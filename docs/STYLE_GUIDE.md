# Documentation Style Guide

## Overview

This guide ensures consistency across all documentation in The Things Stack on Azure project.

---

## Front Matter

All documentation files should start with metadata:

```markdown
---
title: Document Title
description: Brief description of the document content
status: active|deprecated|draft
owner: Team/Person responsible
lastUpdated: YYYY-MM-DD
audience: developers|operators|architects|all
---
```

**Example**:
```markdown
---
title: VM Deployment Guide
description: Complete guide for deploying The Things Stack on Azure VMs
status: active
owner: Infrastructure Team
lastUpdated: 2025-11-21
audience: developers, operators
---
```

---

## Document Structure

### Heading Hierarchy

Use ATX-style headings (`#`) with proper nesting:

```markdown
# Document Title (H1 - once per document)

## Major Section (H2)

### Subsection (H3)

#### Detail Section (H4)
```

**Rules**:
- One H1 per document (document title)
- Don't skip levels (H2 → H4)
- Use sentence case for headings
- Add blank line before and after headings

---

## Code Blocks

### Syntax

Use fenced code blocks with language identifier:

````markdown
```powershell
# PowerShell example
.\deploy.ps1 -Mode quick
```

```bash
# Bash example
./deploy.sh --mode quick
```

```bicep
// Bicep example
resource vm 'Microsoft.Compute/virtualMachines@2023-03-01' = {
  name: vmName
  location: location
}
```
````

### Language Identifiers

| Language | Use |
|----------|-----|
| `powershell` | PowerShell scripts and commands |
| `bash` | Bash/shell scripts |
| `bicep` | Azure Bicep templates |
| `yaml` | YAML configuration files |
| `json` | JSON data and configuration |
| `text` | Plain text output |
| `console` | Terminal output without specific language |

### Commands with Output

Show command and expected output:

```markdown
```powershell
# Command
Get-AzResourceGroup -Name "rg-tts-prod"

# Output
ResourceGroupName : rg-tts-prod
Location          : centralus
ProvisioningState : Succeeded
```
```

---

## Tables

### Parameter Tables

Use tables for parameters, options, and comparisons:

```markdown
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `location` | string | `centralus` | Azure region for deployment |
| `vmSize` | string | `Standard_B4ms` | VM size SKU |
| `enableKeyVault` | bool | `true` | Enable Key Vault integration |
```

**Rules**:
- Header row with separator
- Left-align text columns
- Wrap code/parameters in backticks
- Keep columns reasonably sized

---

## Admonitions

Use admonitions to highlight important information:

```markdown
> **⚠️ WARNING**  
> This operation will delete all resources and cannot be undone.

> **💡 TIP**  
> Use reserved instances to save 40-60% on compute costs.

> **📝 NOTE**  
> Database passwords must be alphanumeric only (no special characters).

> **✅ SUCCESS**  
> Deployment completed successfully! Access console at https://example.com

> **❌ ERROR**  
> Common error: KeyError "getpwnam(): name not found"
```

### Admonition Icons

| Icon | Type | Use |
|------|------|-----|
| ⚠️ | Warning | Destructive operations, breaking changes |
| 💡 | Tip | Helpful suggestions, best practices |
| 📝 | Note | Additional context, clarifications |
| ✅ | Success | Successful outcomes, confirmations |
| ❌ | Error | Error messages, failure scenarios |
| 🔒 | Security | Security-related information |
| 🚀 | Performance | Performance optimization tips |
| 💰 | Cost | Cost-related information |

---

## Links

### Internal Links

Link to other documentation using relative paths:

```markdown
See [VM Deployment Guide](vm-deployment.md) for details.
Reference [Architecture Overview](../learn/architecture-overview.md).
```

### External Links

External links with descriptive text:

```markdown
Install [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli).
Review [The Things Stack Documentation](https://www.thethingsindustries.com/docs/).
```

### Anchor Links

Link to sections within document:

```markdown
Jump to [Security Features](#security-features).
```

---

## Lists

### Unordered Lists

Use `-` for bullets:

```markdown
- First item
- Second item
  - Nested item (2 spaces)
  - Another nested item
- Third item
```

### Ordered Lists

Use `1.` for numbered lists (auto-numbered):

```markdown
1. First step
2. Second step
   1. Sub-step (3 spaces)
   2. Another sub-step
3. Third step
```

### Task Lists

For checklists:

```markdown
- [x] Completed task
- [ ] Pending task
- [ ] Another pending task
```

---

## File and Command References

### Files

Wrap file names and paths in backticks:

```markdown
The deployment script is `deploy.ps1`.
Modify `deployments/vm/tts-docker-deployment.bicep`.
Configuration stored in `/home/ttsadmin/docker-compose.yml`.
```

### Commands

Inline commands:

```markdown
Run `Connect-AzAccount` to authenticate.
Check status with `docker ps -a`.
```

### Variables and Parameters

```markdown
Set the `$resourceGroup` variable.
Use the `--location` parameter.
The `adminEmail` must be a valid email address.
```

