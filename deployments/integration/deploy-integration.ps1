#!/usr/bin/env pwsh
# ==============================================================================
# Deploy IoT Hub & Data Intelligence Integration
# ==============================================================================
#
# PURPOSE:
# Orchestrates deployment of Azure IoT Hub data intelligence infrastructure for
# The Things Stack (TTS) telemetry bridging. This script handles brownfield
# scenarios by detecting existing monitoring resources and prompting for reuse.
#
# ARCHITECTURE:
# 1. Generate SQL admin password (complexity requirements)
# 2. Detect existing Log Analytics and Application Insights resources
# 3. Prompt user: Reuse, Create New, or Skip monitoring
# 4. Deploy Bicep template with conditional monitoring flags
# 5. Create IoT Hub bridge device identity using Azure IoT CLI
# 6. Configure Function App with device connection string
# 7. Deploy Function code via ZIP deployment
# 8. Initialize SQL database schema using Entra ID authentication
# 9. Generate TTS webhook configuration helper script
#
# BROWNFIELD LOGIC:
# - Reuse: Pass existing resource IDs to Bicep, skip creation
# - Create New: Deploy new monitoring stack (separate billing/access)
# - Skip: No monitoring (enableMonitoring=false, not recommended for prod)
#
# PARAMETERS:
# - ResourceGroupName: Must exist, detected region used for all resources
# - Location: Auto-detected from Resource Group in deploy.ps1
# - KeyVaultName: Must exist with RBAC permissions for deployment user
#
# PREREQUISITES:
# - Azure PowerShell module (Az)
# - Azure CLI with IoT extension (az extension add --name azure-iot)
# - PowerShell 7+ recommended
# - Key Vault Secrets Officer role on target Key Vault
#
# OUTPUTS:
# - Webhook URL for TTS configuration
# - Event Hub connection string for Azure Fabric
# - SQL server name and database name
# - IoT Hub name
# - Generated configure-tts-webhook.sh script
#
# DEPLOYMENT TIME: 5-10 minutes
#
# ==============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$true)]
    [string]$Location,
    
    [Parameter(Mandatory=$true)]
    [string]$KeyVaultName
)

$ErrorActionPreference = "Stop"

# Ensure Azure IoT Extension is installed
Write-Host "Checking Azure IoT CLI extension..." -ForegroundColor Gray
az extension add --name azure-iot --allow-preview true 2>$null

Write-Host "`n╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Deploying IoT Hub & Data Intelligence Integration              ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# 1. Generate SQL Admin Password
Write-Host "Generating secure SQL Admin password..." -ForegroundColor Yellow
$sqlPassword = -join ((33..126) | Get-Random -Count 16 | ForEach-Object {[char]$_})
# Ensure complexity requirements
$sqlPassword += "Aa1!"

# 2. Deploy Bicep Template
Write-Host "Deploying infrastructure (IoT Hub, SQL, Event Hub, Functions)..." -ForegroundColor Yellow
Write-Host "This may take 5-10 minutes." -ForegroundColor Gray

# ==============================================================================
# BROWNFIELD AWARENESS: Detect Existing Monitoring Resources
# ==============================================================================
# In brownfield scenarios, the target Resource Group may already contain Log
# Analytics Workspace and/or Application Insights from the main TTS deployment.
# We detect these and offer three options:
#
# 1. REUSE: Configure Function App to use existing resources (cost-efficient)
#    - Pass existing resource IDs to Bicep
#    - Set createMonitoringResources=false, enableMonitoring=true
#
# 2. CREATE NEW: Deploy separate monitoring stack (billing/access isolation)
#    - Ignore existing resources
#    - Set createMonitoringResources=true, enableMonitoring=true
#
# 3. SKIP: No monitoring for integration (not recommended for production)
#    - Set createMonitoringResources=false, enableMonitoring=false
#    - Function App will not send telemetry to Application Insights
# ==============================================================================

