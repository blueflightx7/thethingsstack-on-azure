#!/usr/bin/env pwsh
# ==============================================================================
# Advanced TTS Deployment Script
# Full-featured deployment with all configuration options
# ==============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$Location = "centralus",
    
    [Parameter(Mandatory=$false)]
    [string]$EnvironmentName = "tts-prod",
    
    [Parameter(Mandatory=$false)]
    [string]$AdminEmail,
    
    [Parameter(Mandatory=$false)]
    [string]$VMSize = "Standard_B4ms",
    
    [Parameter(Mandatory=$false)]
    [string]$DomainName = "",
    
    [Parameter(Mandatory=$false)]
    [string]$AdminSourceIP = "*",
    
    [Parameter(Mandatory=$false)]
    [switch]$DisablePrivateDatabase,
    
    [Parameter(Mandatory=$false)]
    [switch]$DisableKeyVault,
    
    [Parameter(Mandatory=$false)]
    [string]$KeyVaultName = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ParametersFile = ""
)

$ErrorActionPreference = "Stop"

Write-Host @"

╔══════════════════════════════════════════════════════╗
║   The Things Stack - Azure Deployment (Advanced)    ║
╚══════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

# Function to validate email
function Test-EmailAddress {
    param([string]$Email)
    return $Email -match '^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$'
}

# Prompt for required parameters if not provided
if ([string]::IsNullOrEmpty($AdminEmail)) {
    do {
        $AdminEmail = Read-Host "Enter admin email address"
        if (-not (Test-EmailAddress $AdminEmail)) {
            Write-Host "Invalid email format. Please try again." -ForegroundColor Red
        }
    } while (-not (Test-EmailAddress $AdminEmail))
}

# Generate resource group name
$timestamp = Get-Date -Format "yyyyMMddHHmm"
$resourceGroupName = "rg-tts-$timestamp"

Write-Host "`nDeployment Configuration:" -ForegroundColor Yellow
Write-Host "  Resource Group: $resourceGroupName" -ForegroundColor Cyan
Write-Host "  Location: $Location" -ForegroundColor Cyan
Write-Host "  Environment: $EnvironmentName" -ForegroundColor Cyan
Write-Host "  VM Size: $VMSize" -ForegroundColor Cyan
Write-Host "  Admin Email: $AdminEmail" -ForegroundColor Cyan
Write-Host "  Private Database: $(-not $DisablePrivateDatabase)" -ForegroundColor Cyan
Write-Host "  Key Vault: $(-not $DisableKeyVault)" -ForegroundColor Cyan

# Confirm deployment
$confirm = Read-Host "`nProceed with deployment? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

# Create resource group
Write-Host "`nCreating resource group..." -ForegroundColor Green
New-AzResourceGroup -Name $resourceGroupName -Location $Location -Force | Out-Null

# Generate Key Vault name if needed and not disabled
if (-not $DisableKeyVault -and [string]::IsNullOrEmpty($KeyVaultName)) {
    $kvSuffix = -join ((48..57) + (97..102) | Get-Random -Count 8 | ForEach-Object {[char]$_})
    $KeyVaultName = "kv-tts-$kvSuffix"
}

# Collect passwords
Write-Host "`nPassword Configuration:" -ForegroundColor Yellow
Write-Host "Enter VM admin password (for SSH):" -ForegroundColor Cyan
$vmAdminPassword = Read-Host -AsSecureString

Write-Host "Enter TTS admin password (for console):" -ForegroundColor Cyan
$ttsAdminPassword = Read-Host -AsSecureString

# Build deployment parameters
$deploymentParams = @{
    ResourceGroupName     = $resourceGroupName
    TemplateFile          = ".\deployments\vm\tts-docker-deployment.bicep"
    location              = $Location
    environmentName       = $EnvironmentName
    adminUsername         = "ttsadmin"
    adminPassword         = $vmAdminPassword
    adminEmail            = $AdminEmail
    vmSize                = $VMSize
    adminSourceIP         = $AdminSourceIP
    enablePrivateDatabaseAccess = -not $DisablePrivateDatabase
    enableKeyVault        = -not $DisableKeyVault
    ttsAdminPasswordParam = $ttsAdminPassword
}

# Add optional parameters
if (-not [string]::IsNullOrEmpty($DomainName)) {
    $deploymentParams.domainName = $DomainName
}

if (-not $DisableKeyVault -and -not [string]::IsNullOrEmpty($KeyVaultName)) {
    $deploymentParams.keyVaultName = $KeyVaultName
}

