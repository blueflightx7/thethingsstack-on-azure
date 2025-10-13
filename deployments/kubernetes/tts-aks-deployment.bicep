// ============================================================================
// The Things Stack - Azure Kubernetes Service (AKS) Deployment
// Production-grade Kubernetes deployment with high availability
// ============================================================================

@description('The deployment region')
param location string = resourceGroup().location

@description('Environment name for resource naming')
param environmentName string

@description('Admin email for certificates and notifications')
param adminEmail string

@description('Database admin password')
@secure()
param databasePassword string

@description('TTS admin password for console access')
@secure()
param ttsAdminPassword string

@description('Cookie hash key (64 hex characters)')
@secure()
param cookieHashKey string

@description('Cookie block key (64 hex characters)')
@secure()
param cookieBlockKey string

@description('Cluster keys (base64-encoded)')
@secure()
param clusterKeys string

@description('Use Azure Cache for Redis Enterprise instead of in-cluster')
param useRedisEnterprise bool = true

// ============================================================================
// VARIABLES
// ============================================================================

var aksClusterName = '${environmentName}-aks'
var vnetName = '${environmentName}-vnet'
var aksSubnetName = 'aks-subnet'
var dbSubnetName = 'db-subnet'
var nsgName = '${environmentName}-nsg'
var dbServerName = '${environmentName}-db-${uniqueString(resourceGroup().id)}'
var keyVaultName = '${environmentName}-kv'
var redisName = '${environmentName}-redis'
var acrName = '${environmentName}${uniqueString(resourceGroup().id)}'
var workloadIdentityName = 'id-tts-${environmentName}'
var logAnalyticsName = '${environmentName}-logs'

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
// AKS CLUSTER (AUTOMATIC MODE)
// ============================================================================

resource aks 'Microsoft.ContainerService/managedClusters@2024-05-02-preview' = {
  name: aksClusterName
  location: location
  sku: {
    name: 'Automatic'
    tier: 'Standard'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    dnsPrefix: aksClusterName
    enableRBAC: true
    oidcIssuerProfile: {
      enabled: true
    }
    securityProfile: {
      workloadIdentity: {
        enabled: true
      }
    }
    nodeProvisioningProfile: {
      mode: 'Auto'
    }
    networkProfile: {
      networkPlugin: 'azure'
      networkDataplane: 'azure'
      networkPolicy: 'azure'
      serviceCidr: '10.1.0.0/16'
      dnsServiceIP: '10.1.0.10'
      loadBalancerSku: 'standard'
    }
    ingressProfile: {
      webAppRouting: {
        enabled: true
      }
    }
    azureMonitorProfile: {
      metrics: {
        enabled: true
      }
    }
    addonProfiles: {
      omsagent: {
        enabled: true
        config: {
          logAnalyticsWorkspaceResourceID: logAnalytics.id
        }
      }
    }
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
    administratorLoginPassword: databasePassword
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
    value: databasePassword
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

resource cookieHashKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cookie-hash-key'
  properties: {
    value: cookieHashKey
  }
}

resource cookieBlockKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cookie-block-key'
  properties: {
    value: cookieBlockKey
  }
}

resource clusterKeysSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cluster-keys'
  properties: {
    value: clusterKeys
  }
}

// ============================================================================
// STORAGE ACCOUNT
// ============================================================================

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'sttts${take(uniqueString(resourceGroup().id), 18)}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

var containerNames = ['avatars', 'pictures', 'uploads']
resource containers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = [for name in containerNames: {
  parent: blobService
  name: name
  properties: {
    publicAccess: 'None'
  }
}]

// ============================================================================
// WORKLOAD IDENTITY
// ============================================================================

resource workloadIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: workloadIdentityName
  location: location
}

resource federatedCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: workloadIdentity
  name: 'tts-workload-id'
  properties: {
    audiences: ['api://AzureADTokenExchange']
    issuer: aks.properties.oidcIssuerProfile.issuerURL
    subject: 'system:serviceaccount:tts:tts'
  }
}

// Role assignments for Workload Identity
resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, workloadIdentity.id, 'StorageBlobDataContributor')
  properties: {
    principalId: workloadIdentity.properties.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalType: 'ServicePrincipal'
  }
}

resource kvSecretsUserRoleWorkload 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, workloadIdentity.id, 'KeyVaultSecretsUser')
  properties: {
    principalId: workloadIdentity.properties.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// REDIS ENTERPRISE (CONDITIONAL)
// ============================================================================

resource redisEnterprise 'Microsoft.Cache/redisEnterprise@2023-11-01' = if (useRedisEnterprise) {
  name: redisName
  location: location
  sku: {
    name: 'Enterprise_E10'
    capacity: 2
  }
  zones: ['1', '2', '3']
  properties: {
    minimumTlsVersion: '1.2'
  }
}

resource redisDatabase 'Microsoft.Cache/redisEnterprise/databases@2023-11-01' = if (useRedisEnterprise) {
  parent: redisEnterprise
  name: 'default'
  properties: {
    clusteringPolicy: 'OSSCluster'
    evictionPolicy: 'NoEviction'
    port: 10000
  }
}

resource redisPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (useRedisEnterprise) {
  parent: keyVault
  name: 'redis-password'
  properties: {
    value: listKeys(resourceId('Microsoft.Cache/redisEnterprise/databases', redisName, 'default'), '2023-11-01').primaryKey
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

output postgresHost string = dbServer.properties.fullyQualifiedDomainName
output databaseName string = ttsDatabase.name

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri

output storageAccountName string = storageAccount.name
output workloadIdentityClientId string = workloadIdentity.properties.clientId
output tenantId string = subscription().tenantId

output redisHost string = useRedisEnterprise ? '${reference(resourceId('Microsoft.Cache/redisEnterprise', redisName), '2023-11-01').hostName}:10000' : ''

output logAnalyticsWorkspaceId string = logAnalytics.id

output vnetId string = vnet.id
output aksSubnetId string = vnet.properties.subnets[0].id

output nextSteps array = [
  'Get kubectl credentials: az aks get-credentials -g ${resourceGroup().name} -n ${aks.name}'
  'Install cert-manager: kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml'
  'Deploy TTS Helm chart: helm upgrade --install tts oci://registry-1.docker.io/thethingsindustries/lorawan-stack-helm-chart --version 3.30.2 -n tts'
  'Create DNS A record pointing to ingress IP'
  'Configure monitoring and alerts in Azure Monitor'
]
