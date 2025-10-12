// ============================================================================
// The Things Stack - Azure Kubernetes Service (AKS) Deployment
// Production-grade Kubernetes deployment with high availability
// ============================================================================

@description('The deployment region')
param location string = resourceGroup().location

@description('Environment name for resource naming')
param environmentName string = 'tts-aks-prod'

@description('AKS cluster name')
param aksClusterName string = '${environmentName}-aks'

@description('Number of nodes in the default node pool')
@minValue(1)
@maxValue(100)
param nodeCount int = 3

@description('VM size for cluster nodes')
param nodeSize string = 'Standard_D4s_v3'

@description('Kubernetes version')
param kubernetesVersion string = '1.28'

@description('Admin email for certificates and notifications')
param adminEmail string

@description('Database admin password')
@secure()
param dbAdminPassword string

@description('TTS admin password for console access')
@secure()
param ttsAdminPassword string

@description('Key Vault name for secrets management')
param keyVaultName string

@description('Azure Container Registry name')
param acrName string

@description('Enable Azure Monitor for containers')
param enableMonitoring bool = true

@description('Enable auto-scaling')
param enableAutoScaling bool = true

@description('Minimum node count for auto-scaling')
param minNodeCount int = 2

@description('Maximum node count for auto-scaling')
param maxNodeCount int = 10

// ============================================================================
// VARIABLES
// ============================================================================

var vnetName = '${environmentName}-vnet'
var aksSubnetName = 'aks-subnet'
var dbSubnetName = 'db-subnet'
var nsgName = '${environmentName}-nsg'
var dbServerName = '${environmentName}-db-${uniqueString(resourceGroup().id)}'
var logAnalyticsName = '${environmentName}-logs'
var appInsightsName = '${environmentName}-appinsights'

// ============================================================================
// LOG ANALYTICS WORKSPACE
// ============================================================================

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ============================================================================
// NETWORKING
// ============================================================================

resource nsg 'Microsoft.Network/networkSecurityGroups@2023-05-01' = {
  name: nsgName
  location: location
  properties: {
    securityRules: [
      {
        name: 'AllowHTTPS'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '443'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'AllowHTTP'
        properties: {
          priority: 110
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '80'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'AllowLoRaWANUDP'
        properties: {
          priority: 120
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Udp'
          sourcePortRange: '*'
          destinationPortRange: '1700'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'AllowGRPC'
        properties: {
          priority: 130
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRanges: [
            '1881'
            '1882'
            '1883'
            '1884'
            '1885'
            '1886'
            '1887'
          ]
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.0.0/16'
      ]
    }
    subnets: [
      {
        name: aksSubnetName
        properties: {
          addressPrefix: '10.0.0.0/22'
          networkSecurityGroup: {
            id: nsg.id
          }
        }
      }
      {
        name: dbSubnetName
        properties: {
          addressPrefix: '10.0.4.0/24'
          delegations: [
            {
              name: 'PostgreSQLFlexibleServerDelegation'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
        }
      }
    ]
  }
}

// ============================================================================
// AZURE CONTAINER REGISTRY
// ============================================================================

resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: acrName
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
  }
}

// ============================================================================
// AKS CLUSTER
// ============================================================================

resource aks 'Microsoft.ContainerService/managedClusters@2023-10-01' = {
  name: aksClusterName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    kubernetesVersion: kubernetesVersion
    dnsPrefix: aksClusterName
    enableRBAC: true
    agentPoolProfiles: [
      {
        name: 'nodepool1'
        count: nodeCount
        vmSize: nodeSize
        osType: 'Linux'
        mode: 'System'
        enableAutoScaling: enableAutoScaling
        minCount: enableAutoScaling ? minNodeCount : null
        maxCount: enableAutoScaling ? maxNodeCount : null
        vnetSubnetID: vnet.properties.subnets[0].id
        maxPods: 110
        type: 'VirtualMachineScaleSets'
        availabilityZones: [
          '1'
          '2'
          '3'
        ]
      }
    ]
    networkProfile: {
      networkPlugin: 'azure'
      networkPolicy: 'azure'
      serviceCidr: '10.1.0.0/16'
      dnsServiceIP: '10.1.0.10'
      loadBalancerSku: 'Standard'
    }
    addonProfiles: enableMonitoring ? {
      omsagent: {
        enabled: true
        config: {
          logAnalyticsWorkspaceResourceID: logAnalytics.id
        }
      }
      azurePolicy: {
        enabled: true
      }
    } : {}
  }
}

// Grant AKS pull access to ACR
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, aks.id, 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull role
    principalId: aks.properties.identityProfile.kubeletidentity.objectId
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// POSTGRESQL DATABASE
// ============================================================================

resource dbServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: dbServerName
  location: location
  sku: {
    name: 'Standard_D4s_v3'
    tier: 'GeneralPurpose'
  }
  properties: {
    version: '15'
    administratorLogin: 'ttsadmin'
    administratorLoginPassword: dbAdminPassword
    storage: {
      storageSizeGB: 128
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Enabled'
    }
    highAvailability: {
      mode: 'ZoneRedundant'
      standbyAvailabilityZone: '2'
    }
    network: {
      delegatedSubnetResourceId: vnet.properties.subnets[1].id
      privateDnsZoneArmResourceId: privateDnsZone.id
    }
  }
  dependsOn: [
    privateDnsZoneVnetLink
  ]
}

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.postgres.database.azure.com'
  location: 'global'
}

resource privateDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: privateDnsZone
  name: '${vnetName}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

resource ttsDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: dbServer
  name: 'tts'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// ============================================================================
// KEY VAULT
// ============================================================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enabledForTemplateDeployment: true
    enabledForDeployment: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// Grant AKS access to Key Vault
resource kvSecretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, aks.id, 'secrets-user')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: aks.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Store secrets in Key Vault
resource dbPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'db-password'
  properties: {
    value: dbAdminPassword
  }
}

resource ttsAdminPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'tts-admin-password'
  properties: {
    value: ttsAdminPassword
  }
}

resource adminEmailSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'admin-email'
  properties: {
    value: adminEmail
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

output aksClusterName string = aks.name
output aksResourceId string = aks.id
output aksApiServerAddress string = aks.properties.fqdn
output aksNodeResourceGroup string = aks.properties.nodeResourceGroup

output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer

output databaseHost string = dbServer.properties.fullyQualifiedDomainName
output databaseName string = ttsDatabase.name

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri

output logAnalyticsWorkspaceId string = logAnalytics.id
output applicationInsightsConnectionString string = appInsights.properties.ConnectionString

output vnetId string = vnet.id
output aksSubnetId string = vnet.properties.subnets[0].id

output clusterInfo object = {
  name: aks.name
  resourceId: aks.id
  fqdn: aks.properties.fqdn
  kubernetesVersion: aks.properties.kubernetesVersion
  nodeCount: nodeCount
  nodeSize: nodeSize
}

output nextSteps array = [
  'Configure kubectl: az aks get-credentials -g ${resourceGroup().name} -n ${aks.name}'
  'Deploy TTS Helm chart: helm install tts ./charts/thethingsstack'
  'Configure ingress controller with TLS'
  'Set up DNS for your domain'
  'Configure monitoring and alerts'
]
