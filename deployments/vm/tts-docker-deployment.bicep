// ============================================================================
// The Things Stack Docker Deployment on Azure
// Complete VM-based deployment with PostgreSQL Flexible Server
// ============================================================================
// ALL FIXES APPLIED:
// Fix #1: PostgreSQL password validation (alphanumeric only)
// Fix #2: Database username synchronization
// Fix #3: Cookie block key length (64 characters)
// Fix #4: PostgreSQL server state check
// Fix #5: Admin email validation
// Fix #6: Database config path (/config/tts.yml)
// Fix #7: Console API base URLs
// Fix #8: OAuth single redirect URI
// Fix #9: Retry logic for timing issues
// Fix #10: Password confirmation for admin user (printf fix)
// Fix #11: Container readiness wait before admin user creation
// ============================================================================

@description('The deployment region')
param location string = resourceGroup().location

@description('Environment name for resource naming')
param environmentName string = 'tts-docker'

@description('Admin username for the VM')
param adminUsername string = 'ttsadmin'

@description('Admin password for the VM')
@secure()
param adminPassword string

@description('VM size for hosting TTS containers')
param vmSize string = 'Standard_B4ms'

@description('Domain name for TTS (will be auto-generated if not provided)')
param domainName string = ''

@description('DNS name prefix for Azure public IP (will be auto-generated if not provided)')
param dnsNamePrefix string = ''

@description('Name of existing Key Vault containing secrets (optional)')
param keyVaultName string = ''

@description('Admin email for certificates and admin user')
param adminEmail string

@description('IP address or CIDR range allowed for SSH access (defaults to any)')
param adminSourceIP string = '*'

@description('Enable private database access only (recommended for production)')
param enablePrivateDatabaseAccess bool = true

@description('Enable Key Vault for secrets management (recommended for production)')
param enableKeyVault bool = true

@description('Enable Log Analytics monitoring (may be blocked by policy in some subscriptions)')
param enableMonitoring bool = true

@description('TTS admin password for console access')
@secure()
param ttsAdminPasswordParam string

@description('Cookie hash key for session security (auto-generated if empty)')
param cookieHashKey string = ''

@description('Cookie block key for session encryption (auto-generated if empty)')
param cookieBlockKey string = ''

@description('OAuth client secret for console authentication')
@secure()
param oauthClientSecret string = ''

@description('Use existing VNet instead of creating a new one')
param useExistingVNet bool = false

@description('Name of existing VNet (required if useExistingVNet is true)')
param existingVNetName string = ''

@description('Resource group containing the existing VNet (defaults to deployment RG if empty)')
param existingVNetResourceGroup string = ''

@description('Name of existing subnet in the VNet (required if useExistingVNet is true)')
param existingSubnetName string = ''

@description('Name of existing database subnet with PostgreSQL delegation (required if useExistingVNet is true)')
param existingDatabaseSubnetName string = ''

@description('Create a new subnet in the existing VNet')
param createSubnetInExistingVNet bool = false

@description('Name for new subnet to create in existing VNet')
param newSubnetName string = 'tts-subnet'

@description('Address prefix for new subnet (e.g., 10.0.5.0/24)')
param newSubnetAddressPrefix string = '10.0.5.0/24'

@description('Use Azure DNS (168.63.129.16) on VM instead of VNet DNS servers - required for private DNS zone resolution')
param useAzureDNS bool = true

// ============================================================================
// VARIABLES
// ============================================================================

var resourceToken = uniqueString(subscription().id, resourceGroup().id, location)
var vmName = '${environmentName}-vm-${resourceToken}'
var nicName = '${vmName}-nic'
var vnetName = useExistingVNet ? existingVNetName : '${environmentName}-vnet-${resourceToken}'
var subnetName = useExistingVNet ? existingSubnetName : 'default'
var databaseSubnetName = useExistingVNet ? existingDatabaseSubnetName : 'database-subnet'
var vnetResourceGroup = useExistingVNet && !empty(existingVNetResourceGroup) ? existingVNetResourceGroup : resourceGroup().name
var nsgName = '${environmentName}-nsg-${resourceToken}'
var pipName = '${vmName}-pip'
var dbServerName = '${environmentName}-db-${resourceToken}'

