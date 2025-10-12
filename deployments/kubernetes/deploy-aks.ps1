#!/usr/bin/env pwsh
# ==============================================================================
# The Things Stack - Azure Kubernetes Service (AKS Automatic) Deployment
# Production-grade LoRaWAN Network Server with Azure Best Practices
# ==============================================================================
# Uses Official TTS Helm Chart: registry-1.docker.io/thethingsindustries/lorawan-stack-helm-chart
# Reference: https://www.thethingsindustries.com/docs/enterprise/kubernetes/generic/install-charts/
# ==============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$Location = "centralus",
    
    [Parameter(Mandatory=$true, HelpMessage="Environment name (alphanumeric only, max 16 chars)")]
    [ValidatePattern('^[a-z0-9]{3,16}$')]
    [string]$EnvironmentName,
    
    [Parameter(Mandatory=$true, HelpMessage="Admin email for Let's Encrypt and TTS console")]
    [ValidatePattern('^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$')]
    [string]$AdminEmail,
    
    [Parameter(Mandatory=$true, HelpMessage="Domain name for TTS deployment (e.g., tts.example.com)")]
    [string]$DomainName,
    
    [Parameter(Mandatory=$false)]
    [string]$TtsHelmVersion = "3.30.2",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipInfrastructure,
    
    [Parameter(Mandatory=$false)]
    [switch]$UseRedisEnterprise  # Use Azure Cache for Redis Enterprise instead of in-cluster
)

$ErrorActionPreference = "Stop"

Write-Host @"

╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   The Things Stack - AKS Automatic Deployment                   ║
║                                                                  ║
║   Azure Best Practices | Official TTS Helm Chart                ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

# ==============================================================================
# CONFIGURATION
# ==============================================================================

$ResourceGroupName = "rg-$EnvironmentName"
$AksClusterName = "$EnvironmentName-aks"
$KeyVaultName = "$EnvironmentName-kv"
$PostgresServerName = "$EnvironmentName-db"
$StorageAccountName = ($EnvironmentName -replace '-','') + "storage"
$RedisName = "$EnvironmentName-redis"
$AcrName = ($EnvironmentName -replace '-','') + "acr"
$TemplateFile = "$PSScriptRoot/tts-aks-deployment.bicep"
$ValuesFile = "$PSScriptRoot/values-azure-aks.yaml"

Write-Host "`nDeployment Configuration:" -ForegroundColor Cyan
Write-Host "  Environment: $EnvironmentName" -ForegroundColor White
Write-Host "  Location: $Location" -ForegroundColor White
Write-Host "  Domain: $DomainName" -ForegroundColor White
Write-Host "  Admin Email: $AdminEmail" -ForegroundColor White
Write-Host "  Resource Group: $ResourceGroupName" -ForegroundColor White
Write-Host "  TTS Helm Version: $TtsHelmVersion" -ForegroundColor White
Write-Host "  Redis Strategy: $(if ($UseRedisEnterprise) { 'Azure Cache Enterprise E10' } else { 'In-Cluster StatefulSet' })" -ForegroundColor White

# ==============================================================================
# PRE-FLIGHT CHECKS
# ==============================================================================

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "  PRE-FLIGHT CHECKS" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Yellow

# Check required tools
$requiredTools = @(
    @{Name="kubectl"; Check={ kubectl version --client 2>&1 }; Url="https://kubernetes.io/docs/tasks/tools/"},
    @{Name="helm"; Check={ helm version 2>&1 }; Url="https://helm.sh/docs/intro/install/"},
    @{Name="az"; Check={ az version 2>&1 }; Url="https://docs.microsoft.com/cli/azure/install-azure-cli"}
)

foreach ($tool in $requiredTools) {
    try {
        $null = & $tool.Check
        Write-Host "✓ $($tool.Name) installed" -ForegroundColor Green
    } catch {
        Write-Host "❌ $($tool.Name) not found" -ForegroundColor Red
        Write-Host "   Install from: $($tool.Url)" -ForegroundColor Yellow
        exit 1
    }
}

