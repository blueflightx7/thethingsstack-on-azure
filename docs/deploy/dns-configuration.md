# Brownfield DNS Configuration for Private Database Access

## Overview

When deploying The Things Stack with **private database access** into an **existing VNet (brownfield scenario)**, DNS configuration is critical for proper operation. This document explains the DNS requirements, configuration options, and troubleshooting steps.

## The Problem

Azure Private DNS zones (e.g., `privatelink.postgres.database.azure.com`) are resolved by **Azure DNS** (IP: `168.63.129.16`). However, corporate VNets often have **custom DNS servers** configured for corporate network integration.

When a VM is deployed into a VNet with custom DNS servers:
1. The VM inherits the VNet's DNS server configuration
2. Custom DNS servers may not forward `privatelink.*` queries to Azure DNS
3. The VM cannot resolve the PostgreSQL private endpoint FQDN
4. The Things Stack container fails to connect to the database
5. Container enters restart loop with DNS errors: `lookup <server>.postgres.database.azure.com: no such host`

## Symptom Timeline

| Phase | Symptom | Logs |
|-------|---------|------|
| 1. Deployment | ✅ Succeeds | All resources created successfully |
| 2. Cloud-init | ✅ Completes | Docker and containers started |
| 3. TTS Startup | ❌ Container Restarting | `docker ps` shows "Restarting" status |
| 4. Container Logs | ❌ DNS Error | `error:pkg/errors:net_dns (lookup <server>.postgres.database.azure.com on 127.0.0.11:53: no such host)` |

## Diagnostic Commands

```bash
# 1. Check VM's current DNS servers
ssh ttsadmin@<VM-IP> "sudo resolvectl status"

# Output shows:
# Current DNS Server: 10.x.x.x  <-- Custom DNS from VNet
# DNS Servers: 10.x.x.x, 10.x.x.x

# 2. Test DNS resolution with local resolver (will fail)
ssh ttsadmin@<VM-IP> "nslookup <server>.postgres.database.azure.com"

# Output shows:
# ** server can't find <server>.postgres.database.azure.com: NXDOMAIN

# 3. Test DNS resolution with Azure DNS (will succeed)
ssh ttsadmin@<VM-IP> "nslookup <server>.postgres.database.azure.com 168.63.129.16"

# Output shows:
# Server: 168.63.129.16
# <server>.postgres.database.azure.com canonical name = <internal-id>.privatelink.postgres.database.azure.com
# Address: 10.x.x.x  <-- Private IP
```

## Solution: DNS Configuration Options

The deployment now supports **two DNS configuration modes** via the `useAzureDNS` parameter (default: `true`).

### Option 1: Use Azure DNS (RECOMMENDED - Default)

**When to use:**
- ✅ Private database access enabled (PostgreSQL with delegated subnet)
- ✅ VNet has custom DNS servers
- ✅ You want automatic resolution of Private DNS zones
- ✅ Production deployments

**How it works:**
```bicep
// In tts-docker-deployment.bicep
param useAzureDNS bool = true

resource nic 'Microsoft.Network/networkInterfaces@2023-04-01' = {
  properties: {
    dnsSettings: useAzureDNS ? {
      dnsServers: ['168.63.129.16']  // Override VNet DNS
    } : null
  }
}
```

**Deployment:**
```powershell
# Interactive (deploy-simple.ps1 will prompt)
.\deploy.ps1

# When prompted:
# DNS Configuration for VM:
#   1. Use Azure DNS (168.63.129.16) - RECOMMENDED
#   2. Inherit from VNet
# Select: 1
```

**Result:**
- VM NIC explicitly configured to use Azure DNS (168.63.129.16)
- VM resolves Private DNS zones correctly
- VM can still access corporate resources via Azure DNS forwarding
- TTS container connects to PostgreSQL successfully
- Console loads immediately

**Verification:**
```powershell
# Check NIC DNS settings
az network nic show --resource-group <RG> --name <NIC> --query "dnsSettings.dnsServers"

# Output: ["168.63.129.16"]
```

### Option 2: Inherit from VNet (Advanced)

**When to use:**
- ⚠️ You've confirmed VNet DNS servers forward `privatelink.*` queries to Azure DNS
- ⚠️ You need corporate DNS for specific use cases
- ⚠️ You understand the risks

**How it works:**
```bicep
param useAzureDNS bool = false

resource nic 'Microsoft.Network/networkInterfaces@2023-04-01' = {
  properties: {
    dnsSettings: null  // Inherit from VNet
  }
}
```

**Deployment:**
```powershell
# Interactive (deploy-simple.ps1 will prompt)
.\deploy.ps1

# When prompted:
# DNS Configuration for VM:
#   1. Use Azure DNS (168.63.129.16) - RECOMMENDED
#   2. Inherit from VNet
# Select: 2

# Warning displayed:
# ⚠ WARNING: VM will inherit VNet DNS servers
# If VNet DNS cannot resolve privatelink domains, deployment will fail!
# Continue with VNet DNS? (y/N)
```