Write-Host "Checking for existing monitoring resources..." -ForegroundColor Gray
$existingLaw = Get-AzResource -ResourceGroupName $ResourceGroupName -ResourceType "Microsoft.OperationalInsights/workspaces" -ErrorAction SilentlyContinue | Select-Object -First 1
$existingAi = Get-AzResource -ResourceGroupName $ResourceGroupName -ResourceType "Microsoft.Insights/components" -ErrorAction SilentlyContinue | Select-Object -First 1

$params = @{
    location = $Location
    keyVaultName = $KeyVaultName
    sqlAdminPassword = $sqlPassword
}

# Default: Create monitoring resources
$enableMonitoring = $true
$createMonitoringResources = $true

if ($existingLaw -or $existingAi) {
    if ($existingLaw) { Write-Host "✓ Found existing Log Analytics: $($existingLaw.Name)" -ForegroundColor Green }
    if ($existingAi) { Write-Host "✓ Found existing App Insights: $($existingAi.Name)" -ForegroundColor Green }
    
    $choice = Read-Host "Found existing monitoring resources. [R]euse, [C]reate New, or [S]kip monitoring? (Default: Reuse)"
    switch -Regex ($choice) {
        "^[Cc]" { 
            Write-Host "Creating new monitoring resources..." -ForegroundColor Yellow
            $createMonitoringResources = $true
            $enableMonitoring = $true
        }
        "^[Ss]" { 
            Write-Host "Skipping monitoring..." -ForegroundColor Yellow
            $createMonitoringResources = $false
            $enableMonitoring = $false
        }
        Default { 
            Write-Host "Reusing existing resources..." -ForegroundColor Green
            $createMonitoringResources = $false
            $enableMonitoring = $true
            if ($existingLaw) { $params.existingLogAnalyticsWorkspaceId = $existingLaw.ResourceId }
            if ($existingAi) { $params.existingAppInsightsId = $existingAi.ResourceId }
        }
    }
} else {
    $choice = Read-Host "No existing monitoring resources found. [C]reate New or [S]kip monitoring? (Default: Create)"
    if ($choice -match "^[Ss]") {
        Write-Host "Skipping monitoring..." -ForegroundColor Yellow
        $createMonitoringResources = $false
        $enableMonitoring = $false
    } else {
        Write-Host "Creating new monitoring resources..." -ForegroundColor Green
        $createMonitoringResources = $true
        $enableMonitoring = $true
    }
}

$params.enableMonitoring = $enableMonitoring
$params.createMonitoringResources = $createMonitoringResources

try {
    $deployment = New-AzResourceGroupDeployment `
        -ResourceGroupName $ResourceGroupName `
        -TemplateFile "$PSScriptRoot\integration.bicep" `
        -TemplateParameterObject $params `
        -Name "tts-integration-$(Get-Date -Format 'yyyyMMdd-HHmm')" `
        -ErrorAction Stop

    $outputs = $deployment.Outputs
    $webhookUrl = $outputs.webhookUrl.Value
    $sqlServer = $outputs.sqlServerName.Value
    $dbName = $outputs.databaseName.Value
    $eventHubConn = $outputs.eventHubConnectionString.Value
    $iotHubName = $outputs.iotHubName.Value
    $functionAppName = $outputs.functionAppName.Value

    Write-Host "`n✓ Infrastructure Deployed Successfully" -ForegroundColor Green

    # --- Configure Function App ---
    Write-Host "`nConfiguring Function App..." -ForegroundColor Yellow
    
    # Create Bridge Device
    $deviceId = "TTS-Bridge"
    Write-Host "Checking/Creating IoT Hub device identity: $deviceId" -ForegroundColor Gray
    # Check if device exists, if not create it
    $deviceExists = az iot hub device-identity show --device-id $deviceId --hub-name $iotHubName --output none 2>&1
    if ($LASTEXITCODE -ne 0) {
        az iot hub device-identity create --device-id $deviceId --hub-name $iotHubName | Out-Null
    }
    
    # Get Connection String
    $connString = az iot hub device-identity connection-string show --device-id $deviceId --hub-name $iotHubName --query connectionString -o tsv
    
    # Set App Setting
    Write-Host "Setting BridgeConnectionString..." -ForegroundColor Gray
    az functionapp config appsettings set --name $functionAppName --resource-group $ResourceGroupName --settings "BridgeConnectionString=$connString" | Out-Null
    
    # Deploy Code
    Write-Host "Deploying Function Code..." -ForegroundColor Yellow
    $funcDir = "$PSScriptRoot\function"
    $zipPath = "$PSScriptRoot\function.zip"
    
    if (Test-Path $zipPath) { Remove-Item $zipPath }
    Compress-Archive -Path "$funcDir\*" -DestinationPath $zipPath
    
    az functionapp deployment source config-zip --resource-group $ResourceGroupName --name $functionAppName --src $zipPath
    Remove-Item $zipPath
    
    Write-Host "✓ Function App Configured" -ForegroundColor Green
}
catch {
    Write-Error "Deployment failed: $_"
    exit 1
}

