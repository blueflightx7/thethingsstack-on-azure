// ============================================================================
// Azure Container Registry (ACR) Module
// Shared registry for VM and AKS deployments
// ============================================================================

@description('The deployment region')
param location string = resourceGroup().location

@description('Environment name for resource naming')
param environmentName string

@description('ACR SKU (Premium required for Tasks, Defender, Content Trust)')
@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param acrSku string = 'Premium'

@description('Enable Microsoft Defender for Container Registry scanning')
param enableDefender bool = true  // Note: Defender enabled at subscription level, not resource level

@description('Enable geo-replication (Premium only)')
param enableGeoReplication bool = false

@description('Secondary region for geo-replication')
param geoReplicationLocation string = 'eastus'

@description('Tags to apply to resources')
param tags object = {}

// ============================================================================
// VARIABLES
// ============================================================================

var resourceToken = uniqueString(subscription().id, resourceGroup().id, location)
var acrName = '${replace(environmentName, '-', '')}acr${resourceToken}'  // Must be alphanumeric only

// ============================================================================
// AZURE CONTAINER REGISTRY
// ============================================================================

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: acrSku
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    adminUserEnabled: false  // Use managed identity instead
    publicNetworkAccess: 'Enabled'
    networkRuleBypassOptions: 'AzureServices'
    zoneRedundancy: acrSku == 'Premium' ? 'Enabled' : 'Disabled'
    policies: {
      quarantinePolicy: {
        status: acrSku == 'Premium' ? 'enabled' : 'disabled'  // Quarantine vulnerable images
      }
      retentionPolicy: {
        days: 30
        status: 'enabled'  // Auto-delete untagged manifests after 30 days
      }
      trustPolicy: {
        type: 'Notary'
        status: acrSku == 'Premium' ? 'enabled' : 'disabled'  // Content trust for signed images
      }
      exportPolicy: {
        status: 'enabled'  // Allow image exports
      }
    }
  }
}

// ============================================================================
// GEO-REPLICATION (Optional - Premium only)
// ============================================================================

resource acrReplication 'Microsoft.ContainerRegistry/registries/replications@2023-07-01' = if (enableGeoReplication && acrSku == 'Premium') {
  parent: acr
  name: geoReplicationLocation
  location: geoReplicationLocation
  properties: {
    regionEndpointEnabled: true
    zoneRedundancy: 'Enabled'
  }
}

// ============================================================================
// DEFENDER FOR CONTAINERS (Optional)
// ============================================================================

// Note: Microsoft Defender must be enabled at subscription level
// This is a placeholder - actual enablement done via Azure Portal or Policy
// Reference: https://learn.microsoft.com/azure/defender-for-cloud/defender-for-containers-enable

// ============================================================================
// WEBHOOKS (For deployment notifications)
// ============================================================================

resource acrWebhookVM 'Microsoft.ContainerRegistry/registries/webhooks@2023-07-01' = {
  parent: acr
  name: 'vmDeployment'
  location: location
  properties: {
    status: 'enabled'
    scope: 'thethingsstack:*'  // Trigger on any TTS image tag
    actions: [
      'push'
    ]
    serviceUri: ''  // To be configured post-deployment with VM webhook URL
  }
}

resource acrWebhookAKS 'Microsoft.ContainerRegistry/registries/webhooks@2023-07-01' = {
  parent: acr
  name: 'aksDeployment'
  location: location
  properties: {
    status: 'disabled'  // Enable when AKS deployed
    scope: 'thethingsstack:*'
    actions: [
      'push'
    ]
    serviceUri: ''  // To be configured with Flux CD webhook
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('ACR resource ID')
output acrId string = acr.id

@description('ACR name')
output acrName string = acr.name

@description('ACR login server')
output acrLoginServer string = acr.properties.loginServer

@description('ACR principal ID (for role assignments)')
output acrPrincipalId string = acr.identity.principalId

@description('VM webhook name (update serviceUri post-deployment)')
output vmWebhookName string = acrWebhookVM.name

@description('AKS webhook name (update serviceUri post-deployment)')
output aksWebhookName string = acrWebhookAKS.name

@description('ACR pull command example')
output acrPullCommand string = 'docker pull ${acr.properties.loginServer}/thethingsstack:latest'

@description('Cost estimate (monthly)')
output costEstimate string = acrSku == 'Premium' ? '$165 (Premium) + $5 (Tasks) + $30 (Defender) = ~$200/month' : acrSku == 'Standard' ? '~$65/month' : '~$15/month'
