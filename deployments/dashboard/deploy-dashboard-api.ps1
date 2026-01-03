#!/usr/bin/env pwsh
# ==============================================================================
# Deploy Dashboard API (BYO Azure Functions) + Link to Static Web App
# ==============================================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory = $true)]
    [string]$StaticWebAppName,

    [Parameter(Mandatory = $true)]
    [string]$FunctionAppName,

    [Parameter(Mandatory = $false)]
    [string]$FunctionAppResourceGroupName = "",

    [Parameter(Mandatory = $false)]
    [string]$ApiProjectPath = "",

    [Parameter(Mandatory = $false)]
    [string]$BackendName = ""

    ,
    [Parameter(Mandatory = $false)]
    [string]$KeyVaultName = "",

    [Parameter(Mandatory = $false)]
    [string]$SqlConnectionSecretName = "integration-sql-connection",

    [Parameter(Mandatory = $false)]
    [string]$SqlConnectionString = "",

    [Parameter(Mandatory = $false)]
    [string]$WebPubSubName = "",

    [Parameter(Mandatory = $false)]
    [string]$WebPubSubResourceGroupName = "",

    [Parameter(Mandatory = $false)]
    [string]$WebPubSubConnectionString = ""
)

$ErrorActionPreference = 'Stop'

function Assert-Command {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Host "❌ $FailureMessage" -ForegroundColor Red
        exit 1
    }
}

function Assert-AzLogin {
    $null = az account show --only-show-errors --output none 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Azure CLI is not logged in (or cannot access the subscription)." -ForegroundColor Red
        Write-Host "   Run: az login" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "`n╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Deploying Dashboard API (BYO Functions)                         ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Resolve repo root from this script location: deployments/dashboard
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')

if ([string]::IsNullOrWhiteSpace($FunctionAppResourceGroupName)) {
    $FunctionAppResourceGroupName = $ResourceGroupName
}

if ([string]::IsNullOrWhiteSpace($ApiProjectPath)) {
    $ApiProjectPath = Join-Path $repoRoot 'deployments\dashboard\api'
}

if ([string]::IsNullOrWhiteSpace($BackendName)) {
    $BackendName = $FunctionAppName
}

if ([string]::IsNullOrWhiteSpace($WebPubSubResourceGroupName)) {
    $WebPubSubResourceGroupName = $ResourceGroupName
}

# Basic tool checks
Assert-Command -Name 'az' -FailureMessage "Azure CLI (az) not found on PATH. Install: https://learn.microsoft.com/cli/azure/install-azure-cli"
Assert-AzLogin
Assert-Command -Name 'dotnet' -FailureMessage ".NET SDK not found. Install .NET 8 SDK to build/publish the API."

if (-not (Test-Path $ApiProjectPath)) {
    Write-Host "❌ API project path not found: $ApiProjectPath" -ForegroundColor Red
    exit 1
}

# Validate Static Web App
Write-Host "Validating Static Web App exists..." -ForegroundColor Gray
az staticwebapp show -n $StaticWebAppName -g $ResourceGroupName --only-show-errors --output none 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Static Web App not found (or insufficient permissions): $StaticWebAppName" -ForegroundColor Red
    Write-Host "   Resource Group: $ResourceGroupName" -ForegroundColor Yellow
    exit 1
}

# Backend linking requires Standard SKU
$swaSku = az staticwebapp show -n $StaticWebAppName -g $ResourceGroupName --query "sku.name" -o tsv --only-show-errors
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($swaSku)) {
    Write-Host "❌ Failed to determine Static Web App SKU." -ForegroundColor Red
    exit 1
}
if ($swaSku -ne 'Standard') {
    Write-Host "❌ Static Web App SKU must be 'Standard' to link a BYO backend." -ForegroundColor Red
    Write-Host "   Current SKU: $swaSku" -ForegroundColor Yellow
    Write-Host "   Recreate/upgrade the SWA to Standard, then re-run this script." -ForegroundColor Yellow
    exit 1
}

# Validate Function App
Write-Host "Validating Function App exists..." -ForegroundColor Gray
$funcJson = az functionapp show -n $FunctionAppName -g $FunctionAppResourceGroupName --query "{id:id, location:location, defaultHostName:defaultHostName}" -o json --only-show-errors 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($funcJson)) {
    Write-Host "❌ Function App not found (or insufficient permissions): $FunctionAppName" -ForegroundColor Red
    Write-Host "   Resource Group: $FunctionAppResourceGroupName" -ForegroundColor Yellow
    exit 1
}
$func = $funcJson | ConvertFrom-Json

