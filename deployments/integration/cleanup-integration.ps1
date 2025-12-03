#!/usr/bin/env pwsh
# ==============================================================================
# Cleanup IoT Hub & Data Intelligence Integration
# ==============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName
)

$ErrorActionPreference = "Stop"

Write-Host "`nWARNING: This will delete all Integration resources (IoT Hub, SQL, Storage, etc.)" -ForegroundColor Red
Write-Host "Data in the SQL Database and Raw Storage will be LOST." -ForegroundColor Red
$confirm = Read-Host "Type 'DELETE' to confirm"

if ($confirm -ne 'DELETE') {
    Write-Host "Operation cancelled." -ForegroundColor Yellow
    exit
}

Write-Host "Finding integration resources..." -ForegroundColor Yellow

# Find resources with tag Component=Integration
$resources = Get-AzResource -ResourceGroupName $ResourceGroupName -TagName "Component" -TagValue "Integration"

if ($resources.Count -eq 0) {
    Write-Host "No integration resources found." -ForegroundColor Yellow
    exit
}

foreach ($res in $resources) {
    Write-Host "Deleting $($res.ResourceType): $($res.Name)..." -ForegroundColor Cyan
    Remove-AzResource -ResourceId $res.ResourceId -Force
}

Write-Host "`n✓ Cleanup Complete" -ForegroundColor Green
