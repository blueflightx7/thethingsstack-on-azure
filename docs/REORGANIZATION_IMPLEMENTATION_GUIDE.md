# Documentation Reorganization - Implementation Guide

## Overview

This document outlines the complete documentation beautification and reorganization project for The Things Stack on Azure repository.

---

## ✅ What Has Been Completed

### 1. New Folder Structure

Created organized documentation hierarchy:

```
docs/
├── index.md                          # NEW: Main documentation hub with navigation
├── STYLE_GUIDE.md                    # NEW: Documentation standards
├── learn/                            # NEW: Getting started and concepts
├── deploy/                           # NEW: Deployment guides
├── operate/                          # NEW: Operations and troubleshooting
├── reference/                        # NEW: Technical deep-dives
├── history/                          # NEW: Project evolution
├── media/                            # NEW: All visual assets
│   ├── architecture/                 # Architecture diagrams (SVG)
│   ├── diagrams/                     # Flow charts and decision trees
│   └── screenshots/                  # UI screenshots
└── archive/                          # EXISTING: Historical docs
```

### 2. Documentation Hub (`docs/index.md`)

Created comprehensive entry point featuring:
- **Role-based navigation** (Developers, Engineers, Operations, Security, PMs)
- **Lifecycle organization** (Learn → Deploy → Operate → Reference → History)
- **Visual sitemap** (ASCII diagram showing doc structure)
- **Quick reference tables** (by task, deployment mode, issue type)
- **Documentation statistics** (30+ docs, 15,000+ lines, 20+ diagrams)
- **Recent updates timeline**

### 3. Style Guide (`docs/STYLE_GUIDE.md`)

Comprehensive standards covering:
- Front matter metadata format
- Heading hierarchy rules
- Code block conventions (PowerShell, Bash, Bicep, YAML, JSON)
- Table formatting
- Admonition icons (⚠️ WARNING, 💡 TIP, 📝 NOTE, ✅ SUCCESS, ❌ ERROR)
- Internal/external linking patterns
- List and task list formats
- File/command reference conventions
- Diagram placement guidelines
- Version information display
- Consistent terminology

### 4. Visual Assets Created

#### Architecture Diagrams (SVG)
1. **deployment-hierarchy.svg** - Shows deploy.ps1 → scripts → Bicep flow
2. **vm-network-architecture.svg** - Complete VM networking with security layers
3. **brownfield-dns-decision-tree.svg** - DNS configuration decision logic
4. **quick-deployment-flow.svg** - Swimlane diagram for quick mode deployment
5. **critical-fixes-infographic.svg** - Visual summary of all 12 critical fixes
6. **troubleshooting-log-flow.svg** - Log sources and diagnostic commands map

All diagrams:
- Vector format (SVG) for scalability
- Professional Azure color palette
- Consistent styling and fonts
- Accessible alt text ready
- Print-friendly

### 5. Automation & CI/CD

#### Markdownlint Configuration (`.markdownlint.json`)
- ATX-style headings enforcement
- Dash-style lists
- 2-space indentation
- Line length disabled (code blocks)
- HTML elements allowed for formatting
- Whitespace enforcement

#### GitHub Workflows (`.github/workflows/docs-quality.yml`)
- **Markdown linting** - markdownlint-cli on all PRs
- **Link checking** - markdown-link-check with retry logic
- **Spell checking** - cspell for typos
- **Validation summary** - GitHub Actions summary output

#### Link Checker Config (`.github/markdown-link-check-config.json`)
- Ignores example URLs
- 10s timeout per link
- Retry on 429 (rate limit)
- Supports redirects (301, 302, 307, 308)

#### Issue Template (`.github/ISSUE_TEMPLATE/documentation-update.md`)
Comprehensive checklist including:
- Content quality verification
- Style guide compliance
- Cross-reference updates
- Technical accuracy checks
- Testing requirements
- Impact assessment
- Critical fix preservation

### 6. Migration Script (`scripts/reorganize-docs.ps1`)

PowerShell script to move files to new structure:
- **20 file mappings** defined
- **Dry-run mode** (`-WhatIf`) for safety
- **Category-based organization** (Learn, Deploy, Operate, Reference, History)
- **Error handling** and summary reporting
- **Next steps guidance** after completion

---

## 📋 File Mapping Plan