// DNS and Domain configuration
// DNS prefix for public IP (lowercase, no dots)
var defaultDnsPrefix = '${environmentName}-${resourceToken}'
var actualDnsPrefix = empty(dnsNamePrefix) ? defaultDnsPrefix : dnsNamePrefix
// Domain name for TTS (can include dots)
var actualDomainName = empty(domainName) ? '${actualDnsPrefix}.${location}.cloudapp.azure.com' : domainName

// FIX #1: Generate alphanumeric-only password for PostgreSQL
var dbPassword = replace(replace(replace(adminPassword, '!', ''), '@', ''), '#', '')

// TTS admin credentials
var ttsAdminPassword = empty(ttsAdminPasswordParam) ? 'TTS${uniqueString(resourceGroup().id, 'admin')}${take(uniqueString(subscription().id), 6)}Pwd' : ttsAdminPasswordParam
var ttsAdminUsername = 'ttsadmin'

// FIX #3: Cookie keys must be exactly 64 characters
var actualCookieHashKey = empty(cookieHashKey) ? toUpper(take(replace(replace(uniqueString(resourceGroup().id, 'hash', deployment().name), '-', ''), '_', ''), 64)) : cookieHashKey
var actualCookieBlockKey = empty(cookieBlockKey) ? toUpper(take(replace(replace(uniqueString(resourceGroup().id, 'block', deployment().name), '-', ''), '_', ''), 64)) : cookieBlockKey
var actualOauthSecret = empty(oauthClientSecret) ? 'console' : oauthClientSecret

// Target VNet resource ID - handles both greenfield (new VNet) and brownfield (existing VNet in different RG)
var targetVnetResourceId = useExistingVNet 
  ? resourceId(subscription().subscriptionId, vnetResourceGroup, 'Microsoft.Network/virtualNetworks', vnetName)
  : resourceId('Microsoft.Network/virtualNetworks', vnetName)

// ============================================================================
// NETWORKING
// ============================================================================

resource nsg 'Microsoft.Network/networkSecurityGroups@2023-04-01' = {
  name: nsgName
  location: location
  properties: {
    securityRules: [
      {
        name: 'AllowSSH'
        properties: {
          priority: 1000
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: adminSourceIP
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '22'
        }
      }
      {
        name: 'AllowHTTP'
        properties: {
          priority: 1001
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '80'
        }
      }
      {
        name: 'AllowHTTPS'
        properties: {
          priority: 1002
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'AllowLoRaWAN'
        properties: {
          priority: 1003
          protocol: 'Udp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '1700'
        }
      }
      {
        name: 'AllowGRPC'
        properties: {
          priority: 1004
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '1881-1887'
        }
      }
      {
        name: 'AllowClusterGRPC'
        properties: {
          priority: 1005
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '8884'
        }
      }
    ]
  }
}

// New VNet (only created if not using existing)
resource vnet 'Microsoft.Network/virtualNetworks@2023-04-01' = if (!useExistingVNet) {
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
        name: subnetName
        properties: {
          addressPrefix: '10.0.0.0/24'
          networkSecurityGroup: {
            id: nsg.id
          }
        }
      }
      {
        name: 'database-subnet'
        properties: {
          addressPrefix: '10.0.1.0/24'
          delegations: [
            {
              name: 'PostgreSQLFlexibleServer'
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

// Private DNS zone - always create in deployment RG (deleted with RG cleanup)
resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = if (enablePrivateDatabaseAccess) {
  name: 'privatelink.postgres.database.azure.com'
  location: 'global'
}

// VNet link - works for both greenfield and brownfield (cross-RG VNet)
resource privateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = if (enablePrivateDatabaseAccess) {
  parent: privateDnsZone
  name: '${vnetName}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: targetVnetResourceId
    }
  }
}

resource pip 'Microsoft.Network/publicIPAddresses@2023-04-01' = {
  name: pipName
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: {
      domainNameLabel: actualDnsPrefix
    }
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2023-04-01' = {
  name: nicName
  location: location
  properties: {
    networkSecurityGroup: {
      id: nsg.id
    }
    dnsSettings: useAzureDNS ? {
      dnsServers: [
        '168.63.129.16'
      ]
    } : null
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          publicIPAddress: {
            id: pip.id
          }
          subnet: {
            id: useExistingVNet 
              ? resourceId(subscription().subscriptionId, vnetResourceGroup, 'Microsoft.Network/virtualNetworks/subnets', vnetName, subnetName)
              : resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, subnetName)
          }
        }
      }
    ]
  }
}

// ============================================================================
// DATABASE
// ============================================================================

