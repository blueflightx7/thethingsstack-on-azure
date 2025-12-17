#!/usr/bin/env pwsh
# ============================================================================== 
# Deploy Dashboard Infrastructure (Static Web App + Web PubSub)
# ==============================================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory = $true)]
    [string]$Location,

    [Parameter(Mandatory = $false)]
    [string]$NamePrefix = 'tts',

    [Parameter(Mandatory = $false)]
    [ValidateSet('Free', 'Standard')]
    [string]$StaticWebAppSku = 'Free',

    [Parameter(Mandatory = $false)]
    [ValidateSet('Free_F1', 'Standard_S1')]
    [string]$WebPubSubSku = 'Standard_S1'
)

$ErrorActionPreference = 'Stop'

Write-Host "`n╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Deploying Dashboard Infrastructure                             ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Validate target RG exists
try {
    $rg = Get-AzResourceGroup -Name $ResourceGroupName -ErrorAction Stop
}
catch {
    Write-Host "❌ Resource Group not found: $ResourceGroupName" -ForegroundColor Red
    Write-Host "   Create it first or choose an existing one." -ForegroundColor Yellow
    exit 1
}

if ([string]::IsNullOrWhiteSpace($Location)) {
    $Location = $rg.Location
}

$templateFile = Join-Path $PSScriptRoot 'dashboard.bicep'
if (-not (Test-Path $templateFile)) {
    Write-Host "❌ Template not found: $templateFile" -ForegroundColor Red
    exit 1
}

$deploymentName = "tts-dashboard-$(Get-Date -Format 'yyyyMMdd-HHmm')"

Write-Host "Target Resource Group: $ResourceGroupName" -ForegroundColor Gray
Write-Host "Location: $Location" -ForegroundColor Gray
Write-Host "Static Web App SKU: $StaticWebAppSku" -ForegroundColor Gray
Write-Host "Web PubSub SKU: $WebPubSubSku`n" -ForegroundColor Gray

$params = @{ 
    location = $Location
    namePrefix = $NamePrefix
    staticWebAppSku = $StaticWebAppSku
    webPubSubSku = $WebPubSubSku
}

try {
    $deployment = New-AzResourceGroupDeployment `
        -ResourceGroupName $ResourceGroupName `
        -TemplateFile $templateFile `
        -TemplateParameterObject $params `
        -Name $deploymentName `
        -ErrorAction Stop

    $outputs = $deployment.Outputs
    $staticHost = $outputs.staticWebAppDefaultHostname.Value
    $staticName = $outputs.staticWebAppName.Value
    $staticLocation = $outputs.staticWebAppLocation.Value
    $pubSubHost = $outputs.webPubSubHostName.Value
    $pubSubName = $outputs.webPubSubName.Value

    Write-Host "`n✓ Dashboard infrastructure deployed" -ForegroundColor Green
    Write-Host "Static Web App URL:" -ForegroundColor White
    Write-Host "  https://$staticHost" -ForegroundColor Green
    Write-Host "Static Web App name:" -ForegroundColor White
    Write-Host "  $staticName" -ForegroundColor Green
    Write-Host "Static Web App region:" -ForegroundColor White
    Write-Host "  $staticLocation" -ForegroundColor Green
    if ($staticLocation -ne $Location) {
        Write-Host "  (Note: SWA isn't available in all regions; deployed in a supported region.)" -ForegroundColor Yellow
    }
    Write-Host "Web PubSub host:" -ForegroundColor White
    Write-Host "  $pubSubHost" -ForegroundColor Green
    Write-Host "Web PubSub name:" -ForegroundColor White
    Write-Host "  $pubSubName" -ForegroundColor Green

    Write-Host "`nNext:" -ForegroundColor Yellow
    Write-Host "- Deploy the dashboard site code (Next.js) into the Static Web App." -ForegroundColor Gray
    Write-Host "- Configure SWA authentication (Entra ID) in Azure Portal / ARM once the app registration is ready." -ForegroundColor Gray
}
catch {
    Write-Host "❌ Dashboard deployment failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