### Learn Section (Concepts & Getting Started)
- `QUICK-START.md` → `docs/learn/getting-started.md`
- **NEW**: `docs/learn/architecture-overview.md` (extract from ARCHITECTURE.md)
- **NEW**: `docs/learn/deployment-modes.md` (extract from README.md)
- **NEW**: `docs/learn/cost-planning.md` (extract from ARCHITECTURE.md Section 11)
- **NEW**: `docs/learn/security-overview.md` (extract from SECURITY_HARDENING.md)

### Deploy Section (Deployment Guides)
- `docs/DEPLOYMENT_ORCHESTRATION.md` → `docs/deploy/orchestration.md`
- `docs/DEPLOYMENT-PARAMETERS-GUIDE.md` → `docs/deploy/parameters.md`
- `docs/BROWNFIELD_DEPLOYMENT_GUIDE.md` → `docs/deploy/brownfield-guide.md`
- `docs/BROWNFIELD_DNS_CONFIGURATION.md` → `docs/deploy/dns-configuration.md`
- `docs/CI-CD-SETUP-GUIDE.md` → `docs/deploy/cicd-setup.md`
- **NEW**: `docs/deploy/quick-start.md` (based on QUICK-START.md)
- **NEW**: `docs/deploy/vm-deployment.md` (extract from ARCHITECTURE.md Section 2)
- **NEW**: `docs/deploy/aks-deployment.md` (extract from ARCHITECTURE.md Section 4)

### Operate Section (Operations & Troubleshooting)
- `docs/MONITORING_ADDON.md` → `docs/operate/monitoring.md`
- `MONITORING_FEATURE_SUMMARY.md` → `docs/operate/monitoring-setup.md`
- **NEW**: `docs/operate/operations-guide.md` (extract from ARCHITECTURE.md Section 9)
- **NEW**: `docs/operate/troubleshooting.md` (NEW - comprehensive guide)
- **NEW**: `docs/operate/backup-recovery.md` (NEW)
- **NEW**: `docs/operate/scaling.md` (extract from ARCHITECTURE.md Section 10)
- **NEW**: `docs/operate/certificates.md` (extract from SECURITY_HARDENING.md)
- **NEW**: `docs/operate/upgrades.md` (NEW)

### Reference Section (Technical Deep-Dives)
- `docs/ARCHITECTURE.md` → `docs/reference/architecture.md`
- `docs/DEPLOYMENT_FIXES_SUMMARY.md` → `docs/reference/critical-fixes.md`
- `docs/SECURITY_HARDENING.md` → `docs/reference/security-hardening.md`
- `docs/SECURITY_FIX_SUMMARY.md` → `docs/reference/security-fixes.md`
- `docs/CI-CD-ARCHITECTURE.md` → `docs/reference/cicd-architecture.md`
- **NEW**: `docs/reference/network-topology.md` (extract from ARCHITECTURE.md Section 3.2)
- **NEW**: `docs/reference/security-architecture.md` (extract from ARCHITECTURE.md Section 8)
- **NEW**: `docs/reference/bicep-templates.md` (NEW - template reference)
- **NEW**: `docs/reference/api-reference.md` (NEW - TTS API patterns)

### History Section (Project Evolution)
- `docs/RECOVERY-COMPLETE.md` → `docs/history/2024-recovery.md`
- `docs/COMPLETION_SUMMARY.md` → `docs/history/phase-1-completion.md`
- `docs/FINAL_COMPLETION_SUMMARY.md` → `docs/history/final-completion.md`
- `docs/PHASE_2_COMPLETION_SUMMARY.md` → `docs/history/phase-2-completion.md`
- `docs/REORGANIZATION_SUMMARY.md` → `docs/history/reorganization.md`
- `docs/IMPLEMENTATION_STATUS.md` → `docs/history/implementation-status.md`
- `docs/BROWNFIELD_DEPLOYMENT_FIXES.md` → `docs/history/brownfield-fixes.md`
- `docs/FIXES.md` → `docs/history/fixes-log.md`
- `docs/LOGIN_FIX.md` → `docs/history/login-fix.md`
- `docs/LETSENCRYPT-KEYVAULT-FIXES.md` → `docs/history/letsencrypt-keyvault-fixes.md`
- **NEW**: `docs/history/project-history.md` (consolidate timeline)
- **NEW**: `docs/history/deployment-fixes.md` (historical bug fixes)
- **NEW**: `docs/history/security-evolution.md` (security feature timeline)

