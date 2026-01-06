#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Unified update script for Beehive Dashboard system components.

.DESCRIPTION
    Updates deployed components without re-running full infrastructure deployment.
    Supports ProcessToSQL Function, Dashboard UI, Dashboard API, and SQL Schema.

.PARAMETER Component
    Component to update: Menu (interactive), All, Function, UI, API, SQL

.PARAMETER ResourceGroupName
    Azure Resource Group name.

.PARAMETER IntegrationFunctionAppName
    ProcessToSQL Function App name.

.PARAMETER DashboardApiFunctionAppName
    Dashboard API Function App name.

.PARAMETER StaticWebAppName
    Static Web App name.

.PARAMETER SqlServerName
    SQL Server name (without .database.windows.net).

.PARAMETER SqlDatabaseName
    SQL Database name.

.PARAMETER SqlUsername
    SQL admin username.

.PARAMETER SqlPassword
    SQL admin password (will prompt if not provided).

.EXAMPLE
    .\update.ps1
    Shows interactive menu.

.EXAMPLE
    .\update.ps1 -Component Function
    Updates ProcessToSQL function only.

.EXAMPLE
    .\update.ps1 -Component All
    Updates all components.

.EXAMPLE
    .\update.ps1 -Component SQL -SqlPassword "MyPassword"
    Updates SQL schema with password.
#>

param(
    [Parameter()]
    [ValidateSet('Menu', 'All', 'Function', 'UI', 'API', 'SQL')]
    [string]$Component = 'Menu',

    # Resource configuration (defaults for EXP-BEEHIVE-PROD-NY-RG)
    [string]$ResourceGroupName = "EXP-BEEHIVE-PROD-NY-RG",
    [string]$IntegrationFunctionAppName = "tts-int-func-tkrq6jjnphvvy",
    [string]$DashboardApiFunctionAppName = "beehive-dash-api-tkrq6jjnphvvy",
    [string]$StaticWebAppName = "beehive-nyc-dash-ivnh6kzlxappu",
    [string]$SqlServerName = "tts-int-sql-tkrq6jjnphvvy",
    [string]$SqlDatabaseName = "tts-data",
    [string]$SqlUsername = "ttsadmin",
    [string]$SqlPassword = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

# ============================================================================
# Helper Functions
# ============================================================================

function Write-Banner {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([int]$Step, [int]$Total, [string]$Message)
    Write-Host "[$Step/$Total] $Message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Failure {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Assert-Command {
    param([string]$Name, [string]$FailureMessage)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Failure $FailureMessage
        return $false
    }
    return $true
}

function Assert-AzLogin {
    $null = az account show --only-show-errors --output none 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Failure "Azure CLI not logged in. Run: az login"
        return $false
    }
    return $true
}

# ============================================================================
# Component: ProcessToSQL Function (Message Ingestion)
# ============================================================================

function Update-ProcessToSqlFunction {
    Write-Banner "Updating ProcessToSQL Function"
    
    $funcDir = Join-Path $PSScriptRoot "integration\function"
    $zipPath = Join-Path $PSScriptRoot "integration\function.zip"
    $prepDeps = Join-Path $funcDir "prepare-deps.ps1"

    # Step 1: Prepare dependencies
    Write-Step 1 4 "Preparing dependencies..."
    if (Test-Path $prepDeps) {
        Push-Location (Split-Path $prepDeps -Parent)
        try {
            & $prepDeps
            if ($LASTEXITCODE -ne 0) {
                Write-Failure "prepare-deps.ps1 failed!"
                return $false
            }
        }
        finally {
            Pop-Location
        }
    } else {
        Write-Host "   WARNING: prepare-deps.ps1 not found, skipping..." -ForegroundColor Yellow
    }

    # Step 2: Create ZIP package
    Write-Step 2 4 "Creating deployment package..."
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path "$funcDir\*" -DestinationPath $zipPath
    $zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
    Write-Host "   Package: function.zip ($zipSize MB)" -ForegroundColor Gray

    # Step 3: Deploy to Azure
    Write-Step 3 4 "Deploying to '$IntegrationFunctionAppName'..."
    az functionapp deployment source config-zip `
        --resource-group $ResourceGroupName `
        --name $IntegrationFunctionAppName `
        --src $zipPath `
        --output none

    if ($LASTEXITCODE -ne 0) {
        Write-Failure "Deployment failed!"
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
        return $false
    }

    # Step 4: Restart
    Write-Step 4 4 "Restarting Function App..."
    az functionapp restart --resource-group $ResourceGroupName --name $IntegrationFunctionAppName --output none

    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    Write-Success "ProcessToSQL Function updated!"
    Write-Host ""
    Write-Host "   Monitor logs:" -ForegroundColor Gray
    Write-Host "   az functionapp log tail -g $ResourceGroupName -n $IntegrationFunctionAppName" -ForegroundColor DarkGray
    return $true
}

