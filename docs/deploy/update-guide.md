# Component Update Guide

Quick reference for updating deployed Beehive Dashboard components without re-running full infrastructure deployment.

## Quick Start

```powershell
cd deployments
.\update.ps1
```

This shows an interactive menu to select which component to update.

## Components

| # | Component | Description | What Gets Updated |
|---|-----------|-------------|-------------------|
| 1 | **ProcessToSQL Function** | Message ingestion | Event Hub → SQL pipeline |
| 2 | **Dashboard UI** | Frontend | Next.js Static Web App |
| 3 | **Dashboard API** | Backend | .NET Function App |
| 4 | **SQL Schema** | Database | Tables, columns, indexes |
| 5 | **All** | Everything | All above components |

## Command Line Usage

```powershell
# Interactive menu
.\update.ps1

# Direct component updates (non-interactive)
.\update.ps1 -Component Function   # ProcessToSQL only
.\update.ps1 -Component UI         # Dashboard frontend only
.\update.ps1 -Component API        # Dashboard backend only
.\update.ps1 -Component SQL        # SQL schema only
.\update.ps1 -Component All        # Update everything
```

## Prerequisites

| Component | Requirements |
|-----------|--------------|
| All | Azure CLI logged in (`az login`) |
| Function | (none additional) |
| UI | Node.js 20+, npm |
| API | .NET 8 SDK |
| SQL | `sqlcmd` CLI or SqlServer PowerShell module |

### Installing Prerequisites

```powershell
# Node.js - download from https://nodejs.org/

# .NET 8 SDK - download from https://dotnet.microsoft.com/download

# SqlServer PowerShell module
Install-Module -Name SqlServer -AllowClobber -Scope CurrentUser
```

## Configuration

Default resource names are configured for `EXP-BEEHIVE-PROD-NY-RG`:

| Parameter | Default Value |
|-----------|---------------|
| ResourceGroupName | `EXP-BEEHIVE-PROD-NY-RG` |
| IntegrationFunctionAppName | `tts-int-func-tkrq6jjnphvvy` |
| DashboardApiFunctionAppName | `beehive-dash-api-tkrq6jjnphvvy` |
| StaticWebAppName | `beehive-nyc-dash-ivnh6kzlxappu` |
| SqlServerName | `tts-int-sql-tkrq6jjnphvvy` |
| SqlDatabaseName | `tts-data` |

### Using Different Resources

Override defaults with parameters:

```powershell
.\update.ps1 -Component Function `
    -ResourceGroupName "MY-RESOURCE-GROUP" `
    -IntegrationFunctionAppName "my-function-app"
```

For SQL updates with password:

```powershell
.\update.ps1 -Component SQL `
    -SqlPassword "YourPassword" `
    -SqlUsername "youradmin"
```

## When to Use What

| Scenario | Command |
|----------|---------|
| Changed ProcessToSQL code (run.csx) | `.\update.ps1 -Component Function` |
| Changed dashboard React/TypeScript | `.\update.ps1 -Component UI` |
| Changed dashboard API (.NET) | `.\update.ps1 -Component API` |
| Added new SQL columns/tables | `.\update.ps1 -Component SQL` |
| Multiple code changes | `.\update.ps1 -Component All` |
| **First-time deployment** | Use `.\deploy.ps1 -Mode integration` instead |
| **Infrastructure changes** | Use `.\deploy.ps1 -Mode integration` instead |

## What Each Update Does

### ProcessToSQL Function (`-Component Function`)

1. Runs `prepare-deps.ps1` to materialize NuGet DLLs
2. Creates ZIP package of `integration/function/*`
3. Deploys via `az functionapp deployment source config-zip`
4. Restarts Function App

**Safe for**: Code changes only. Does NOT modify app settings or connection strings.

### Dashboard UI (`-Component UI`)

1. Runs `npm ci` or `npm install`
2. Runs `npm run build` (Next.js static export)
3. Copies `staticwebapp.config.json` to output
4. Deploys via Azure SWA CLI

**Safe for**: Frontend changes only.

### Dashboard API (`-Component API`)

1. Runs `dotnet publish` on the API project
2. Creates ZIP package
3. Deploys via `az functionapp deployment source config-zip`

**Safe for**: API code changes only. Does NOT modify app settings.

### SQL Schema (`-Component SQL`)

1. Connects to Azure SQL
2. Executes `integration/sql/schema.sql`

**Safe for**: Schema uses `IF NOT EXISTS` patterns. Existing data is preserved.

## Monitoring After Update

### Function Logs

```powershell
# Stream live logs
az functionapp log tail -g EXP-BEEHIVE-PROD-NY-RG -n tts-int-func-tkrq6jjnphvvy

# View in Azure Portal
# Function App → Functions → ProcessToSQL → Monitor
```

### Dashboard

```powershell
# Get dashboard URL
az staticwebapp show -n beehive-nyc-dash-ivnh6kzlxappu -g EXP-BEEHIVE-PROD-NY-RG --query "defaultHostname" -o tsv
```

## Troubleshooting

### "Azure CLI not logged in"

```powershell
az login
```

### "Could not retrieve SWA deployment token"

Verify the Static Web App exists:

```powershell
az staticwebapp list -g EXP-BEEHIVE-PROD-NY-RG -o table
```

### "prepare-deps.ps1 failed"

Check .NET SDK is installed:

```powershell
dotnet --version  # Should be 8.x
```

### "Neither sqlcmd nor Invoke-Sqlcmd available"

Install SqlServer module:

```powershell
Install-Module -Name SqlServer -AllowClobber -Scope CurrentUser
```

Or install sqlcmd from [Microsoft SQL Tools](https://learn.microsoft.com/sql/tools/sqlcmd/sqlcmd-utility).

### Function deployment succeeded but code not running

1. Check function is enabled in Azure Portal
2. View Application Insights for errors
3. Restart the Function App:

```powershell
az functionapp restart -g EXP-BEEHIVE-PROD-NY-RG -n tts-int-func-tkrq6jjnphvvy
```

## See Also

- [Integration Deployment](integration-deployment.md) - Full infrastructure deployment
- [Dashboard Deployment](dashboard-deployment.md) - Dashboard infrastructure
- [Function App Reference](../reference/function-app-reference.md) - ProcessToSQL details