# Use parameters file if provided
if (-not [string]::IsNullOrEmpty($ParametersFile) -and (Test-Path $ParametersFile)) {
    Write-Host "Using parameters file: $ParametersFile" -ForegroundColor Cyan
    $deploymentParams.TemplateParameterFile = $ParametersFile
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "Starting deployment (this may take 10-15 minutes)..." -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Green

try {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    $deployment = New-AzResourceGroupDeployment @deploymentParams -Verbose
    
    $stopwatch.Stop()
    $duration = $stopwatch.Elapsed.ToString("mm\:ss")
    
    Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║            Deployment Successful!                    ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════╝`n" -ForegroundColor Green
    
    Write-Host "Deployment Duration: $duration" -ForegroundColor Cyan
    
    Write-Host "`n📌 Access Information:" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "Console URL:     " -NoNewline; Write-Host $deployment.Outputs.consoleUrl.Value -ForegroundColor Green
    Write-Host "Admin Username:  " -NoNewline; Write-Host $deployment.Outputs.adminCredentials.Value.username -ForegroundColor Green
    Write-Host "Admin Email:     " -NoNewline; Write-Host $deployment.Outputs.adminCredentials.Value.email -ForegroundColor Green
    
    Write-Host "`n🔧 Management:" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "SSH Command:     " -NoNewline; Write-Host $deployment.Outputs.sshCommand.Value -ForegroundColor Cyan
    Write-Host "Public IP:       " -NoNewline; Write-Host $deployment.Outputs.publicIpAddress.Value -ForegroundColor Cyan
    Write-Host "DNS Name:        " -NoNewline; Write-Host $deployment.Outputs.publicDnsName.Value -ForegroundColor Cyan
    
    Write-Host "`n🌐 LoRaWAN Endpoints:" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "Gateway Address: " -NoNewline; Write-Host $deployment.Outputs.gatewayAddress.Value -ForegroundColor Magenta
    Write-Host "gRPC API:        " -NoNewline; Write-Host $deployment.Outputs.grpcApiUrl.Value -ForegroundColor Magenta
    
    Write-Host "`n📊 Monitoring:" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "Log Analytics:   " -NoNewline; Write-Host $deployment.Outputs.logAnalyticsWorkspaceId.Value.Split('/')[-1] -ForegroundColor DarkCyan
    Write-Host "App Insights:    " -NoNewline; Write-Host $deployment.Outputs.securityMonitoring.Value.applicationInsights -ForegroundColor DarkCyan
    
    Write-Host "`n⚠️  Important Notes:" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "• TTS is initializing in the background (5-10 minutes)" -ForegroundColor White
    Write-Host "• Monitor progress: $($deployment.Outputs.quickStartGuide.Value)" -ForegroundColor White
    Write-Host "• Save your admin password - it cannot be retrieved later" -ForegroundColor White
    
    # Save deployment info to file
    $outputFile = "deployment-$timestamp.txt"
    @"
The Things Stack Deployment Information
========================================
Deployed: $(Get-Date)
Resource Group: $resourceGroupName
Duration: $duration

Access Information:
-------------------
Console URL: $($deployment.Outputs.consoleUrl.Value)
Admin Username: $($deployment.Outputs.adminCredentials.Value.username)
Admin Email: $($deployment.Outputs.adminCredentials.Value.email)

Management:
-----------
SSH Command: $($deployment.Outputs.sshCommand.Value)
Public IP: $($deployment.Outputs.publicIpAddress.Value)
DNS Name: $($deployment.Outputs.publicDnsName.Value)

LoRaWAN Endpoints:
------------------
Gateway Address: $($deployment.Outputs.gatewayAddress.Value)
gRPC API: $($deployment.Outputs.grpcApiUrl.Value)

Database:
---------
Host: $($deployment.Outputs.databaseHost.Value)

Monitoring:
-----------
Log Analytics Workspace: $($deployment.Outputs.logAnalyticsWorkspaceId.Value)
Application Insights: $($deployment.Outputs.applicationInsightsConnectionString.Value)
"@ | Out-File -FilePath $outputFile -Encoding UTF8
    
    Write-Host "`n💾 Deployment info saved to: $outputFile" -ForegroundColor Green
}
catch {
    Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║            Deployment Failed!                        ║" -ForegroundColor Red
    Write-Host "╚══════════════════════════════════════════════════════╝`n" -ForegroundColor Red
    
    Write-Host "Error Details:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.InnerException) {
        Write-Host "`nInner Exception:" -ForegroundColor Red
        Write-Host $_.Exception.InnerException.Message -ForegroundColor Red
    }
    
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check Azure portal for detailed error messages" -ForegroundColor White
    Write-Host "2. Verify you have sufficient Azure credits/quota" -ForegroundColor White
    Write-Host "3. Ensure passwords meet complexity requirements" -ForegroundColor White
    Write-Host "4. Review deployment logs in the Azure portal" -ForegroundColor White
    
    exit 1
}