**Requirements:**
1. VNet's custom DNS servers must be configured to forward `*.privatelink.postgres.database.azure.com` queries to Azure DNS (168.63.129.16)
2. Typically requires DNS forwarder configuration in corporate DNS infrastructure
3. Test DNS resolution before deploying

**Verification:**
```bash
# From VM, test that VNet DNS can resolve privatelink
nslookup <server>.postgres.database.azure.com

# Should return private IP (10.x.x.x), not NXDOMAIN
```

## Architecture Diagrams

### Scenario 1: Azure DNS (Recommended)

```
┌─────────────────────────────────────────────────────────────────┐
│                          Azure VNet                              │
│                   (Custom DNS: 10.x.x.x)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐                                             │
│  │   TTS VM       │                                             │
│  │                │                                             │
│  │  NIC DNS:      │──────────┐                                 │
│  │  168.63.129.16 │          │                                 │
│  │  (Azure DNS)   │          │  DNS Query:                     │
│  └────────────────┘          │  <server>.postgres.database.    │
│         │                    │  azure.com                      │
│         │                    │                                 │
│         │                    ▼                                 │
│         │         ┌─────────────────────┐                      │
│         │         │   Azure DNS         │                      │
│         │         │   168.63.129.16     │                      │
│         │         └──────────┬──────────┘                      │
│         │                    │                                 │
│         │                    │  Queries Private DNS Zone       │
│         │                    │                                 │
│         │                    ▼                                 │
│         │         ┌─────────────────────┐                      │
│         │         │  Private DNS Zone   │                      │
│         │         │  privatelink.       │                      │
│         │         │  postgres...        │                      │
│         │         └──────────┬──────────┘                      │
│         │                    │                                 │
│         │                    │  Returns: 10.x.x.x              │
│         │                    │                                 │
│         │                    ▼                                 │
│         │         ┌─────────────────────┐                      │
│         └────────►│  PostgreSQL         │                      │
│                   │  (Private)          │                      │
│                   │  10.x.x.x           │                      │
│                   └─────────────────────┘                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

✅ Works: VM uses Azure DNS directly, resolves Private DNS zones
```

### Scenario 2: VNet DNS (Fails without DNS forwarder)

```
┌─────────────────────────────────────────────────────────────────┐
│                          Azure VNet                              │
│                   (Custom DNS: 10.x.x.x)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐                                             │
│  │   TTS VM       │                                             │
│  │                │                                             │
│  │  NIC DNS:      │──────────┐                                 │
│  │  (inherit)     │          │                                 │
│  │  10.x.x.x      │          │  DNS Query:                     │
│  └────────────────┘          │  <server>.postgres.database.    │
│         │                    │  azure.com                      │
│         │                    │                                 │
│         │                    ▼                                 │
│         │         ┌─────────────────────┐                      │
│         │         │  Corporate DNS      │                      │
│         │         │  10.x.x.x           │                      │
│         │         └──────────┬──────────┘                      │
│         │                    │                                 │
│         │                    │  ❌ NXDOMAIN                    │
│         │                    │  (No privatelink zone)          │
│         │                    │                                 │
│         │                    ▼                                 │
│         │         ┌─────────────────────┐                      │
│         └────────►│  PostgreSQL         │                      │
│                   │  (Private)          │                      │
│                   │  10.x.x.x           │                      │
│                   │  ❌ Unreachable     │                      │
│                   └─────────────────────┘                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

❌ Fails: Corporate DNS doesn't know about Azure Private DNS zones
```

## Manual Fix (If Already Deployed)

If you've already deployed with the wrong DNS configuration and the console isn't loading:

```powershell
# 1. Get resource names
$rgName = "<resource-group-name>"
$vmName = "<vm-name>"
$nicName = "${vmName}-nic"

# 2. Update NIC to use Azure DNS
az network nic update `
    --resource-group $rgName `
    --name $nicName `
    --dns-servers 168.63.129.16

# 3. Restart VM to apply DNS settings
az vm restart --resource-group $rgName --name $vmName

# 4. Wait 2-3 minutes, then verify DNS
ssh ttsadmin@<VM-IP> "sudo resolvectl status"

# Output should show:
# Current DNS Server: 168.63.129.16

# 5. Verify container is healthy
ssh ttsadmin@<VM-IP> "sudo docker ps"

# Output should show:
# ttsadmin_stack_1   Up (healthy)   <-- Not "Restarting"

# 6. Access console
# Browse to: https://<fqdn>/console
```

## Troubleshooting

### Container Still Restarting After DNS Fix

```bash
# 1. Check systemd-resolved picked up new DNS
sudo resolvectl status

# Should show: Current DNS Server: 168.63.129.16