# ============================================================================
# Component: Dashboard UI (Static Web App)
# ============================================================================

function Update-DashboardUI {
    Write-Banner "Updating Dashboard UI (Static Web App)"

    $dashboardPath = Join-Path $repoRoot "dashboard"

    if (-not (Assert-Command "node" "Node.js not found. Install from https://nodejs.org/")) { return $false }
    if (-not (Assert-Command "npm" "npm not found.")) { return $false }
    if (-not (Assert-Command "npx" "npx not found.")) { return $false }

    # Get deployment token
    Write-Step 1 4 "Retrieving deployment token..."
    $deploymentToken = az staticwebapp secrets list -n $StaticWebAppName -g $ResourceGroupName --query "properties.apiKey" -o tsv --only-show-errors 2>$null
    if ([string]::IsNullOrWhiteSpace($deploymentToken)) {
        Write-Failure "Could not retrieve SWA deployment token. Check if '$StaticWebAppName' exists."
        return $false
    }

    # Install dependencies
    Write-Step 2 4 "Installing npm dependencies..."
    Push-Location $dashboardPath
    try {
        if (Test-Path "package-lock.json") {
            npm ci 2>&1 | Out-Host
        } else {
            npm install 2>&1 | Out-Host
        }

        # Build
        Write-Step 3 4 "Building Next.js app..."
        npm run build 2>&1 | Out-Host

        $outDir = Join-Path $dashboardPath "out"
        if (-not (Test-Path (Join-Path $outDir "index.html"))) {
            Write-Failure "Build output not found. Check npm run build output."
            return $false
        }

        # Copy config
        $configFile = Join-Path $dashboardPath "staticwebapp.config.json"
        if (Test-Path $configFile) {
            Copy-Item $configFile -Destination $outDir -Force
        }

        # Deploy
        Write-Step 4 4 "Deploying to Static Web App..."
        npx -y @azure/static-web-apps-cli@latest deploy `
            --app-location ./ `
            --output-location ./out `
            --swa-config-location ./out `
            --env production `
            --deployment-token $deploymentToken 2>&1 | Out-Host

        if ($LASTEXITCODE -ne 0) {
            Write-Failure "SWA deploy failed."
            return $false
        }

        Write-Success "Dashboard UI updated!"
        
        # Get hostname
        $swaHost = az staticwebapp show -n $StaticWebAppName -g $ResourceGroupName --query "defaultHostname" -o tsv --only-show-errors 2>$null
        if (-not [string]::IsNullOrWhiteSpace($swaHost)) {
            Write-Host ""
            Write-Host "   Dashboard URL: https://$swaHost" -ForegroundColor Gray
        }
        return $true
    }
    finally {
        Pop-Location
    }
}

# ============================================================================
# Component: Dashboard API (Function App Backend)
# ============================================================================

function Update-DashboardAPI {
    Write-Banner "Updating Dashboard API (Function App)"

    $apiPath = Join-Path $PSScriptRoot "dashboard\api"
    
    if (-not (Assert-Command "dotnet" ".NET SDK not found. Install .NET 8 SDK.")) { return $false }

    # Find csproj
    $csproj = Get-ChildItem -Path $apiPath -Filter "*.csproj" -File -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $csproj) {
        Write-Failure "No .csproj found in $apiPath"
        return $false
    }

    $publishDir = Join-Path $env:TEMP ("dash-api-publish-" + [Guid]::NewGuid().ToString('N'))
    $zipPath = Join-Path $env:TEMP ("dash-api-" + [Guid]::NewGuid().ToString('N') + ".zip")

    # Build
    Write-Step 1 3 "Building API project..."
    Write-Host "   Project: $($csproj.Name)" -ForegroundColor Gray
    dotnet publish $csproj.FullName -c Release -o $publishDir 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Failure "dotnet publish failed."
        return $false
    }

    # Package
    Write-Step 2 3 "Creating ZIP package..."
    Compress-Archive -Path (Join-Path $publishDir "*") -DestinationPath $zipPath -Force

    # Deploy
    Write-Step 3 3 "Deploying to '$DashboardApiFunctionAppName'..."
    az functionapp deployment source config-zip `
        -g $ResourceGroupName `
        -n $DashboardApiFunctionAppName `
        --src $zipPath `
        --only-show-errors 2>&1 | Out-Host

    if ($LASTEXITCODE -ne 0) {
        Write-Failure "ZIP deploy failed."
        Remove-Item $publishDir -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
        return $false
    }

    # Cleanup
    Remove-Item $publishDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

    Write-Success "Dashboard API updated!"
    return $true
}

# ============================================================================
# Component: SQL Schema
# ============================================================================

function Update-SqlSchema {
    Write-Banner "Updating SQL Schema"

    $schemaFile = Join-Path $PSScriptRoot "integration\sql\schema.sql"
    if (-not (Test-Path $schemaFile)) {
        Write-Failure "Schema file not found: $schemaFile"
        return $false
    }

    $serverFqdn = "$SqlServerName.database.windows.net"

    # Prompt for password if not provided
    if ([string]::IsNullOrWhiteSpace($script:SqlPassword)) {
        Write-Host "Enter SQL password for '$SqlUsername': " -ForegroundColor Yellow -NoNewline
        $securePassword = Read-Host -AsSecureString
        $script:SqlPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        )
    }

    Write-Step 1 2 "Connecting to SQL Server..."
    Write-Host "   Server: $serverFqdn" -ForegroundColor Gray
    Write-Host "   Database: $SqlDatabaseName" -ForegroundColor Gray

    Write-Step 2 2 "Applying schema..."
    
    # Try Invoke-Sqlcmd first (PowerShell SqlServer module - preferred)
    if (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue) {
        Write-Host "   Using Invoke-Sqlcmd..." -ForegroundColor Gray
        try {
            # Use -ErrorAction Stop and explicit timeouts, no -Verbose to avoid hanging
            Invoke-Sqlcmd -ServerInstance $serverFqdn -Database $SqlDatabaseName `
                -Username $SqlUsername -Password $script:SqlPassword `
                -InputFile $schemaFile -TrustServerCertificate `
                -ConnectionTimeout 30 -QueryTimeout 120 -ErrorAction Stop
            Write-Success "SQL Schema applied successfully!"
            return $true
        }
        catch {
            Write-Host "   Invoke-Sqlcmd failed: $_" -ForegroundColor Yellow
        }
    }

    # Try sqlcmd CLI as fallback
    if (Get-Command sqlcmd -ErrorAction SilentlyContinue) {
        Write-Host "   Using sqlcmd CLI..." -ForegroundColor Gray
        try {
            # -l 30 = 30 second login timeout, -t 120 = 120 second query timeout
            $output = & sqlcmd -S $serverFqdn -d $SqlDatabaseName -U $SqlUsername -P $script:SqlPassword -I -i $schemaFile -l 30 -t 120 2>&1
            $output | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
            if ($LASTEXITCODE -eq 0) {
                Write-Success "SQL Schema applied successfully!"
                return $true
            }
            else {
                Write-Host "   sqlcmd returned exit code: $LASTEXITCODE" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "   sqlcmd failed: $_" -ForegroundColor Yellow
        }
    }

    Write-Failure "Neither sqlcmd nor Invoke-Sqlcmd available."
    Write-Host ""
    Write-Host "   Manual alternative - run in Azure Data Studio or SSMS:" -ForegroundColor Yellow
    Write-Host "   Server:   $serverFqdn" -ForegroundColor Gray
    Write-Host "   Database: $SqlDatabaseName" -ForegroundColor Gray
    Write-Host "   File:     $schemaFile" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Or install SqlServer module:" -ForegroundColor Yellow
    Write-Host "   Install-Module -Name SqlServer -AllowClobber -Scope CurrentUser" -ForegroundColor DarkGray
    return $false
}