# Find the csproj
$csproj = Get-ChildItem -Path $ApiProjectPath -Filter '*.csproj' -File -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $csproj) {
    Write-Host "❌ No .csproj found under: $ApiProjectPath" -ForegroundColor Red
    exit 1
}

# Publish to temp
$publishDir = Join-Path $env:TEMP ("tts-dashboard-api-publish-" + [Guid]::NewGuid().ToString('N'))
$zipPath = Join-Path $env:TEMP ("tts-dashboard-api-" + [Guid]::NewGuid().ToString('N') + ".zip")

Write-Host "Publishing Functions API..." -ForegroundColor Yellow
Write-Host "  Project: $($csproj.FullName)" -ForegroundColor Gray
Write-Host "  Output:  $publishDir" -ForegroundColor Gray

dotnet publish $csproj.FullName -c Release -o $publishDir | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ dotnet publish failed." -ForegroundColor Red
    exit 1
}

# Zip publish output
Write-Host "Creating ZIP package..." -ForegroundColor Yellow
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path (Join-Path $publishDir '*') -DestinationPath $zipPath -Force

# Zip deploy
Write-Host "Deploying ZIP package to Function App..." -ForegroundColor Yellow
az functionapp deployment source config-zip -g $FunctionAppResourceGroupName -n $FunctionAppName --src $zipPath --only-show-errors | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ZIP deploy failed." -ForegroundColor Red
    exit 1
}

# Optional: Configure app settings
Write-Host "Configuring Function App settings (optional)..." -ForegroundColor Yellow

if ([string]::IsNullOrWhiteSpace($SqlConnectionString) -and -not [string]::IsNullOrWhiteSpace($KeyVaultName)) {
    Write-Host "Retrieving SQL connection string from Key Vault secret '$SqlConnectionSecretName'..." -ForegroundColor Gray
    $SqlConnectionString = az keyvault secret show --vault-name $KeyVaultName --name $SqlConnectionSecretName --query value -o tsv --only-show-errors 2>$null
}

if ([string]::IsNullOrWhiteSpace($WebPubSubConnectionString) -and -not [string]::IsNullOrWhiteSpace($WebPubSubName)) {
    Write-Host "Retrieving Web PubSub connection string for '$WebPubSubName'..." -ForegroundColor Gray
    # Ensure the CLI extension exists (non-fatal if already installed)
    $null = az extension add --name webpubsub --only-show-errors 2>$null
    $WebPubSubConnectionString = az webpubsub key show -n $WebPubSubName -g $WebPubSubResourceGroupName --query primaryConnectionString -o tsv --only-show-errors 2>$null
}

$settings = @()
if (-not [string]::IsNullOrWhiteSpace($SqlConnectionString)) {
    $settings += "SqlConnectionString=$SqlConnectionString"
}
if (-not [string]::IsNullOrWhiteSpace($WebPubSubConnectionString)) {
    $settings += "WebPubSubConnectionString=$WebPubSubConnectionString"
}

if ($settings.Count -gt 0) {
    Write-Host "Applying app settings: $($settings.Count)" -ForegroundColor Gray
    az functionapp config appsettings set -g $FunctionAppResourceGroupName -n $FunctionAppName --settings $settings --only-show-errors | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to set app settings." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "No optional settings provided; skipping app settings update." -ForegroundColor Gray
}

# Link backend
Write-Host "Linking Function App to Static Web App as /api backend..." -ForegroundColor Yellow
Write-Host "  Backend region: $($func.location)" -ForegroundColor Gray

az staticwebapp backends link -g $ResourceGroupName -n $StaticWebAppName --backend-resource-id $func.id --backend-region $func.location --only-show-errors | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend link failed." -ForegroundColor Red
    exit 1
}

# Output URLs
$swaHost = az staticwebapp show -n $StaticWebAppName -g $ResourceGroupName --query "defaultHostname" -o tsv --only-show-errors
if ([string]::IsNullOrWhiteSpace($swaHost)) {
    $swaHost = "<static-web-app-hostname>"
}

Write-Host "`n✓ Dashboard API deployed and linked" -ForegroundColor Green
Write-Host "Function App:" -ForegroundColor White
Write-Host "  https://$($func.defaultHostName)/api/overview" -ForegroundColor Green
Write-Host "Static Web App (proxied):" -ForegroundColor White
Write-Host "  https://$swaHost/api/overview" -ForegroundColor Green

# Cleanup temp files
try {
    if (Test-Path $publishDir) { Remove-Item $publishDir -Recurse -Force }
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
} catch {
    # Non-fatal
}