# 2. Flush DNS cache (if needed)
sudo resolvectl flush-caches

# 3. Test DNS resolution
nslookup <server>.postgres.database.azure.com

# Should return: Address: 10.x.x.x (private IP)

# 4. Check container logs
sudo docker logs ttsadmin_stack_1 2>&1 | grep -i "dns\|lookup\|database"

# Should NOT show: "no such host" errors

# 5. Restart containers
cd /home/ttsadmin
sudo docker-compose restart

# 6. Monitor health
watch -n 2 'sudo docker ps'
```

### Azure DNS Test Shows Wrong IP

```bash
# If nslookup returns public IP instead of private:

# 1. Verify Private DNS zone VNet link
az network private-dns link vnet list \
    --resource-group <deployment-rg> \
    --zone-name privatelink.postgres.database.azure.com

# Should show:
# VNet: <vnet-name>
# Status: Succeeded

# 2. Check A record exists
az network private-dns record-set a list \
    --resource-group <deployment-rg> \
    --zone-name privatelink.postgres.database.azure.com

# Should show record with private IP: 10.x.x.x

# 3. If missing, redeploy or manually create link
```

### Corporate Resources Not Accessible

If VM needs to access corporate resources after setting Azure DNS:

**Azure DNS automatically forwards** non-Azure queries to VNet DNS servers. This should work transparently. If not:

```powershell
# Option 1: Revert to VNet DNS (requires DNS forwarder setup)
az network nic update --resource-group <RG> --name <NIC> --dns-servers ""

# Option 2: Use both DNS servers (Azure DNS + Corporate)
az network nic update --resource-group <RG> --name <NIC> --dns-servers 168.63.129.16 10.x.x.x

# Option 3: Configure corporate DNS to forward privatelink queries
# (Infrastructure team required)
```

## Best Practices

### ✅ DO

1. **Use Azure DNS (default)** for private database deployments
2. **Test DNS resolution** before deploying if using VNet DNS
3. **Document VNet DNS configuration** in brownfield environments
4. **Verify Private DNS VNet link** exists and is in "Succeeded" state
5. **Check container logs** if console doesn't load within 5 minutes

### ❌ DON'T

1. **Don't assume VNet DNS works** with Private DNS zones
2. **Don't skip the DNS prompt** during deployment
3. **Don't manually edit `/etc/resolv.conf`** (systemd-resolved overrides it)
4. **Don't set public database access** just to avoid DNS configuration
5. **Don't deploy without testing DNS** if using option 2 (inherit from VNet)

## Parameter Reference

### Bicep Template

```bicep
@description('Use Azure DNS (168.63.129.16) on VM instead of VNet DNS servers - required for private DNS zone resolution')
param useAzureDNS bool = true
```

### PowerShell Deployment

```powershell
# Auto-prompt (recommended)
.\deploy.ps1

# Explicit Azure DNS
.\deploy.ps1 -UseAzureDNS $true

# Explicit VNet DNS (advanced)
.\deploy.ps1 -UseAzureDNS $false
```

### Azure CLI Deployment

```bash
# With Azure DNS (recommended)
az deployment group create \
  --resource-group <rg-name> \
  --template-file deployments/vm/tts-docker-deployment.bicep \
  --parameters useAzureDNS=true \
  <...other parameters...>

# With VNet DNS (requires DNS forwarder)
az deployment group create \
  --resource-group <rg-name> \
  --template-file deployments/vm/tts-docker-deployment.bicep \
  --parameters useAzureDNS=false \
  <...other parameters...>
```

## Related Documentation

- **Private DNS Zones**: See `ARCHITECTURE.md` Section 8.2
- **Brownfield Networking**: See `BROWNFIELD_DEPLOYMENT_GUIDE.md` Section 3
- **Troubleshooting**: See `TROUBLESHOOTING.md` - DNS Resolution
- **Security**: See `SECURITY_HARDENING.md` - Network Configuration

## Implementation History

This DNS configuration feature was added to resolve a critical issue in brownfield deployments:

- **Issue**: VMs deployed into VNets with custom DNS servers couldn't resolve PostgreSQL private endpoints
- **Symptom**: TTS container restart loop with "no such host" DNS errors
- **Root Cause**: Custom DNS servers don't resolve Azure Private DNS zones (`privatelink.postgres.database.azure.com`)
- **Fix**: Add `useAzureDNS` parameter to override VNet DNS with Azure DNS (168.63.129.16)
- **Result**: Brownfield deployments work correctly with private database access

**Commits:**
- `2891ec2` - Add useAzureDNS parameter to Bicep template
- `38ea5db` - Add DNS configuration prompt to deployment script

**Testing:**
- Verified in EXP-BEEHIVE-PROD-NY-RG deployment
- VNet: onemtcexp-vnet-east with custom DNS (10.248.4.11/12)
- Manual fix applied successfully (az network nic update)
- Template changes tested with clean redeployment
