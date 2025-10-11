#!/usr/bin/env pwsh
# ==============================================================================
# TTS Azure Deployment Script
# Deploys The Things Stack to Azure with proper orchestration:
# 1. Collect parameters
# 2. Create resource group
# 3. Create Key Vault
# 4. Add all secrets
# 5. Confirm secrets
# 6. Deploy template
# ==============================================================================

param(
    [string]$Location = "centralus",
    [string]$EnvironmentName = "tts-prod",
    [string]$AdminEmail = "",
    [string]$DomainName = ""
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "  TTS Azure Deployment Script" -ForegroundColor Cyan
Write-Host "  Let's Encrypt SSL Enabled" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# ============================================================================
# STEP 1: COLLECT PARAMETERS
# ============================================================================

Write-Host "STEP 1: Collecting Parameters`n" -ForegroundColor Yellow

# Prompt for admin email if not provided
if ([string]::IsNullOrEmpty($AdminEmail)) {
    $AdminEmail = Read-Host "Enter admin email address (for Let's Encrypt & TTS admin)"
}

# Validate email format
if ($AdminEmail -notmatch '^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$') {
    Write-Error "Invalid email format: $AdminEmail"
    exit 1
}

# Prompt for domain name if not provided
if ([string]::IsNullOrEmpty($DomainName)) {
    Write-Host "`nDomain name (leave empty for auto-generated Azure domain):" -ForegroundColor Yellow
    $DomainName = Read-Host
}

# Prompt for passwords securely
Write-Host "`nEnter VM/Database admin password (alphanumeric only, 12+ chars):" -ForegroundColor Yellow
$vmAdminPassword = Read-Host -AsSecureString

Write-Host "Enter TTS admin password (for console login, 12+ chars):" -ForegroundColor Yellow
$ttsAdminPassword = Read-Host -AsSecureString

# Convert secure strings to plain text for Key Vault operations
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($vmAdminPassword)
$vmAdminPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ttsAdminPassword)
$ttsAdminPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

# Generate cookie keys
$cookieHashKey = -join ((0..63) | ForEach-Object { '{0:X}' -f (Get-Random -Maximum 16) })
$cookieBlockKey = -join ((0..63) | ForEach-Object { '{0:X}' -f (Get-Random -Maximum 16) })

# Generate OAuth client secret
$oauthClientSecret = "console"

# TTS admin username
$ttsAdminUsername = "ttsadmin"

# Generate checksum
$checksum = -join ((0..31) | ForEach-Object { '{0:X}' -f (Get-Random -Maximum 16) })

Write-Host "`n✓ Parameters collected" -ForegroundColor Green

# ============================================================================
# STEP 2: CREATE RESOURCE GROUP
# ============================================================================

Write-Host "`nSTEP 2: Creating Resource Group`n" -ForegroundColor Yellow

$timestamp = Get-Date -Format "yyyyMMddHHmm"
$resourceGroupName = "rg-tts-$timestamp"

Write-Host "Creating resource group: $resourceGroupName" -ForegroundColor Cyan
New-AzResourceGroup -Name $resourceGroupName -Location $Location -Force | Out-Null
Write-Host "✓ Resource group created" -ForegroundColor Green

# ============================================================================
# STEP 3: CREATE KEY VAULT
# ============================================================================

Write-Host "`nSTEP 3: Creating Key Vault`n" -ForegroundColor Yellow

$kvSuffix = -join ((48..57) + (97..102) | Get-Random -Count 8 | ForEach-Object {[char]$_})
$keyVaultName = "kv-tts-$kvSuffix"

Write-Host "Creating Key Vault: $keyVaultName" -ForegroundColor Cyan

