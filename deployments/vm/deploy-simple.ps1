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

# Prompt for DNS name prefix if custom domain not provided
$DnsNamePrefix = ""
if ([string]::IsNullOrEmpty($DomainName)) {
    Write-Host "`nDNS name prefix for Azure public IP (leave empty for auto-generated):" -ForegroundColor Yellow
    Write-Host "  Example: 'my-tts' will create 'my-tts.eastus.cloudapp.azure.com'" -ForegroundColor Gray
    $DnsNamePrefix = Read-Host
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
    Write-Host "Resource Group Options:" -ForegroundColor Cyan
    Write-Host "  1. Enter resource group name manually" -ForegroundColor White
    Write-Host "  2. Select from existing resource groups" -ForegroundColor White
    Write-Host "  3. Create new resource group automatically`n" -ForegroundColor White
    
    $rgOption = Read-Host "Select option (1-3, default: 3)"
    
    switch ($rgOption) {
        "1" {
            # Manual entry
            $ResourceGroupName = Read-Host "Enter resource group name"
            
            $existingRG = Get-AzResourceGroup -Name $ResourceGroupName -ErrorAction SilentlyContinue
            if ($existingRG) {
                Write-Host "✓ Found existing resource group: $ResourceGroupName" -ForegroundColor Green
                $Location = $existingRG.Location
                Write-Host "  Location: $Location" -ForegroundColor Gray
                
                $confirm = Read-Host "Use this resource group? (Y/n)"
                if ($confirm -eq 'n' -or $confirm -eq 'N') {
                    Write-Error "Deployment cancelled by user"
                    exit 1
                }
            } else {
                Write-Host "Resource group '$ResourceGroupName' not found." -ForegroundColor Yellow
                $create = Read-Host "Create it? (Y/n)"
                if ($create -ne 'n' -and $create -ne 'N') {
                    New-AzResourceGroup -Name $ResourceGroupName -Location $Location -Force | Out-Null
                    Write-Host "✓ Resource group created" -ForegroundColor Green
                } else {
                    Write-Error "Deployment cancelled by user"
                    exit 1
                }
            }
        }
        "2" {
            # List and select
            Write-Host "`nFetching available resource groups..." -ForegroundColor Cyan
            $existingRGs = Get-AzResourceGroup | Select-Object ResourceGroupName, Location
            
            if ($existingRGs.Count -eq 0) {
                Write-Host "No existing resource groups found. Creating a new one." -ForegroundColor Yellow
                $timestamp = Get-Date -Format "yyyyMMddHHmm"
                $ResourceGroupName = "rg-tts-$timestamp"
                New-AzResourceGroup -Name $ResourceGroupName -Location $Location -Force | Out-Null
                Write-Host "✓ Resource group created: $ResourceGroupName" -ForegroundColor Green
            } else {
                Write-Host "`nAvailable Resource Groups:" -ForegroundColor Cyan
                for ($i = 0; $i -lt $existingRGs.Count; $i++) {
                    Write-Host "  $($i + 1). $($existingRGs[$i].ResourceGroupName) ($($existingRGs[$i].Location))" -ForegroundColor White
                }
                
                $rgChoice = Read-Host "`nSelect resource group (1-$($existingRGs.Count))"
                
                if ($rgChoice -and $rgChoice -match '^\d+$' -and [int]$rgChoice -le $existingRGs.Count -and [int]$rgChoice -gt 0) {
                    $ResourceGroupName = $existingRGs[[int]$rgChoice - 1].ResourceGroupName
                    $Location = $existingRGs[[int]$rgChoice - 1].Location
                    Write-Host "✓ Using resource group: $ResourceGroupName" -ForegroundColor Green
                    Write-Host "  Location: $Location" -ForegroundColor Gray
                } else {
                    Write-Error "Invalid selection"
                    exit 1
                }
            }
        }
        default {
            # Create new (option 3 or Enter)
            $timestamp = Get-Date -Format "yyyyMMddHHmm"
            $ResourceGroupName = "rg-tts-$timestamp"
            
            Write-Host "Creating new resource group: $ResourceGroupName" -ForegroundColor Cyan
            New-AzResourceGroup -Name $ResourceGroupName -Location $Location -Force | Out-Null
            Write-Host "✓ Resource group created" -ForegroundColor Green
        }
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
$vnetResourceGroup = $ResourceGroupName
$vnetResourceId = ""
$subnetResourceId = ""
$selectedVNet = $null
$selectedSubnet = $null

# Check if user wants to use existing VNet
if ([string]::IsNullOrEmpty($VNetName)) {
    Write-Host "Network Options:" -ForegroundColor Cyan
    Write-Host "  1. Enter VNet and Subnet names manually" -ForegroundColor White
    Write-Host "  2. Select from VNets in current resource group ($ResourceGroupName)" -ForegroundColor White
    Write-Host "  3. Search all VNets across subscription" -ForegroundColor White
    Write-Host "  4. Create new VNet automatically`n" -ForegroundColor White
    
    $netOption = Read-Host "Select option (1-4, default: 4)"
    
    switch ($netOption) {
        "1" {
            # Manual entry
            $VNetName = Read-Host "Enter VNet name"
            $vnetRgInput = Read-Host "Enter VNet resource group name (press Enter for current RG: $ResourceGroupName)"
            if ([string]::IsNullOrEmpty($vnetRgInput)) {
                $vnetResourceGroup = $ResourceGroupName
            } else {
                $vnetResourceGroup = $vnetRgInput
            }
            
            # Try to find the VNet
            $selectedVNet = Get-AzVirtualNetwork -Name $VNetName -ResourceGroupName $vnetResourceGroup -ErrorAction SilentlyContinue
            
            if ($selectedVNet) {
                Write-Host "✓ Found VNet: $VNetName in $vnetResourceGroup" -ForegroundColor Green
                Write-Host "  Address Space: $($selectedVNet.AddressSpace.AddressPrefixes -join ', ')" -ForegroundColor Gray
                
                # CRITICAL: Update location to match VNet's location
                $vnetLocation = $selectedVNet.Location
                if ($Location -ne $vnetLocation) {
                    Write-Host "  ⚠ VNet is in region: $vnetLocation" -ForegroundColor Yellow
                    Write-Host "  Deployment location changed from $Location to $vnetLocation (resources must be in same region as VNet)" -ForegroundColor Yellow
                    $Location = $vnetLocation
                }
                
                # Get subnet
                if ($selectedVNet.Subnets.Count -eq 0) {
                    Write-Host "  No subnets found in VNet" -ForegroundColor Yellow
                    $createSubnet = Read-Host "  Create new subnet? (Y/n)"
                    if ($createSubnet -ne 'n' -and $createSubnet -ne 'N') {
                        $SubnetName = Read-Host "  Enter subnet name (default: tts-subnet)"
                        if ([string]::IsNullOrEmpty($SubnetName)) { $SubnetName = "tts-subnet" }
                        Write-Host "  ✓ New subnet '$SubnetName' will be created" -ForegroundColor Green
                        $createNewVNet = $false
                    } else {
                        Write-Error "Cannot proceed without a subnet"
                        exit 1
                    }
                } else {
                    # List subnets
                    Write-Host "`n  Available Subnets:" -ForegroundColor Cyan
                    for ($i = 0; $i -lt $selectedVNet.Subnets.Count; $i++) {
                        $subnet = $selectedVNet.Subnets[$i]
                        Write-Host "    $($i + 1). $($subnet.Name) - $($subnet.AddressPrefix)" -ForegroundColor White
                        
                        # Check for delegations
                        if ($subnet.Delegations.Count -gt 0) {
                            Write-Host "       ⚠ Delegated to: $($subnet.Delegations[0].ServiceName)" -ForegroundColor Yellow
                        }
                    }
                    
                    $subnetChoice = Read-Host "`n  Select Subnet (1-$($selectedVNet.Subnets.Count)), or 0 to create new"
                    
                    if ($subnetChoice -eq "0") {
                        $SubnetName = Read-Host "  Enter new subnet name"
                        Write-Host "  ✓ New subnet '$SubnetName' will be created in VNet" -ForegroundColor Green
                        $createNewVNet = $false
                    }
                    elseif ($subnetChoice -and $subnetChoice -match '^\d+$' -and [int]$subnetChoice -le $selectedVNet.Subnets.Count -and [int]$subnetChoice -gt 0) {
                        $selectedSubnet = $selectedVNet.Subnets[[int]$subnetChoice - 1]
                        $SubnetName = $selectedSubnet.Name
                        $subnetResourceId = $selectedSubnet.Id
                        
                        # Validate subnet is not delegated
                        if ($selectedSubnet.Delegations.Count -gt 0) {
                            Write-Host "  ⚠ WARNING: Subnet is delegated to $($selectedSubnet.Delegations[0].ServiceName)" -ForegroundColor Red
                            Write-Host "  This may cause deployment issues if delegation is incompatible." -ForegroundColor Yellow
                            $continueAnyway = Read-Host "  Continue anyway? (y/N)"
                            if ($continueAnyway -ne 'y' -and $continueAnyway -ne 'Y') {
                                Write-Error "Deployment cancelled"
                                exit 1
                            }
                        }
                        
                        Write-Host "  ✓ Selected Subnet: $SubnetName ($($selectedSubnet.AddressPrefix))" -ForegroundColor Green
                        $vnetResourceId = $selectedVNet.Id
                        $createNewVNet = $false
                    } else {
                        Write-Error "Invalid subnet selection"
                        exit 1
                    }
                }
            } else {
                Write-Host "VNet '$VNetName' not found in resource group '$vnetResourceGroup'" -ForegroundColor Red
                $createNew = Read-Host "Create new VNet? (Y/n)"
                if ($createNew -ne 'n' -and $createNew -ne 'N') {
                    $createNewVNet = $true
                } else {
                    Write-Error "Deployment cancelled"
                    exit 1
                }
            }
        }
        "2" {
            # List VNets in current resource group
            Write-Host "`nFetching VNets in $ResourceGroupName..." -ForegroundColor Cyan
            $existingVNets = Get-AzVirtualNetwork -ResourceGroupName $ResourceGroupName -ErrorAction SilentlyContinue
            
            if ($existingVNets.Count -eq 0) {
                Write-Host "No VNets found in this resource group. New VNet will be created." -ForegroundColor Yellow
                $createNewVNet = $true
            } else {
                Write-Host "`nAvailable VNets:" -ForegroundColor Cyan
                for ($i = 0; $i -lt $existingVNets.Count; $i++) {
                    Write-Host "  $($i + 1). $($existingVNets[$i].Name) - $($existingVNets[$i].AddressSpace.AddressPrefixes -join ', ')" -ForegroundColor White
                }
                
                $vnetChoice = Read-Host "`nSelect VNet (1-$($existingVNets.Count)), or 0 to create new"
                
                if ($vnetChoice -eq "0") {
                    $createNewVNet = $true
                }
                elseif ($vnetChoice -and $vnetChoice -match '^\d+$' -and [int]$vnetChoice -le $existingVNets.Count -and [int]$vnetChoice -gt 0) {
                    $selectedVNet = $existingVNets[[int]$vnetChoice - 1]
                    $VNetName = $selectedVNet.Name
                    $vnetResourceId = $selectedVNet.Id
                    $vnetResourceGroup = $ResourceGroupName
                    
                    # CRITICAL: Update location to match VNet's location
                    $vnetLocation = $selectedVNet.Location
                    if ($Location -ne $vnetLocation) {
                        Write-Host "  ⚠ VNet is in region: $vnetLocation" -ForegroundColor Yellow
                        Write-Host "  Deployment location changed from $Location to $vnetLocation (resources must be in same region as VNet)" -ForegroundColor Yellow
                        $Location = $vnetLocation
                    }
                    
                    # Continue to subnet selection (reuse logic from option 1)
                    if ($selectedVNet.Subnets.Count -eq 0) {
                        Write-Host "  No subnets in VNet. New subnet will be created." -ForegroundColor Yellow
                        $SubnetName = "tts-subnet"
                        $createNewVNet = $false
                    } else {
                        Write-Host "`n  Available Subnets:" -ForegroundColor Cyan
                        for ($i = 0; $i -lt $selectedVNet.Subnets.Count; $i++) {
                            $subnet = $selectedVNet.Subnets[$i]
                            Write-Host "    $($i + 1). $($subnet.Name) - $($subnet.AddressPrefix)" -ForegroundColor White
                            if ($subnet.Delegations.Count -gt 0) {
                                Write-Host "       ⚠ Delegated to: $($subnet.Delegations[0].ServiceName)" -ForegroundColor Yellow
                            }
                        }
                        
                        $subnetChoice = Read-Host "`n  Select Subnet (1-$($selectedVNet.Subnets.Count)), or 0 to create new"
                        
                        if ($subnetChoice -eq "0") {
                            $SubnetName = Read-Host "  Enter new subnet name"
                            $createNewVNet = $false
                        }
                        elseif ($subnetChoice -and $subnetChoice -match '^\d+$' -and [int]$subnetChoice -le $selectedVNet.Subnets.Count -and [int]$subnetChoice -gt 0) {
                            $selectedSubnet = $selectedVNet.Subnets[[int]$subnetChoice - 1]
                            $SubnetName = $selectedSubnet.Name
                            $subnetResourceId = $selectedSubnet.Id
                            
                            if ($selectedSubnet.Delegations.Count -gt 0) {
                                Write-Host "  ⚠ WARNING: Subnet is delegated" -ForegroundColor Yellow
                                $continueAnyway = Read-Host "  Continue? (y/N)"
                                if ($continueAnyway -ne 'y' -and $continueAnyway -ne 'Y') {
                                    exit 1
                                }
                            }
                            
                            Write-Host "  ✓ Selected Subnet: $SubnetName" -ForegroundColor Green
                            $createNewVNet = $false
                        }
                    }
                } else {
                    $createNewVNet = $true
                }
            }
        }
        "3" {
            # Search all VNets across subscription
            Write-Host "`nSearching all VNets in subscription (this may take a moment)..." -ForegroundColor Cyan
            $allVNets = Get-AzVirtualNetwork
            
            if ($allVNets.Count -eq 0) {
                Write-Host "No VNets found in subscription. New VNet will be created." -ForegroundColor Yellow
                $createNewVNet = $true
            } else {
                Write-Host "`nFound $($allVNets.Count) VNet(s):" -ForegroundColor Cyan
                for ($i = 0; $i -lt $allVNets.Count; $i++) {
                    Write-Host "  $($i + 1). $($allVNets[$i].Name) - RG: $($allVNets[$i].ResourceGroupName) - $($allVNets[$i].AddressSpace.AddressPrefixes -join ', ')" -ForegroundColor White
                }
                
                $vnetChoice = Read-Host "`nSelect VNet (1-$($allVNets.Count)), or 0 to create new"
                
                if ($vnetChoice -eq "0") {
                    $createNewVNet = $true
                }
                elseif ($vnetChoice -and $vnetChoice -match '^\d+$' -and [int]$vnetChoice -le $allVNets.Count -and [int]$vnetChoice -gt 0) {
                    $selectedVNet = $allVNets[[int]$vnetChoice - 1]
                    $VNetName = $selectedVNet.Name
                    $vnetResourceId = $selectedVNet.Id
                    $vnetResourceGroup = $selectedVNet.ResourceGroupName
                    
                    if ($vnetResourceGroup -ne $ResourceGroupName) {
                        Write-Host "  ℹ VNet is in different resource group: $vnetResourceGroup" -ForegroundColor Yellow
                    }
                    
                    # CRITICAL: Update location to match VNet's location
                    $vnetLocation = $selectedVNet.Location
                    if ($Location -ne $vnetLocation) {
                        Write-Host "  ⚠ VNet is in region: $vnetLocation" -ForegroundColor Yellow
                        Write-Host "  Deployment location changed from $Location to $vnetLocation (resources must be in same region as VNet)" -ForegroundColor Yellow
                        $Location = $vnetLocation
                    }
                    
                    # Subnet selection (same logic as above)
                    if ($selectedVNet.Subnets.Count -eq 0) {
                        Write-Host "  No subnets in VNet. New subnet will be created." -ForegroundColor Yellow
                        $SubnetName = "tts-subnet"
                        $createNewVNet = $false
                    } else {
                        Write-Host "`n  Available Subnets:" -ForegroundColor Cyan
                        for ($i = 0; $i -lt $selectedVNet.Subnets.Count; $i++) {
                            $subnet = $selectedVNet.Subnets[$i]
                            Write-Host "    $($i + 1). $($subnet.Name) - $($subnet.AddressPrefix)" -ForegroundColor White
                            if ($subnet.Delegations.Count -gt 0) {
                                Write-Host "       ⚠ Delegated to: $($subnet.Delegations[0].ServiceName)" -ForegroundColor Yellow
                            }
                        }
                        
                        $subnetChoice = Read-Host "`n  Select Subnet (1-$($selectedVNet.Subnets.Count)), or 0 to create new"
                        
                        if ($subnetChoice -eq "0") {
                            $SubnetName = Read-Host "  Enter new subnet name"
                            $createNewVNet = $false
                        }
                        elseif ($subnetChoice -and $subnetChoice -match '^\d+$' -and [int]$subnetChoice -le $selectedVNet.Subnets.Count -and [int]$subnetChoice -gt 0) {
                            $selectedSubnet = $selectedVNet.Subnets[[int]$subnetChoice - 1]
                            $SubnetName = $selectedSubnet.Name
                            $subnetResourceId = $selectedSubnet.Id
                            
                            if ($selectedSubnet.Delegations.Count -gt 0) {
                                Write-Host "  ⚠ WARNING: Subnet is delegated" -ForegroundColor Yellow
                                $continueAnyway = Read-Host "  Continue? (y/N)"
                                if ($continueAnyway -ne 'y' -and $continueAnyway -ne 'Y') {
                                    exit 1
                                }
                            }
                            
                            Write-Host "  ✓ Selected Subnet: $SubnetName" -ForegroundColor Green
                            $createNewVNet = $false
                        }
                    }
                }
            }
        }
        default {
            # Create new (option 4 or Enter)
            $createNewVNet = $true
        }
    }
}

if ($createNewVNet) {
    Write-Host "✓ New VNet and Subnet will be created automatically by Bicep template" -ForegroundColor Green
    Write-Host "✓ Database subnet with PostgreSQL delegation will be created" -ForegroundColor Green
} else {
    # ========================================================================
    # SELECT DATABASE SUBNET FOR POSTGRESQL (MUST BE DELEGATED)
    # ========================================================================
    
    Write-Host "`n  📊 Database Subnet Selection (PostgreSQL Private Access)" -ForegroundColor Cyan
    Write-Host "  ⚠️  PostgreSQL Flexible Server requires a delegated subnet" -ForegroundColor Yellow
    Write-Host "  Delegation: Microsoft.DBforPostgreSQL/flexibleServers`n" -ForegroundColor Gray
    
    # Get fresh VNet info to see all subnets
    $selectedVNet = Get-AzVirtualNetwork -Name $VNetName -ResourceGroupName $vnetResourceGroup
    
    # Find subnets with PostgreSQL delegation
    $delegatedSubnets = $selectedVNet.Subnets | Where-Object {
        $_.Delegations.Count -gt 0 -and 
        $_.Delegations[0].ServiceName -eq 'Microsoft.DBforPostgreSQL/flexibleServers'
    }
    
    if ($delegatedSubnets.Count -gt 0) {
        Write-Host "  Found $($delegatedSubnets.Count) subnet(s) with PostgreSQL delegation:" -ForegroundColor Green
        for ($i = 0; $i -lt $delegatedSubnets.Count; $i++) {
            $dbSubnet = $delegatedSubnets[$i]
            Write-Host "    $($i + 1). $($dbSubnet.Name) - $($dbSubnet.AddressPrefix)" -ForegroundColor White
            Write-Host "       ✓ Delegated to: Microsoft.DBforPostgreSQL/flexibleServers" -ForegroundColor Green
        }
        
        if ($delegatedSubnets.Count -eq 1) {
            $DatabaseSubnetName = $delegatedSubnets[0].Name
            Write-Host "`n  ✓ Auto-selected: $DatabaseSubnetName" -ForegroundColor Green
        } else {
            $dbSubnetChoice = Read-Host "`n  Select Database Subnet (1-$($delegatedSubnets.Count))"
            if ($dbSubnetChoice -and $dbSubnetChoice -match '^\d+$' -and [int]$dbSubnetChoice -le $delegatedSubnets.Count -and [int]$dbSubnetChoice -gt 0) {
                $DatabaseSubnetName = $delegatedSubnets[[int]$dbSubnetChoice - 1].Name
                Write-Host "  ✓ Selected: $DatabaseSubnetName" -ForegroundColor Green
            } else {
                Write-Error "Invalid selection"
                exit 1
            }
        }
    } else {
        Write-Host "  ⚠️  No subnets found with PostgreSQL delegation!" -ForegroundColor Red
        Write-Host "`n  Available options:" -ForegroundColor Cyan
        Write-Host "    1. Delegate an existing subnet" -ForegroundColor White
        Write-Host "    2. Switch to public database access (not recommended for production)" -ForegroundColor White
        
        $delegationChoice = Read-Host "`n  Select option (1-2)"
        
        if ($delegationChoice -eq "1") {
            # Show non-delegated subnets
            $availableSubnets = $selectedVNet.Subnets | Where-Object {
                $_.Delegations.Count -eq 0 -and $_.Name -ne $SubnetName
            }
            
            if ($availableSubnets.Count -eq 0) {
                Write-Host "`n  No available subnets to delegate. Creating new subnet for database..." -ForegroundColor Yellow
                $DatabaseSubnetName = "database-subnet"
                Write-Host "  ⚠️  You'll need to manually create subnet '$DatabaseSubnetName' with PostgreSQL delegation" -ForegroundColor Yellow
                Write-Host "  Or deployment will fail. Continue? (y/N)" -ForegroundColor Red
                $continue = Read-Host
                if ($continue -ne 'y' -and $continue -ne 'Y') {
                    exit 1
                }
            } else {
                Write-Host "`n  Available subnets (not delegated):" -ForegroundColor Cyan
                for ($i = 0; $i -lt $availableSubnets.Count; $i++) {
                    Write-Host "    $($i + 1). $($availableSubnets[$i].Name) - $($availableSubnets[$i].AddressPrefix)" -ForegroundColor White
                }
                
                $subnetToDelegate = Read-Host "`n  Select subnet to delegate to PostgreSQL (1-$($availableSubnets.Count))"
                
                if ($subnetToDelegate -and $subnetToDelegate -match '^\d+$' -and [int]$subnetToDelegate -le $availableSubnets.Count -and [int]$subnetToDelegate -gt 0) {
                    $targetSubnet = $availableSubnets[[int]$subnetToDelegate - 1]
                    $DatabaseSubnetName = $targetSubnet.Name
                    
                    Write-Host "`n  Checking for resource locks on VNet..." -ForegroundColor Cyan
                    
                    # Check for locks on the VNet
                    $vnetLocks = Get-AzResourceLock -ResourceGroupName $vnetResourceGroup -ResourceName $VNetName -ResourceType "Microsoft.Network/virtualNetworks" -ErrorAction SilentlyContinue
                    
                    if ($vnetLocks) {
                        Write-Host "  ⚠️  WARNING: VNet has resource lock(s):" -ForegroundColor Red
                        foreach ($lock in $vnetLocks) {
                            Write-Host "    - $($lock.Name) ($($lock.Properties.level))" -ForegroundColor Yellow
                        }
                        
                        Write-Host "`n  Subnet delegation requires modifying the VNet, which is blocked by the lock." -ForegroundColor Yellow
                        Write-Host "  Options:" -ForegroundColor Cyan
                        Write-Host "    1. Temporarily remove lock, add delegation, then re-apply lock" -ForegroundColor White
                        Write-Host "    2. Skip delegation (you must add it manually before deployment)" -ForegroundColor White
                        Write-Host "    3. Switch to public database access" -ForegroundColor White
                        
                        $lockChoice = Read-Host "`n  Select option (1-3)"
                        
                        if ($lockChoice -eq "1") {
                            # Remove locks temporarily
                            Write-Host "`n  Removing locks temporarily..." -ForegroundColor Cyan
                            $removedLocks = @()
                            foreach ($lock in $vnetLocks) {
                                Remove-AzResourceLock -LockId $lock.LockId -Force | Out-Null
                                $removedLocks += $lock
                                Write-Host "    ✓ Removed: $($lock.Name)" -ForegroundColor Green
                            }
                            
                            # Add delegation
                            Write-Host "`n  Configuring delegation on subnet: $DatabaseSubnetName..." -ForegroundColor Cyan
                            
                            $targetSubnet.Delegations.Add(
                                (New-Object Microsoft.Azure.Commands.Network.Models.PSDelegation -Property @{
                                    Name = "PostgreSQLFlexibleServer"
                                    ServiceName = "Microsoft.DBforPostgreSQL/flexibleServers"
                                })
                            )
                            
                            try {
                                Set-AzVirtualNetwork -VirtualNetwork $selectedVNet | Out-Null
                                Write-Host "  ✓ Delegation configured successfully!" -ForegroundColor Green
                            } catch {
                                Write-Error "Failed to configure delegation: $_"
                                
                                # Re-apply locks before exiting
                                Write-Host "`n  Re-applying locks..." -ForegroundColor Cyan
                                foreach ($lock in $removedLocks) {
                                    New-AzResourceLock -LockName $lock.Name -LockLevel $lock.Properties.level -ResourceGroupName $vnetResourceGroup -ResourceName $VNetName -ResourceType "Microsoft.Network/virtualNetworks" -LockNotes $lock.Properties.notes -Force | Out-Null
                                }
                                
                                exit 1
                            }
                            
                            # Re-apply locks
                            Write-Host "`n  Re-applying locks..." -ForegroundColor Cyan
                            foreach ($lock in $removedLocks) {
                                New-AzResourceLock -LockName $lock.Name -LockLevel $lock.Properties.level -ResourceGroupName $vnetResourceGroup -ResourceName $VNetName -ResourceType "Microsoft.Network/virtualNetworks" -LockNotes $lock.Properties.notes -Force | Out-Null
                                Write-Host "    ✓ Re-applied: $($lock.Name)" -ForegroundColor Green
                            }
                        } elseif ($lockChoice -eq "2") {
                            Write-Host "`n  ⚠️  IMPORTANT: You MUST manually add PostgreSQL delegation to subnet '$DatabaseSubnetName'" -ForegroundColor Red
                            Write-Host "  Before running this deployment, execute:" -ForegroundColor Yellow
                            Write-Host "    `$vnet = Get-AzVirtualNetwork -Name '$VNetName' -ResourceGroupName '$vnetResourceGroup'" -ForegroundColor Cyan
                            Write-Host "    `$subnet = Get-AzVirtualNetworkSubnetConfig -VirtualNetwork `$vnet -Name '$DatabaseSubnetName'" -ForegroundColor Cyan
                            Write-Host "    `$subnet.Delegations.Add((New-Object Microsoft.Azure.Commands.Network.Models.PSDelegation -Property @{Name='PostgreSQL';ServiceName='Microsoft.DBforPostgreSQL/flexibleServers'}))" -ForegroundColor Cyan
                            Write-Host "    Set-AzVirtualNetwork -VirtualNetwork `$vnet" -ForegroundColor Cyan
                            Write-Host "`n  Continue with deployment assuming delegation will be added? (y/N)" -ForegroundColor Yellow
                            $continue = Read-Host
                            if ($continue -ne 'y' -and $continue -ne 'Y') {
                                exit 1
                            }
                        } elseif ($lockChoice -eq "3") {
                            Write-Host "`n  ⚠️  Switching to PUBLIC database access" -ForegroundColor Yellow
                            Write-Host "  Database will be accessible via public endpoint with firewall rules" -ForegroundColor Yellow
                            $enablePrivateDatabaseAccess = $false
                            $DatabaseSubnetName = "" # Not needed for public access
                        } else {
                            Write-Error "Invalid selection"
                            exit 1
                        }
                    } else {
                        # No locks - proceed with delegation
                        Write-Host "  ✓ No locks found" -ForegroundColor Green
                        Write-Host "`n  Configuring delegation on subnet: $DatabaseSubnetName..." -ForegroundColor Cyan
                        
                        $targetSubnet.Delegations.Add(
                            (New-Object Microsoft.Azure.Commands.Network.Models.PSDelegation -Property @{
                                Name = "PostgreSQLFlexibleServer"
                                ServiceName = "Microsoft.DBforPostgreSQL/flexibleServers"
                            })
                        )
                        
                        try {
                            Set-AzVirtualNetwork -VirtualNetwork $selectedVNet | Out-Null
                            Write-Host "  ✓ Delegation configured successfully!" -ForegroundColor Green
                        } catch {
                            Write-Error "Failed to configure delegation: $_"
                            exit 1
                        }
                    }
                } else {
                    Write-Error "Invalid selection"
                    exit 1
                }
            }
        } elseif ($delegationChoice -eq "2") {
            Write-Host "`n  ⚠️  Switching to PUBLIC database access" -ForegroundColor Yellow
            Write-Host "  Database will be accessible via public endpoint with firewall rules" -ForegroundColor Yellow
            $enablePrivateDatabaseAccess = $false
            $DatabaseSubnetName = "" # Not needed for public access
        } else {
            Write-Error "Invalid selection"
            exit 1
        }
    }
    
    Write-Host "`nNetwork Configuration Summary:" -ForegroundColor Cyan
    Write-Host "  VNet: $VNetName" -ForegroundColor White
    Write-Host "  VNet Resource Group: $vnetResourceGroup" -ForegroundColor White
    Write-Host "  VM Subnet: $SubnetName" -ForegroundColor White
    if ($selectedSubnet) {
        Write-Host "    Address: $($selectedSubnet.AddressPrefix)" -ForegroundColor Gray
    }
    if ($DatabaseSubnetName) {
        Write-Host "  Database Subnet: $DatabaseSubnetName" -ForegroundColor White
        Write-Host "    Delegation: Microsoft.DBforPostgreSQL/flexibleServers" -ForegroundColor Green
    } else {
        Write-Host "  Database Access: Public (with firewall rules)" -ForegroundColor Yellow
    }
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
    
    # Create Key Vault with purge protection and soft delete enabled (SFI compliance)
    # Soft delete is automatically enabled (mandatory since Azure API 2020+)
    # Purge protection prevents permanent deletion during the retention period
    # PublicNetworkAccess must be explicitly set for SFI compliance policy
    Write-Host "  Enabling soft delete (90 days), purge protection, and public network access (SFI compliance)..." -ForegroundColor Cyan
    New-AzKeyVault `
        -Name $keyVaultName `
        -ResourceGroupName $ResourceGroupName `
        -Location $Location `
        -EnabledForTemplateDeployment `
        -EnabledForDeployment `
        -EnablePurgeProtection `
        -SoftDeleteRetentionInDays 90 `
        -PublicNetworkAccess "Enabled" | Out-Null
    
    Write-Host "✓ Key Vault created with RBAC, soft delete, and purge protection" -ForegroundColor Green
    Write-Host "  Soft Delete: Enabled (90 days retention)" -ForegroundColor Gray
    Write-Host "  Purge Protection: Enabled (prevents permanent deletion)" -ForegroundColor Gray
    
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
    
    # Add delete lock on Key Vault to prevent accidental deletion
    Write-Host "Adding delete lock to Key Vault..." -ForegroundColor Cyan
    try {
        New-AzResourceLock `
            -LockName "DoNotDelete-KeyVault" `
            -LockLevel CanNotDelete `
            -ResourceName $keyVaultName `
            -ResourceType "Microsoft.KeyVault/vaults" `
            -ResourceGroupName $ResourceGroupName `
            -LockNotes "Prevents accidental deletion of Key Vault containing TTS secrets" `
            -Force | Out-Null
        Write-Host "✓ Delete lock applied to Key Vault" -ForegroundColor Green
        Write-Host "  To delete Key Vault, you must first remove the lock:" -ForegroundColor Yellow
        Write-Host "  Remove-AzResourceLock -LockName 'DoNotDelete-KeyVault' -ResourceGroupName '$ResourceGroupName'" -ForegroundColor Gray
    }
    catch {
        Write-Warning "Could not create delete lock on Key Vault: $_"
        Write-Host "  Key Vault is still protected by RBAC, but no delete lock applied" -ForegroundColor Yellow
    }
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
    enableKeyVault        = $true  # PowerShell creates the vault, Bicep references it and creates secrets
    enablePrivateDatabaseAccess = if ($createNewVNet) { $true } else { if ($DatabaseSubnetName) { $true } else { $false } }
    enableMonitoring      = $false  # Disabled to avoid policy restrictions on Log Analytics
    Verbose               = $true
}

# Add VNet/Subnet parameters if using existing network
if (-not $createNewVNet) {
    if ($subnetResourceId) {
        # Existing subnet selected
        $deploymentParams.useExistingVNet = $true
        $deploymentParams.existingVNetName = $VNetName
        $deploymentParams.existingVNetResourceGroup = $vnetResourceGroup
        $deploymentParams.existingSubnetName = $SubnetName
        
        # Add database subnet if provided
        if ($DatabaseSubnetName) {
            $deploymentParams.existingDatabaseSubnetName = $DatabaseSubnetName
        }
    } else {
        # Create new subnet in existing VNet
        $deploymentParams.useExistingVNet = $true
        $deploymentParams.existingVNetName = $VNetName
        $deploymentParams.existingVNetResourceGroup = $vnetResourceGroup
        $deploymentParams.createSubnetInExistingVNet = $true
        $deploymentParams.newSubnetName = $SubnetName
        
        # Add database subnet if provided
        if ($DatabaseSubnetName) {
            $deploymentParams.existingDatabaseSubnetName = $DatabaseSubnetName
        }
    }
}

# Add ACR parameters if using custom registry
if ($UseCustomAcr -and -not [string]::IsNullOrEmpty($AcrName)) {
    $deploymentParams.useCustomAcr = $true
    $deploymentParams.acrName = $AcrName
}

if (-not [string]::IsNullOrEmpty($DomainName)) {
    $deploymentParams.domainName = $DomainName
}

if (-not [string]::IsNullOrEmpty($DnsNamePrefix)) {
    $deploymentParams.dnsNamePrefix = $DnsNamePrefix
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
    # Enable detailed error output
    $ErrorActionPreference = "Stop"
    $deployment = New-AzResourceGroupDeployment @deploymentParams -ErrorVariable deployError
    
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
    
    # Show detailed error information
    Write-Host "`n=== FULL ERROR DETAILS ===" -ForegroundColor Yellow
    Write-Host ($_ | Format-List * -Force | Out-String) -ForegroundColor Red
    
    if ($_.ErrorDetails) {
        Write-Host "`n=== ERROR DETAILS JSON ===" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    
    # Show exception details
    if ($_.Exception) {
        Write-Host "`n=== EXCEPTION DETAILS ===" -ForegroundColor Yellow
        $exception = $_.Exception
        while ($exception) {
            Write-Host "Type: $($exception.GetType().FullName)" -ForegroundColor Red
            Write-Host "Message: $($exception.Message)" -ForegroundColor Red
            if ($exception.InnerException) {
                Write-Host "`n--- Inner Exception ---" -ForegroundColor Yellow
                $exception = $exception.InnerException
            } else {
                $exception = $null
            }
        }
    }
    
    exit 1
}

# Clean up sensitive variables
Remove-Variable vmAdminPasswordPlain -ErrorAction SilentlyContinue
Remove-Variable ttsAdminPasswordPlain -ErrorAction SilentlyContinue
