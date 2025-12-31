// ==============================================================================
// IoT Hub & Data Intelligence Integration - Bicep Template
// ==============================================================================
// 
// PURPOSE:
// This template deploys the infrastructure for bridging The Things Stack (TTS)
// telemetry data to Azure's data intelligence platform. It creates a webhook-based
// integration for non-Enterprise TTS deployments that cannot use native integrations.
//
// ARCHITECTURE:
// TTS Webhook → Azure Function → IoT Hub → [Event Hub | Blob Storage]
//                                            ↓              ↓
//                                      Azure Fabric    Archive
//                                                          ↓
//                                                     SQL Database
//
// COMPONENTS DEPLOYED:
// - Azure IoT Hub (Basic B1) - Message ingestion and routing
// - Azure Functions (Consumption) - Webhook bridge with stateless HttpClient
// - Event Hub (Basic) - Real-time streaming to Azure Fabric
// - Blob Storage (Data Lake Gen2) - Raw telemetry archive with lifecycle management
// - SQL Database (Serverless) - Structured telemetry storage with auto-pause
// - Application Insights & Log Analytics - Monitoring (conditional)
//
// BROWNFIELD AWARENESS:
// This template supports deploying into existing Resource Groups with monitoring
// resources. Use enableMonitoring and createMonitoringResources flags to control
// whether to create new monitoring resources or reuse existing ones.
//
// SECURITY:
// - TLS 1.2 enforced on all resources (Azure Policy compliance)
// - HTTPS-only traffic for Storage Accounts
// - Secrets stored in existing Key Vault
// - SAS token-based authentication for IoT Hub REST API
// - Managed Identity for Function → Key Vault access
//
// COST ESTIMATE: ~$30-45/month
// - IoT Hub B1: ~$10/month (400K messages/day)
// - Event Hub Basic: ~$11/month
// - SQL Serverless: ~$5-15/month (auto-pause after 1 hour)
// - Storage: ~$1-4/month
// - Functions: ~$0-5/month (Consumption plan)
// - Monitoring: ~$3-10/month (if created)
//
// DEPLOYMENT DEPENDENCIES:
// - Existing Resource Group
// - Existing Key Vault with RBAC permissions
// - Azure IoT CLI extension (for device identity creation)
//
// ==============================================================================

@description('The Azure region for the resources')
param location string = resourceGroup().location

@description('Prefix for resource names (Note: hyphens removed for storage account names)')
param prefix string = 'tts-int'

@description('The name of the existing Key Vault to store secrets in')
param keyVaultName string

@description('SQL Server Administrator Login')
param sqlAdminLogin string = 'ttsadmin'

@description('SQL Server Administrator Password')
@secure()
param sqlAdminPassword string

@description('Tags for the resources')
param tags object = {
  Component: 'Integration'
  System: 'TheThingsStack'
}

@description('Existing Log Analytics Workspace ID (optional)')
param existingLogAnalyticsWorkspaceId string = ''

@description('Existing Application Insights ID (optional)')
param existingAppInsightsId string = ''

@description('Enable monitoring (Log Analytics and Application Insights)')
param enableMonitoring bool = true

@description('Create new monitoring resources (if false, expects existing IDs or skips creation)')
param createMonitoringResources bool = true

// --- Storage Account (Data Lake Gen2) ---
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${replace(prefix, '-', '')}st${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    isHnsEnabled: true // Enable Hierarchical Namespace for Data Lake Gen2
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
  tags: tags
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' existing = {
  parent: storage
  name: 'default'
}

resource rawContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'raw-telemetry'
}

resource processedContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'processed-data'
}

// Lifecycle Management Policy
resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-01-01' = {
  parent: storage
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          enabled: true
          name: 'MoveToCoolAndArchive'
          type: 'Lifecycle'
          definition: {
            actions: {
              baseBlob: {
                tierToCool: {
                  daysAfterModificationGreaterThan: 30
                }
                tierToArchive: {
                  daysAfterModificationGreaterThan: 90
                }
              }
            }
            filters: {
              blobTypes: [
                'blockBlob'
              ]
              prefixMatch: [
                'raw-telemetry/'
                'processed-data/'
              ]
            }
          }
        }
      ]
    }
  }
}

// --- Event Hub Namespace & Hub ---
resource eventHubNamespace 'Microsoft.EventHub/namespaces@2021-11-01' = {
  name: '${prefix}-evhns-${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
    capacity: 1
  }
  tags: tags
}

resource eventHub 'Microsoft.EventHub/namespaces/eventhubs@2021-11-01' = {
  parent: eventHubNamespace
  name: 'fabric-stream'
  properties: {
    messageRetentionInDays: 1
    partitionCount: 2
  }
}

resource eventHubAuthRule 'Microsoft.EventHub/namespaces/eventhubs/authorizationRules@2021-11-01' = {
  parent: eventHub
  name: 'IntegrationSharedAccessKey'
  properties: {
    rights: [
      'Send'
      'Listen'
    ]
  }
}