# ============================================================================
# Interactive Menu
# ============================================================================

function Show-Menu {
    Write-Banner "Beehive Dashboard Update Tool"
    
    Write-Host "  Resource Group:      $ResourceGroupName" -ForegroundColor Gray
    Write-Host "  Integration Func:    $IntegrationFunctionAppName" -ForegroundColor Gray
    Write-Host "  Dashboard API:       $DashboardApiFunctionAppName" -ForegroundColor Gray
    Write-Host "  Static Web App:      $StaticWebAppName" -ForegroundColor Gray
    Write-Host "  SQL Server:          $SqlServerName" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Select component to update:" -ForegroundColor White
    Write-Host ""
    Write-Host "  [1] ProcessToSQL Function  - Message ingestion from Event Hub" -ForegroundColor Cyan
    Write-Host "  [2] Dashboard UI           - Next.js Static Web App" -ForegroundColor Cyan
    Write-Host "  [3] Dashboard API          - .NET Function App backend" -ForegroundColor Cyan
    Write-Host "  [4] SQL Schema             - Database table updates" -ForegroundColor Cyan
    Write-Host "  [5] All Components         - Update everything" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "  [Q] Quit" -ForegroundColor Gray
    Write-Host ""

    $choice = Read-Host "  Enter selection"
    return $choice
}

