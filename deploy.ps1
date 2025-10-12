#!/usr/bin/env pwsh
# ==============================================================================
# The Things Stack - Primary Deployment Orchestrator
# Menu-driven deployment for all deployment modes
# ==============================================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("", "vm", "aks", "quick")]
    [string]$Mode = "",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "centralus",
    
    [Parameter(Mandatory=$false)]
    [string]$EnvironmentName = "tts-prod",
    
    [Parameter(Mandatory=$false)]
    [string]$AdminEmail,
    
    [Parameter(Mandatory=$false)]
    [string]$ParametersFile = ""
)

$ErrorActionPreference = "Stop"

Write-Host @"

╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   The Things Stack - Azure Deployment Orchestrator              ║
║                                                                  ║
║   Production-Ready LoRaWAN Network Server Deployment            ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

# ==============================================================================
# DEPLOYMENT MODE SELECTION
# ==============================================================================

function Show-DeploymentMenu {
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "  SELECT DEPLOYMENT MODE" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Yellow
    
    Write-Host "  [1] Quick Deployment (VM)" -ForegroundColor White
    Write-Host "      • Single VM with Docker Compose" -ForegroundColor Gray
    Write-Host "      • Best for: Development, Testing, PoC" -ForegroundColor Gray
    Write-Host "      • Cost: ~$155-205/month" -ForegroundColor Gray
    Write-Host "      • Deployment time: 10-15 minutes" -ForegroundColor Gray
    Write-Host "      • Capacity: Up to 10,000 devices`n" -ForegroundColor Gray
    
    Write-Host "  [2] Production Deployment (AKS - Kubernetes)" -ForegroundColor Green
    Write-Host "      • Azure Kubernetes Service cluster" -ForegroundColor Gray
    Write-Host "      • Best for: Production, High Availability" -ForegroundColor Gray
    Write-Host "      • Cost: ~$500-800/month" -ForegroundColor Gray
    Write-Host "      • Deployment time: 20-30 minutes" -ForegroundColor Gray
    Write-Host "      • Capacity: 100,000+ devices, auto-scaling`n" -ForegroundColor Gray
    
    Write-Host "  [3] Advanced VM Deployment (Custom)" -ForegroundColor Cyan
    Write-Host "      • VM with custom configuration" -ForegroundColor Gray
    Write-Host "      • Best for: Custom requirements, specific sizing" -ForegroundColor Gray
    Write-Host "      • Cost: Varies based on configuration" -ForegroundColor Gray
    Write-Host "      • Deployment time: 15-20 minutes`n" -ForegroundColor Gray
    
    Write-Host "  [4] Compare All Deployment Options" -ForegroundColor Magenta
    Write-Host "      • View detailed comparison matrix`n" -ForegroundColor Gray
    
    Write-Host "  [Q] Quit`n" -ForegroundColor DarkGray
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Yellow
}

function Show-ComparisonMatrix {
    Write-Host "`n╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║              DEPLOYMENT OPTIONS COMPARISON                       ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan
    
    $comparison = @"
┌─────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Feature         │ Quick VM         │ Production AKS   │ Advanced VM      │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Device Capacity │ Up to 10,000     │ 100,000+         │ Up to 50,000     │
│ High Avail.     │ No (Single VM)   │ Yes (Multi-node) │ No (Single VM)   │
│ Auto-scaling    │ No               │ Yes (HPA)        │ No               │
│ Load Balancing  │ No               │ Yes (Built-in)   │ No               │
│ Monthly Cost    │ ~`$155-205       │ ~`$500-800       │ ~`$200-400       │
│ Setup Time      │ 10-15 min        │ 20-30 min        │ 15-20 min        │
│ Complexity      │ Low              │ High             │ Medium           │
│ Use Case        │ Dev/Test/PoC     │ Production       │ Custom needs     │
│ Maintenance     │ Manual           │ Managed (AKS)    │ Manual           │
│ Backup/DR       │ Manual snapshots │ Built-in options │ Manual snapshots │
│ SSL/TLS         │ Let's Encrypt    │ Let's Encrypt    │ Let's Encrypt    │
│ Monitoring      │ Azure Monitor    │ + Prometheus     │ Azure Monitor    │
└─────────────────┴──────────────────┴──────────────────┴──────────────────┘

COST BREAKDOWN:
===============

Quick VM (~`$205/month):
  • VM (B4ms): ~`$120
  • PostgreSQL (B1ms): ~`$25
  • Storage: ~`$15
  • Networking: ~`$10
  • Monitoring: ~`$35

Production AKS (~`$650/month):
  • AKS Cluster (3 nodes D4s_v3): ~`$350
  • PostgreSQL (GP 4vCore): ~`$180
  • Storage + PVCs: ~`$40
  • Load Balancer: ~`$25
  • Monitoring: ~`$55

RECOMMENDED DEPLOYMENT PATH:
============================

1. START: Quick VM deployment for initial setup and testing
2. VALIDATE: Test your gateways, devices, and integrations
3. SCALE: When ready for production, migrate to AKS deployment
4. OPTIMIZE: Fine-tune based on actual device count and traffic

"@
    Write-Host $comparison -ForegroundColor White
    
    Write-Host "`nPress any key to return to menu..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Show menu if no mode specified