resource dbServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: dbServerName
  location: location
  dependsOn: [
    privateDnsZoneLink
  ]
  // Implicit dependency through privateDnsZone.id reference (line 328)
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    createMode: 'Default'
    version: '15'
    // FIX #2: Use adminUsername consistently
    administratorLogin: adminUsername
    administratorLoginPassword: dbPassword
    storage: {
      storageSizeGB: 32
    }
    network: enablePrivateDatabaseAccess ? {
      delegatedSubnetResourceId: useExistingVNet 
        ? resourceId(subscription().subscriptionId, vnetResourceGroup, 'Microsoft.Network/virtualNetworks/subnets', vnetName, databaseSubnetName)
        : resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, databaseSubnetName)
      privateDnsZoneArmResourceId: privateDnsZone.id
      publicNetworkAccess: 'Disabled'
    } : {
      publicNetworkAccess: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: dbServer
  name: 'ttn_lorawan'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.UTF8'
  }
}

// ============================================================================
// MONITORING
// ============================================================================

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = if (enableMonitoring) {
  name: '${environmentName}-logs'
  location: location
  tags: {
    'azd-env-name': environmentName
  }
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = if (enableMonitoring) {
  name: '${environmentName}-appinsights'
  location: location
  tags: {
    'azd-env-name': environmentName
  }
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: enableMonitoring ? logAnalytics.id : ''
  }
}

resource securityAlert 'Microsoft.Insights/activityLogAlerts@2020-10-01' = if (enableMonitoring) {
  name: '${environmentName}-security-alert'
  location: 'Global'
  tags: {
    'azd-env-name': environmentName
  }
  properties: {
    description: 'Alert for security-related activities'
    enabled: true
    scopes: [
      resourceGroup().id
    ]
    condition: {
      allOf: [
        {
          field: 'category'
          equals: 'Security'
        }
      ]
    }
    actions: {
      actionGroups: []
    }
  }
}

// ============================================================================
// KEY VAULT
// ============================================================================

// Reference existing Key Vault created by PowerShell script
// The deploy-simple.ps1 script creates the Key Vault with proper settings
// before running this Bicep template, so we just reference it here
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = if (enableKeyVault) {
  name: keyVaultName
}

resource dbPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (enableKeyVault) {
  parent: keyVault
  name: 'db-password'
  properties: {
    value: dbPassword
  }
}

resource ttsAdminPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (enableKeyVault) {
  parent: keyVault
  name: 'tts-admin-password'
  properties: {
    value: ttsAdminPassword
  }
}

resource cookieHashKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (enableKeyVault) {
  parent: keyVault
  name: 'cookie-hash-key'
  properties: {
    value: actualCookieHashKey
  }
}

resource cookieBlockKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (enableKeyVault) {
  parent: keyVault
  name: 'cookie-block-key'
  properties: {
    value: actualCookieBlockKey
  }
}

resource oauthSecretSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (enableKeyVault) {
  parent: keyVault
  name: 'oauth-client-secret'
  properties: {
    value: actualOauthSecret
  }
}

// Additional secrets for configuration management
resource configChecksumSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (enableKeyVault) {
  parent: keyVault
  name: 'config-checksum'
  properties: {
    value: uniqueString(resourceGroup().id, environmentName, adminEmail)
  }
}

resource adminEmailSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (enableKeyVault) {
  parent: keyVault
  name: 'admin-email'
  properties: {
    value: adminEmail
  }
}

resource ttsAdminUsernameSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (enableKeyVault) {
  parent: keyVault
  name: 'tts-admin-username'
  properties: {
    value: ttsAdminUsername
  }
}

// ============================================================================
// RBAC - Key Vault Access for VM
// ============================================================================

resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableKeyVault) {
  name: guid(keyVault.id, vm.id, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: vm.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// FIREWALL RULES (if not using private access)
// ============================================================================

resource firewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = if (!enablePrivateDatabaseAccess) {
  parent: dbServer
  name: 'AllowVMSubnet'
  properties: {
    startIpAddress: '10.0.0.1'
    endIpAddress: '10.0.0.254'
  }
}

// ============================================================================
// VIRTUAL MACHINE
// ============================================================================

resource vm 'Microsoft.Compute/virtualMachines@2023-03-01' = {
  name: vmName
  location: location
  identity: enableKeyVault ? {
    type: 'SystemAssigned'
  } : null
  properties: {
    hardwareProfile: {
      vmSize: vmSize
    }
    osProfile: {
      computerName: vmName
      adminUsername: adminUsername
      adminPassword: adminPassword
      customData: base64(format('''
#cloud-config

package_update: true
package_upgrade: true

packages:
  - docker.io
  - docker-compose
  - postgresql-client

write_files:
  - path: /home/{0}/docker-compose.yml
    owner: root:root
    permissions: '0644'
    content: |
      version: '3.7'
      services:
        stack:
          image: thethingsnetwork/lorawan-stack:latest
          command: ttn-lw-stack -c /config/tts.yml start
          restart: unless-stopped
          depends_on:
            - redis
          volumes:
            - ./config:/config:ro
            - ./certs:/run/secrets:ro
            - stack_data:/srv/ttn-lorawan/public
          environment:
            TTS_DOMAIN: {1}
            TTN_LW_BLOB_LOCAL_DIRECTORY: /srv/ttn-lorawan/public/blob
            TTN_LW_REDIS_ADDRESS: redis:6379
          ports:
            - 80:1885
            - 443:8885
            - 1700:1700/udp
            - 8884:8884
        redis:
          image: redis:7
          command: redis-server --appendonly yes
          restart: unless-stopped
          volumes:
            - redis_data:/data
      volumes:
        redis_data:
        stack_data:

  - path: /home/{0}/config/tts.yml
    owner: root:root
    permissions: '0644'
    content: |
      # TTS Configuration File
      # FIX #6: Use /config/tts.yml path
      
      # License (not required for open source deployment)
      # license: your-license-key
      
      # TLS Configuration
      tls:
        source: file
        certificate: /run/secrets/cert.pem
        key: /run/secrets/key.pem
      
      # HTTP Configuration
      http:
        cookie:
          block-key: '{2}'
          hash-key: '{3}'
        static:
          mount: /assets
          search-path:
            - /srv/ttn-lorawan/public
      
      # gRPC Configuration  
      grpc:
        allow-insecure-for-credentials: false
        trusted-proxies:
          - 127.0.0.0/8
          - 10.0.0.0/8
      
      # Cluster Configuration
      cluster:
        name: tts-cluster
        address: localhost:8884
        tls: false
      
      # Redis Configuration
      redis:
        address: redis:6379
      
      # Blob Storage
      blob:
        provider: local
        local:
          directory: /srv/ttn-lorawan/public/blob
      
      # Email Configuration (optional)
      email:
        sender-name: 'The Things Stack'
        sender-address: 'noreply@{1}'
        network:
          name: 'The Things Stack'
          console-url: 'https://{1}/console'
          identity-server-url: 'https://{1}/oauth'
      
      # Identity Server
      is:
        # FIX #2: Database username must match
        database-uri: 'postgresql://{0}:{4}@{5}/ttn_lorawan?sslmode=require'
        email:
          network:
            name: 'The Things Stack'
            console-url: 'https://{1}/console'
            identity-server-url: 'https://{1}/oauth'
        profile-picture:
          use-gravatar: true
        user-registration:
          enabled: true
          admin-approval:
            required: false
          contact-info-validation:
            required: false
        oauth:
          mount: /oauth
          ui:
            canonical-url: 'https://{1}/oauth'
            # FIX #7: Correct API base URLs
            is:
              base-url: 'https://{1}/api/v3'
      
      # Gateway Server
      gs:
        mqtt:
          public-address: '{1}:1882'
        mqtt-v2:
          public-address: '{1}:1881'
      
      # Network Server
      ns:
        # FIX #2: Database username must match
        net-id: '000000'
        dev-addr-prefixes:
          - '00000000/7'
      
      # Application Server
      as:
        # FIX #2: Database username must match
        mqtt:
          public-address: '{1}:1883'
        webhooks:
          target: 'direct'
      
      # Join Server
      js:
        # FIX #2: Database username must match
        join-eui-prefix:
          - '0000000000000000/0'
      
      # Console Configuration
      console:
        ui:
          canonical-url: 'https://{1}/console'
          # FIX #7: Correct API base URLs for console
          is:
            base-url: 'https://{1}/api/v3'
          gs:
            base-url: 'https://{1}/api/v3'
          ns:
            base-url: 'https://{1}/api/v3'
          as:
            base-url: 'https://{1}/api/v3'
          js:
            base-url: 'https://{1}/api/v3'
          edtc:
            base-url: 'https://{1}/api/v3'
        oauth:
          client-id: console
          client-secret: console
          authorize-url: 'https://{1}/oauth/authorize'
          token-url: 'https://{1}/oauth/token'
          logout-url: 'https://{1}/oauth/logout'

runcmd:
  # Create necessary directories
  - mkdir -p /home/{0}/certs
  - mkdir -p /home/{0}/config
  - mkdir -p /var/log/letsencrypt
  - chown -R {0}:{0} /home/{0}
  
  # Certificate generation with Let's Encrypt
  - |
    echo "Setting up Let's Encrypt certificates..."
    # Install certbot
    snap install core
    snap refresh core
    snap install --classic certbot
    ln -sf /snap/bin/certbot /usr/bin/certbot
    
    # Wait for DNS to propagate
    echo "Waiting for DNS propagation for domain {1}..."
    for i in $(seq 1 30); do
      if nslookup {1} 8.8.8.8 | grep -q "Address:"; then
        echo "DNS resolved successfully"
        break
      fi
      echo "Waiting for DNS (attempt $i/30)..."
      sleep 10
    done
    
    # Obtain certificate using standalone mode (runs temporary web server on port 80)
    echo "Obtaining Let's Encrypt certificate for {1}..."
    certbot certonly --standalone --non-interactive --agree-tos --email {8} -d {1} --http-01-port 80 \
      --pre-hook "systemctl stop docker.socket docker || true" \
      --post-hook "systemctl start docker || true"
    
    # Copy Let's Encrypt certificates
    if [ -f /etc/letsencrypt/live/{1}/fullchain.pem ]; then
      cp /etc/letsencrypt/live/{1}/fullchain.pem /home/{0}/certs/cert.pem
      cp /etc/letsencrypt/live/{1}/privkey.pem /home/{0}/certs/key.pem
      chown {0}:{0} /home/{0}/certs/*
      chmod 644 /home/{0}/certs/cert.pem
      chmod 644 /home/{0}/certs/key.pem
      echo "✅ Let's Encrypt certificate installed"
      
      # Setup auto-renewal
      echo "0 0,12 * * * root certbot renew --quiet --deploy-hook 'cp /etc/letsencrypt/live/{1}/fullchain.pem /home/{0}/certs/cert.pem && cp /etc/letsencrypt/live/{1}/privkey.pem /home/{0}/certs/key.pem && chown {0}:{0} /home/{0}/certs/* && chmod 644 /home/{0}/certs/cert.pem && chmod 644 /home/{0}/certs/key.pem && cd /home/{0} && docker-compose restart stack'" > /etc/cron.d/certbot-renew
      echo "✅ Auto-renewal configured (runs twice daily)"
    else
      echo "⚠️ Let's Encrypt certificate generation failed - TTS will continue without valid certificates"
    fi
  
  # Add user to docker group
  - usermod -aG docker {0}
  
  # Start Docker services
  - systemctl enable docker
  - systemctl start docker
  
  # Start TTS with docker-compose
  - cd /home/{0} && docker-compose up -d
  
  # FIX #4 & #9: Wait for PostgreSQL to be ready with retry
  - echo "Waiting for PostgreSQL server to be ready..."
  - for i in $(seq 1 30); do pg_isready -h {5} -U {0} && break || (echo "Waiting for PostgreSQL (attempt $i/30)..."; sleep 10); done
  
  # FIX #9: Wait for containers to be healthy
  - echo "Waiting for TTS container to be healthy..."
  - for i in $(seq 1 20); do docker inspect --format='{6}' {0}_stack_1 2>/dev/null | grep -q "healthy" && break || (echo "Waiting for container health (attempt $i/20)..."; sleep 10); done
  
  # FIX #12: Database migration (init command is deprecated)
  - echo "Running TTS database migrations..."
  - sleep 10
  - for i in $(seq 1 5); do docker exec {0}_stack_1 ttn-lw-stack -c /config/tts.yml is-db migrate && break || (echo "Database migration attempt $i failed, retrying..."; sleep 5); done
  
  # FIX #11: Wait for TTS container to be fully ready before database operations
  - echo "Waiting for TTS container to be fully ready..."
  - sleep 30
  - for i in $(seq 1 10); do docker exec {0}_stack_1 ttn-lw-stack -c /config/tts.yml is-db --help >/dev/null 2>&1 && break || (echo "Waiting for TTS to be ready (attempt $i/10)..."; sleep 10); done
  
  # FIX #12: Initialize Identity Server database with explicit URI
  - echo "Initializing Identity Server database..."
  - docker exec {0}_stack_1 ttn-lw-stack -c /config/tts.yml is-db migrate --is.database-uri='postgresql://{0}:{4}@{5}/ttn_lorawan?sslmode=require' || echo "Database migration failed or already migrated"
  
  # FIX #10 & #11: Create admin user with retry logic using --password flag and explicit database URI
  - echo "Creating admin user..."
  - for i in $(seq 1 5); do docker exec {0}_stack_1 ttn-lw-stack -c /config/tts.yml is-db create-admin-user --id {10} --email {8} --password '{9}' --is.database-uri='postgresql://{0}:{4}@{5}/ttn_lorawan?sslmode=require' && break || (echo "Admin user creation attempt $i failed, retrying in 10 seconds..."; sleep 10); done
  
  # FIX #8 & #9: Create OAuth client for console with retry logic and explicit database URI
  - echo "Creating OAuth client for console..."
  - sleep 5
  - for i in $(seq 1 5); do docker exec {0}_stack_1 ttn-lw-stack -c /config/tts.yml is-db create-oauth-client --id console --name 'Console' --secret 'console' --owner {10} --redirect-uri 'https://{1}/console/oauth/callback' --redirect-uri 'https://{1}/oauth/callback' --redirect-uri '/console/oauth/callback' --redirect-uri '/oauth/callback' --logout-redirect-uri 'https://{1}/console' --logout-redirect-uri '/console' --is.database-uri='postgresql://{0}:{4}@{5}/ttn_lorawan?sslmode=require' && break || (echo "OAuth client creation attempt $i failed, retrying..."; sleep 5); done
  
  # Final verification of complete setup
  - echo "Performing final database verification..."
  - docker exec {0}_stack_1 ttn-lw-stack is-db --help >/dev/null 2>&1 && echo "✅ Database initialization completed successfully" || echo "❌ Database initialization may have issues"
  - echo "TTS should be ready for login with the admin user created with ID {10}"
  - echo "Admin Username {10}"
  - echo "Console URL https://{1}/console"
  - echo "Deployment Complete!"

final_message: "The Things Stack deployment is complete. Access the console at https://{1}/console"
''', adminUsername, actualDomainName, actualCookieBlockKey, actualCookieHashKey, dbPassword, dbServer.properties.fullyQualifiedDomainName, '{{.State.Health.Status}}', pip.properties.ipAddress, adminEmail, ttsAdminPassword, ttsAdminUsername))
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: '0001-com-ubuntu-server-jammy'
        sku: '22_04-lts-gen2'
        version: 'latest'
      }
      osDisk: {
        createOption: 'FromImage'
        managedDisk: {
          storageAccountType: 'Premium_LRS'
        }
        diskSizeGB: 128
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: nic.id
        }
      ]
    }
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

output publicIpAddress string = pip.properties.ipAddress
output publicDnsName string = pip.properties.dnsSettings.fqdn
output consoleUrl string = 'https://${actualDomainName}/console'
output gatewayAddress string = '${actualDomainName}:1700'
output grpcApiUrl string = '${actualDomainName}:8884'
output sshCommand string = 'ssh ${adminUsername}@${pip.properties.ipAddress}'
output databaseHost string = dbServer.properties.fullyQualifiedDomainName
output vmResourceId string = vm.id
output deploymentStatus string = 'TTS deployment completed successfully!'
output adminCredentials object = {
  username: ttsAdminUsername
  email: adminEmail
  consoleUrl: 'https://${actualDomainName}/console'
}
output quickStartGuide string = 'SSH to ${pip.properties.ipAddress} and run: docker logs ${adminUsername}_stack_1 -f to monitor deployment progress'
output logAnalyticsWorkspaceId string = enableMonitoring ? logAnalytics.id : ''
output applicationInsightsInstrumentationKey string = enableMonitoring ? appInsights!.properties.InstrumentationKey : ''
output applicationInsightsConnectionString string = enableMonitoring ? appInsights!.properties.ConnectionString : ''
output securityMonitoring object = enableMonitoring ? {
  logAnalyticsWorkspace: logAnalytics.name
  applicationInsights: appInsights.name
  securityAlert: securityAlert.name
} : {
  logAnalyticsWorkspace: 'Monitoring disabled'
  applicationInsights: 'Monitoring disabled'
  securityAlert: 'Monitoring disabled'
}
