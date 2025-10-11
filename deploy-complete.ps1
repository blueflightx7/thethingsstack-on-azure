#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Complete deployment script for The Things Stack on Azure with proper Key Vault setup
.DESCRIPTION
    This script follows the proper deployment flow:
    1. Collect all parameters upfront
    2. Create resource group
    3. Create Key Vault
    4. Populate all secrets
    5. Confirm secrets
    6. Deploy Bicep template
    
    Uses Let's Encrypt for SSL certificates (publicly signed certificates only).
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$Location = "centralus",
    
    [Parameter(Mandatory=$false)]
    [string]$EnvironmentName = "tts-prod",
    
    [Parameter(Mandatory=$false)]
    [string]$VMSize = "Standard_B4ms",
    
    [Parameter(Mandatory=$false)]
    [string]$DomainName = "",
    
    [Parameter(Mandatory=$false)]
    [string]$AdminEmail = "",
    
    [Parameter(Mandatory=$false)]
    [string]$AdminSourceIP = "0.0.0.0/0",
    
    [Parameter(Mandatory=$false)]
    [switch]$DisablePrivateDatabase,
    
    [Parameter(Mandatory=$false)]
    [string]$TemplatePath = "deployments/vm/tts-docker-deployment.bicep"
)

# Banner
Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║  The Things Stack on Azure - Complete Deployment            ║
║  Proper orchestration with Key Vault pre-configuration      ║
║  Let's Encrypt SSL Certificates                             ║
╔══════════════════════════════════════════════════════════════╗
"@ -ForegroundColor Cyan

# ============================================================================
# STEP 1: COLLECT ALL PARAMETERS UPFRONT
# ============================================================================

Write-Host "`n📋 STEP 1: Collecting all deployment parameters..." -ForegroundColor Yellow

# Admin email (required for Let's Encrypt)
if ([string]::IsNullOrEmpty($AdminEmail)) {
    $AdminEmail = Read-Host "Enter admin email address (required for certificates and admin user)"
}

# Admin username
$AdminUsername = Read-Host "Enter admin username for VM (default: ttsadmin)" 
if ([string]::IsNullOrEmpty($AdminUsername)) {
    $AdminUsername = "ttsadmin"
}

# VM Admin Password
Write-Host "`nEnter VM admin password (for SSH access):" -ForegroundColor Cyan
$vmAdminPassword = Read-Host -AsSecureString
$vmAdminPasswordText = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($vmAdminPassword))

# TTS Admin Password
Write-Host "`nEnter TTS console admin password:" -ForegroundColor Cyan
$ttsAdminPassword = Read-Host -AsSecureString
$ttsAdminPasswordText = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ttsAdminPassword))

# Database Password
Write-Host "`nEnter PostgreSQL database password:" -ForegroundColor Cyan
$dbPassword = Read-Host -AsSecureString
$dbPasswordText = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

# TTS Admin Username (for console login)
$ttsAdminUsername = Read-Host "Enter TTS console admin username (default: ttsadmin)"
if ([string]::IsNullOrEmpty($ttsAdminUsername)) {
    $ttsAdminUsername = "ttsadmin"
}

# Generate cryptographic keys
Write-Host "`n🔐 Generating cryptographic keys..." -ForegroundColor Cyan
function Get-RandomHexString {
    param([int]$Length = 64)
    $bytes = New-Object byte[] ($Length / 2)
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($bytes)
    return ($bytes | ForEach-Object { $_.ToString("X2") }) -join ''
}

$cookieHashKey = Get-RandomHexString -Length 64
$cookieBlockKey = Get-RandomHexString -Length 64
$oauthClientSecret = Get-RandomHexString -Length 32

# Generate checksum for configuration verification
$configChecksum = (Get-FileHash -InputStream ([System.IO.MemoryStream]::new([System.Text.Encoding]::UTF8.GetBytes("$EnvironmentName-$AdminEmail-$AdminUsername"))) -Algorithm SHA256).Hash

