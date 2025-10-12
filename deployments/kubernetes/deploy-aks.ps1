#!/usr/bin/env pwsh
# ==============================================================================
# The Things Stack - Azure Kubernetes Service (AKS) Deployment
# Production-grade LoRaWAN Network Server on Kubernetes
# ==============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$Location = "centralus",
    
    [Parameter(Mandatory=$false)]
    [string]$EnvironmentName = "tts-aks-prod",
    
    [Parameter(Mandatory=$false)]
    [string]$AdminEmail,
    
    [Parameter(Mandatory=$false)]
    [int]$NodeCount = 3,
    
    [Parameter(Mandatory=$false)]
    [string]$NodeSize = "Standard_D4s_v3",
    
    [Parameter(Mandatory=$false)]
    [string]$KubernetesVersion = "1.28",
    
    [Parameter(Mandatory=$false)]
    [string]$ParametersFile = ""
)

$ErrorActionPreference = "Stop"

Write-Host @"

╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   The Things Stack - AKS Production Deployment                  ║
║                                                                  ║
║   High-Availability Kubernetes Deployment                       ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

# ==============================================================================
# PRE-FLIGHT CHECKS
# ==============================================================================

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "  PRE-FLIGHT CHECKS" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Yellow

# Check if kubectl is installed
try {
    $null = kubectl version --client 2>&1
    Write-Host "✓ kubectl installed" -ForegroundColor Green
} catch {
    Write-Host "❌ kubectl not found" -ForegroundColor Red
    Write-Host "   Install from: https://kubernetes.io/docs/tasks/tools/" -ForegroundColor Yellow
    exit 1
}

# Check if helm is installed
try {
    $null = helm version 2>&1
    Write-Host "✓ Helm installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Helm not found" -ForegroundColor Red
    Write-Host "   Install from: https://helm.sh/docs/intro/install/" -ForegroundColor Yellow
    exit 1
}

# Check Azure CLI
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-Host "✓ Azure CLI v$($azVersion.'azure-cli')" -ForegroundColor Green
} catch {
    Write-Host "❌ Azure CLI not found" -ForegroundColor Red
    Write-Host "   Install from: https://docs.microsoft.com/cli/azure/install-azure-cli" -ForegroundColor Yellow
    exit 1
}

# Validate email
function Test-EmailAddress {
    param([string]$Email)
    return $Email -match '^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$'
}

if ([string]::IsNullOrEmpty($AdminEmail)) {
    do {
        $AdminEmail = Read-Host "Enter admin email address"
        if (-not (Test-EmailAddress $AdminEmail)) {
            Write-Host "Invalid email format. Please try again." -ForegroundColor Red
        }
    } while (-not (Test-EmailAddress $AdminEmail))
}

# ==============================================================================
# DEPLOYMENT CONFIGURATION
# ==============================================================================

$timestamp = Get-Date -Format "yyyyMMddHHmm"
$resourceGroupName = "rg-$EnvironmentName-$timestamp"
$aksClusterName = "$EnvironmentName-aks"
$acrName = ($EnvironmentName -replace '[^a-zA-Z0-9]', '') + "acr" + (-join ((97..122) | Get-Random -Count 4 | ForEach-Object {[char]$_}))
$kvName = "kv-" + (-join ((48..57) + (97..102) | Get-Random -Count 12 | ForEach-Object {[char]$_}))

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "  DEPLOYMENT CONFIGURATION" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Yellow

Write-Host "Resource Group:    " -NoNewline; Write-Host $resourceGroupName -ForegroundColor Cyan
Write-Host "Location:          " -NoNewline; Write-Host $Location -ForegroundColor Cyan
Write-Host "AKS Cluster:       " -NoNewline; Write-Host $aksClusterName -ForegroundColor Cyan
Write-Host "Kubernetes:        " -NoNewline; Write-Host "v$KubernetesVersion" -ForegroundColor Cyan
Write-Host "Node Count:        " -NoNewline; Write-Host $NodeCount -ForegroundColor Cyan
Write-Host "Node Size:         " -NoNewline; Write-Host $NodeSize -ForegroundColor Cyan
Write-Host "Container Registry:" -NoNewline; Write-Host $acrName -ForegroundColor Cyan
Write-Host "Key Vault:         " -NoNewline; Write-Host $kvName -ForegroundColor Cyan
Write-Host "Admin Email:       " -NoNewline; Write-Host $AdminEmail -ForegroundColor Cyan