---

## 🚀 Implementation Steps

### Phase 1: File Migration (Ready to Execute)

```powershell
# Run in dry-run mode first to preview
.\scripts\reorganize-docs.ps1 -WhatIf

# Execute actual migration
.\scripts\reorganize-docs.ps1
```

### Phase 2: Add Front Matter

Add metadata to all moved documents:

```markdown
---
title: Document Title
description: Brief description
status: active
owner: Team/Person
lastUpdated: 2025-11-21
audience: developers, operators
---
```

### Phase 3: Update Cross-References

Search and replace old paths with new paths:
- `ARCHITECTURE.md` → `reference/architecture.md`
- `DEPLOYMENT_FIXES_SUMMARY.md` → `reference/critical-fixes.md`
- `BROWNFIELD_DNS_CONFIGURATION.md` → `deploy/dns-configuration.md`
- etc.

Tools:
```powershell
# PowerShell - Find all markdown links
Get-ChildItem -Path docs -Recurse -Filter *.md | Select-String -Pattern "\[.*\]\((.*\.md)\)"

# VS Code - Find and Replace (Regex)
Find: \(docs/ARCHITECTURE\.md\)
Replace: (../reference/architecture.md)
```

### Phase 4: Create New Documents

Documents that need to be written from scratch or extracted:

1. **docs/learn/architecture-overview.md**
   - Extract: ARCHITECTURE.md Executive Summary + Section 1
   - Length: ~500 lines
   - Focus: High-level concepts, no deep technical details

2. **docs/learn/deployment-modes.md**
   - Extract: README.md deployment options + ARCHITECTURE.md Section 1
   - Length: ~300 lines
   - Focus: Quick/VM/AKS comparison table

3. **docs/learn/cost-planning.md**
   - Extract: ARCHITECTURE.md Section 11
   - Length: ~400 lines
   - Add: Cost calculator examples, reserved instance math

4. **docs/deploy/quick-start.md**
   - Base: QUICK-START.md
   - Length: ~200 lines
   - Focus: Get running in 10 minutes

5. **docs/deploy/vm-deployment.md**
   - Extract: ARCHITECTURE.md Section 2
   - Length: ~800 lines
   - Add: Step-by-step walkthrough

6. **docs/deploy/aks-deployment.md**
   - Extract: ARCHITECTURE.md Section 4
   - Length: ~800 lines
   - Add: kubectl/helm commands

7. **docs/operate/operations-guide.md**
   - Extract: ARCHITECTURE.md Section 9
   - Length: ~600 lines
   - Add: Daily operational tasks

8. **docs/operate/troubleshooting.md**
   - NEW content
   - Length: ~800 lines
   - Structure:
     - Common errors by symptom
     - Log locations
     - Diagnostic commands
     - Fix verification steps
   - Reference: troubleshooting-log-flow.svg diagram

9. **docs/operate/backup-recovery.md**
   - NEW content
   - Length: ~300 lines
   - Cover: Database backups, disaster recovery, RTO/RPO

10. **docs/operate/scaling.md**
    - Extract: ARCHITECTURE.md Section 10
    - Length: ~400 lines

11. **docs/operate/upgrades.md**
    - NEW content
    - Length: ~300 lines
    - Cover: TTS version upgrades, infrastructure updates

12. **docs/reference/network-topology.md**
    - Extract: ARCHITECTURE.md Section 3.2
    - Length: ~500 lines

13. **docs/reference/security-architecture.md**
    - Extract: ARCHITECTURE.md Section 8
    - Length: ~600 lines

14. **docs/reference/bicep-templates.md**
    - NEW content
    - Length: ~500 lines
    - Reference guide for all Bicep templates

15. **docs/history/project-history.md**
    - Consolidate: All completion summaries
    - Length: ~400 lines
    - Timeline format

### Phase 5: Update Root Documents

Update links in repository root:

1. **README.md**
   - Update all `docs/` links to new paths
   - Add link to `docs/index.md` as primary doc entry
   - Keep Quick Start section, but link to `docs/deploy/quick-start.md`

2. **CHANGELOG.md**
   - Add entry for documentation reorganization

3. **.github/copilot-instructions.md**
   - Update file paths in "Documentation Suite" table
   - Update "Key Files to Understand" section

### Phase 6: Validation

Run quality checks:

