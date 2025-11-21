# Deployment Parameters Guide

This guide explains all the interactive prompts and configuration options available when deploying The Things Stack on Azure.

## Table of Contents

1. [Overview](#overview)
2. [Common Parameters (All Deployment Modes)](#common-parameters-all-deployment-modes)
3. [VM-Specific Parameters](#vm-specific-parameters)
4. [AKS-Specific Parameters](#aks-specific-parameters)
5. [Optional Features](#optional-features)
6. [Parameter Reference](#parameter-reference)

---

## Overview

All deployment scripts (`deploy.ps1`, `deploy-simple.ps1`, `deploy-aks.ps1`) now support interactive prompts for configuration, making deployments flexible and user-friendly.

### Deployment Flow

```
deploy.ps1 (Main Orchestrator)
    │
    ├─► Mode: quick  → deployments/vm/deploy-simple.ps1
    ├─► Mode: aks    → deployments/kubernetes/deploy-aks.ps1
    └─► Mode: vm     → Advanced VM configuration
```

---

## Common Parameters (All Deployment Modes)

These parameters are requested for **all deployment types** (quick, aks, vm):

### 1. Azure Region

**Prompt**: "Select region (1-8, or press Enter for default: centralus)"

**Popular Options**:
- `centralus` (Central US) - Default
- `eastus` (East US)
- `westus2` (West US 2)
- `westeurope` (West Europe)
- `northeurope` (North Europe)
- `eastasia` (East Asia)
- `southeastasia` (Southeast Asia)
- Custom (enter your own)

**Example**:
```
Select region (1-8, or press Enter for default: centralus): 1
✓ Selected region: centralus
```

**When to Change**:
- Deploy closer to your LoRaWAN gateways for lower latency
- Comply with data residency requirements
- Leverage region-specific pricing or capacity

**Command Line Override**:
```powershell
.\deploy.ps1 -Mode quick -Location "westeurope"
```

---

### 2. Resource Group

**Prompt**: "Do you have an existing resource group to use? (y/N)"

**Options**:
- **N (Default)**: Create new resource group with auto-generated name `rg-tts-<timestamp>`
- **Y**: Select from existing resource groups

**Example - Create New**:
```
Do you have an existing resource group to use? (y/N): N
Creating new resource group: rg-tts-202510121430
✓ Resource group created
```

**Example - Use Existing**:
```
Do you have an existing resource group to use? (y/N): y

Fetching available resource groups...

Available Resource Groups:
  1. rg-production-eastus
  2. rg-dev-centralus
  3. rg-shared-resources

Select resource group (1-3), or press Enter to create new: 1
✓ Using existing resource group: rg-production-eastus
  Location: eastus
```

**When to Use Existing**:
- Deploying into existing hub-and-spoke network architecture
- Grouping TTS with related resources (monitoring, DNS, etc.)
- Working within organizational resource group policies

**Command Line Override**:
```powershell
.\deploy.ps1 -Mode quick -ResourceGroupName "rg-production-eastus"
```

---

### 3. Virtual Network (VNet) and Subnet

**Prompt**: "Do you have an existing VNet and Subnet to use? (y/N)"

**Options**:
- **N (Default)**: Bicep template creates new VNet automatically
- **Y**: Select from existing VNets and Subnets

**Example - Create New**:
```
Do you have an existing VNet and Subnet to use? (y/N): N
✓ New VNet and Subnet will be created automatically by Bicep template
```

**Example - Use Existing**:
```
Do you have an existing VNet and Subnet to use? (y/N): y

Fetching available VNets in rg-production-eastus...

Available VNets:
  1. vnet-prod-hub - 10.0.0.0/16
  2. vnet-dev-spoke - 10.1.0.0/16

Select VNet (1-2), or press Enter to create new: 1
✓ Selected VNet: vnet-prod-hub

  Available Subnets:
    1. subnet-aks - 10.0.1.0/24
    2. subnet-services - 10.0.2.0/24
    3. subnet-data - 10.0.3.0/24

  Select Subnet (1-3): 2
  ✓ Selected Subnet: subnet-services
```

**When to Use Existing**:
- Hub-and-spoke network topology (deploy into spoke VNet)
- Shared services architecture (PostgreSQL, Redis in shared subnet)
- Network policies require specific IP ranges
- Integration with on-premises networks via VPN/ExpressRoute

**Default VNet Configuration** (if creating new):

| Deployment Mode | VNet CIDR | Subnets |
|----------------|-----------|---------|
| **VM (Quick)** | 10.0.0.0/16 | `subnet-tts`: 10.0.1.0/24<br>`subnet-db`: 10.0.2.0/24 |
| **AKS** | 10.0.0.0/16 | `subnet-aks`: 10.0.0.0/22<br>`subnet-db`: 10.0.4.0/24<br>`subnet-redis`: 10.0.6.0/24 (if Redis Enterprise) |

**Command Line Override**:
```powershell
# Not directly supported via command line - use parameters file or interactive prompts
```

---

### 4. Admin Email

**Prompt**: "Enter admin email address (for Let's Encrypt & TTS admin)"

**Purpose**:
- Let's Encrypt SSL certificate notifications
- TTS admin console login username
- Alert notifications

**Validation**: Must be valid email format (RFC 5322)

**Example**:
```
Enter admin email address (for Let's Encrypt & TTS admin): admin@onemtc.net
✓ Valid email format
```

**Command Line Override**:
```powershell
.\deploy.ps1 -Mode quick -AdminEmail "admin@onemtc.net"
```

---

## VM-Specific Parameters

These parameters are only requested for **VM deployments** (quick and vm modes):

### 5. Azure Container Registry (ACR)

**Prompt**: "Do you want to use Azure Container Registry for custom images? (y/N)"

**Options**:
- **N (Default)**: Use official Docker Hub image `thethingsindustries/lorawan-stack:v3.30.2`
- **Y**: Select from existing ACRs for custom builds

**Example - Docker Hub (Simple)**:
```
Do you want to use Azure Container Registry for custom images? (y/N): N
✓ Using official Docker Hub image: thethingsindustries/lorawan-stack:v3.30.2
```

**Example - Custom ACR**:
```
Do you want to use Azure Container Registry for custom images? (y/N): y

Fetching available Azure Container Registries...

Available Container Registries:
  1. ttsprodacr - ttsprodacr.azurecr.io
  2. devregistry - devregistry.azurecr.io

Select ACR (1-2), or press Enter to use Docker Hub: 1
✓ Using ACR: ttsprodacr
```

**When to Use ACR**:
- Custom TTS image builds (plugins, custom branding)
- CI/CD pipeline with auto-updates via Watchtower
- Private registry compliance requirements
- Air-gapped deployments

**Prerequisites for ACR**:
1. ACR must exist (created via `deployments/shared/acr.bicep`)
2. GitHub Actions workflow configured (`.github/workflows/build-deploy.yml`)
3. Watchtower enabled for auto-updates

**Cost Impact**:
- ACR Premium: +$165/month
- Watchtower: $0 (runs as container)

**Command Line Override**:
```powershell
.\deploy.ps1 -Mode quick -UseCustomAcr $true -AcrName "ttsprodacr"
```

---

### 6. Domain Name

**Prompt**: "Domain name (leave empty for auto-generated Azure domain)"

**Options**:
- **Empty (Default)**: Auto-generated `<vm-name>.<region>.cloudapp.azure.com`
- **Custom**: Your own domain (requires DNS configuration)

**Example - Auto-generated**:
```
Domain name (leave empty for auto-generated Azure domain):
✓ Using auto-generated Azure domain
```

**Example - Custom Domain**:
```
Domain name (leave empty for auto-generated Azure domain): tts.onemtc.net
✓ Using custom domain: tts.onemtc.net
```

**Custom Domain Requirements**:
1. DNS A record pointing to VM public IP (configured after deployment)
2. Let's Encrypt will auto-provision SSL certificate
3. Firewall allows HTTP/HTTPS traffic

**DNS Configuration** (post-deployment):
```
# Get VM public IP from deployment output
Console URL: https://tts.onemtc.net

# Create DNS A record:
# Name: tts
# Type: A
# Value: <VM Public IP from output>
```

---

### 7. VM/Database Admin Password

**Prompt**: "Enter VM/Database admin password (alphanumeric only, 12+ chars)"

**Requirements**:
- **Alphanumeric only** (no special characters for PostgreSQL compatibility)
- Minimum 12 characters
- Secure input (masked in terminal)

**Purpose**:
- VM SSH login
- PostgreSQL database admin password
- Stored in Azure Key Vault

**Example**:
```
Enter VM/Database admin password (alphanumeric only, 12+ chars): ************
✓ Password accepted
```

**Security Notes**:
- Password stored in Key Vault secret: `db-password`
- Used for PostgreSQL admin user authentication
- SSH access restricted to your public IP by default

---

### 8. TTS Admin Password

**Prompt**: "Enter TTS admin password (for console login, 12+ chars)"

**Requirements**:
- Minimum 12 characters
- Secure input (masked in terminal)

**Purpose**:
- TTS web console login
- REST API authentication
- Stored in Azure Key Vault

**Example**:
```
Enter TTS admin password (for console login, 12+ chars): ************
✓ Password accepted
```

**Security Notes**:
- Password stored in Key Vault secret: `tts-admin-password`
- Username stored in Key Vault secret: `tts-admin-username` (default: `ttsadmin`)
- Password used for admin user creation in cloud-init

---

## AKS-Specific Parameters

These parameters are only requested for **AKS deployments** (aks mode):

### 9. Environment Name

**Prompt**: "Environment name (alphanumeric only, 3-16 chars, e.g., 'ttsprod')"

**Requirements**:
- Alphanumeric only (no hyphens, underscores, special characters)
- 3-16 characters
- Lowercase

**Validation Pattern**: `^[a-z0-9]{3,16}$`

**Purpose**:
- Prefix for all resource names
- Example: `ttsprod` → `ttsprod-aks`, `ttsprod-db`, `ttsprod-kv`

**Example**:
```
Environment name (alphanumeric only, 3-16 chars, e.g., 'ttsprod'): ttsprod
✓ Valid environment name
```

**Command Line Override**:
```powershell
.\deploy.ps1 -Mode aks -EnvironmentName "ttsprod"
```

---

### 10. Domain Name (AKS)

**Prompt**: "Domain name for TTS deployment (e.g., tts.example.com)"

**Requirements**:
- **Required** for AKS deployments (not optional like VM)
- Must configure DNS before accessing console

**Purpose**:
- Ingress Controller routing
- Let's Encrypt certificate domain
- TTS Console URL

**Example**:
```
Domain name for TTS deployment (e.g., tts.example.com): tts.onemtc.net
✓ Domain configured
```

**DNS Configuration** (post-deployment):
```
# Get Load Balancer public IP from AKS deployment output
kubectl get svc -n ingress-nginx ingress-nginx-controller

# Create DNS A record:
# Name: tts
# Type: A
# Value: <Load Balancer Public IP>
```

---

### 11. Redis Strategy

**Prompt**: "Select Redis deployment: [1] Azure Cache for Redis Enterprise E10, [2] In-Cluster StatefulSet"

**Options**:

| Option | Description | Cost | Use Case |
|--------|-------------|------|----------|
| **1 - Azure Cache Enterprise E10** (Recommended) | Fully managed, Redis 7.2, 12 GB cache, zone-redundant | ~$175/month | Production workloads, high availability |
| **2 - In-Cluster StatefulSet** | Self-managed Kubernetes StatefulSet, requires PersistentVolume | ~$20/month (storage only) | Development, lower cost environments |

**Example - Azure Cache**:
```
Select Redis deployment: [1-2]: 1
✓ Using Azure Cache for Redis Enterprise E10
```

**Example - In-Cluster**:
```
Select Redis deployment: [1-2]: 2
✓ Using In-Cluster Redis StatefulSet
```

**Azure Cache for Redis Enterprise Features**:
- 99.99% SLA
- Zone redundancy (data replicated across 3 zones)
- Automatic failover
- Redis 7.2 (latest stable)
- Private VNet injection
- Managed backups

**In-Cluster StatefulSet Considerations**:
- Manual backup/restore
- Single-zone deployment (no auto-failover)
- Requires PersistentVolumeClaim management
- Lower operational complexity

**Command Line Override**:
```powershell
.\deploy.ps1 -Mode aks -UseRedisEnterprise  # Use Azure Cache
.\deploy.ps1 -Mode aks  # Default to in-cluster StatefulSet
```

---

## Optional Features

### SSH IP Restriction (VM Deployments Only)

**Automatic**: Script auto-detects your public IP via `https://api.ipify.org`

**Purpose**: Network Security Group (NSG) rule restricts SSH access to your IP only

**Behavior**:
```
Detecting your public IP for SSH access restriction...
✓ Detected deployer IP: 203.0.113.42
  SSH access will be restricted to this IP for security
```

**Manual Override** (if auto-detection fails):
```
⚠ Could not detect public IP. SSH will default to ANY (not recommended for production)
Enter your public IP address manually (or press Enter to allow from ANY): 203.0.113.42
✓ Using IP: 203.0.113.42
```

**Security Impact**:
- **Restricted IP**: Only your IP can SSH to VM (production-ready)
- **Allow ANY (*)**: Any IP can SSH (development only, high risk)

---

## Parameter Reference

### Command Line Parameters

#### deploy.ps1 (Main Orchestrator)

```powershell
.\deploy.ps1 `
    -Mode <quick|aks|vm> `
    -Location <azure-region> `
    -EnvironmentName <name> `
    -AdminEmail <email> `
    -ParametersFile <path>
```

**Examples**:
```powershell
# Quick VM with all parameters
.\deploy.ps1 -Mode quick -Location "eastus" -AdminEmail "admin@example.com"

# AKS production deployment
.\deploy.ps1 -Mode aks -EnvironmentName "ttsprod" -AdminEmail "admin@example.com"

# Interactive menu (no parameters)
.\deploy.ps1
```

---

#### deploy-simple.ps1 (VM Deployment)

```powershell
.\deployments\vm\deploy-simple.ps1 `
    -Location <azure-region> `
    -EnvironmentName <name> `
    -AdminEmail <email> `
    -DomainName <domain> `
    -ResourceGroupName <rg-name> `
    -VNetName <vnet-name> `
    -SubnetName <subnet-name> `
    -UseCustomAcr <$true|$false> `
    -AcrName <acr-name>
```

**Examples**:
```powershell
# Simple deployment (all interactive)
.\deployments\vm\deploy-simple.ps1

# With existing infrastructure
.\deployments\vm\deploy-simple.ps1 `
    -Location "eastus" `
    -ResourceGroupName "rg-production" `
    -VNetName "vnet-prod-hub" `
    -SubnetName "subnet-services" `
    -AdminEmail "admin@example.com"

# With custom ACR
.\deployments\vm\deploy-simple.ps1 `
    -Location "eastus" `
    -AdminEmail "admin@example.com" `
    -UseCustomAcr $true `
    -AcrName "ttsprodacr"
```

---

#### deploy-aks.ps1 (AKS Deployment)

```powershell
.\deployments\kubernetes\deploy-aks.ps1 `
    -Location <azure-region> `
    -EnvironmentName <name> `
    -AdminEmail <email> `
    -DomainName <domain> `
    -ResourceGroupName <rg-name> `
    -VNetName <vnet-name> `
    -SubnetName <subnet-name> `
    -UseRedisEnterprise `
    -TtsHelmVersion <version>
```

**Examples**:
```powershell
# Full AKS deployment (all interactive)
.\deployments\kubernetes\deploy-aks.ps1

# Production with Azure Cache for Redis
.\deployments\kubernetes\deploy-aks.ps1 `
    -EnvironmentName "ttsprod" `
    -Location "eastus" `
    -AdminEmail "admin@example.com" `
    -DomainName "tts.example.com" `
    -UseRedisEnterprise

# With existing VNet
.\deployments\kubernetes\deploy-aks.ps1 `
    -EnvironmentName "ttsprod" `
    -Location "eastus" `
    -ResourceGroupName "rg-aks-prod" `
    -VNetName "vnet-prod-hub" `
    -SubnetName "subnet-aks" `
    -AdminEmail "admin@example.com" `
    -DomainName "tts.example.com"
```

---

### Parameter Validation Summary

| Parameter | Required | Pattern/Format | Example |
|-----------|----------|----------------|---------|
| `Location` | No (defaults to centralus) | Azure region name | `eastus`, `westeurope` |
| `EnvironmentName` | AKS: Yes, VM: No | `^[a-z0-9]{3,16}$` | `ttsprod`, `devenv` |
| `AdminEmail` | Yes (interactive if not provided) | RFC 5322 email | `admin@example.com` |
| `DomainName` | AKS: Yes, VM: No | Valid FQDN | `tts.example.com` |
| `ResourceGroupName` | No (auto-generated) | Valid RG name | `rg-production-eastus` |
| `VNetName` | No (auto-created) | Valid VNet name | `vnet-prod-hub` |
| `SubnetName` | No (auto-created) | Valid subnet name | `subnet-services` |
| `UseCustomAcr` | No (defaults to $false) | Boolean | `$true`, `$false` |
| `AcrName` | No (Docker Hub if not provided) | Valid ACR name | `ttsprodacr` |
| `UseRedisEnterprise` | No (defaults to $false) | Switch parameter | `-UseRedisEnterprise` |

---

## Deployment Scenarios

### Scenario 1: Simple VM Deployment (Default)

**Command**:
```powershell
.\deploy.ps1 -Mode quick
```

**Interactive Prompts**:
1. Select region: **1** (centralus)
2. Use existing RG? **N**
3. Use existing VNet? **N**
4. Use ACR? **N**
5. Enter admin email: **admin@example.com**
6. Domain name: *(leave empty for auto-generated)*
7. VM password: ************
8. TTS password: ************

**Result**:
- New resource group: `rg-tts-202510121430`
- New VNet: `vnet-tts` (10.0.0.0/16)
- Docker Hub image: `thethingsindustries/lorawan-stack:v3.30.2`
- Auto-generated domain: `tts-vm-<random>.<region>.cloudapp.azure.com`
- **Deployment time**: 15 minutes
- **Cost**: ~$155/month

---

### Scenario 2: Production VM with Custom ACR

**Prerequisites**:
1. Deploy ACR: `az deployment group create --template-file deployments/shared/acr.bicep`
2. Configure GitHub Actions: Set secrets `AZURE_CREDENTIALS`, `ACR_NAME`
3. Push custom image to ACR

**Command**:
```powershell
.\deploy.ps1 -Mode quick -AdminEmail "admin@onemtc.net"
```

**Interactive Prompts**:
1. Select region: **2** (eastus)
2. Use existing RG? **y** → Select `rg-production-eastus`
3. Use existing VNet? **y** → Select `vnet-prod-hub` / `subnet-services`
4. Use ACR? **y** → Select `ttsprodacr`
5. Domain name: **tts.onemtc.net**
6. VM password: ************
7. TTS password: ************

**Result**:
- Existing RG: `rg-production-eastus`
- Existing VNet: `vnet-prod-hub` / `subnet-services`
- Custom ACR: `ttsprodacr.azurecr.io/lorawan-stack:latest`
- Custom domain: `tts.onemtc.net`
- Watchtower auto-updates every 5 minutes
- **Deployment time**: 15 minutes
- **Cost**: ~$320/month (VM + ACR)

---

### Scenario 3: Production AKS with Redis Enterprise

**Command**:
```powershell
.\deploy.ps1 -Mode aks
```

**Interactive Prompts**:
1. Select region: **4** (westeurope)
2. Environment name: **ttsprod**
3. Admin email: **admin@onemtc.net**
4. Domain name: **tts.onemtc.net**
5. Use existing RG? **N**
6. Use existing VNet? **N**
7. Redis: **1** (Azure Cache Enterprise E10)

**Result**:
- New RG: `rg-ttsprod`
- New VNet: `vnet-ttsprod` (10.0.0.0/16)
- AKS Automatic cluster: 3 nodes, zone-redundant
- PostgreSQL Flexible Server: Zone-redundant, private access
- Azure Cache for Redis: E10 Enterprise, 12 GB
- Let's Encrypt SSL: `tts.onemtc.net`
- **Deployment time**: 30 minutes
- **Cost**: ~$675/month

---

## Troubleshooting

### Issue: "Could not detect public IP"

**Cause**: Network restrictions blocking `https://api.ipify.org`

**Solution**:
```
Enter your public IP address manually (or press Enter to allow from ANY): <your-ip>
```

**Find your public IP**:
```powershell
# PowerShell
(Invoke-WebRequest -Uri "https://ifconfig.me").Content

# Browser
# Visit: https://whatismyipaddress.com
```

---

### Issue: "Invalid environment name"

**Cause**: Environment name contains hyphens or special characters

**Solution**: Use alphanumeric only (e.g., `ttsprod` instead of `tts-prod`)

```
❌ Invalid: tts-prod, tts_prod, TTS-PROD
✅ Valid:   ttsprod, ttsdev, aks01
```

---

### Issue: "No existing VNets found"

**Cause**: Resource group is new or has no VNets

**Solution**: Select "press Enter to create new" when prompted

```
No existing VNets found in this resource group. New VNet will be created.
✓ New VNet and Subnet will be created automatically by Bicep template
```

---

### Issue: "No existing ACRs found"

**Cause**: No Azure Container Registries in subscription

**Solution**: Either:
1. Deploy ACR first: `az deployment group create --template-file deployments/shared/acr.bicep`
2. Or select **N** to use Docker Hub

```
No existing ACRs found. Please create one first or use Docker Hub.
✓ Using official Docker Hub image: thethingsindustries/lorawan-stack:v3.30.2
```

---

## Next Steps

After deployment completes, see:
- **VM Deployments**: [QUICK-START.md](QUICK-START.md) - Post-deployment verification
- **AKS Deployments**: [CI-CD-SETUP-GUIDE.md](CI-CD-SETUP-GUIDE.md) - Kubernetes configuration
- **Custom ACR**: [CI-CD-ARCHITECTURE.md](CI-CD-ARCHITECTURE.md) - Build pipeline setup

---

## Related Documentation

- [README.md](../README.md) - Project overview and quick start
- [ARCHITECTURE.md](ARCHITECTURE.md) - Infrastructure deep-dive
- [DEPLOYMENT_ORCHESTRATION.md](DEPLOYMENT_ORCHESTRATION.md) - Orchestrator system guide
- [CI-CD-ARCHITECTURE.md](CI-CD-ARCHITECTURE.md) - CI/CD pipeline design
- [SECURITY_HARDENING.md](SECURITY_HARDENING.md) - Production security guide
