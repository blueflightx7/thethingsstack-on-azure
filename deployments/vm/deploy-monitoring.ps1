#!/usr/bin/env pwsh
# ==============================================================================
# TTS Monitoring Add-On Deployment Script
# Adds Log Analytics, Application Insights, and Security Monitoring
# to an existing TTS deployment
# ==============================================================================

param(
    [string]$ResourceGroupName = "",
    [string]$Location = "",
    [string]$EnvironmentName = "tts-prod",
    [string]$LogAnalyticsWorkspaceName = "",
    [string]$AppInsightsName = "",
    [bool]$UseExistingLogAnalytics = $false,
    [bool]$UseExistingAppInsights = $false
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "  TTS Monitoring Add-On Deployment" -ForegroundColor Cyan
Write-Host "  Add monitoring to existing TTS deployment" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# ============================================================================
# STEP 1: SELECT RESOURCE GROUP
# ============================================================================

Write-Host "STEP 1: Resource Group Selection`n" -ForegroundColor Yellow

if ([string]::IsNullOrEmpty($ResourceGroupName)) {
    Write-Host "Resource Group Options:" -ForegroundColor Cyan
    Write-Host "  1. Enter resource group name manually" -ForegroundColor White
    Write-Host "  2. Select from existing resource groups`n" -ForegroundColor White
    
    $rgOption = Read-Host "Select option (1-2, default: 2)"
    
    switch ($rgOption) {
        "1" {
            $ResourceGroupName = Read-Host "Enter resource group name"
            $existingRG = Get-AzResourceGroup -Name $ResourceGroupName -ErrorAction SilentlyContinue
            
            if (-not $existingRG) {
                Write-Error "Resource group '$ResourceGroupName' not found"
                exit 1
            }
            
            $Location = $existingRG.Location
            Write-Host "✓ Using resource group: $ResourceGroupName" -ForegroundColor Green
            Write-Host "  Location: $Location" -ForegroundColor Gray
        }
        default {
            # List and select
            Write-Host "`nFetching available resource groups..." -ForegroundColor Cyan
            $existingRGs = Get-AzResourceGroup | Select-Object ResourceGroupName, Location
            
            if ($existingRGs.Count -eq 0) {
                Write-Error "No resource groups found"
                exit 1
            }
            
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
} else {
    # Validate provided resource group
    $existingRG = Get-AzResourceGroup -Name $ResourceGroupName -ErrorAction SilentlyContinue
    if (-not $existingRG) {
        Write-Error "Resource group '$ResourceGroupName' not found"
        exit 1
    }
    $Location = $existingRG.Location
    Write-Host "Using resource group: $ResourceGroupName" -ForegroundColor Green
    Write-Host "  Location: $Location" -ForegroundColor Gray
}

# ============================================================================
# STEP 2: LOG ANALYTICS WORKSPACE CONFIGURATION
# ============================================================================

Write-Host "`nSTEP 2: Log Analytics Workspace Configuration`n" -ForegroundColor Yellow

Write-Host "Log Analytics Options:" -ForegroundColor Cyan
Write-Host "  1. Create new Log Analytics Workspace" -ForegroundColor White
Write-Host "  2. Use existing Log Analytics Workspace in this resource group" -ForegroundColor White
Write-Host "  3. Use existing Log Analytics Workspace from another resource group`n" -ForegroundColor White

$lawOption = Read-Host "Select option (1-3, default: 1)"

switch ($lawOption) {
    "2" {
        # List workspaces in current RG
        Write-Host "`nFetching Log Analytics Workspaces in $ResourceGroupName..." -ForegroundColor Cyan
        $existingWorkspaces = Get-AzOperationalInsightsWorkspace -ResourceGroupName $ResourceGroupName -ErrorAction SilentlyContinue
        
        if ($existingWorkspaces.Count -eq 0) {
            Write-Host "No workspaces found in this resource group. Creating new..." -ForegroundColor Yellow
            $UseExistingLogAnalytics = $false
        } else {
            Write-Host "`nAvailable Workspaces:" -ForegroundColor Cyan
            for ($i = 0; $i -lt $existingWorkspaces.Count; $i++) {
                Write-Host "  $($i + 1). $($existingWorkspaces[$i].Name) - SKU: $($existingWorkspaces[$i].Sku)" -ForegroundColor White
            }
            
            $lawChoice = Read-Host "`nSelect workspace (1-$($existingWorkspaces.Count)), or 0 to create new"
            
            if ($lawChoice -eq "0") {
                $UseExistingLogAnalytics = $false
            } elseif ($lawChoice -and $lawChoice -match '^\d+$' -and [int]$lawChoice -le $existingWorkspaces.Count -and [int]$lawChoice -gt 0) {
                $LogAnalyticsWorkspaceName = $existingWorkspaces[[int]$lawChoice - 1].Name
                $UseExistingLogAnalytics = $true
                Write-Host "✓ Using existing workspace: $LogAnalyticsWorkspaceName" -ForegroundColor Green
            }
        }
    }
    "3" {
        # Search all workspaces
        Write-Host "`nSearching all Log Analytics Workspaces in subscription..." -ForegroundColor Cyan
        $allWorkspaces = Get-AzOperationalInsightsWorkspace
        
        if ($allWorkspaces.Count -eq 0) {
            Write-Host "No workspaces found in subscription. Creating new..." -ForegroundColor Yellow
            $UseExistingLogAnalytics = $false
        } else {
            Write-Host "`nFound $($allWorkspaces.Count) workspace(s):" -ForegroundColor Cyan
            for ($i = 0; $i -lt $allWorkspaces.Count; $i++) {
                Write-Host "  $($i + 1). $($allWorkspaces[$i].Name) - RG: $($allWorkspaces[$i].ResourceGroupName) - SKU: $($allWorkspaces[$i].Sku)" -ForegroundColor White
            }
            
            $lawChoice = Read-Host "`nSelect workspace (1-$($allWorkspaces.Count)), or 0 to create new"
            
            if ($lawChoice -eq "0") {
                $UseExistingLogAnalytics = $false
            } elseif ($lawChoice -and $lawChoice -match '^\d+$' -and [int]$lawChoice -le $allWorkspaces.Count -and [int]$lawChoice -gt 0) {
                $selectedWorkspace = $allWorkspaces[[int]$lawChoice - 1]
                $LogAnalyticsWorkspaceName = $selectedWorkspace.Name
                $logAnalyticsResourceGroup = $selectedWorkspace.ResourceGroupName
                $UseExistingLogAnalytics = $true
                Write-Host "✓ Using existing workspace: $LogAnalyticsWorkspaceName" -ForegroundColor Green
                Write-Host "  Resource Group: $logAnalyticsResourceGroup" -ForegroundColor Gray
            }
        }
    }
    default {
        # Create new
        $UseExistingLogAnalytics = $false
    }
}

if (-not $UseExistingLogAnalytics) {
    if ([string]::IsNullOrEmpty($LogAnalyticsWorkspaceName)) {
        $LogAnalyticsWorkspaceName = "$EnvironmentName-logs-$(Get-Date -Format 'yyyyMMddHHmm')"
    }
    Write-Host "✓ New workspace will be created: $LogAnalyticsWorkspaceName" -ForegroundColor Green
}

# ============================================================================
# STEP 3: APPLICATION INSIGHTS CONFIGURATION
# ============================================================================

Write-Host "`nSTEP 3: Application Insights Configuration`n" -ForegroundColor Yellow

Write-Host "Application Insights Options:" -ForegroundColor Cyan
Write-Host "  1. Create new Application Insights (recommended)" -ForegroundColor White
Write-Host "  2. Use existing Application Insights in this resource group" -ForegroundColor White
Write-Host "  3. Use existing Application Insights from another resource group`n" -ForegroundColor White

$aiOption = Read-Host "Select option (1-3, default: 1)"

switch ($aiOption) {
    "2" {
        # List App Insights in current RG
        Write-Host "`nFetching Application Insights in $ResourceGroupName..." -ForegroundColor Cyan
        $existingAppInsights = Get-AzApplicationInsights -ResourceGroupName $ResourceGroupName -ErrorAction SilentlyContinue
        
        if ($existingAppInsights.Count -eq 0) {
            Write-Host "No Application Insights found in this resource group. Creating new..." -ForegroundColor Yellow
            $UseExistingAppInsights = $false
        } else {
            Write-Host "`nAvailable Application Insights:" -ForegroundColor Cyan
            for ($i = 0; $i -lt $existingAppInsights.Count; $i++) {
                Write-Host "  $($i + 1). $($existingAppInsights[$i].Name) - Type: $($existingAppInsights[$i].Kind)" -ForegroundColor White
            }
            
            $aiChoice = Read-Host "`nSelect Application Insights (1-$($existingAppInsights.Count)), or 0 to create new"
            
            if ($aiChoice -eq "0") {
                $UseExistingAppInsights = $false
            } elseif ($aiChoice -and $aiChoice -match '^\d+$' -and [int]$aiChoice -le $existingAppInsights.Count -and [int]$aiChoice -gt 0) {
                $AppInsightsName = $existingAppInsights[[int]$aiChoice - 1].Name
                $UseExistingAppInsights = $true
                Write-Host "✓ Using existing Application Insights: $AppInsightsName" -ForegroundColor Green
            }
        }
    }
    "3" {
        # Search all App Insights
        Write-Host "`nSearching all Application Insights in subscription..." -ForegroundColor Cyan
        $allAppInsights = Get-AzResource -ResourceType "Microsoft.Insights/components"
        
        if ($allAppInsights.Count -eq 0) {
            Write-Host "No Application Insights found in subscription. Creating new..." -ForegroundColor Yellow
            $UseExistingAppInsights = $false
        } else {
            Write-Host "`nFound $($allAppInsights.Count) Application Insights:" -ForegroundColor Cyan
            for ($i = 0; $i -lt $allAppInsights.Count; $i++) {
                Write-Host "  $($i + 1). $($allAppInsights[$i].Name) - RG: $($allAppInsights[$i].ResourceGroupName)" -ForegroundColor White
            }
            
            $aiChoice = Read-Host "`nSelect Application Insights (1-$($allAppInsights.Count)), or 0 to create new"
            
            if ($aiChoice -eq "0") {
                $UseExistingAppInsights = $false
            } elseif ($aiChoice -and $aiChoice -match '^\d+$' -and [int]$aiChoice -le $allAppInsights.Count -and [int]$aiChoice -gt 0) {
                $selectedAppInsights = $allAppInsights[[int]$aiChoice - 1]
                $AppInsightsName = $selectedAppInsights.Name
                $appInsightsResourceGroup = $selectedAppInsights.ResourceGroupName
                $UseExistingAppInsights = $true
                Write-Host "✓ Using existing Application Insights: $AppInsightsName" -ForegroundColor Green
                Write-Host "  Resource Group: $appInsightsResourceGroup" -ForegroundColor Gray
            }
        }
    }
    default {
        # Create new
        $UseExistingAppInsights = $false
    }
}

if (-not $UseExistingAppInsights) {
    if ([string]::IsNullOrEmpty($AppInsightsName)) {
        $AppInsightsName = "$EnvironmentName-appinsights"
    }
    Write-Host "✓ New Application Insights will be created: $AppInsightsName" -ForegroundColor Green
}

# ============================================================================
# STEP 4: DEPLOY MONITORING TEMPLATE
# ============================================================================

Write-Host "`nSTEP 4: Deploying Monitoring Infrastructure`n" -ForegroundColor Yellow

Write-Host "Deployment Summary:" -ForegroundColor Cyan
Write-Host "  Resource Group: $ResourceGroupName" -ForegroundColor White
Write-Host "  Location: $Location" -ForegroundColor White
Write-Host "  Log Analytics: $LogAnalyticsWorkspaceName $(if ($UseExistingLogAnalytics) { '(existing)' } else { '(new)' })" -ForegroundColor White
Write-Host "  App Insights: $AppInsightsName $(if ($UseExistingAppInsights) { '(existing)' } else { '(new)' })" -ForegroundColor White

$confirm = Read-Host "`nProceed with deployment? (Y/n)"
if ($confirm -eq 'n' -or $confirm -eq 'N') {
    Write-Host "Deployment cancelled" -ForegroundColor Yellow
    exit 0
}

# Create Bicep template for monitoring add-on
$monitoringTemplate = @"
@description('The deployment region')
param location string = resourceGroup().location

@description('Environment name for resource naming')
param environmentName string = 'tts-prod'

@description('Use existing Log Analytics Workspace')
param useExistingLogAnalytics bool = false

@description('Name of Log Analytics Workspace')
param logAnalyticsWorkspaceName string

@description('Resource group of existing Log Analytics (if different)')
param logAnalyticsResourceGroup string = resourceGroup().name

@description('Use existing Application Insights')
param useExistingAppInsights bool = false

@description('Name of Application Insights')
param appInsightsName string

@description('Resource group of existing App Insights (if different)')
param appInsightsResourceGroup string = resourceGroup().name

// ============================================================================
// LOG ANALYTICS WORKSPACE
// ============================================================================

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = if (!useExistingLogAnalytics) {
  name: logAnalyticsWorkspaceName
  location: location
  tags: {
    'azd-env-name': environmentName
  }
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

resource existingLogAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = if (useExistingLogAnalytics) {
  name: logAnalyticsWorkspaceName
  scope: resourceGroup(logAnalyticsResourceGroup)
}

// ============================================================================
// APPLICATION INSIGHTS
// ============================================================================

resource appInsights 'Microsoft.Insights/components@2020-02-02' = if (!useExistingAppInsights) {
  name: appInsightsName
  location: location
  tags: {
    'azd-env-name': environmentName
  }
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: useExistingLogAnalytics ? existingLogAnalytics.id : logAnalytics.id
  }
}

resource existingAppInsights 'Microsoft.Insights/components@2020-02-02' existing = if (useExistingAppInsights) {
  name: appInsightsName
  scope: resourceGroup(appInsightsResourceGroup)
}

// ============================================================================
// SECURITY ALERT
// ============================================================================

resource securityAlert 'Microsoft.Insights/activityLogAlerts@2020-10-01' = {
  name: '$${environmentName}-security-alert'
  location: 'Global'
  tags: {
    'azd-env-name': environmentName
  }
  properties: {
    scopes: [
      resourceGroup().id
    ]
    condition: {
      allOf: [
        {
          field: 'category'
          equals: 'Security'
        }
        {
          field: 'level'
          equals: 'Error'
        }
      ]
    }
    actions: {
      actionGroups: []
    }
    enabled: true
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

output logAnalyticsWorkspaceId string = useExistingLogAnalytics ? existingLogAnalytics.id : logAnalytics.id
output logAnalyticsWorkspaceName string = useExistingLogAnalytics ? existingLogAnalytics.name : logAnalytics.name
output applicationInsightsId string = useExistingAppInsights ? existingAppInsights.id : appInsights.id
output applicationInsightsName string = useExistingAppInsights ? existingAppInsights.name : appInsights.name
output applicationInsightsInstrumentationKey string = useExistingAppInsights ? existingAppInsights.properties.InstrumentationKey : appInsights.properties.InstrumentationKey
output applicationInsightsConnectionString string = useExistingAppInsights ? existingAppInsights.properties.ConnectionString : appInsights.properties.ConnectionString
output securityAlertName string = securityAlert.name
"@

# Save template to temp file
$tempTemplateFile = [System.IO.Path]::GetTempFileName() + ".bicep"
$monitoringTemplate | Out-File -FilePath $tempTemplateFile -Encoding utf8

try {
    Write-Host "Deploying monitoring infrastructure..." -ForegroundColor Cyan
    
    $deploymentParams = @{
        ResourceGroupName = $ResourceGroupName
        TemplateFile = $tempTemplateFile
        location = $Location
        environmentName = $EnvironmentName
        useExistingLogAnalytics = $UseExistingLogAnalytics
        logAnalyticsWorkspaceName = $LogAnalyticsWorkspaceName
        useExistingAppInsights = $UseExistingAppInsights
        appInsightsName = $AppInsightsName
        Verbose = $true
    }
    
    if ($UseExistingLogAnalytics -and $logAnalyticsResourceGroup) {
        $deploymentParams.logAnalyticsResourceGroup = $logAnalyticsResourceGroup
    }
    
    if ($UseExistingAppInsights -and $appInsightsResourceGroup) {
        $deploymentParams.appInsightsResourceGroup = $appInsightsResourceGroup
    }
    
    $deployment = New-AzResourceGroupDeployment @deploymentParams
    
    Write-Host "`n╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║         Monitoring Deployment Complete!                 ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════╝`n" -ForegroundColor Green
    
    Write-Host "Monitoring Resources:" -ForegroundColor Cyan
    Write-Host "  Log Analytics Workspace: $($deployment.Outputs.logAnalyticsWorkspaceName.Value)" -ForegroundColor White
    Write-Host "  Workspace ID: $($deployment.Outputs.logAnalyticsWorkspaceId.Value)" -ForegroundColor Gray
    Write-Host "`n  Application Insights: $($deployment.Outputs.applicationInsightsName.Value)" -ForegroundColor White
    Write-Host "  Instrumentation Key: $($deployment.Outputs.applicationInsightsInstrumentationKey.Value)" -ForegroundColor Gray
    Write-Host "  Connection String: $($deployment.Outputs.applicationInsightsConnectionString.Value)" -ForegroundColor Gray
    Write-Host "`n  Security Alert: $($deployment.Outputs.securityAlertName.Value)" -ForegroundColor White
    
    Write-Host "`nNext Steps:" -ForegroundColor Yellow
    Write-Host "  1. Update your TTS application to use the Application Insights connection string" -ForegroundColor White
    Write-Host "  2. Configure VM diagnostic settings to send logs to Log Analytics" -ForegroundColor White
    Write-Host "  3. Set up custom alerts in the Azure Portal" -ForegroundColor White
    Write-Host "`n" -ForegroundColor White
}
catch {
    Write-Host "`n✗ Monitoring deployment failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
finally {
    # Clean up temp file
    if (Test-Path $tempTemplateFile) {
        Remove-Item $tempTemplateFile -Force
    }
}