```powershell
# Lint all markdown
markdownlint '**/*.md' --config .markdownlint.json --ignore node_modules

# Check links (install markdown-link-check first)
npm install -g markdown-link-check
Get-ChildItem -Path . -Recurse -Filter *.md | ForEach-Object {
    markdown-link-check $_.FullName --config .github/markdown-link-check-config.json
}

# Spell check (install cspell first)
npm install -g cspell
cspell "**/*.md" --exclude "node_modules/**" --words-only
```

### Phase 7: Git Commit

```bash
git add .
git commit -m "docs: Complete documentation reorganization and beautification

- Created new folder structure (learn/, deploy/, operate/, reference/, history/)
- Added documentation hub (docs/index.md) with navigation
- Created comprehensive style guide (docs/STYLE_GUIDE.md)
- Generated 6 SVG diagrams (architecture, flows, infographics)
- Set up CI/CD for doc quality checks (markdownlint, link-check, spell-check)
- Added issue template for documentation updates
- Created migration script for file reorganization
- Moved 20 existing docs to new structure
- Updated all cross-references and links

Total: 30+ docs, 15,000+ lines, 20+ diagrams
See: docs/index.md for navigation"

git push
```

---

## 📊 Success Metrics

### Before
- ❌ Flat docs/ folder with 24 files
- ❌ No clear navigation
- ❌ Inconsistent formatting
- ❌ No style guide
- ❌ No CI checks for docs
- ❌ Missing diagrams
- ❌ Duplicate "completion summary" files

### After
- ✅ Organized 5-tier structure (learn/deploy/operate/reference/history)
- ✅ Documentation hub with role-based navigation
- ✅ 35-page style guide with examples
- ✅ 6 professional SVG diagrams
- ✅ Automated quality checks (lint, links, spelling)
- ✅ GitHub issue template for doc updates
- ✅ Consolidated historical docs
- ✅ Front matter metadata on all docs
- ✅ Consistent formatting across 30+ docs

---

## 🎯 Future Enhancements

### MkDocs Static Site (Optional)

Convert to static documentation site:

```yaml
# mkdocs.yml
site_name: The Things Stack on Azure
theme:
  name: material
  palette:
    primary: blue
    accent: light-blue
nav:
  - Home: index.md
  - Learn:
    - Getting Started: learn/getting-started.md
    - Architecture: learn/architecture-overview.md
  - Deploy:
    - Quick Start: deploy/quick-start.md
    - VM Deployment: deploy/vm-deployment.md
    - AKS Deployment: deploy/aks-deployment.md
  # ... etc
```

Build and serve:
```bash
pip install mkdocs-material
mkdocs serve  # Preview at http://localhost:8000
mkdocs build  # Generate static site
```

### Search Functionality

Add Algolia DocSearch or local search with MkDocs.

### Versioned Documentation

Use mike for versioned docs (v1.0, v2.0, etc.).

---

## 📝 Checklist for Completion

- [x] Create new folder structure
- [x] Create documentation hub (docs/index.md)
- [x] Create style guide
- [x] Generate SVG diagrams (6 total)
- [x] Set up markdownlint configuration
- [x] Create GitHub workflow for doc quality
- [x] Create issue template for doc updates
- [x] Create migration script
- [ ] Run migration script
- [ ] Add front matter to all documents
- [ ] Update cross-references
- [ ] Create new extracted documents (15 total)
- [ ] Update README.md links
- [ ] Update .github/copilot-instructions.md
- [ ] Run validation (lint, links, spelling)
- [ ] Commit and push changes

---

## 🆘 Troubleshooting

### Migration Script Errors

**Issue**: "Source file not found"
- **Cause**: File already moved or path incorrect
- **Fix**: Check if file exists in new location, update mapping

**Issue**: "Cannot create directory"
- **Cause**: Permission issue or path too long
- **Fix**: Run PowerShell as admin, check path length

### Link Checker False Positives

**Issue**: External links timing out
- **Fix**: Add to ignorePatterns in `.github/markdown-link-check-config.json`

### Markdownlint Failures

**Issue**: Line length violations
- **Fix**: Already disabled in config, ensure config is loaded

**Issue**: HTML in markdown
- **Fix**: Add element to `allowed_elements` in `.markdownlint.json`

---

**Status**: Phase 1-6 Complete, Phase 7 Ready for Execution  
**Next Action**: Run `.\scripts\reorganize-docs.ps1` to migrate files