# Cost estimate
$nodeCostPerMonth = switch ($NodeSize) {
    "Standard_D4s_v3" { 140 }
    "Standard_D8s_v3" { 280 }
    "Standard_D16s_v3" { 560 }
    default { 140 }
}
$totalNodeCost = $nodeCostPerMonth * $NodeCount
$estimatedMonthlyCost = $totalNodeCost + 180 + 40 + 25 + 55  # Nodes + DB + Storage + LB + Monitoring

Write-Host "`nEstimated Monthly Cost: ~$" -NoNewline; Write-Host $estimatedMonthlyCost -ForegroundColor Yellow
Write-Host "  • AKS Nodes ($NodeCount x $NodeSize): ~$" -NoNewline; Write-Host $totalNodeCost -ForegroundColor Gray
Write-Host "  • PostgreSQL (GP 4vCore): ~`$180" -ForegroundColor Gray
Write-Host "  • Storage + PVCs: ~`$40" -ForegroundColor Gray
Write-Host "  • Load Balancer: ~`$25" -ForegroundColor Gray
Write-Host "  • Monitoring: ~`$55" -ForegroundColor Gray

$confirm = Read-Host "`nProceed with AKS deployment? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

# ==============================================================================
# PHASE 1: CREATE RESOURCE GROUP
# ==============================================================================

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  PHASE 1: RESOURCE GROUP PROVISIONING" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Green

Write-Host "Creating resource group: $resourceGroupName" -ForegroundColor Cyan
az group create --name $resourceGroupName --location $Location --output none
Write-Host "✓ Resource group created" -ForegroundColor Green

# ==============================================================================
# PHASE 2: DEPLOY BICEP TEMPLATE
# ==============================================================================

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  PHASE 2: INFRASTRUCTURE DEPLOYMENT" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Green

Write-Host "Deploying AKS cluster and supporting resources..." -ForegroundColor Cyan
Write-Host "This will take 15-20 minutes...`n" -ForegroundColor Yellow

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

# Collect passwords
Write-Host "Enter database admin password:" -ForegroundColor Cyan
$dbPassword = Read-Host -AsSecureString
$dbPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

Write-Host "Enter TTS admin password (for console):" -ForegroundColor Cyan
$ttsPassword = Read-Host -AsSecureString
$ttsPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ttsPassword))

