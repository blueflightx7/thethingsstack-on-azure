# Documentation Reorganization Script
# This script moves documentation files to their new organized structure

param(
    [switch]$WhatIf = $false
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Documentation Reorganization" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($WhatIf) {
    Write-Host "⚠️  DRY RUN MODE - No files will be moved" -ForegroundColor Yellow
    Write-Host ""
}

# Define file mappings: Source -> Destination
$fileMappings = @(
    # Learn section (concepts and getting started)
    @{
        Source = "QUICK-START.md"
        Dest = "docs/learn/getting-started.md"
        Category = "Learn"
    },
    
    # Deploy section (deployment guides)
    @{
        Source = "docs/DEPLOYMENT_ORCHESTRATION.md"
        Dest = "docs/deploy/orchestration.md"
        Category = "Deploy"
    },
    @{
        Source = "docs/DEPLOYMENT-PARAMETERS-GUIDE.md"
        Dest = "docs/deploy/parameters.md"
        Category = "Deploy"
    },
    @{
        Source = "docs/BROWNFIELD_DEPLOYMENT_GUIDE.md"
        Dest = "docs/deploy/brownfield-guide.md"
        Category = "Deploy"
    },
    @{
        Source = "docs/BROWNFIELD_DNS_CONFIGURATION.md"
        Dest = "docs/deploy/dns-configuration.md"
        Category = "Deploy"
    },
    @{
        Source = "docs/CI-CD-SETUP-GUIDE.md"
        Dest = "docs/deploy/cicd-setup.md"
        Category = "Deploy"
    },
    
    # Operate section (operations and troubleshooting)
    @{
        Source = "docs/MONITORING_ADDON.md"
        Dest = "docs/operate/monitoring.md"
        Category = "Operate"
    },
    @{
        Source = "MONITORING_FEATURE_SUMMARY.md"
        Dest = "docs/operate/monitoring-setup.md"
        Category = "Operate"
    },
    
    # Reference section (technical deep-dives)
    @{
        Source = "docs/ARCHITECTURE.md"
        Dest = "docs/reference/architecture.md"
        Category = "Reference"
    },
    @{
        Source = "docs/DEPLOYMENT_FIXES_SUMMARY.md"
        Dest = "docs/reference/critical-fixes.md"
        Category = "Reference"
    },
    @{
        Source = "docs/SECURITY_HARDENING.md"
        Dest = "docs/reference/security-hardening.md"
        Category = "Reference"
    },
    @{
        Source = "docs/SECURITY_FIX_SUMMARY.md"
        Dest = "docs/reference/security-fixes.md"
        Category = "Reference"
    },
    @{
        Source = "docs/CI-CD-ARCHITECTURE.md"
        Dest = "docs/reference/cicd-architecture.md"
        Category = "Reference"
    },
    
    # History section (project evolution)
    @{
        Source = "docs/RECOVERY-COMPLETE.md"
        Dest = "docs/history/2024-recovery.md"
        Category = "History"
    },
    @{
        Source = "docs/COMPLETION_SUMMARY.md"
        Dest = "docs/history/phase-1-completion.md"
        Category = "History"
    },
    @{
        Source = "docs/FINAL_COMPLETION_SUMMARY.md"
        Dest = "docs/history/final-completion.md"
        Category = "History"
    },
    @{
        Source = "docs/PHASE_2_COMPLETION_SUMMARY.md"
        Dest = "docs/history/phase-2-completion.md"
        Category = "History"
    },
    @{
        Source = "docs/REORGANIZATION_SUMMARY.md"
        Dest = "docs/history/reorganization.md"
        Category = "History"
    },
    @{
        Source = "docs/IMPLEMENTATION_STATUS.md"
        Dest = "docs/history/implementation-status.md"
        Category = "History"
    },
    @{
        Source = "docs/BROWNFIELD_DEPLOYMENT_FIXES.md"
        Dest = "docs/history/brownfield-fixes.md"
        Category = "History"
    },
    @{
        Source = "docs/FIXES.md"
        Dest = "docs/history/fixes-log.md"
        Category = "History"
    },
    @{
        Source = "docs/LOGIN_FIX.md"
        Dest = "docs/history/login-fix.md"
        Category = "History"
    },
    @{
        Source = "docs/LETSENCRYPT-KEYVAULT-FIXES.md"
        Dest = "docs/history/letsencrypt-keyvault-fixes.md"
        Category = "History"
    }
)

# Summary counters
$moved = 0
$skipped = 0
$errors = 0

# Get repository root (parent of scripts folder)
$repoRoot = Split-Path $PSScriptRoot -Parent

Write-Host "Planned file movements:" -ForegroundColor Cyan
Write-Host ""

foreach ($mapping in $fileMappings) {
    $sourcePath = Join-Path $repoRoot $mapping.Source
    $destPath = Join-Path $repoRoot $mapping.Dest
    
    Write-Host "[$($mapping.Category)]" -ForegroundColor DarkCyan -NoNewline
    Write-Host " $($mapping.Source) " -NoNewline
    Write-Host "→" -ForegroundColor Yellow -NoNewline
    Write-Host " $($mapping.Dest)"
    
    if (-not (Test-Path $sourcePath)) {
        Write-Host "  ⚠️  Source file not found" -ForegroundColor Yellow
        $skipped++
        continue
    }
    
    if (-not $WhatIf) {
        try {
            # Ensure destination directory exists
            $destDir = Split-Path $destPath -Parent
            if (-not (Test-Path $destDir)) {
                New-Item -Path $destDir -ItemType Directory -Force | Out-Null
            }
            
            # Move file
            Move-Item -Path $sourcePath -Destination $destPath -Force
            Write-Host "  ✅ Moved successfully" -ForegroundColor Green
            $moved++
        }
        catch {
            Write-Host "  ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
            $errors++
        }
    }
    else {
        Write-Host "  [DRY RUN] Would move" -ForegroundColor Gray
        $moved++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($WhatIf) {
    Write-Host "Files to be moved: $moved" -ForegroundColor Yellow
    Write-Host "Files to be skipped: $skipped" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run without -WhatIf to perform actual moves" -ForegroundColor Cyan
}
else {
    Write-Host "✅ Files moved: $moved" -ForegroundColor Green
    Write-Host "⚠️  Files skipped: $skipped" -ForegroundColor Yellow
    Write-Host "❌ Errors: $errors" -ForegroundColor Red
    
    if ($errors -eq 0 -and $moved -gt 0) {
        Write-Host ""
        Write-Host "🎉 Documentation reorganization completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Review moved files in new locations" -ForegroundColor White
        Write-Host "2. Update internal links to reflect new paths" -ForegroundColor White
        Write-Host "3. Add front matter metadata to documents" -ForegroundColor White
        Write-Host "4. Run: markdownlint '**/*.md' --config .markdownlint.json" -ForegroundColor White
        Write-Host "5. Commit changes to git" -ForegroundColor White
    }
}

Write-Host ""
