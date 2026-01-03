targetScope = 'resourceGroup'

@description('Azure region for all dashboard resources.')
param location string = resourceGroup().location

@description('Prefix used for naming dashboard resources. Keep short; resources have name length limits.')
param namePrefix string = 'tts'

@description('Tags to apply to all dashboard resources.')
param tags object = {}

@description('SKU for the Static Web App.')
@allowed([
  'Free'
  'Standard'
])
param staticWebAppSku string = 'Standard'

@description('SKU for the Web PubSub service.')
@allowed([
  'Free_F1'
  'Standard_S1'
])
param webPubSubSku string = 'Standard_S1'

var normalizedLocation = toLower(location)

// Static Web Apps (Microsoft.Web/staticSites) is not available in every region.
// If the user picked an unsupported region (e.g., eastus), we map to a supported one.
var allowedStaticWebAppLocations = [
  'westus2'
  'centralus'
  'eastus2'
  'westeurope'
  'eastasia'
]

var staticWebAppLocation = contains(allowedStaticWebAppLocations, normalizedLocation)
  ? normalizedLocation
  : (normalizedLocation == 'eastus' ? 'eastus2' : 'centralus')

var uniqueSuffix = uniqueString(resourceGroup().id, namePrefix)
var staticWebAppName = toLower('${namePrefix}-dash-${uniqueSuffix}')
var webPubSubName = toLower('${namePrefix}-wps-${uniqueSuffix}')

module webPubSub 'br/public:avm/res/signal-r-service/web-pub-sub:0.7.2' = {
  params: {
    name: webPubSubName
    location: normalizedLocation
    sku: webPubSubSku
    tags: tags
    // Enable local auth so connection strings / access keys work.
    // The current dashboard API uses `WebPubSubConnectionString`.
    // If/when we move to Entra ID auth, we can flip this back to true.
    disableLocalAuth: false
    // clientCertEnabled remains false by default.
  }
}

module staticWebApp 'br/public:avm/res/web/static-site:0.9.3' = {
  params: {
    name: staticWebAppName
    location: staticWebAppLocation
    sku: staticWebAppSku
    tags: tags
    // Create SWA without a linked repository; deployments can be pushed via SWA CLI.
    provider: 'None'

    // App settings are made available to the SWA runtime (backend API)
    appSettings: {
      NEXT_PUBLIC_WEB_PUBSUB_HOST: webPubSub.outputs.hostName
      NEXT_PUBLIC_WEB_PUBSUB_HUB: 'dashboard'
      // Backend API Settings (Secrets)
      // Note: WebPubSubConnectionString is retrieved via listKeys in the orchestrator or manually for now
      // because AVM modules might not output the keys directly.
      // However, we can set placeholders or if we use a direct resource reference we could get it.
      // For now, we'll set placeholders to ensure the keys exist in the config.
      TTS_API_KEY: ''
      PostgresConnectionString: ''
      WebPubSubConnectionString: '' 
    }
  }
}

@description('Static Web App default hostname (use with https://).')
output staticWebAppDefaultHostname string = staticWebApp.outputs.defaultHostname

@description('Static Web App resource name.')
output staticWebAppName string = staticWebApp.outputs.name

@description('Static Web App resource ID.')
output staticWebAppResourceId string = staticWebApp.outputs.resourceId

@description('Static Web App region actually used for deployment (may differ from the resource group location).')
output staticWebAppLocation string = staticWebAppLocation

@description('Web PubSub host name.')
output webPubSubHostName string = webPubSub.outputs.hostName

@description('Web PubSub resource name.')
output webPubSubName string = webPubSub.outputs.name

@description('Web PubSub resource ID.')
output webPubSubResourceId string = webPubSub.outputs.resourceId