try {
    $deploymentResult = az deployment group create `
        --resource-group $resourceGroupName `
        --template-file "$PSScriptRoot\tts-aks-deployment.bicep" `
        --parameters `
            location=$Location `
            environmentName=$EnvironmentName `
            aksClusterName=$aksClusterName `
            nodeCount=$NodeCount `
            nodeSize=$NodeSize `
            kubernetesVersion=$KubernetesVersion `
            adminEmail=$AdminEmail `
            dbAdminPassword=$dbPasswordPlain `
            ttsAdminPassword=$ttsPasswordPlain `
            keyVaultName=$kvName `
            acrName=$acrName `
        --output json | ConvertFrom-Json
    
    $stopwatch.Stop()
    $duration = $stopwatch.Elapsed.ToString("mm\:ss")
    
    Write-Host "`n✓ Infrastructure deployment complete ($duration)" -ForegroundColor Green
    
} catch {
    Write-Host "`n❌ Infrastructure deployment failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# ==============================================================================
# PHASE 3: CONFIGURE KUBECTL
# ==============================================================================

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  PHASE 3: KUBERNETES CONFIGURATION" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Green

Write-Host "Configuring kubectl credentials..." -ForegroundColor Cyan
az aks get-credentials --resource-group $resourceGroupName --name $aksClusterName --overwrite-existing --output none
Write-Host "✓ kubectl configured" -ForegroundColor Green

# Verify cluster access
Write-Host "`nVerifying cluster access..." -ForegroundColor Cyan
$nodes = kubectl get nodes --output json | ConvertFrom-Json
Write-Host "✓ Cluster accessible - $($nodes.items.Count) nodes ready" -ForegroundColor Green

# ==============================================================================
# PHASE 4: DEPLOY HELM CHART
# ==============================================================================

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  PHASE 4: APPLICATION DEPLOYMENT" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Green

Write-Host "Installing TTS Helm chart..." -ForegroundColor Cyan

# TODO: Deploy actual TTS Helm chart when available
# For now, show placeholder
Write-Host "⚠️  TTS Helm chart deployment in development" -ForegroundColor Yellow
Write-Host "`nNext steps to complete deployment:" -ForegroundColor Cyan
Write-Host "  1. Create TTS namespace: kubectl create namespace tts" -ForegroundColor White
Write-Host "  2. Deploy TTS Helm chart: helm install tts ./charts/thethingsstack" -ForegroundColor White
Write-Host "  3. Configure ingress controller for HTTPS" -ForegroundColor White
Write-Host "  4. Set up certificate manager (cert-manager)" -ForegroundColor White

# ==============================================================================
# DEPLOYMENT COMPLETE
# ==============================================================================

Write-Host "`n╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║           AKS INFRASTRUCTURE DEPLOYMENT COMPLETE                 ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "Deployment Duration: $duration" -ForegroundColor Cyan

Write-Host "`n📌 Cluster Information:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "Resource Group:  " -NoNewline; Write-Host $resourceGroupName -ForegroundColor Green
Write-Host "Cluster Name:    " -NoNewline; Write-Host $aksClusterName -ForegroundColor Green
Write-Host "Kubernetes:      " -NoNewline; Write-Host "v$KubernetesVersion" -ForegroundColor Green
Write-Host "Nodes:           " -NoNewline; Write-Host "$NodeCount x $NodeSize" -ForegroundColor Green

Write-Host "`n🔧 Management Commands:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "View nodes:      " -NoNewline; Write-Host "kubectl get nodes" -ForegroundColor Cyan
Write-Host "View pods:       " -NoNewline; Write-Host "kubectl get pods -n tts" -ForegroundColor Cyan
Write-Host "View services:   " -NoNewline; Write-Host "kubectl get svc -n tts" -ForegroundColor Cyan
Write-Host "Cluster dashboard: " -NoNewline; Write-Host "az aks browse -g $resourceGroupName -n $aksClusterName" -ForegroundColor Cyan

Write-Host "`n⚠️  Important Next Steps:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "1. Deploy TTS Helm chart (in development)" -ForegroundColor White
Write-Host "2. Configure DNS for your domain" -ForegroundColor White
Write-Host "3. Set up ingress controller and TLS certificates" -ForegroundColor White
Write-Host "4. Configure monitoring and alerts" -ForegroundColor White
Write-Host "5. Save your admin credentials securely`n" -ForegroundColor White

# Save deployment info
$outputFile = "deployment-aks-$timestamp.txt"
@"
The Things Stack - AKS Deployment Information
==============================================
Deployed: $(Get-Date)
Duration: $duration

Cluster Information:
--------------------
Resource Group: $resourceGroupName
Cluster Name: $aksClusterName
Kubernetes Version: v$KubernetesVersion
Nodes: $NodeCount x $NodeSize
Location: $Location

Management Commands:
--------------------
Get credentials: az aks get-credentials -g $resourceGroupName -n $aksClusterName
View nodes: kubectl get nodes
View pods: kubectl get pods -n tts
View services: kubectl get svc -n tts
Dashboard: az aks browse -g $resourceGroupName -n $aksClusterName

Resources:
----------
Key Vault: $kvName
Container Registry: $acrName

Cost Estimate:
--------------
Monthly: ~`$$estimatedMonthlyCost

Next Steps:
-----------
1. Deploy TTS Helm chart
2. Configure DNS
3. Set up ingress and TLS
4. Configure monitoring
"@ | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "💾 Deployment info saved to: $outputFile`n" -ForegroundColor Green

# Clean up sensitive variables
Remove-Variable dbPasswordPlain -ErrorAction SilentlyContinue
Remove-Variable ttsPasswordPlain -ErrorAction SilentlyContinue
