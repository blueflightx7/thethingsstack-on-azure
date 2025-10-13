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
    [string]$Location = "",
    [string]$EnvironmentName = "tts-prod",
    [string]$AdminEmail = "",
    [string]$DomainName = "",
    [string]$ResourceGroupName = "",
    [string]$VNetName = "",
    [string]$SubnetName = "",
    [bool]$UseCustomAcr = $false,
    [string]$AcrName = ""
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

# Prompt for Azure region if not provided
if ([string]::IsNullOrEmpty($Location)) {
    Write-Host "`nAvailable Azure Regions (Popular):" -ForegroundColor Cyan
    Write-Host "  1. centralus (Central US)" -ForegroundColor White
    Write-Host "  2. eastus (East US)" -ForegroundColor White
    Write-Host "  3. westus2 (West US 2)" -ForegroundColor White
    Write-Host "  4. westeurope (West Europe)" -ForegroundColor White
    Write-Host "  5. northeurope (North Europe)" -ForegroundColor White
    Write-Host "  6. eastasia (East Asia)" -ForegroundColor White
    Write-Host "  7. southeastasia (Southeast Asia)" -ForegroundColor White
    Write-Host "  8. Custom (enter your own)`n" -ForegroundColor White
    
    $regionChoice = Read-Host "Select region (1-8, or press Enter for default: centralus)"
    
    switch ($regionChoice) {
        "1" { $Location = "centralus" }
        "2" { $Location = "eastus" }
        "3" { $Location = "westus2" }
        "4" { $Location = "westeurope" }
        "5" { $Location = "northeurope" }
        "6" { $Location = "eastasia" }
        "7" { $Location = "southeastasia" }
        "8" { $Location = Read-Host "Enter Azure region name" }
        default { $Location = "centralus" }
    }
    
    Write-Host "✓ Selected region: $Location" -ForegroundColor Green
}

