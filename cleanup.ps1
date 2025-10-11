#!/usr/bin/env pwsh
# ==============================================================================
# TTS Deployment Cleanup Script
# Removes all resources from failed or test deployments
# ==============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$false)]
    [switch]$DeleteAll,
    
    [Parameter(Mandatory=$false)]
    [switch]$OlderThanDays,
    
    [Parameter(Mandatory=$false)]
    [int]$Days = 7
)

$ErrorActionPreference = "Stop"

Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Red
Write-Host "║      TTS Deployment Cleanup Script                  ║" -ForegroundColor Red
Write-Host "╚══════════════════════════════════════════════════════╝`n" -ForegroundColor Red

if ($DeleteAll) {
    Write-Host "⚠️  WARNING: This will delete ALL TTS resource groups!" -ForegroundColor Yellow
    $confirm = Read-Host "Are you absolutely sure? Type 'DELETE ALL' to confirm"
    if ($confirm -ne "DELETE ALL") {
        Write-Host "Cancelled." -ForegroundColor Green
        exit 0
    }
    
    Write-Host "`nFinding all TTS resource groups..." -ForegroundColor Cyan
    $resourceGroups = Get-AzResourceGroup | Where-Object ResourceGroupName -like 'rg-tts-*'
    
    if ($resourceGroups.Count -eq 0) {
        Write-Host "No TTS resource groups found." -ForegroundColor Green
        exit 0
    }
    
    Write-Host "Found $($resourceGroups.Count) resource group(s):" -ForegroundColor Yellow
    $resourceGroups | ForEach-Object { Write-Host "  - $($_.ResourceGroupName)" -ForegroundColor Cyan }
    
    $confirm2 = Read-Host "`nProceed with deletion? (yes/no)"
    if ($confirm2 -ne "yes") {
        Write-Host "Cancelled." -ForegroundColor Green
        exit 0
    }
    
    foreach ($rg in $resourceGroups) {
        Write-Host "`nDeleting $($rg.ResourceGroupName)..." -ForegroundColor Red
        Remove-AzResourceGroup -Name $rg.ResourceGroupName -Force -AsJob | Out-Null
    }
    
    Write-Host "`nAll deletions started as background jobs." -ForegroundColor Green
    Write-Host "Monitor progress in Azure Portal." -ForegroundColor Cyan
}
elseif ($OlderThanDays) {
    $cutoffDate = (Get-Date).AddDays(-$Days)
    Write-Host "Finding TTS resource groups older than $Days days (before $($cutoffDate.ToString('yyyy-MM-dd')))..." -ForegroundColor Cyan
    
    $resourceGroups = Get-AzResourceGroup | Where-Object {
        $_.ResourceGroupName -like 'rg-tts-*' -and
        $_.Tags['CreatedTime'] -and
        [DateTime]::Parse($_.Tags['CreatedTime']) -lt $cutoffDate
    }
    
    if ($resourceGroups.Count -eq 0) {
        Write-Host "No old TTS resource groups found." -ForegroundColor Green
        exit 0
    }
    
    Write-Host "Found $($resourceGroups.Count) old resource group(s):" -ForegroundColor Yellow
    $resourceGroups | ForEach-Object { 
        Write-Host "  - $($_.ResourceGroupName) (Created: $($_.Tags['CreatedTime']))" -ForegroundColor Cyan 
    }
    
    $confirm = Read-Host "`nDelete these resource groups? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Cancelled." -ForegroundColor Green
        exit 0
    }
    
    foreach ($rg in $resourceGroups) {
        Write-Host "Deleting $($rg.ResourceGroupName)..." -ForegroundColor Red
        Remove-AzResourceGroup -Name $rg.ResourceGroupName -Force -AsJob | Out-Null
    }
    
    Write-Host "`nDeletions started as background jobs." -ForegroundColor Green
}
elseif ($ResourceGroupName) {
    if (-not (Get-AzResourceGroup -Name $ResourceGroupName -ErrorAction SilentlyContinue)) {
        Write-Host "Resource group '$ResourceGroupName' not found." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Resource Group: $ResourceGroupName" -ForegroundColor Cyan
    
    $resources = Get-AzResource -ResourceGroupName $ResourceGroupName
    Write-Host "`nResources to be deleted:" -ForegroundColor Yellow
    $resources | ForEach-Object { Write-Host "  - $($_.Name) ($($_.ResourceType))" -ForegroundColor Cyan }
    
    $confirm = Read-Host "`nDelete this resource group? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Cancelled." -ForegroundColor Green
        exit 0
    }
    
    Write-Host "`nDeleting $ResourceGroupName..." -ForegroundColor Red
    Remove-AzResourceGroup -Name $ResourceGroupName -Force
    
    Write-Host "Resource group deleted successfully." -ForegroundColor Green
}
else {
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  Delete specific resource group:" -ForegroundColor Cyan
    Write-Host "    .\cleanup.ps1 -ResourceGroupName rg-tts-202510101234" -ForegroundColor White
    Write-Host ""
    Write-Host "  Delete all TTS resource groups:" -ForegroundColor Cyan
    Write-Host "    .\cleanup.ps1 -DeleteAll" -ForegroundColor White
    Write-Host ""
    Write-Host "  Delete old TTS resource groups:" -ForegroundColor Cyan
    Write-Host "    .\cleanup.ps1 -OlderThanDays -Days 7" -ForegroundColor White
    Write-Host ""
    Write-Host "Available TTS resource groups:" -ForegroundColor Yellow
    Get-AzResourceGroup | Where-Object ResourceGroupName -like 'rg-tts-*' | ForEach-Object {
        Write-Host "  - $($_.ResourceGroupName) [$($_.Location)]" -ForegroundColor Cyan
    }
}