# ============================================================================
# Main
# ============================================================================

# Verify Azure login
if (-not (Assert-AzLogin)) {
    exit 1
}

$results = @{}

if ($Component -eq 'Menu') {
    $choice = Show-Menu
    
    switch ($choice.ToUpper()) {
        '1' { $results['Function'] = Update-ProcessToSqlFunction }
        '2' { $results['UI'] = Update-DashboardUI }
        '3' { $results['API'] = Update-DashboardAPI }
        '4' { $results['SQL'] = Update-SqlSchema }
        '5' { 
            $results['Function'] = Update-ProcessToSqlFunction
            $results['API'] = Update-DashboardAPI
            $results['UI'] = Update-DashboardUI
            $results['SQL'] = Update-SqlSchema
        }
        'Q' { 
            Write-Host "Cancelled." -ForegroundColor Gray
            exit 0 
        }
        default {
            Write-Host "Invalid selection." -ForegroundColor Red
            exit 1
        }
    }
}
elseif ($Component -eq 'All') {
    $results['Function'] = Update-ProcessToSqlFunction
    $results['API'] = Update-DashboardAPI
    $results['UI'] = Update-DashboardUI
    $results['SQL'] = Update-SqlSchema
}
elseif ($Component -eq 'Function') {
    $results['Function'] = Update-ProcessToSqlFunction
}
elseif ($Component -eq 'UI') {
    $results['UI'] = Update-DashboardUI
}
elseif ($Component -eq 'API') {
    $results['API'] = Update-DashboardAPI
}
elseif ($Component -eq 'SQL') {
    $results['SQL'] = Update-SqlSchema
}

# Summary
if ($results.Count -gt 0) {
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host "  SUMMARY" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor Cyan
    foreach ($key in $results.Keys) {
        if ($results[$key]) {
            Write-Host "  [OK]   $key" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] $key" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# Exit with error if any failed
if ($results.Values -contains $false) {
    exit 1
}