try {
    $kv = New-AzKeyVault `
        -Name $keyVaultName `
        -ResourceGroupName $resourceGroupName `
        -Location $Location `
        -EnabledForTemplateDeployment `
        -EnabledForDeployment `
        -EnabledForDiskEncryption `
        -SoftDeleteRetentionInDays 7
    
    Write-Host "✓ Key Vault created" -ForegroundColor Green
}
catch {
    Write-Error "Failed to create Key Vault: $_"
    exit 1
}

# Wait for Key Vault to be ready
Start-Sleep -Seconds 10

# ============================================================================
# STEP 4: ADD SECRETS TO KEY VAULT
# ============================================================================

Write-Host "`nSTEP 4: Adding Secrets to Key Vault`n" -ForegroundColor Yellow

# Get current user for access policy
$currentUser = Get-AzContext
$currentUserId = (Get-AzADUser -UserPrincipalName $currentUser.Account.Id -ErrorAction SilentlyContinue).Id

if (-not $currentUserId) {
    # Fallback to signed-in user object ID from token
    $currentUserId = (Get-AzADUser -SignedIn).Id
}

# Set access policy for current user to manage secrets
Write-Host "Setting Key Vault access policy..." -ForegroundColor Cyan
try {
    Set-AzKeyVaultAccessPolicy `
        -VaultName $keyVaultName `
        -ObjectId $currentUserId `
        -PermissionsToSecrets Get,List,Set,Delete,Recover,Backup,Restore,Purge `
        -ErrorAction Stop | Out-Null
    
    Write-Host "✓ Access policy set" -ForegroundColor Green
    Write-Host "Waiting for permissions to propagate (60 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 60  # Longer wait for policy propagation
}
catch {
    Write-Warning "Failed to set access policy: $_"
    Write-Host "Attempting to continue..." -ForegroundColor Yellow
}

# Define all secrets
$secrets = @{
    "db-password" = $vmAdminPasswordPlain
    "tts-admin-password" = $ttsAdminPasswordPlain
    "tts-admin-username" = $ttsAdminUsername
    "cookie-hash-key" = $cookieHashKey
    "cookie-block-key" = $cookieBlockKey
    "oauth-client-secret" = $oauthClientSecret
    "admin-email" = $AdminEmail
    "checksum" = $checksum
}

# Add each secret with retry logic
foreach ($secretName in $secrets.Keys) {
    $retryCount = 0
    $maxRetries = 5
    $success = $false
    
    while (-not $success -and $retryCount -lt $maxRetries) {
        try {
            $secureValue = ConvertTo-SecureString -String $secrets[$secretName] -AsPlainText -Force
            Set-AzKeyVaultSecret -VaultName $keyVaultName -Name $secretName -SecretValue $secureValue -ErrorAction Stop | Out-Null
            Write-Host "  ✓ $secretName" -ForegroundColor Green
            $success = $true
        }
        catch {
            $retryCount++
            if ($retryCount -lt $maxRetries) {
                Write-Host "  ⚠ $secretName (retry $retryCount/$maxRetries in 10s...)" -ForegroundColor Yellow
                Start-Sleep -Seconds 10
            }
            else {
                Write-Error "Failed to add secret '$secretName' after $maxRetries attempts: $_"
                exit 1
            }
        }
    }
}

Write-Host "`n✓ All secrets added" -ForegroundColor Green

# ============================================================================
# STEP 5: CONFIRM SECRETS
# ============================================================================

Write-Host "`nSTEP 5: Confirming Secrets`n" -ForegroundColor Yellow

Start-Sleep -Seconds 5

try {
    $storedSecrets = Get-AzKeyVaultSecret -VaultName $keyVaultName
    
    foreach ($secret in $storedSecrets) {
        Write-Host "  ✓ $($secret.Name)" -ForegroundColor Green
    }
    
    $expectedCount = $secrets.Count
    $actualCount = $storedSecrets.Count
    
    if ($actualCount -eq $expectedCount) {
        Write-Host "`n✓ All $actualCount secrets confirmed" -ForegroundColor Green
    }
    else {
        Write-Warning "Expected $expectedCount secrets, found $actualCount"
    }
}
catch {
    Write-Error "Failed to confirm secrets: $_"
    exit 1
}

# ============================================================================
# STEP 6: DEPLOY TEMPLATE
# ============================================================================

Write-Host "`nSTEP 6: Deploying Infrastructure`n" -ForegroundColor Yellow

$deploymentParams = @{
    ResourceGroupName     = $resourceGroupName
    TemplateFile          = ".\deployments\vm\tts-docker-deployment.bicep"
    location              = $Location
    environmentName       = $EnvironmentName
    adminUsername         = "ttsadmin"
    adminPassword         = $vmAdminPassword
    adminEmail            = $AdminEmail
    keyVaultName          = $keyVaultName
    ttsAdminPasswordParam = $ttsAdminPassword
    cookieHashKey         = $cookieHashKey
    cookieBlockKey        = $cookieBlockKey
    oauthClientSecret     = (ConvertTo-SecureString -String $oauthClientSecret -AsPlainText -Force)
    enableKeyVault        = $true
    enablePrivateDatabaseAccess = $true
    Verbose               = $true
}

if (-not [string]::IsNullOrEmpty($DomainName)) {
    $deploymentParams.domainName = $DomainName
}

Write-Host "Starting template deployment..." -ForegroundColor Cyan
Write-Host "  Resource Group: $resourceGroupName" -ForegroundColor Gray
Write-Host "  Location: $Location" -ForegroundColor Gray
Write-Host "  Environment: $EnvironmentName" -ForegroundColor Gray
Write-Host "  Key Vault: $keyVaultName" -ForegroundColor Gray
if ($DomainName) {
    Write-Host "  Domain: $DomainName" -ForegroundColor Gray
}
Write-Host "`nThis will take 15-20 minutes...`n" -ForegroundColor Yellow

try {
    $deployment = New-AzResourceGroupDeployment @deploymentParams
    
    Write-Host "`n╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║              Deployment Complete!                        ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════╝`n" -ForegroundColor Green
    
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
    
    Write-Host "`nKey Vault Details:" -ForegroundColor Cyan
    Write-Host "  Name: $keyVaultName" -ForegroundColor Gray
    Write-Host "  Secrets: $($secrets.Count)" -ForegroundColor Gray
    
    Write-Host "`nNext Steps:" -ForegroundColor Yellow
    Write-Host "  1. Wait for cloud-init to complete (5-10 minutes)" -ForegroundColor White
    Write-Host "  2. Let's Encrypt will obtain SSL certificates automatically" -ForegroundColor White
    Write-Host "  3. Monitor progress: SSH to VM and run: docker logs lorawan-stack_stack_1 -f" -ForegroundColor White
    Write-Host "  4. Access console at the URL above once ready" -ForegroundColor White
    Write-Host "`n" -ForegroundColor White
}
catch {
    Write-Host "`n✗ Deployment failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Clean up sensitive variables
Remove-Variable vmAdminPasswordPlain -ErrorAction SilentlyContinue
Remove-Variable ttsAdminPasswordPlain -ErrorAction SilentlyContinue