if ([string]::IsNullOrEmpty($Mode)) {
    do {
        Clear-Host
        Write-Host @"

╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   The Things Stack - Azure Deployment Orchestrator              ║
║                                                                  ║
║   Production-Ready LoRaWAN Network Server Deployment            ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan
        
        Show-DeploymentMenu
        
        $choice = Read-Host "Select deployment mode [1-4, Q]"
        
        switch ($choice.ToUpper()) {
            "1" { 
                $Mode = "quick"
                break
            }
            "2" { 
                $Mode = "aks"
                break
            }
            "3" { 
                $Mode = "vm"
                break
            }
            "4" { 
                Show-ComparisonMatrix
            }
            "Q" {
                Write-Host "`nDeployment cancelled." -ForegroundColor Yellow
                exit 0
            }
            default {
                Write-Host "`nInvalid selection. Please try again." -ForegroundColor Red
                Start-Sleep -Seconds 2
            }
        }
    } while ([string]::IsNullOrEmpty($Mode))
}

# ==============================================================================
# DEPLOYMENT EXECUTION
# ==============================================================================

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  EXECUTING: $($Mode.ToUpper()) DEPLOYMENT" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Green

switch ($Mode.ToLower()) {
    "quick" {
        Write-Host "📦 Starting Quick VM Deployment..." -ForegroundColor Cyan
        Write-Host "   Using: deploy-simple.ps1`n" -ForegroundColor Gray
        
        $params = @{
            Location = $Location
            EnvironmentName = $EnvironmentName
        }
        
        if ($AdminEmail) { $params.AdminEmail = $AdminEmail }
        if ($ParametersFile) { $params.ParametersFile = $ParametersFile }
        
        & "$PSScriptRoot\deploy-simple.ps1" @params
    }
    
    "aks" {
        Write-Host "🚀 Starting Production AKS Deployment..." -ForegroundColor Green
        Write-Host "   Using: deployments/kubernetes/deploy-aks.ps1`n" -ForegroundColor Gray
        
        # Check if AKS deployment script exists
        $aksDeployScript = "$PSScriptRoot\deployments\kubernetes\deploy-aks.ps1"
        if (Test-Path $aksDeployScript) {
            $params = @{
                Location = $Location
                EnvironmentName = $EnvironmentName
            }
            
            if ($AdminEmail) { $params.AdminEmail = $AdminEmail }
            if ($ParametersFile) { $params.ParametersFile = $ParametersFile }
            
            & $aksDeployScript @params
        } else {
            Write-Host "⚠️  AKS deployment not yet implemented" -ForegroundColor Yellow
            Write-Host "`nThe AKS/Kubernetes deployment is under development." -ForegroundColor White
            Write-Host "Current status:" -ForegroundColor White
            Write-Host "  ✅ Architecture planned (see docs/ARCHITECTURE.md)" -ForegroundColor Green
            Write-Host "  🔨 Implementation in progress" -ForegroundColor Yellow
            Write-Host "  📋 Expected completion: Next release`n" -ForegroundColor Gray
            
            Write-Host "For production deployments, we recommend:" -ForegroundColor Cyan
            Write-Host "  1. Start with VM deployment for immediate use" -ForegroundColor White
            Write-Host "  2. Scale VM vertically (larger size) if needed" -ForegroundColor White
            Write-Host "  3. Migrate to AKS when available`n" -ForegroundColor White
            
            $useVM = Read-Host "Would you like to deploy with VM instead? (yes/no)"
            if ($useVM -eq "yes") {
                $Mode = "quick"
                & "$PSScriptRoot\deploy-simple.ps1" -Location $Location -EnvironmentName $EnvironmentName
            } else {
                Write-Host "`nDeployment cancelled." -ForegroundColor Yellow
                exit 0
            }
        }
    }
    
    "vm" {
        Write-Host "⚙️  Starting Advanced VM Deployment..." -ForegroundColor Cyan
        Write-Host "   Custom configuration mode`n" -ForegroundColor Gray
        Write-Host "⚙️  Starting Advanced VM Deployment..." -ForegroundColor Cyan
        Write-Host "   Custom configuration mode`n" -ForegroundColor Gray
        
        # Collect advanced parameters
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
        
        Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
        Write-Host "  ADVANCED CONFIGURATION" -ForegroundColor Yellow
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Yellow
        
        # VM Size selection
        Write-Host "Select VM Size:" -ForegroundColor Cyan
        Write-Host "  [1] Standard_B4ms (4 vCPU, 16GB) - ~`$120/month - Up to 10K devices" -ForegroundColor White
        Write-Host "  [2] Standard_D4s_v3 (4 vCPU, 16GB) - ~`$140/month - Up to 20K devices" -ForegroundColor White
        Write-Host "  [3] Standard_D8s_v3 (8 vCPU, 32GB) - ~`$280/month - Up to 50K devices" -ForegroundColor White
        Write-Host "  [4] Custom (specify SKU)`n" -ForegroundColor White
        
        $vmChoice = Read-Host "Selection [1-4]"
        $VMSize = switch ($vmChoice) {
            "1" { "Standard_B4ms" }
            "2" { "Standard_D4s_v3" }
            "3" { "Standard_D8s_v3" }
            "4" { Read-Host "Enter custom VM SKU" }
            default { "Standard_B4ms" }
        }
        
        # Security options
        Write-Host "`nSecurity Configuration:" -ForegroundColor Cyan
        $enablePrivateDB = (Read-Host "Enable private database access? (yes/no) [yes]") -ne "no"
        $enableKeyVault = (Read-Host "Enable Key Vault for secrets? (yes/no) [yes]") -ne "no"
        
        # Domain name
        Write-Host "`nDomain Configuration:" -ForegroundColor Cyan
        Write-Host "Leave empty to use auto-generated Azure DNS name" -ForegroundColor Gray
        $DomainName = Read-Host "Custom domain name (optional)"
        
        # Detect or specify SSH source IP
        Write-Host "`nSSH Access Configuration:" -ForegroundColor Cyan
        Write-Host "Detecting your public IP for SSH restriction..." -ForegroundColor Gray
        try {
            $AdminSourceIP = (Invoke-RestMethod -Uri 'https://api.ipify.org?format=json' -TimeoutSec 10).ip
            Write-Host "✓ Detected IP: $AdminSourceIP" -ForegroundColor Green
            $useDetectedIP = Read-Host "Use this IP for SSH restriction? (yes/no) [yes]"
            if ($useDetectedIP -eq "no") {
                $AdminSourceIP = Read-Host "Enter IP address or CIDR (or * for any)"
            }
        } catch {
            Write-Host "⚠ Could not detect IP" -ForegroundColor Yellow
            $AdminSourceIP = Read-Host "Enter IP address or CIDR (or * for any)"
        }
        
        # Generate resource group name
        $timestamp = Get-Date -Format "yyyyMMddHHmm"
        $resourceGroupName = "rg-tts-$timestamp"
        
        Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
        Write-Host "  DEPLOYMENT SUMMARY" -ForegroundColor Yellow
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Yellow
        
        Write-Host "Resource Group: " -NoNewline; Write-Host $resourceGroupName -ForegroundColor Cyan
        Write-Host "Location: " -NoNewline; Write-Host $Location -ForegroundColor Cyan
        Write-Host "Environment: " -NoNewline; Write-Host $EnvironmentName -ForegroundColor Cyan
        Write-Host "VM Size: " -NoNewline; Write-Host $VMSize -ForegroundColor Cyan
        Write-Host "Admin Email: " -NoNewline; Write-Host $AdminEmail -ForegroundColor Cyan
        Write-Host "SSH Source IP: " -NoNewline; Write-Host $AdminSourceIP -ForegroundColor Cyan
        Write-Host "Private Database: " -NoNewline; Write-Host $enablePrivateDB -ForegroundColor Cyan
        Write-Host "Key Vault: " -NoNewline; Write-Host $enableKeyVault -ForegroundColor Cyan
        if ($DomainName) {
            Write-Host "Domain: " -NoNewline; Write-Host $DomainName -ForegroundColor Cyan
        }
        
        $confirm = Read-Host "`nProceed with deployment? (yes/no)"
        if ($confirm -ne "yes") {
            Write-Host "Deployment cancelled." -ForegroundColor Yellow
            exit 0
        }
        
        # Create resource group
        Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        Write-Host "  PROVISIONING INFRASTRUCTURE" -ForegroundColor Green
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Green
        
        Write-Host "Creating resource group..." -ForegroundColor Cyan
        New-AzResourceGroup -Name $resourceGroupName -Location $Location -Force | Out-Null
        Write-Host "✓ Resource group created" -ForegroundColor Green
        
        # Generate Key Vault name if needed
        $KeyVaultName = ""
        if ($enableKeyVault) {
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
            TemplateFile          = "$PSScriptRoot\deployments\vm\tts-docker-deployment.bicep"
            location              = $Location
            environmentName       = $EnvironmentName
            adminUsername         = "ttsadmin"
            adminPassword         = $vmAdminPassword
            adminEmail            = $AdminEmail
            vmSize                = $VMSize
            adminSourceIP         = $AdminSourceIP
            enablePrivateDatabaseAccess = $enablePrivateDB
            enableKeyVault        = $enableKeyVault
            ttsAdminPasswordParam = $ttsAdminPassword
        }
        
        # Add optional parameters
        if (-not [string]::IsNullOrEmpty($DomainName)) {
            $deploymentParams.domainName = $DomainName
        }
        
        if ($enableKeyVault -and -not [string]::IsNullOrEmpty($KeyVaultName)) {
            $deploymentParams.keyVaultName = $KeyVaultName
        }
        
        # Use parameters file if provided
        if (-not [string]::IsNullOrEmpty($ParametersFile) -and (Test-Path $ParametersFile)) {
            Write-Host "Using parameters file: $ParametersFile" -ForegroundColor Cyan
            $deploymentParams.TemplateParameterFile = $ParametersFile
        }
        
        Write-Host "`nStarting deployment (this may take 10-15 minutes)...`n" -ForegroundColor Yellow
        
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
            
            Write-Host "`n🌐 LoRaWAN Endpoints:" -ForegroundColor Yellow
            Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
            Write-Host "Gateway Address: " -NoNewline; Write-Host $deployment.Outputs.gatewayAddress.Value -ForegroundColor Magenta
            Write-Host "gRPC API:        " -NoNewline; Write-Host $deployment.Outputs.grpcApiUrl.Value -ForegroundColor Magenta
            
            # Save deployment info
            $outputFile = "deployment-$timestamp.txt"
            @"
The Things Stack Deployment Information
========================================
Deployed: $(Get-Date)
Mode: Advanced VM
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

LoRaWAN Endpoints:
------------------
Gateway Address: $($deployment.Outputs.gatewayAddress.Value)
gRPC API: $($deployment.Outputs.grpcApiUrl.Value)

Configuration:
--------------
VM Size: $VMSize
Location: $Location
Private Database: $enablePrivateDB
Key Vault: $enableKeyVault
SSH Source IP: $AdminSourceIP
"@ | Out-File -FilePath $outputFile -Encoding UTF8
            
            Write-Host "`n💾 Deployment info saved to: $outputFile" -ForegroundColor Green
            
        } catch {
            Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Red
            Write-Host "║            Deployment Failed!                        ║" -ForegroundColor Red
            Write-Host "╚══════════════════════════════════════════════════════╝`n" -ForegroundColor Red
            
            Write-Host "Error Details:" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
            
            Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
            Write-Host "1. Check Azure portal for detailed error messages" -ForegroundColor White
            Write-Host "2. Verify you have sufficient Azure credits/quota" -ForegroundColor White
            Write-Host "3. Ensure passwords meet complexity requirements" -ForegroundColor White
            Write-Host "4. Review deployment logs in the Azure portal" -ForegroundColor White
            
            exit 1
        }
    }
    
    default {
        Write-Host "❌ Invalid deployment mode: $Mode" -ForegroundColor Red
        Write-Host "   Valid modes: quick, aks, vm" -ForegroundColor Yellow
        exit 1
    }
}