# Prompt for admin email if not provided
if ([string]::IsNullOrEmpty($AdminEmail)) {
    $AdminEmail = Read-Host "`nEnter admin email address (for Let's Encrypt & TTS admin)"
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

# Detect deployer's public IP for SSH access restriction
Write-Host "`nDetecting your public IP for SSH access restriction..." -ForegroundColor Cyan
try {
    $deployerIP = (Invoke-RestMethod -Uri 'https://api.ipify.org?format=json' -TimeoutSec 10).ip
    Write-Host "✓ Detected deployer IP: $deployerIP" -ForegroundColor Green
    Write-Host "  SSH access will be restricted to this IP for security" -ForegroundColor Yellow
} catch {
    Write-Host "⚠ Could not detect public IP. SSH will default to ANY (not recommended for production)" -ForegroundColor Red
    $response = Read-Host "Enter your public IP address manually (or press Enter to allow from ANY)"
    if ($response) {
        $deployerIP = $response
        Write-Host "✓ Using IP: $deployerIP" -ForegroundColor Green
    } else {
        $deployerIP = "*"
        Write-Host "⚠ WARNING: SSH will be accessible from ANY IP address" -ForegroundColor Red
    }
}

# ============================================================================
# STEP 2: RESOURCE GROUP CONFIGURATION
# ============================================================================

Write-Host "`nSTEP 2: Resource Group Configuration`n" -ForegroundColor Yellow

# Check if user wants to use existing resource group
if ([string]::IsNullOrEmpty($ResourceGroupName)) {
    $useExisting = Read-Host "Do you have an existing resource group to use? (y/N)"
    
    if ($useExisting -eq 'y' -or $useExisting -eq 'Y') {
        # List available resource groups
        Write-Host "`nFetching available resource groups..." -ForegroundColor Cyan
        $existingRGs = Get-AzResourceGroup | Select-Object -ExpandProperty ResourceGroupName
        
        if ($existingRGs.Count -eq 0) {
            Write-Host "No existing resource groups found. Creating a new one." -ForegroundColor Yellow
            $useExisting = 'n'
        } else {
            Write-Host "`nAvailable Resource Groups:" -ForegroundColor Cyan
            for ($i = 0; $i -lt $existingRGs.Count; $i++) {
                Write-Host "  $($i + 1). $($existingRGs[$i])" -ForegroundColor White
            }
            
            $rgChoice = Read-Host "`nSelect resource group (1-$($existingRGs.Count)), or press Enter to create new"
            
            if ($rgChoice -and $rgChoice -match '^\d+$' -and [int]$rgChoice -le $existingRGs.Count -and [int]$rgChoice -gt 0) {
                $ResourceGroupName = $existingRGs[[int]$rgChoice - 1]
                Write-Host "✓ Using existing resource group: $ResourceGroupName" -ForegroundColor Green
                
                # Get location from existing RG
                $existingRG = Get-AzResourceGroup -Name $ResourceGroupName
                $Location = $existingRG.Location
                Write-Host "  Location: $Location" -ForegroundColor Gray
            } else {
                $useExisting = 'n'
            }
        }
    }
    
    # Create new resource group if not using existing
    if ($useExisting -ne 'y' -and $useExisting -ne 'Y') {
        $timestamp = Get-Date -Format "yyyyMMddHHmm"
        $ResourceGroupName = "rg-tts-$timestamp"
        
        Write-Host "Creating new resource group: $ResourceGroupName" -ForegroundColor Cyan
        New-AzResourceGroup -Name $ResourceGroupName -Location $Location -Force | Out-Null
        Write-Host "✓ Resource group created" -ForegroundColor Green
    }
} else {
    # Resource group name provided via parameter
    $existingRG = Get-AzResourceGroup -Name $ResourceGroupName -ErrorAction SilentlyContinue
    if ($existingRG) {
        Write-Host "Using existing resource group: $ResourceGroupName" -ForegroundColor Green
        $Location = $existingRG.Location
        Write-Host "  Location: $Location" -ForegroundColor Gray
    } else {
        Write-Host "Creating new resource group: $ResourceGroupName" -ForegroundColor Cyan
        New-AzResourceGroup -Name $ResourceGroupName -Location $Location -Force | Out-Null
        Write-Host "✓ Resource group created" -ForegroundColor Green
    }
}

# ============================================================================
# STEP 3: NETWORK CONFIGURATION
# ============================================================================

Write-Host "`nSTEP 3: Network Configuration`n" -ForegroundColor Yellow

$createNewVNet = $true
$vnetResourceId = ""
$subnetResourceId = ""

# Check if user wants to use existing VNet
if ([string]::IsNullOrEmpty($VNetName)) {
    $useExistingVNet = Read-Host "Do you have an existing VNet and Subnet to use? (y/N)"
    
    if ($useExistingVNet -eq 'y' -or $useExistingVNet -eq 'Y') {
        # List available VNets in the resource group
        Write-Host "`nFetching available VNets in $ResourceGroupName..." -ForegroundColor Cyan
        $existingVNets = Get-AzVirtualNetwork -ResourceGroupName $ResourceGroupName -ErrorAction SilentlyContinue
        
        if ($existingVNets.Count -eq 0) {
            Write-Host "No existing VNets found in this resource group. New VNet will be created." -ForegroundColor Yellow
            $createNewVNet = $true
        } else {
            Write-Host "`nAvailable VNets:" -ForegroundColor Cyan
            for ($i = 0; $i -lt $existingVNets.Count; $i++) {
                Write-Host "  $($i + 1). $($existingVNets[$i].Name) - $($existingVNets[$i].AddressSpace.AddressPrefixes -join ', ')" -ForegroundColor White
            }
            
            $vnetChoice = Read-Host "`nSelect VNet (1-$($existingVNets.Count)), or press Enter to create new"
            
            if ($vnetChoice -and $vnetChoice -match '^\d+$' -and [int]$vnetChoice -le $existingVNets.Count -and [int]$vnetChoice -gt 0) {
                $selectedVNet = $existingVNets[[int]$vnetChoice - 1]
                $VNetName = $selectedVNet.Name
                $vnetResourceId = $selectedVNet.Id
                
                Write-Host "✓ Selected VNet: $VNetName" -ForegroundColor Green
                
                # List subnets
                if ($selectedVNet.Subnets.Count -eq 0) {
                    Write-Host "  No subnets found in this VNet. New VNet will be created." -ForegroundColor Yellow
                    $createNewVNet = $true
                } else {
                    Write-Host "`n  Available Subnets:" -ForegroundColor Cyan
                    for ($i = 0; $i -lt $selectedVNet.Subnets.Count; $i++) {
                        Write-Host "    $($i + 1). $($selectedVNet.Subnets[$i].Name) - $($selectedVNet.Subnets[$i].AddressPrefix)" -ForegroundColor White
                    }
                    
                    $subnetChoice = Read-Host "`n  Select Subnet (1-$($selectedVNet.Subnets.Count))"
                    
                    if ($subnetChoice -and $subnetChoice -match '^\d+$' -and [int]$subnetChoice -le $selectedVNet.Subnets.Count -and [int]$subnetChoice -gt 0) {
                        $selectedSubnet = $selectedVNet.Subnets[[int]$subnetChoice - 1]
                        $SubnetName = $selectedSubnet.Name
                        $subnetResourceId = $selectedSubnet.Id
                        
                        Write-Host "  ✓ Selected Subnet: $SubnetName" -ForegroundColor Green
                        $createNewVNet = $false
                    } else {
                        Write-Host "  Invalid selection. New VNet will be created." -ForegroundColor Yellow
                        $createNewVNet = $true
                    }
                }
            } else {
                $createNewVNet = $true
            }
        }
    }
}

if ($createNewVNet) {
    Write-Host "✓ New VNet and Subnet will be created automatically by Bicep template" -ForegroundColor Green
}

# ============================================================================
# STEP 4: OPTIONAL ACR CONFIGURATION
# ============================================================================

Write-Host "`nSTEP 4: Container Registry Configuration`n" -ForegroundColor Yellow

if (-not $UseCustomAcr) {
    $useAcrChoice = Read-Host "Do you want to use Azure Container Registry for custom images? (y/N)"
    
    if ($useAcrChoice -eq 'y' -or $useAcrChoice -eq 'Y') {
        $UseCustomAcr = $true
        
        if ([string]::IsNullOrEmpty($AcrName)) {
            # List available ACRs
            Write-Host "`nFetching available Azure Container Registries..." -ForegroundColor Cyan
            $existingACRs = Get-AzContainerRegistry -ErrorAction SilentlyContinue
            
            if ($existingACRs.Count -eq 0) {
                Write-Host "No existing ACRs found. Please create one first or use Docker Hub." -ForegroundColor Yellow
                $UseCustomAcr = $false
            } else {
                Write-Host "`nAvailable Container Registries:" -ForegroundColor Cyan
                for ($i = 0; $i -lt $existingACRs.Count; $i++) {
                    Write-Host "  $($i + 1). $($existingACRs[$i].Name) - $($existingACRs[$i].LoginServer)" -ForegroundColor White
                }
                
                $acrChoice = Read-Host "`nSelect ACR (1-$($existingACRs.Count)), or press Enter to use Docker Hub"
                
                if ($acrChoice -and $acrChoice -match '^\d+$' -and [int]$acrChoice -le $existingACRs.Count -and [int]$acrChoice -gt 0) {
                    $AcrName = $existingACRs[[int]$acrChoice - 1].Name
                    Write-Host "✓ Using ACR: $AcrName" -ForegroundColor Green
                } else {
                    $UseCustomAcr = $false
                }
            }
        }
    }
}

if (-not $UseCustomAcr) {
    Write-Host "✓ Using official Docker Hub image: thethingsindustries/lorawan-stack:v3.30.2" -ForegroundColor Green
}

# ============================================================================
# STEP 5: COLLECT REMAINING PARAMETERS
# ============================================================================

Write-Host "`nSTEP 5: Additional Configuration`n" -ForegroundColor Yellow

# ============================================================================
# STEP 6: CREATE KEY VAULT
# ============================================================================

Write-Host "`nSTEP 6: Creating Key Vault`n" -ForegroundColor Yellow

$kvSuffix = -join ((48..57) + (97..102) | Get-Random -Count 8 | ForEach-Object {[char]$_})
$keyVaultName = "kv-tts-$kvSuffix"

Write-Host "Creating Key Vault: $keyVaultName" -ForegroundColor Cyan

try {
    # Get current user object ID for RBAC
    $currentUser = Get-AzContext
    $currentUserId = (Get-AzADUser -UserPrincipalName $currentUser.Account.Id -ErrorAction SilentlyContinue).Id
    
    if (-not $currentUserId) {
        $currentUserId = (Get-AzADUser -SignedIn -ErrorAction SilentlyContinue).Id
    }
    
    if (-not $currentUserId) {
        Write-Error "Could not determine current user object ID"
        exit 1
    }
    
    Write-Host "  Current User ID: $currentUserId" -ForegroundColor Gray
    
    # Create Key Vault (RBAC is enabled by default)
    New-AzKeyVault `
        -Name $keyVaultName `
        -ResourceGroupName $ResourceGroupName `
        -Location $Location `
        -EnabledForTemplateDeployment `
        -EnabledForDeployment `
        -SoftDeleteRetentionInDays 7 | Out-Null
    
    Write-Host "✓ Key Vault created with RBAC" -ForegroundColor Green
    
    # Assign Key Vault Secrets Officer role to current user
    Write-Host "Assigning Key Vault Secrets Officer role..." -ForegroundColor Cyan
    
    $kvResourceId = (Get-AzKeyVault -VaultName $keyVaultName -ResourceGroupName $ResourceGroupName).ResourceId
    
    New-AzRoleAssignment `
        -ObjectId $currentUserId `
        -RoleDefinitionName "Key Vault Secrets Officer" `
        -Scope $kvResourceId | Out-Null
    
    Write-Host "✓ RBAC role assigned" -ForegroundColor Green
    Write-Host "Waiting for RBAC propagation (30 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
}
catch {
    Write-Error "Failed to create Key Vault: $_"
    exit 1
}

# ============================================================================
# STEP 7: ADD SECRETS TO KEY VAULT
# ============================================================================

Write-Host "`nSTEP 7: Adding Secrets to Key Vault`n" -ForegroundColor Yellow

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

# Add each secret
foreach ($secretName in $secrets.Keys) {
    try {
        $secureValue = ConvertTo-SecureString -String $secrets[$secretName] -AsPlainText -Force
        Set-AzKeyVaultSecret -VaultName $keyVaultName -Name $secretName -SecretValue $secureValue -ErrorAction Stop | Out-Null
        Write-Host "  ✓ $secretName" -ForegroundColor Green
    }
    catch {
        Write-Error "Failed to add secret '$secretName': $_"
        exit 1
    }
}

Write-Host "`n✓ All secrets added" -ForegroundColor Green

# ============================================================================
# STEP 8: CONFIRM SECRETS
# ============================================================================

Write-Host "`nSTEP 8: Confirming Secrets`n" -ForegroundColor Yellow

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
# STEP 9: DEPLOY TEMPLATE
# ============================================================================

Write-Host "`nSTEP 9: Deploying Infrastructure`n" -ForegroundColor Yellow

$deploymentParams = @{
    ResourceGroupName     = $ResourceGroupName
    TemplateFile          = ".\deployments\vm\tts-docker-deployment.bicep"
    location              = $Location
    environmentName       = $EnvironmentName
    adminUsername         = "ttsadmin"
    adminPassword         = $vmAdminPassword
    adminEmail            = $AdminEmail
    adminSourceIP         = $deployerIP
    keyVaultName          = $keyVaultName
    ttsAdminPasswordParam = $ttsAdminPassword
    cookieHashKey         = $cookieHashKey
    cookieBlockKey        = $cookieBlockKey
    oauthClientSecret     = (ConvertTo-SecureString -String $oauthClientSecret -AsPlainText -Force)
    enableKeyVault        = $true
    enablePrivateDatabaseAccess = $true
    Verbose               = $true
}

# Add VNet/Subnet parameters if using existing network
if (-not $createNewVNet -and $vnetResourceId -and $subnetResourceId) {
    $deploymentParams.useExistingVNet = $true
    $deploymentParams.existingVNetId = $vnetResourceId
    $deploymentParams.existingSubnetId = $subnetResourceId
}

# Add ACR parameters if using custom registry
if ($UseCustomAcr -and -not [string]::IsNullOrEmpty($AcrName)) {
    $deploymentParams.useCustomAcr = $true
    $deploymentParams.acrName = $AcrName
}

if (-not [string]::IsNullOrEmpty($DomainName)) {
    $deploymentParams.domainName = $DomainName
}

Write-Host "Starting template deployment..." -ForegroundColor Cyan
Write-Host "  Resource Group: $ResourceGroupName" -ForegroundColor Gray
Write-Host "  Location: $Location" -ForegroundColor Gray
Write-Host "  Environment: $EnvironmentName" -ForegroundColor Gray
Write-Host "  Key Vault: $keyVaultName" -ForegroundColor Gray
if (-not $createNewVNet) {
    Write-Host "  VNet: $VNetName" -ForegroundColor Gray
    Write-Host "  Subnet: $SubnetName" -ForegroundColor Gray
}
if ($UseCustomAcr) {
    Write-Host "  ACR: $AcrName" -ForegroundColor Gray
}
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
