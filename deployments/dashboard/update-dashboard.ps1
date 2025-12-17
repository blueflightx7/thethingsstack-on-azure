#!/usr/bin/env pwsh
# ==============================================================================
# Update Dashboard UI Only (Build + Deploy to existing Static Web App)
# ==============================================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory = $true)]
    [string]$StaticWebAppName,

    [Parameter(Mandatory = $false)]
    [string]$DashboardPath = "",

    [Parameter(Mandatory = $false)]
    [string]$DeploymentToken = ""
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
Write-Host "║   Updating Dashboard UI (Deploy only)                            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Resolve repo root from this script location: deployments/dashboard
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')

if ([string]::IsNullOrWhiteSpace($DashboardPath)) {
    $DashboardPath = Join-Path $repoRoot 'dashboard'
}

if (-not (Test-Path $DashboardPath)) {
    Write-Host "❌ Dashboard path not found: $DashboardPath" -ForegroundColor Red
    exit 1
}

# Basic tool checks
Assert-Command -Name 'az' -FailureMessage "Azure CLI (az) not found on PATH. Install: https://learn.microsoft.com/cli/azure/install-azure-cli"
Assert-AzLogin

Assert-Command -Name 'node' -FailureMessage "Node.js not found on PATH. Install Node.js 20+ from https://nodejs.org/ and re-open your terminal."
Assert-Command -Name 'npm' -FailureMessage "npm not found on PATH. Install Node.js 20+ from https://nodejs.org/ (npm ships with Node)."

$packageJson = Join-Path $DashboardPath 'package.json'
if (-not (Test-Path $packageJson)) {
    Write-Host "❌ Dashboard package.json not found: $packageJson" -ForegroundColor Red
    exit 1
}

# API Path
$ApiPath = Join-Path $repoRoot 'deployments\dashboard\api'
if (-not (Test-Path $ApiPath)) {
    Write-Host "⚠️ API path not found: $ApiPath (Skipping API deployment)" -ForegroundColor Yellow
    $ApiPath = ""
} else {
    Assert-Command -Name 'dotnet' -FailureMessage ".NET SDK not found. Install .NET 8 SDK to build the API."
}

# Handle hostname input (common user error)
if ($StaticWebAppName -match '\.azurestaticapps\.net$') {
    Write-Host "⚠️  Input '$StaticWebAppName' looks like a hostname." -ForegroundColor Yellow
    Write-Host "   Searching for the Static Web App resource in '$ResourceGroupName'..." -ForegroundColor Gray
    
    try {
        $swaList = az staticwebapp list -g $ResourceGroupName --query "[].{name:name, host:defaultHostname}" -o json | ConvertFrom-Json
        $match = $swaList | Where-Object { $_.host -eq $StaticWebAppName }
        
        if ($match) {
            $StaticWebAppName = $match.name
            Write-Host "✓ Found resource: $StaticWebAppName" -ForegroundColor Green
        } else {
            Write-Host "❌ Could not find a Static Web App with hostname '$StaticWebAppName' in group '$ResourceGroupName'." -ForegroundColor Red
            Write-Host "   Please provide the *Resource Name* (e.g. 'tts-dash-xyz'), not the URL." -ForegroundColor Yellow
            exit 1
        }
    } catch {
        Write-Host "❌ Failed to list Static Web Apps to resolve hostname." -ForegroundColor Red
        exit 1
    }
}

# Confirm SWA exists (gives a clearer error than later token retrieval)
Write-Host "Validating Static Web App exists..." -ForegroundColor Gray
az staticwebapp show -n $StaticWebAppName -g $ResourceGroupName --only-show-errors --output none 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Static Web App not found (or insufficient permissions): $StaticWebAppName" -ForegroundColor Red
    Write-Host "   Resource Group: $ResourceGroupName" -ForegroundColor Yellow
    exit 1
}

# Get deployment token if not provided
if ([string]::IsNullOrWhiteSpace($DeploymentToken)) {
    Write-Host "Retrieving Static Web App deployment token..." -ForegroundColor Gray
    $DeploymentToken = az staticwebapp secrets list -n $StaticWebAppName -g $ResourceGroupName --query "properties.apiKey" -o tsv --only-show-errors
    if ([string]::IsNullOrWhiteSpace($DeploymentToken)) {
        Write-Host "❌ Could not retrieve SWA deployment token." -ForegroundColor Red
        Write-Host "   Try running: az staticwebapp secrets list -n $StaticWebAppName -g $ResourceGroupName --query properties.apiKey -o tsv" -ForegroundColor Yellow
        exit 1
    }
}

# Build
Write-Host "Building dashboard UI..." -ForegroundColor Yellow
Push-Location $DashboardPath
try {
    if (Test-Path (Join-Path $DashboardPath 'package-lock.json')) {
        npm ci | Out-Host
    }
    else {
        npm install | Out-Host
    }
    npm run build | Out-Host

    $outDir = Join-Path $DashboardPath 'out'
    if (-not (Test-Path $outDir)) {
        Write-Host "❌ Build output directory not found: $outDir" -ForegroundColor Red
        exit 1
    }

    # Verify build output contains index.html (critical for SWA)
    if (-not (Test-Path (Join-Path $outDir 'index.html'))) {
        Write-Host "❌ 'index.html' not found in $outDir" -ForegroundColor Red
        Write-Host "   Ensure 'npm run build' completed successfully and next.config.mjs has output: 'export'." -ForegroundColor Yellow
        exit 1
    }

    # Copy staticwebapp.config.json to out/ to ensure it's included in the deployment bundle
    # This fixes routing issues where the config isn't picked up from the root
    $configFile = Join-Path $DashboardPath 'staticwebapp.config.json'
    if (Test-Path $configFile) {
        Write-Host "   Copying staticwebapp.config.json to build output..." -ForegroundColor Gray
        Copy-Item $configFile -Destination $outDir -Force
    }

    # Deploy
    # We pass the token explicitly via flag to ensure it propagates correctly to npx/swa process
    
    Write-Host "Deploying to Static Web App (production environment)..." -ForegroundColor Yellow
    if (-not [string]::IsNullOrWhiteSpace($ApiPath)) {
        Write-Host "   Including API from: $ApiPath" -ForegroundColor Gray
    }

    # Change to dashboard directory to simplify paths
    Push-Location $DashboardPath
    try {
        # Explicitly set app/output/config locations so the CLI picks up the exported site correctly
        # app-location: source root (already built)
        # output-location: ./out (Next.js export output)
        # swa-config-location: ./out (we copied the config there)
        # NOTE: do NOT pass positional <outputLocation> when using --output-location
        $deployCmd = "deploy --app-location ./ --output-location ./out --swa-config-location ./out --env production --deployment-token $DeploymentToken"
        if (-not [string]::IsNullOrWhiteSpace($ApiPath)) {
            $deployCmd += " --api-location `"$ApiPath`""
        }

        # Force using npx to ensure we use the latest version of the CLI and avoid local version issues
        Write-Host "   Using 'npx @azure/static-web-apps-cli'..." -ForegroundColor Gray
        Assert-Command -Name 'npx' -FailureMessage "npx not found on PATH."
        
        Invoke-Expression "npx -y @azure/static-web-apps-cli@latest $deployCmd" | Out-Host

        if ($LASTEXITCODE -ne 0) {
            throw "SWA CLI deploy failed."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host "`n✓ Dashboard UI deployed" -ForegroundColor Green
    Write-Host "  Static Web App: $StaticWebAppName" -ForegroundColor Green
}
finally {
    Pop-Location
}