---

## Images and Diagrams

### Placement

Store all images in `docs/media/`:

```
docs/media/
├── architecture/     # Architecture diagrams
├── diagrams/        # Flow charts, sequence diagrams
└── screenshots/     # UI screenshots
```

### Embedding

```markdown
![Deployment Architecture](media/architecture/vm-deployment.svg)

<div align="center">
  <img src="media/diagrams/deployment-flow.svg" alt="Deployment Flow" width="800">
</div>
```

### Alt Text

Always provide descriptive alt text for accessibility.

---

## Diagrams

### ASCII Diagrams

Use for simple hierarchies and flows:

```markdown
```text
deploy.ps1 (Primary Orchestrator)
│
├── Mode: quick ──► deploy-simple.ps1 ──► tts-docker-deployment.bicep
├── Mode: aks ────► deploy-aks.ps1 ──► tts-aks-deployment.bicep
└── Mode: vm ─────► Advanced VM deployment
```
```

### SVG Diagrams

Preferred format for architecture and flow diagrams:

- Create with tools like draw.io, Lucidchart, or Mermaid
- Export as SVG for scalability
- Store in `docs/media/architecture/` or `docs/media/diagrams/`

---

## Examples Section

Provide working examples:

```markdown
## Examples

### Basic Deployment

```powershell
# Deploy to Central US with monitoring
.\deploy.ps1 -Mode quick -Location centralus -AdminEmail admin@example.com
```

### Advanced Configuration

```powershell
# Custom VM size with Key Vault
.\deploy.ps1 `
  -Mode vm `
  -Location eastus `
  -VMSize Standard_D4s_v3 `
  -EnableKeyVault $true `
  -AdminEmail admin@example.com
```
```

---

## Version Information

Include version info for time-sensitive content:

```markdown
> **Version**: TTS 3.30.2  
> **Last Updated**: 2025-11-21  
> **Azure API Version**: 2023-03-01
```

---

## Cross-References

### Related Documentation

End sections with related links:

```markdown
## See Also

- [Deployment Parameters](parameters.md) - Complete parameter reference
- [Troubleshooting](../operate/troubleshooting.md) - Common issues
- [Architecture](../reference/architecture.md) - Technical deep-dive
```

---

## Terminal Prompts

### PowerShell Prompts

```markdown
```powershell
PS C:\> Get-AzResourceGroup

PS C:\thethingsstack-on-azure> .\deploy.ps1
```
```

### Bash Prompts

```markdown
```bash
$ az login
$ ./deploy.sh --mode quick
```
```

**Don't** include prompts in copyable commands:

```markdown
# ✅ GOOD (copyable)
```powershell
Connect-AzAccount
```

# ❌ BAD (includes prompt)
```powershell
PS C:\> Connect-AzAccount
```
```

---

## Consistent Terminology

| Use | Don't Use |
|-----|-----------|
| Azure | azure, AZURE |
| PowerShell | Powershell, powershell |
| Bicep | bicep, BICEP |
| The Things Stack | TTS, the things stack |
| Key Vault | KeyVault, key vault |
| Resource Group | resource group, RG |
| Virtual Machine | VM, virtual machine, vm |
| Kubernetes | kubernetes, k8s (except in code) |

---

## Document Status Labels

Use status badges at top of documents:

```markdown
![Status: Active](https://img.shields.io/badge/status-active-green)
![Status: Draft](https://img.shields.io/badge/status-draft-yellow)
![Status: Deprecated](https://img.shields.io/badge/status-deprecated-red)
```

---

## Breaking Changes

Highlight breaking changes prominently:

```markdown
## ⚠️ BREAKING CHANGES in v2.0

### Database Password Requirements

**Before**: Any characters allowed  
**After**: Alphanumeric only (no special characters)

**Migration**: Update passwords in Key Vault before upgrading.
```

---

## Changelog Format

For documents with frequent updates:

```markdown
## Changelog

### 2025-11-21
- Added brownfield DNS configuration
- Updated security hardening steps

### 2025-10-10
- Initial documentation
```

---

## License and Footer

Standard footer for documentation:

```markdown
---

**Made with ❤️ for the LoRaWAN Community**

[Documentation Hub](../index.md) | [Report Issue](https://github.com/blueflightx7/thethingsstack-on-azure/issues)
```

---

## Validation

Before committing documentation:

- [ ] Run markdownlint
- [ ] Check all internal links
- [ ] Verify code blocks execute correctly
- [ ] Review spelling and grammar
- [ ] Ensure front matter is complete
- [ ] Test examples in isolated environment

---

## Tools

**Recommended**:
- **Editor**: VS Code with Markdown All in One extension
- **Linter**: markdownlint-cli
- **Diagrams**: draw.io, Mermaid
- **Screenshots**: Windows Snip & Sketch, macOS Screenshot

**VS Code Extensions**:
- Markdown All in One
- Markdown Preview Enhanced
- markdownlint
- Code Spell Checker

---

**This style guide is a living document. Suggest improvements via GitHub issues.**
