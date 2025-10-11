#!/usr/bin/env pwsh
# ==============================================================================
# Simple TTS Deployment Script
# Deploys The Things Stack to Azure with minimal prompts
# ==============================================================================

param(
    [string]$Location = "centralus",
    [string]$EnvironmentName = "tts-prod",
    [string]$AdminEmail = "",
    [switch]$UseExistingKeyVault,
    [string]$KeyVaultName = ""
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "  TTS Azure Deployment Script" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Prompt for admin email if not provided
if ([string]::IsNullOrEmpty($AdminEmail)) {
    $AdminEmail = Read-Host "Enter admin email address"
}

# Validate email format
if ($AdminEmail -notmatch '^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$') {
    Write-Error "Invalid email format: $AdminEmail"
    exit 1
}

# Generate resource group name with timestamp
$timestamp = Get-Date -Format "yyyyMMddHHmm"
$resourceGroupName = "rg-tts-$timestamp"

Write-Host "Creating resource group: $resourceGroupName" -ForegroundColor Yellow
New-AzResourceGroup -Name $resourceGroupName -Location $Location -Force | Out-Null

# Generate or use existing Key Vault name
if ([string]::IsNullOrEmpty($KeyVaultName)) {
    $kvSuffix = -join ((48..57) + (97..102) | Get-Random -Count 8 | ForEach-Object {[char]$_})
    $KeyVaultName = "kv-tts-$kvSuffix"
}

Write-Host "Key Vault: $KeyVaultName" -ForegroundColor Yellow

# Prompt for passwords securely
Write-Host "`nEnter VM admin password (for SSH access):" -ForegroundColor Yellow
$vmAdminPassword = Read-Host -AsSecureString

Write-Host "Enter TTS admin password (for console login):" -ForegroundColor Yellow
$ttsAdminPassword = Read-Host -AsSecureString

# Prepare deployment parameters
$deploymentParams = @{
    ResourceGroupName     = $resourceGroupName
    TemplateFile          = ".\deployments\vm\tts-docker-deployment.bicep"
    location              = $Location
    environmentName       = $EnvironmentName
    adminUsername         = "ttsadmin"
    adminPassword         = $vmAdminPassword
    adminEmail            = $AdminEmail
    keyVaultName          = $KeyVaultName
    ttsAdminPasswordParam = $ttsAdminPassword
    enableKeyVault        = $true
    Verbose               = $true
}

Write-Host "`nStarting deployment..." -ForegroundColor Green
Write-Host "Resource Group: $resourceGroupName" -ForegroundColor Cyan
Write-Host "Location: $Location" -ForegroundColor Cyan
Write-Host "Environment: $EnvironmentName" -ForegroundColor Cyan

try {
    $deployment = New-AzResourceGroupDeployment @deploymentParams
    
    Write-Host "`n================================" -ForegroundColor Green
    Write-Host "  Deployment Complete!" -ForegroundColor Green
    Write-Host "================================`n" -ForegroundColor Green
    
    Write-Host "Console URL: " -NoNewline
    Write-Host $deployment.Outputs.consoleUrl.Value -ForegroundColor Yellow
    
    Write-Host "SSH Command: " -NoNewline
    Write-Host $deployment.Outputs.sshCommand.Value -ForegroundColor Yellow
    
    Write-Host "Admin Username: " -NoNewline
    Write-Host $deployment.Outputs.adminCredentials.Value.username -ForegroundColor Yellow
    
    Write-Host "Admin Email: " -NoNewline
    Write-Host $deployment.Outputs.adminCredentials.Value.email -ForegroundColor Yellow
    
    Write-Host "`nGateway Address: " -NoNewline
    Write-Host $deployment.Outputs.gatewayAddress.Value -ForegroundColor Cyan
    
    Write-Host "gRPC API: " -NoNewline
    Write-Host $deployment.Outputs.grpcApiUrl.Value -ForegroundColor Cyan
    
    Write-Host "`nNote: TTS is initializing in the background. Allow 5-10 minutes for full startup." -ForegroundColor Yellow
    Write-Host "Monitor progress: " -NoNewline
    Write-Host $deployment.Outputs.quickStartGuide.Value -ForegroundColor Cyan
}
catch {
    Write-Host "`nDeployment failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