# 3. Initialize SQL Schema
Write-Host "`nInitializing SQL Database Schema..." -ForegroundColor Yellow

# Get Access Token for SQL
$token = (Get-AzAccessToken -ResourceUrl https://database.windows.net).Token

# Create SQL Script
$schemaFile = "$PSScriptRoot\sql\schema.sql"
if (Test-Path $schemaFile) {
    try {
        # Use Invoke-Sqlcmd if available, otherwise warn
        if (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue) {
            Invoke-Sqlcmd -ServerInstance $sqlServer -Database $dbName -AccessToken $token -InputFile $schemaFile
            Write-Host "✓ SQL Schema applied" -ForegroundColor Green
        } else {
            Write-Warning "Invoke-Sqlcmd not found. Please run '$schemaFile' manually on the database."
        }
    }
    catch {
        Write-Warning "Failed to apply SQL schema automatically. Please run '$schemaFile' manually."
        Write-Warning "Error: $_"
    }
}

# 4. Generate Configuration Helper
Write-Host "`nGenerating TTS Configuration Helper..." -ForegroundColor Yellow
$helperPath = "$PSScriptRoot\configure-tts-webhook.sh"
$helperContent = @"
#!/bin/bash
# Run this on your TTS VM to configure the Webhook

WEBHOOK_URL="$webhookUrl"
API_KEY="<YOUR_TTS_API_KEY>"
APP_ID="<YOUR_APP_ID>"

echo "Configuring Webhook for \$APP_ID..."

curl -X POST \
  "http://localhost:1885/api/v3/as/applications/\$APP_ID/webhooks" \
  -H "Authorization: Bearer \$API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": { "webhook_id": "azure-integration" },
    "base_url": "'"\$WEBHOOK_URL"'",
    "format": "json",
    "uplink_message": { "path": "" },
    "join_accept": { "path": "" },
    "downlink_ack": { "path": "" },
    "downlink_nack": { "path": "" },
    "downlink_sent": { "path": "" },
    "downlink_failed": { "path": "" },
    "downlink_queued": { "path": "" },
    "location_solved": { "path": "" }
  }'

echo "Webhook configured!"
"@

$helperContent | Out-File -FilePath $helperPath -Encoding utf8
Write-Host "✓ Helper script generated at: $helperPath" -ForegroundColor Green

# 5. Final Output
Write-Host "`n╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   INTEGRATION DEPLOYMENT COMPLETE                                ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host "`n1. Webhook URL:" -ForegroundColor White
Write-Host "   $webhookUrl" -ForegroundColor Green

Write-Host "`n2. Fabric Event Hub Connection String:" -ForegroundColor White
Write-Host "   $eventHubConn" -ForegroundColor Green
Write-Host "   (Use this in Azure Fabric -> Real-Time Intelligence -> Eventstream)" -ForegroundColor Gray

Write-Host "`n3. Next Steps:" -ForegroundColor White
Write-Host "   a. Run 'configure-tts-webhook.sh' on your TTS VM" -ForegroundColor Gray
Write-Host "   b. Connect Azure Fabric using the connection string above" -ForegroundColor Gray
Write-Host "   c. Verify data is flowing to SQL Database '$dbName'" -ForegroundColor Gray