# Check if logged in to Azure
try {
    $account = az account show 2>&1 | ConvertFrom-Json
    Write-Host "✓ Logged into Azure ($(($account.name)))" -ForegroundColor Green
} catch {
    Write-Host "❌ Not logged into Azure" -ForegroundColor Red
    Write-Host "   Run: az login" -ForegroundColor Yellow
    exit 1
}

# ==============================================================================
# STEP 1: GENERATE SECRETS
# ==============================================================================

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "  STEP 1: GENERATING SECRETS" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Yellow

function New-SecurePassword {
    param([int]$Length = 32, [switch]$AlphanumericOnly)
    $chars = if ($AlphanumericOnly) {
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    } else {
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    }
    -join ((1..$Length) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

function New-HexKey {
    param([int]$Length = 64)
    -join ((1..$Length) | ForEach-Object { '{0:X}' -f (Get-Random -Maximum 16) })
}

$secrets = @{
    'db-password' = New-SecurePassword -Length 32 -AlphanumericOnly
    'tts-admin-password' = New-SecurePassword -Length 24
    'cookie-hash-key' = New-HexKey -Length 64
    'cookie-block-key' = New-HexKey -Length 64
    'cluster-keys' = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
}

Write-Host "Generated secrets:" -ForegroundColor Green
$secrets.Keys | ForEach-Object { Write-Host "  ✓ $_" -ForegroundColor White }

# ==============================================================================
# STEP 2: DEPLOY AZURE INFRASTRUCTURE (BICEP)
# ==============================================================================

if (-not $SkipInfrastructure) {
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "  STEP 2: DEPLOYING AZURE INFRASTRUCTURE" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Yellow
    
    # Create resource group
    Write-Host "Creating resource group: $ResourceGroupName..." -ForegroundColor Cyan
    az group create --name $ResourceGroupName --location $Location --output none
    Write-Host "✓ Resource group created" -ForegroundColor Green
    
    # Deploy Bicep template
    Write-Host "`nDeploying infrastructure (this takes ~15-20 minutes)..." -ForegroundColor Cyan
    Write-Host "  Components: AKS Automatic, PostgreSQL, Redis, Key Vault, Storage, ACR" -ForegroundColor White
    
    $bicepParams = @{
        environmentName = $EnvironmentName
        location = $Location
        adminEmail = $AdminEmail
        databasePassword = $secrets['db-password']
        ttsAdminPassword = $secrets['tts-admin-password']
        cookieHashKey = $secrets['cookie-hash-key']
        cookieBlockKey = $secrets['cookie-block-key']
        clusterKeys = $secrets['cluster-keys']
        useRedisEnterprise = $UseRedisEnterprise.IsPresent
    }
    
    $deployment = az deployment group create `
        --resource-group $ResourceGroupName `
        --template-file $TemplateFile `
        --parameters $bicepParams `
        --output json | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Infrastructure deployment failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Infrastructure deployed" -ForegroundColor Green
    
    # Get outputs
    $outputs = $deployment.properties.outputs
    $aksClusterName = $outputs.aksClusterName.value
    $keyVaultName = $outputs.keyVaultName.value
    $postgresHost = $outputs.postgresHost.value
    $storageAccountName = $outputs.storageAccountName.value
    $redisHost = if ($UseRedisEnterprise) { $outputs.redisHost.value } else { "" }
    $workloadIdentityClientId = $outputs.workloadIdentityClientId.value
    $tenantId = $outputs.tenantId.value
    
    Write-Host "`nInfrastructure Details:" -ForegroundColor Cyan
    Write-Host "  AKS Cluster: $aksClusterName" -ForegroundColor White
    Write-Host "  PostgreSQL: $postgresHost" -ForegroundColor White
    Write-Host "  Storage: $storageAccountName" -ForegroundColor White
    Write-Host "  Key Vault: $keyVaultName" -ForegroundColor White
    if ($UseRedisEnterprise) {
        Write-Host "  Redis Enterprise: $redisHost" -ForegroundColor White
    }
}

# ==============================================================================
# STEP 3: CONFIGURE KUBECTL
# ==============================================================================

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "  STEP 3: CONFIGURING KUBECTL" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Yellow

az aks get-credentials `
    --resource-group $ResourceGroupName `
    --name $aksClusterName `
    --overwrite-existing `
    --output none

Write-Host "✓ kubectl configured for $aksClusterName" -ForegroundColor Green

# Verify cluster connectivity
$nodes = kubectl get nodes --output json | ConvertFrom-Json
Write-Host "  Cluster nodes: $($nodes.items.Count)" -ForegroundColor White
$nodes.items | ForEach-Object {
    Write-Host "    - $($_.metadata.name) [$($_.status.nodeInfo.kubeletVersion)]" -ForegroundColor Gray
}

# ==============================================================================
# STEP 4: INSTALL CERT-MANAGER
# ==============================================================================

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "  STEP 4: INSTALLING CERT-MANAGER" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Yellow

# Check if cert-manager is already installed
$certManagerInstalled = kubectl get namespace cert-manager 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing cert-manager v1.13.0..." -ForegroundColor Cyan
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml --output none
    
    # Wait for cert-manager to be ready
    Write-Host "Waiting for cert-manager to be ready..." -ForegroundColor Cyan
    kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager -n cert-manager --output none
    kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager-webhook -n cert-manager --output none
    Write-Host "✓ cert-manager installed" -ForegroundColor Green
} else {
    Write-Host "✓ cert-manager already installed" -ForegroundColor Green
}

# Create Let's Encrypt ClusterIssuer
Write-Host "Creating Let's Encrypt ClusterIssuer..." -ForegroundColor Cyan
@"
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: $AdminEmail
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: webapprouting.kubernetes.azure.com
"@ | kubectl apply -f - --output none

Write-Host "✓ Let's Encrypt ClusterIssuer created" -ForegroundColor Green

# ==============================================================================
# STEP 5: PREPARE TTS HELM VALUES
# ==============================================================================

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "  STEP 5: PREPARING TTS HELM VALUES" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Yellow

# Get secrets from Key Vault
Write-Host "Retrieving secrets from Key Vault..." -ForegroundColor Cyan
$dbPassword = az keyvault secret show --vault-name $keyVaultName --name db-password --query value -o tsv
$ttsAdminPassword = az keyvault secret show --vault-name $keyVaultName --name tts-admin-password --query value -o tsv
$cookieHashKey = az keyvault secret show --vault-name $keyVaultName --name cookie-hash-key --query value -o tsv
$cookieBlockKey = az keyvault secret show --vault-name $keyVaultName --name cookie-block-key --query value -o tsv
$clusterKeys = az keyvault secret show --vault-name $keyVaultName --name cluster-keys --query value -o tsv

if ($UseRedisEnterprise) {
    $redisPassword = az keyvault secret show --vault-name $keyVaultName --name redis-password --query value -o tsv
}

Write-Host "✓ Secrets retrieved" -ForegroundColor Green

# Build PostgreSQL connection string
$postgresUri = "postgres://ttsadmin:$dbPassword@$postgresHost/tts?sslmode=require"

# Create deployment-specific values file
$deploymentValuesFile = "$PSScriptRoot/values-$EnvironmentName.yaml"
Write-Host "Creating deployment values file: $deploymentValuesFile" -ForegroundColor Cyan

# Read base values
$baseValues = Get-Content $ValuesFile -Raw

# Create deployment-specific overrides
$overrides = @"
# Generated deployment values for: $EnvironmentName
# Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

global:
  domain: "$DomainName"
  deployment:
    initialTenant:
      adminPassword: "$ttsAdminPassword"
      adminEmail: "$AdminEmail"
  blob:
    azure:
      accountName: "$storageAccountName"
      clientID: "$workloadIdentityClientId"
  cluster:
    keys: "$clusterKeys"
  http:
    cookie:
      blockKey: "$cookieBlockKey"
      hashKey: "$cookieHashKey"
  redis:
    address: "$(if ($UseRedisEnterprise) { $redisHost } else { 'redis-0.redis.tts.svc.cluster.local:6379' })"
    password: "$(if ($UseRedisEnterprise) { $redisPassword } else { '' })"

is:
  database:
    uri: "$postgresUri"

workloadIdentity:
  clientId: "$workloadIdentityClientId"
  tenantId: "$tenantId"

gateway:
  udp:
    annotations:
      service.beta.kubernetes.io/azure-load-balancer-resource-group: "$ResourceGroupName"
"@

Set-Content -Path $deploymentValuesFile -Value $overrides
Write-Host "✓ Deployment values created" -ForegroundColor Green

# ==============================================================================
# STEP 6: DEPLOY THE THINGS STACK (OFFICIAL HELM CHART)
# ==============================================================================

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "  STEP 6: DEPLOYING THE THINGS STACK" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Yellow

Write-Host "Using Official TTS Helm Chart:" -ForegroundColor Cyan
Write-Host "  Registry: registry-1.docker.io/thethingsindustries/lorawan-stack-helm-chart" -ForegroundColor White
Write-Host "  Version: $TtsHelmVersion" -ForegroundColor White

# Login to Docker Hub registry (required for OCI pull)
Write-Host "`nLogging into Helm OCI registry (anonymous access)..." -ForegroundColor Cyan
# Note: TTS public charts allow anonymous access

# Install/Upgrade TTS Helm chart
Write-Host "Installing The Things Stack (this may take 5-10 minutes)..." -ForegroundColor Cyan
helm upgrade --install tts `
    oci://registry-1.docker.io/thethingsindustries/lorawan-stack-helm-chart `
    --version $TtsHelmVersion `
    --namespace tts `
    --create-namespace `
    --values $ValuesFile `
    --values $deploymentValuesFile `
    --wait `
    --timeout 15m

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ TTS deployment failed" -ForegroundColor Red
    Write-Host "Check logs with: kubectl logs -n tts -l app=lorawan-stack" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ The Things Stack deployed" -ForegroundColor Green

# ==============================================================================
# STEP 7: GET ACCESS DETAILS
# ==============================================================================

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "  STEP 7: DEPLOYMENT COMPLETE" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Yellow

# Wait for ingress to get IP
Write-Host "Waiting for ingress IP address..." -ForegroundColor Cyan
Start-Sleep -Seconds 30

$ingressIP = kubectl get ingress -n tts -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}' 2>&1
$gatewayIP = kubectl get svc -n tts -l app=lorawan-stack,component=gateway-server -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}' 2>&1

Write-Host @"

╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   ✅ DEPLOYMENT SUCCESSFUL                                       ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

ACCESS INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 Console URL:       https://$DomainName
📧 Admin Email:       $AdminEmail
🔑 Admin Password:    (stored in Key Vault: $keyVaultName/tts-admin-password)

🌍 Ingress IP:        $ingressIP
📡 Gateway UDP:       $gatewayIP:1700

NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  Create DNS A Record:
   $DomainName → $ingressIP

2️⃣  Wait for TLS Certificate (2-5 minutes):
   kubectl get certificate -n tts

3️⃣  Configure LoRaWAN Gateways:
   Server Address: $gatewayIP
   Server Port: 1700

4️⃣  Access Console:
   https://$DomainName
   Username: admin-user
   Password: (retrieve from Key Vault)

5️⃣  View Logs:
   kubectl logs -n tts -l app=lorawan-stack -f

6️⃣  Monitor with Grafana:
   $(az grafana show -g $ResourceGroupName --query 'properties.endpoint' -o tsv 2>/dev/null)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"@ -ForegroundColor Green

Write-Host "Deployment completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