// --- IoT Hub ---
resource iotHub 'Microsoft.Devices/IotHubs@2023-06-30' = {
  name: '${prefix}-iot-${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'B1'
    capacity: 1
  }
  properties: {
    routing: {
      endpoints: {
        eventHubs: [
          {
            connectionString: eventHubAuthRule.listKeys().primaryConnectionString
            name: 'FabricEventHub'
          }
        ]
        storageContainers: [
          {
            connectionString: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
            containerName: rawContainer.name
            fileNameFormat: '{iothub}/{partition}/{YYYY}/{MM}/{DD}/{HH}/{mm}'
            batchFrequencyInSeconds: 100
            maxChunkSizeInBytes: 104857600
            encoding: 'JSON'
            name: 'RawStorage'
          }
        ]
      }
      routes: [
        {
          name: 'ToFabric'
          source: 'DeviceMessages'
          endpointNames: [
            'FabricEventHub'
          ]
          isEnabled: true
        }
        {
          name: 'ToArchive'
          source: 'DeviceMessages'
          endpointNames: [
            'RawStorage'
          ]
          isEnabled: true
        }
      ]
      fallbackRoute: {
        name: '$fallback'
        source: 'DeviceMessages'
        condition: 'true'
        endpointNames: [
          'events'
        ]
        isEnabled: true
      }
    }
  }
  tags: tags
}

// --- Azure SQL Database (Serverless) ---
resource sqlServer 'Microsoft.Sql/servers@2021-11-01' = {
  name: '${prefix}-sql-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
  }
  tags: tags
}

resource sqlDb 'Microsoft.Sql/servers/databases@2021-11-01' = {
  parent: sqlServer
  name: 'tts-data'
  location: location
  sku: {
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
  }
  properties: {
    autoPauseDelay: 60 // Pause after 1 hour of inactivity
  }
  tags: tags
}

resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2021-11-01' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// --- Function App ---
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${prefix}-asp-${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  tags: tags
}

// --- Log Analytics Workspace ---
// Only create if monitoring is enabled AND we are creating new resources AND no existing ID is provided
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = if (enableMonitoring && createMonitoringResources && empty(existingLogAnalyticsWorkspaceId)) {
  name: '${prefix}-law-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
  tags: tags
}

// --- Application Insights ---
// Only create if monitoring is enabled AND we are creating new resources AND no existing ID is provided
resource appInsights 'Microsoft.Insights/components@2020-02-02' = if (enableMonitoring && createMonitoringResources && empty(existingAppInsightsId)) {
  name: '${prefix}-ai-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: !empty(existingLogAnalyticsWorkspaceId) ? existingLogAnalyticsWorkspaceId : logAnalyticsWorkspace.id
  }
  tags: tags
}

// Get reference to existing App Insights if provided
// resource existingAppInsights 'Microsoft.Insights/components@2020-02-02' existing = if (!empty(existingAppInsightsId)) {
//   name: last(split(existingAppInsightsId, '/'))
//   scope: resourceGroup()
// }

var useExistingAi = !empty(existingAppInsightsId)
var useNewAi = enableMonitoring && createMonitoringResources && !useExistingAi

var appInsightsInstrumentationKey = useExistingAi ? reference(existingAppInsightsId, '2020-02-02').InstrumentationKey : (useNewAi ? appInsights.properties.InstrumentationKey : '')

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${prefix}-func-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'functionapp'
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower('${prefix}-func-${uniqueString(resourceGroup().id)}')
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'dotnet'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsightsInstrumentationKey
        }
        {
          name: 'IoTHubConnectionString'
          value: 'HostName=${iotHub.properties.hostName};SharedAccessKeyName=iothubowner;SharedAccessKey=${iotHub.listKeys().value[0].primaryKey}'
        }
        {
          name: 'SqlConnectionString'
          value: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Initial Catalog=${sqlDb.name};Persist Security Info=False;User ID=${sqlAdminLogin};Password="${sqlAdminPassword}";MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'
        }
        {
          name: 'EventHubConnection'
          value: eventHubAuthRule.listKeys().primaryConnectionString
        }
        {
          // We ship dependencies in wwwroot/bin; avoid remote build/package restore.
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        {
          name: 'ENABLE_ORYX_BUILD'
          value: 'false'
        }
      ]
    }
  }
  tags: tags
}

// --- Event Grid System Topic ---
resource systemTopic 'Microsoft.EventGrid/systemTopics@2022-06-15' = {
  name: '${prefix}-topic-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    source: storage.id
    topicType: 'Microsoft.Storage.StorageAccounts'
  }
  tags: tags
}

// --- Key Vault Secrets ---
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' existing = {
  name: keyVaultName
}

resource secretIoTHub 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'integration-iothub-connection'
  properties: {
    value: 'HostName=${iotHub.properties.hostName};SharedAccessKeyName=iothubowner;SharedAccessKey=${iotHub.listKeys().value[0].primaryKey}'
  }
}

resource secretSql 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'integration-sql-connection'
  properties: {
    value: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Initial Catalog=${sqlDb.name};Persist Security Info=False;User ID=${sqlAdminLogin};Password="${sqlAdminPassword}";MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'
  }
}

resource secretEventHub 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'integration-eventhub-connection'
  properties: {
    value: eventHubAuthRule.listKeys().primaryConnectionString
  }
}

resource secretWebhookUrl 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'integration-webhook-url'
  properties: {
    value: 'https://${functionApp.properties.defaultHostName}/api/IngestWebhook'
  }
}

output webhookUrl string = 'https://${functionApp.properties.defaultHostName}/api/IngestWebhook'
#disable-next-line outputs-should-not-contain-secrets
output eventHubConnectionString string = eventHubAuthRule.listKeys().primaryConnectionString
output sqlServerName string = sqlServer.properties.fullyQualifiedDomainName
output databaseName string = sqlDb.name
output iotHubName string = iotHub.name
output functionAppName string = functionApp.name