# Display collected parameters
Write-Host "`n✅ Parameters collected:" -ForegroundColor Green
Write-Host "  Location: $Location" -ForegroundColor Cyan
Write-Host "  Environment: $EnvironmentName" -ForegroundColor Cyan
Write-Host "  VM Size: $VMSize" -ForegroundColor Cyan
Write-Host "  Admin Email: $AdminEmail" -ForegroundColor Cyan
Write-Host "  Admin Username: $AdminUsername" -ForegroundColor Cyan
Write-Host "  TTS Admin Username: $ttsAdminUsername" -ForegroundColor Cyan
Write-Host "  Admin Source IP: $AdminSourceIP" -ForegroundColor Cyan
Write-Host "  Private Database: $(-not $DisablePrivateDatabase)" -ForegroundColor Cyan
Write-Host "  SSL Certificates: Let's Encrypt (publicly signed)" -ForegroundColor Cyan

# Confirm to proceed
$confirm = Read-Host "`nProceed with deployment? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "❌ Deployment cancelled by user" -ForegroundColor Red
    exit 1
}

# ============================================================================
# STEP 2: CREATE RESOURCE GROUP
# ============================================================================

Write-Host "`n📦 STEP 2: Creating resource group..." -ForegroundColor Yellow

$timestamp = Get-Date -Format "yyyyMMddHHmm"
$resourceGroupName = "rg-$EnvironmentName-$timestamp"

try {
    $rg = New-AzResourceGroup -Name $resourceGroupName -Location $Location -Force
    Write-Host "✅ Resource group created: $resourceGroupName" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create resource group: $_" -ForegroundColor Red
    exit 1
}

# ============================================================================
# STEP 3: CREATE KEY VAULT
# ============================================================================

Write-Host "`n🔑 STEP 3: Creating Key Vault..." -ForegroundColor Yellow

$kvSuffix = -join ((48..57) + (97..102) | Get-Random -Count 8 | ForEach-Object {[char]$_})
$keyVaultName = "kv-$EnvironmentName-$kvSuffix"

