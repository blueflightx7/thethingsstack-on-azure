#!/usr/bin/env pwsh
# ==============================================================================
# TTS Deployment Validation Script
# Validates a deployed TTS instance is working correctly
# ==============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName
)

$ErrorActionPreference = "Stop"

Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      TTS Deployment Validation Script               ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Check if resource group exists
Write-Host "📋 Checking resource group..." -ForegroundColor Yellow
$rg = Get-AzResourceGroup -Name $ResourceGroupName -ErrorAction SilentlyContinue
if (-not $rg) {
    Write-Host "❌ Resource group not found: $ResourceGroupName" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Resource group exists: $($rg.Location)" -ForegroundColor Green

# Get deployment outputs
Write-Host "`n📋 Retrieving deployment outputs..." -ForegroundColor Yellow
$deployment = Get-AzResourceGroupDeployment -ResourceGroupName $ResourceGroupName -Name "tts-docker-deployment" -ErrorAction SilentlyContinue

if (-not $deployment) {
    Write-Host "❌ Deployment not found" -ForegroundColor Red
    Write-Host "Available deployments:" -ForegroundColor Yellow
    Get-AzResourceGroupDeployment -ResourceGroupName $ResourceGroupName | Select-Object DeploymentName, ProvisioningState, Timestamp
    exit 1
}

Write-Host "✅ Deployment found: $($deployment.ProvisioningState)" -ForegroundColor Green

# Extract outputs
$vmIp = $deployment.Outputs.publicIpAddress.Value
$consoleUrl = $deployment.Outputs.consoleUrl.Value
$sshCommand = $deployment.Outputs.sshCommand.Value
$dbHost = $deployment.Outputs.databaseHost.Value

Write-Host "`n📊 Deployment Details:" -ForegroundColor Cyan
Write-Host "  VM IP:        $vmIp" -ForegroundColor White
Write-Host "  Console URL:  $consoleUrl" -ForegroundColor White
Write-Host "  Database:     $dbHost" -ForegroundColor White

# Test 1: Check VM
Write-Host "`n🖥️  Checking Virtual Machine..." -ForegroundColor Yellow
$vm = Get-AzVM -ResourceGroupName $ResourceGroupName | Select-Object -First 1
if ($vm) {
    $vmStatus = Get-AzVM -ResourceGroupName $ResourceGroupName -Name $vm.Name -Status
    $powerState = $vmStatus.Statuses | Where-Object Code -like "PowerState/*" | Select-Object -ExpandProperty DisplayStatus
    if ($powerState -eq "VM running") {
        Write-Host "✅ VM is running: $($vm.Name)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  VM state: $powerState" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ No VM found" -ForegroundColor Red
}

# Test 2: Check Database
Write-Host "`n🗄️  Checking PostgreSQL Database..." -ForegroundColor Yellow
$db = Get-AzPostgreSqlFlexibleServer -ResourceGroupName $ResourceGroupName | Select-Object -First 1
if ($db) {
    if ($db.State -eq "Ready") {
        Write-Host "✅ Database is ready: $($db.Name)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Database state: $($db.State)" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ No database found" -ForegroundColor Red
}

# Test 3: Check Public IP
Write-Host "`n🌐 Checking Public IP..." -ForegroundColor Yellow
$pip = Get-AzPublicIpAddress -ResourceGroupName $ResourceGroupName | Select-Object -First 1
if ($pip) {
    Write-Host "✅ Public IP allocated: $($pip.IpAddress)" -ForegroundColor Green
    Write-Host "   DNS Name: $($pip.DnsSettings.Fqdn)" -ForegroundColor Cyan
} else {
    Write-Host "❌ No public IP found" -ForegroundColor Red
}

# Test 4: HTTP/HTTPS Connectivity
Write-Host "`n🔗 Testing HTTP Connectivity..." -ForegroundColor Yellow
try {
    $httpResponse = Invoke-WebRequest -Uri "http://$vmIp" -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($httpResponse.StatusCode -eq 200 -or $httpResponse.StatusCode -eq 301) {
        Write-Host "✅ HTTP accessible (Status: $($httpResponse.StatusCode))" -ForegroundColor Green
    } else {
        Write-Host "⚠️  HTTP returned: $($httpResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ HTTP not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🔒 Testing HTTPS Connectivity..." -ForegroundColor Yellow
try {
    # Ignore SSL certificate errors for self-signed cert
    $httpsResponse = Invoke-WebRequest -Uri "https://$vmIp" -TimeoutSec 5 -SkipCertificateCheck -UseBasicParsing -ErrorAction SilentlyContinue
    if ($httpsResponse.StatusCode -eq 200) {
        Write-Host "✅ HTTPS accessible" -ForegroundColor Green
    } else {
        Write-Host "⚠️  HTTPS returned: $($httpsResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ HTTPS not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Console Accessibility
Write-Host "`n💻 Testing Console..." -ForegroundColor Yellow
try {
    $consoleResponse = Invoke-WebRequest -Uri $consoleUrl -TimeoutSec 10 -SkipCertificateCheck -UseBasicParsing -ErrorAction SilentlyContinue
    if ($consoleResponse.StatusCode -eq 200) {
        Write-Host "✅ Console is accessible" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Console returned: $($consoleResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Console not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: SSH Connectivity (requires SSH client)
Write-Host "`n🔐 Testing SSH Port..." -ForegroundColor Yellow
$tcpClient = New-Object System.Net.Sockets.TcpClient
try {
    $tcpClient.Connect($vmIp, 22)
    Write-Host "✅ SSH port 22 is open" -ForegroundColor Green
    $tcpClient.Close()
} catch {
    Write-Host "❌ SSH port 22 is not accessible" -ForegroundColor Red
}

# Test 7: Gateway UDP Port
Write-Host "`n📡 Testing Gateway UDP Port 1700..." -ForegroundColor Yellow
Write-Host "ℹ️  UDP connectivity test requires gateway to send packets" -ForegroundColor Cyan

# Test 8: Check Monitoring
Write-Host "`n📊 Checking Monitoring Resources..." -ForegroundColor Yellow
$logAnalytics = Get-AzOperationalInsightsWorkspace -ResourceGroupName $ResourceGroupName -ErrorAction SilentlyContinue
if ($logAnalytics) {
    Write-Host "✅ Log Analytics workspace exists" -ForegroundColor Green
} else {
    Write-Host "⚠️  No Log Analytics workspace found" -ForegroundColor Yellow
}

$appInsights = Get-AzApplicationInsights -ResourceGroupName $ResourceGroupName -ErrorAction SilentlyContinue
if ($appInsights) {
    Write-Host "✅ Application Insights exists" -ForegroundColor Green
} else {
    Write-Host "⚠️  No Application Insights found" -ForegroundColor Yellow
}

# Test 9: Check Key Vault
Write-Host "`n🔑 Checking Key Vault..." -ForegroundColor Yellow
$keyVault = Get-AzKeyVault -ResourceGroupName $ResourceGroupName -ErrorAction SilentlyContinue
if ($keyVault) {
    Write-Host "✅ Key Vault exists: $($keyVault.VaultName)" -ForegroundColor Green
    
    $secrets = Get-AzKeyVaultSecret -VaultName $keyVault.VaultName
    Write-Host "   Secrets count: $($secrets.Count)" -ForegroundColor Cyan
} else {
    Write-Host "ℹ️  No Key Vault (may be disabled)" -ForegroundColor Cyan
}

# Summary
Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║             Validation Summary                       ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "Resource Group: $ResourceGroupName" -ForegroundColor White
Write-Host "Deployment State: $($deployment.ProvisioningState)" -ForegroundColor White
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. SSH to VM: " -NoNewline; Write-Host $sshCommand -ForegroundColor Cyan
Write-Host "2. Check TTS logs: " -NoNewline; Write-Host "docker logs lorawan-stack_stack_1 -f" -ForegroundColor Cyan
Write-Host "3. Access console: " -NoNewline; Write-Host $consoleUrl -ForegroundColor Cyan
Write-Host "`nℹ️  Allow 5-10 minutes after deployment for TTS to fully initialize" -ForegroundColor Cyan