try {
    $kv = New-AzKeyVault `
        -Name $keyVaultName `
        -ResourceGroupName $resourceGroupName `
        -Location $Location `
        -EnabledForTemplateDeployment `
        -EnabledForDeployment `
        -EnabledForDiskEncryption `
        -EnableRbacAuthorization `
        -SoftDeleteRetentionInDays 7 `
        -Sku Standard

    Write-Host "✅ Key Vault created: $keyVaultName" -ForegroundColor Green
    
    # Wait for Key Vault to be fully provisioned
    Start-Sleep -Seconds 10
    
} catch {
    Write-Host "❌ Failed to create Key Vault: $_" -ForegroundColor Red
    Write-Host "Cleaning up resource group..." -ForegroundColor Yellow
    Remove-AzResourceGroup -Name $resourceGroupName -Force
    exit 1
}

# ============================================================================
# STEP 4: GRANT CURRENT USER ACCESS TO KEY VAULT
# ============================================================================

Write-Host "`n🔐 STEP 4: Granting Key Vault access..." -ForegroundColor Yellow

try {
    $currentUser = (Get-AzContext).Account.Id
    $keyVaultSecretsOfficerRole = "Key Vault Secrets Officer"
    
    # Get current user's object ID
    $user = Get-AzADUser -UserPrincipalName $currentUser -ErrorAction SilentlyContinue
    if (-not $user) {
        # Try as service principal
        $user = Get-AzADServicePrincipal -ApplicationId $currentUser -ErrorAction SilentlyContinue
    }
    
    if ($user) {
        $roleAssignment = New-AzRoleAssignment `
            -ObjectId $user.Id `
            -RoleDefinitionName $keyVaultSecretsOfficerRole `
            -Scope $kv.ResourceId `
            -ErrorAction SilentlyContinue
        
        Write-Host "✅ Access granted to current user" -ForegroundColor Green
        
        # Wait for RBAC to propagate
        Write-Host "⏳ Waiting for RBAC permissions to propagate (30 seconds)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 30
    } else {
        Write-Host "⚠️  Could not find current user, proceeding anyway..." -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "⚠️  Warning: Failed to grant access: $_" -ForegroundColor Yellow
    Write-Host "   Continuing anyway, you may need to manually grant access..." -ForegroundColor Yellow
}

# ============================================================================
# STEP 5: POPULATE ALL SECRETS
# ============================================================================

Write-Host "`n🔒 STEP 5: Populating Key Vault secrets..." -ForegroundColor Yellow

$secrets = @{
    "db-password" = $dbPasswordText
    "tts-admin-password" = $ttsAdminPasswordText
    "cookie-hash-key" = $cookieHashKey
    "cookie-block-key" = $cookieBlockKey
    "oauth-client-secret" = $oauthClientSecret
    "config-checksum" = $configChecksum
    "admin-email" = $AdminEmail
    "tts-admin-username" = $ttsAdminUsername
}

$secretsAdded = 0
$secretsFailed = 0

foreach ($secretName in $secrets.Keys) {
    try {
        $secretValue = ConvertTo-SecureString -String $secrets[$secretName] -AsPlainText -Force
        $null = Set-AzKeyVaultSecret -VaultName $keyVaultName -Name $secretName -SecretValue $secretValue -ErrorAction Stop
        Write-Host "  ✅ $secretName" -ForegroundColor Green
        $secretsAdded++
    } catch {
        Write-Host "  ❌ $secretName : $_" -ForegroundColor Red
        $secretsFailed++
    }
}

Write-Host "`nSecrets Summary:" -ForegroundColor Cyan
Write-Host "  Added: $secretsAdded" -ForegroundColor Green
Write-Host "  Failed: $secretsFailed" -ForegroundColor $(if ($secretsFailed -eq 0) { "Green" } else { "Red" })

if ($secretsFailed -gt 0) {
    Write-Host "`n⚠️  Some secrets failed to be added. Do you want to continue? (yes/no)" -ForegroundColor Yellow
    $confirmContinue = Read-Host
    if ($confirmContinue -ne "yes") {
        Write-Host "❌ Deployment cancelled. Cleaning up..." -ForegroundColor Red
        Remove-AzResourceGroup -Name $resourceGroupName -Force
        exit 1
    }
}

# ============================================================================
# STEP 6: CONFIRM SECRETS
# ============================================================================

Write-Host "`n🔍 STEP 6: Confirming all secrets are accessible..." -ForegroundColor Yellow

Start-Sleep -Seconds 5  # Give a moment for secrets to be fully committed

$confirmedSecrets = @()
$missingSecrets = @()

foreach ($secretName in $secrets.Keys) {
    try {
        $secret = Get-AzKeyVaultSecret -VaultName $keyVaultName -Name $secretName -ErrorAction Stop
        if ($secret) {
            $confirmedSecrets += $secretName
            Write-Host "  ✅ $secretName confirmed" -ForegroundColor Green
        } else {
            $missingSecrets += $secretName
            Write-Host "  ❌ $secretName not found!" -ForegroundColor Red
        }
    } catch {
        $missingSecrets += $secretName
        Write-Host "  ❌ $secretName error: $_" -ForegroundColor Red
    }
}

Write-Host "`nConfirmation Summary:" -ForegroundColor Cyan
Write-Host "  Confirmed: $($confirmedSecrets.Count)" -ForegroundColor Green
Write-Host "  Missing: $($missingSecrets.Count)" -ForegroundColor $(if ($missingSecrets.Count -eq 0) { "Green" } else { "Red" })

if ($missingSecrets.Count -gt 0) {
    Write-Host "`n❌ The following secrets are missing:" -ForegroundColor Red
    $missingSecrets | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    
    Write-Host "`nDo you want to continue anyway? (yes/no)" -ForegroundColor Yellow
    $confirmContinue = Read-Host
    if ($confirmContinue -ne "yes") {
        Write-Host "❌ Deployment cancelled. Cleaning up..." -ForegroundColor Red
        Remove-AzResourceGroup -Name $resourceGroupName -Force
        exit 1
    }
}

# ============================================================================
# STEP 7: DEPLOY BICEP TEMPLATE
# ============================================================================

Write-Host "`n🚀 STEP 7: Deploying Bicep template..." -ForegroundColor Yellow

$deploymentParams = @{
    location = $Location
    environmentName = $EnvironmentName
    adminUsername = $AdminUsername
    adminPassword = $vmAdminPassword
    vmSize = $VMSize
    keyVaultName = $keyVaultName
    adminEmail = $AdminEmail
    adminSourceIP = $AdminSourceIP
    enablePrivateDatabaseAccess = -not $DisablePrivateDatabase
    enableKeyVault = $true
    ttsAdminPasswordParam = $ttsAdminPassword
    cookieHashKey = $cookieHashKey
    cookieBlockKey = $cookieBlockKey
    oauthClientSecret = ConvertTo-SecureString -String $oauthClientSecret -AsPlainText -Force
}

if (-not [string]::IsNullOrEmpty($DomainName)) {
    $deploymentParams.domainName = $DomainName
}

try {
    Write-Host "`nStarting template deployment..." -ForegroundColor Cyan
    Write-Host "This will take 15-20 minutes. Please wait..." -ForegroundColor Yellow
    
    $deployment = New-AzResourceGroupDeployment `
        -Name "tts-deployment-$timestamp" `
        -ResourceGroupName $resourceGroupName `
        -TemplateFile $TemplatePath `
        -TemplateParameterObject $deploymentParams `
        -Verbose
    
    if ($deployment.ProvisioningState -eq "Succeeded") {
        Write-Host "`n✅ DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green -BackgroundColor DarkGreen
        
        Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
        Write-Host "║             DEPLOYMENT COMPLETE - ACCESS INFO                ║" -ForegroundColor Cyan
        Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
        
        Write-Host "`n🌐 Access Information:" -ForegroundColor Yellow
        Write-Host "  Console URL: $($deployment.Outputs.consoleUrl.Value)" -ForegroundColor Cyan
        Write-Host "  Gateway Address: $($deployment.Outputs.gatewayAddress.Value)" -ForegroundColor Cyan
        Write-Host "  gRPC API: $($deployment.Outputs.grpcApiUrl.Value)" -ForegroundColor Cyan
        
        Write-Host "`n👤 Admin Credentials:" -ForegroundColor Yellow
        Write-Host "  Username: $ttsAdminUsername" -ForegroundColor Cyan
        Write-Host "  Email: $AdminEmail" -ForegroundColor Cyan
        
        Write-Host "`n🔧 SSH Access:" -ForegroundColor Yellow
        Write-Host "  $($deployment.Outputs.sshCommand.Value)" -ForegroundColor Cyan
        
        Write-Host "`n📊 Monitoring:" -ForegroundColor Yellow
        Write-Host "  Log Analytics: $($deployment.Outputs.logAnalyticsWorkspaceId.Value)" -ForegroundColor Cyan
        Write-Host "  App Insights: $($deployment.Outputs.applicationInsightsInstrumentationKey.Value)" -ForegroundColor Cyan
        
        Write-Host "`n🔑 Key Vault:" -ForegroundColor Yellow
        Write-Host "  Name: $keyVaultName" -ForegroundColor Cyan
        Write-Host "  Secrets stored: $($confirmedSecrets.Count)" -ForegroundColor Cyan
        
        Write-Host "`n📝 Quick Start:" -ForegroundColor Yellow
        Write-Host "  $($deployment.Outputs.quickStartGuide.Value)" -ForegroundColor Cyan
        
        Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
        
    } else {
        Write-Host "`n❌ Deployment failed with state: $($deployment.ProvisioningState)" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "`n❌ Deployment failed: $_" -ForegroundColor Red
    Write-Host "`nDo you want to keep the resource group for troubleshooting? (yes/no)" -ForegroundColor Yellow
    $keepRg = Read-Host
    if ($keepRg -ne "yes") {
        Write-Host "Cleaning up resource group..." -ForegroundColor Yellow
        Remove-AzResourceGroup -Name $resourceGroupName -Force
    }
    exit 1
}

Write-Host "`n✅ Script completed successfully!" -ForegroundColor Green
