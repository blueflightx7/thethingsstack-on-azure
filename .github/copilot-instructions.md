# The Things Stack on Azure - AI Agent Instructions

## Project Overview

This is a **production-ready deployment system** for The Things Stack (LoRaWAN Network Server) on Azure. The codebase provides Infrastructure-as-Code (Bicep) with PowerShell orchestration, supporting three deployment modes: Quick VM (dev/test), Production AKS (Kubernetes), and Advanced VM (custom).

**Critical Context**: This project has undergone catastrophic recovery (2,738+ lines rebuilt) and includes 7 critical bug fixes that are documented and must be preserved.

## Architecture & Entry Points

### Deployment Hierarchy (ALWAYS use this)

```
deploy.ps1 (PRIMARY ORCHESTRATOR - SINGLE ENTRY POINT)
│
├── Mode: quick ──► deployments/vm/deploy-simple.ps1 ──► deployments/vm/tts-docker-deployment.bicep
├── Mode: aks ────► deployments/kubernetes/deploy-aks.ps1 ──► deployments/kubernetes/tts-aks-deployment.bicep
├── Mode: vm ─────► Inline advanced deployment ──► deployments/vm/tts-docker-deployment.bicep
└── Mode: integration ──► deployments/integration/deploy-integration.ps1 ──► deployments/integration/integration.bicep
```

**Never suggest using scripts directly** - always route through `deploy.ps1` with `-Mode` parameter.

## Critical Patterns & Conventions

### 1. The 12 Critical Fixes (NEVER REGRESS)

**All fixes documented in**: `DEPLOYMENT_FIXES_SUMMARY.md`, `SECURITY_FIX_SUMMARY.md`, `LOGIN_FIX.md`, `docs/BROWNFIELD_DNS_CONFIGURATION.md`

1. **Admin User Creation** (`deployments/vm/tts-docker-deployment.bicep:826`):
   ```bash
   # CORRECT (FIX #7):
   create-admin-user --id admin --email admin@example.com --password 'password' \
     --is.database-uri='postgresql://user:pass@server/db?sslmode=require'
   
   # WRONG (causes login failure):
   printf 'password\npassword\n' | create-admin-user
   ```

2. **SSH IP Restriction** (`deployments/vm/deploy-simple.ps1:82-100`):
   - Auto-detect deployer IP via `ipify.org` API
   - NSG rule uses detected IP, **never** `*` for production
   - `adminSourceIP` parameter passed to Bicep

3. **Key Vault RBAC** (`deployments/vm/deploy-simple.ps1:128-160`):
   - Wait 30 seconds after role assignment for propagation
   - Use `Key Vault Secrets Officer` role for deployment user
   - All 8 secrets required: db-password, tts-admin-password, tts-admin-username, cookie-hash-key, cookie-block-key, oauth-client-secret, admin-email, checksum

4. **Cookie Keys** (64 hex characters each):
   ```powershell
   $cookieHashKey = -join ((0..63) | ForEach-Object { '{0:X}' -f (Get-Random -Maximum 16) })
   ```

5. **OAuth Client Secret**: Always use `"console"` as the value

6. **Container Readiness**: Wait for `{{.State.Health.Status}}` before admin user creation

7. **Database Credentials**: Alphanumeric only (no special chars in PostgreSQL password)

8. **Brownfield VNet DNS** (`deployments/vm/tts-docker-deployment.bicep:314-318`):
   - **CRITICAL**: VNets with custom DNS servers (corporate DNS) cannot resolve Azure Private DNS zones
   - VM NIC must use Azure DNS (168.63.129.16) when `useAzureDNS=true` (default)
   - Without this, VM can't resolve PostgreSQL private endpoint FQDN
   - Symptom: TTS container restart loop with "no such host" DNS errors
   ```bicep
   dnsSettings: useAzureDNS ? {
     dnsServers: ['168.63.129.16']
   } : null
   ```

9. **Private DNS Zone VNet Link** (`deployments/vm/tts-docker-deployment.bicep:273-283`):
   - Private DNS zone (`privatelink.postgres.database.azure.com`) **MUST** be linked to VNet
   - Supports cross-resource-group VNets (brownfield)
   - Link must be in "Succeeded" state before database deployment
   - Zone created in deployment RG, link references VNet by full resource ID
   ```bicep
   virtualNetwork: {
     id: resourceId(subscription().subscriptionId, vnetResourceGroup, 'Microsoft.Network/virtualNetworks', vnetName)
   }
   ```

10. **PostgreSQL Subnet Delegation** (`deployments/vm/tts-docker-deployment.bicep:352`):
    - Database subnet **MUST** be delegated to `Microsoft.DBforPostgreSQL/flexibleServers`
    - Use 5-parameter `resourceId()` for cross-RG subnets (brownfield)
    - Resource ID format: `resourceId(subscriptionId, resourceGroup, type, vnetName, subnetName)`
    - Incorrect format causes "InternalServerError" during PostgreSQL deployment

11. **PostgreSQL Dependency Chain** (`deployments/vm/tts-docker-deployment.bicep:354`):
    - Use `privateDnsZone.id` (symbolic reference) NOT `resourceId()` string
    - Symbolic reference creates implicit Bicep dependency
    - Ensures Private DNS zone exists before PostgreSQL deployment
    - Without this: deployment fails with resource not found errors

12. **Database Initialization with Explicit URI** (`deployments/vm/tts-docker-deployment.bicep:824-833`):
    - **CRITICAL**: All `is-db` commands MUST include `--is.database-uri` flag
    - Without flag, commands try localhost:5432 instead of Azure PostgreSQL
    - Required for: `is-db migrate`, `create-admin-user`, `create-oauth-client`
    - Symptom: "driver error" on login, database tables don't exist
    ```bash
    docker exec stack_1 ttn-lw-stack is-db migrate \
      --is.database-uri='postgresql://user:pass@server/db?sslmode=require'
    ```

### 13. Integration Deployment (Option 6)

**Brownfield Awareness**:
- **Region Detection**: `deploy.ps1` auto-detects the region of the target Resource Group.
- **Monitoring Selection**: `deploy-integration.ps1` detects existing Log Analytics/App Insights.
- **Reuse/Create/Skip**: User is prompted to Reuse existing, Create new, or Skip monitoring.
- **Bicep Logic**: Uses `enableMonitoring` and `createMonitoringResources` flags to conditionally deploy resources and configure Function App settings.

**Security & Compliance**:
- **Storage**: Must use `minimumTlsVersion: 'TLS1_2'` and `supportsHttpsTrafficOnly: true`.
- **Functions**: Use stateless `HttpClient` pattern (avoid `CreateCloudBlobClient` connection limits).
- **Naming**: Storage account names must not contain hyphens (use `replace(prefix, '-', '')`).

### 2. Bicep Template Structure

**Primary Template**: `deployments/vm/tts-docker-deployment.bicep` (900 lines)

**Key Sections**:
- Lines 1-98: Parameter definitions with security decorators (@secure, @minValue, etc.)
- Line 97: `useAzureDNS` parameter (FIX #8 - critical for brownfield)
- Line 123: Database password sanitization (removes @, !, # from VM admin password)
- Lines 103-165: NSG rules (SSH restricted, LoRaWAN UDP 1700, HTTPS, gRPC ports)
- Lines 265-270: Private DNS zone (always in deployment RG)
- Lines 273-283: VNet link to Private DNS zone (supports cross-RG VNets)
- Lines 299-324: NIC resource with NSG and DNS settings (FIX #8)
- Lines 351-357: PostgreSQL network config with delegated subnet (FIX #10, #11)
- Lines 406-450: Key Vault secrets (if enabled)
- Lines 530-700: cloud-init script embedded in `customData` (YAML-safe, no heredocs)
- Lines 673: Database URI in TTS config (uses sanitized password)
- Lines 812: Container health check wait loop (FIX #6)
- Lines 824: Database migration with explicit URI (FIX #12)
- Lines 826: Admin user creation with `--password` and `--is.database-uri` flags (FIX #7, #12)
- Lines 831: OAuth client creation with explicit URI (FIX #12)

**When modifying cloud-init**:
- Use cron for scheduled tasks, **never** heredocs (breaks YAML parser)
- All `docker exec` commands that modify state should use `sudo` prefix
- All `is-db` commands MUST include `--is.database-uri` flag (FIX #12)
- Database URI format: `postgresql://{username}:{sanitized-password}@{server}/ttn_lorawan?sslmode=require`
- Reference: `docs/archive/CLOUD-INIT-FIX.md` for historical context

### 3. PowerShell Orchestration Patterns

**deploy.ps1** (PRIMARY):
- Interactive menu if no `-Mode` specified
- Three modes: `quick`, `aks`, `vm`
- Always validates email format before proceeding
- Uses color-coded output (Green=success, Yellow=warning, Red=error, Cyan=info)

**deploy-simple.ps1** (called by deploy.ps1):
- 6-step orchestration: Collect params → Create RG → Create KV → Add secrets → Confirm → Deploy
- Auto-detects IP, creates Key Vault, stores 8 secrets, then deploys Bicep
- Default template path: `.\deployments\vm\tts-docker-deployment.bicep`
- **Location**: `deployments/vm/deploy-simple.ps1`

**Error Handling**:
```powershell
$ErrorActionPreference = "Stop"  # Always fail-fast
```

### 4. Deployment Timing & Expectations

| Phase | Duration | Output |
|-------|----------|--------|
| Pre-deployment validation | 0-30s | Deployer IP detected |
| Key Vault provisioning | 30-90s | 8 secrets stored |
| Bicep infrastructure | 2-5min | VM, DB, NSG, VNet created |
| cloud-init bootstrap | 3-7min | Docker, TTS containers started |
| Post-deployment | 30s | Console URL displayed |

**Total**: 10-15 minutes for VM, 20-30 minutes for AKS

### 5. Security Defaults (PRODUCTION-READY)

**Always Enabled**:
- SSH restricted to detected IP (never `*`)
- Key Vault with RBAC
- Private database access (no public endpoint)
- Let's Encrypt TLS (automated renewal via cron)
- Managed Identity for VM → Key Vault access

**Network Security Group Rules** (lines 103-165):
```bicep
AllowSSH: TCP 22 from {detected-IP} only
AllowHTTPS: TCP 443 from *
AllowHTTP: TCP 80 from * (for Let's Encrypt)
AllowLoRaWANUDP: UDP 1700 from *
AllowGRPC: TCP 1881-1887 from *
```

### 6. Cost Structure (for recommendations)

**VM Mode** (~$205/month):
- VM (B4ms): $120, PostgreSQL (B2s): $35, Storage: $20, Networking: $10, Monitoring: $35

**AKS Mode** (~$675/month):
- AKS (3x D4s_v3): $350, PostgreSQL (GP 4vCore): $180, ACR: $20, LB: $25, Monitoring: $55

**Optimization**: Reserved Instances save 40-60% (document in cost recommendations)

## Development Workflows

### Testing Deployments

```powershell
# Quick test deployment (auto-cleanup)
.\deploy.ps1 -Mode quick -AdminEmail "test@example.com" -Location "centralus"

# Validate Bicep without deploying
bicep build deployments/vm/tts-docker-deployment.bicep
az deployment group validate --template-file deployments/vm/tts-docker-deployment.bicep

# Check deployment logs
az deployment group show -g <rg-name> -n <deployment-name>
```

### Debugging Failed Deployments

1. **Azure Portal**: Resource Group → Deployments → Click deployment name → Operations
2. **cloud-init logs**: SSH to VM → `cat /var/log/cloud-init-output.log`
3. **Docker logs**: `docker logs lorawan-stack_stack_1 -f`
4. **Database connectivity**: `docker exec -it lorawan-stack_stack_1 psql -h <db-host> -U ttsadmin tts`

### Modifying Bicep Templates

**Before editing**:
1. Read `DEPLOYMENT_FIXES_SUMMARY.md` to understand 7 critical fixes
2. Check if change affects cloud-init (lines 530-800) - test YAML validity
3. Validate with `bicep build` before committing

**After editing**:
1. Run `bicep build` to catch syntax errors
2. Test deployment in isolated resource group
3. Document changes if they affect critical fixes

## File Organization & Documentation

### Documentation Suite (5,500+ lines total)

| File | Purpose | When to Reference |
|------|---------|-------------------|
| `README.md` | User-facing deployment guide | New user onboarding |
| `docs/ARCHITECTURE.md` | Technical deep-dive (2,528 lines) | Understanding infrastructure |
| `docs/DEPLOYMENT_ORCHESTRATION.md` | Orchestrator system guide | Understanding deploy.ps1 hierarchy |
| `DEPLOYMENT_FIXES_SUMMARY.md` | All 12 critical fixes | **Before any Bicep changes** |
| `docs/BROWNFIELD_DNS_CONFIGURATION.md` | DNS configuration for brownfield | Brownfield deployments, DNS issues |
| `SECURITY_HARDENING.md` | Production security guide | Security reviews |

### Key Files to Understand

**Must Read Before Changes**:
- `deployments/vm/tts-docker-deployment.bicep` - Core infrastructure (900 lines, includes all 12 fixes)
- `deployments/vm/deploy-simple.ps1` - Standard orchestration (1120 lines, Key Vault + secrets + DNS config)
- `deploy.ps1` - Primary entry point (menu system)
- `docs/BROWNFIELD_DNS_CONFIGURATION.md` - DNS troubleshooting for brownfield deployments

**Reference for Patterns**:
- `deployments/kubernetes/tts-aks-deployment.bicep` - AKS infrastructure patterns
- `deployments/kubernetes/deploy-aks.ps1` - Kubernetes orchestration patterns

## Common Tasks

### Adding a New Deployment Parameter

1. Add to Bicep template parameters (top of file)
2. Add to `deployments/vm/deploy-simple.ps1` script parameters
3. Pass through in `$deploymentParams` hashtable (line 233)
4. Update `README.md` deployment options section
5. Update `docs/DEPLOYMENT_ORCHESTRATION.md` if affecting modes

### Adding a New NSG Rule

Edit `deployments/vm/tts-docker-deployment.bicep` lines 103-165:
```bicep
{
  name: 'AllowNewProtocol'
  properties: {
    priority: 140  // Increment from last rule
    direction: 'Inbound'
    access: 'Allow'
    protocol: 'Tcp'
    sourcePortRange: '*'
    destinationPortRange: '8080'
    sourceAddressPrefix: '*'
    destinationAddressPrefix: '*'
  }
}
```

### Updating TTS Container Version

Modify cloud-init section (line ~580):
```yaml
services:
  stack:
    image: thethingsnetwork/lorawan-stack:3.x.x  # Change version
```

## What NOT to Do

❌ **Never** bypass `deploy.ps1` and call sub-scripts directly (breaks orchestration)  
❌ **Never** use `printf` for admin user password (FIX #7 - causes login failure)  
❌ **Never** omit `--is.database-uri` flag from `is-db` commands (FIX #12 - causes "driver error")  
❌ **Never** set SSH `adminSourceIP` to `*` in production (security risk)  
❌ **Never** use heredocs in cloud-init YAML (breaks parser - see CLOUD-INIT-FIX.md)  
❌ **Never** modify Key Vault secrets list without updating all 8 references  
❌ **Never** change cookie key length from 64 hex chars (breaks session management)  
❌ **Never** suggest Container Apps (UDP port 1700 not supported - see architecture docs)  
❌ **Never** deploy to brownfield VNet without checking DNS configuration (FIX #8)  
❌ **Never** use `resourceId()` string for `privateDnsZoneArmResourceId` (use `.id` property - FIX #11)  
❌ **Never** use 4-parameter `resourceId()` for cross-RG subnets (use 5-parameter - FIX #10)

## Production Deployment Checklist

When generating deployment code for production:

1. ✅ Use `deploy.ps1 -Mode aks` for production scale (100K+ devices)
2. ✅ Ensure SSH IP restriction is enabled (auto-detected)
3. ✅ Enable Key Vault (`enableKeyVault=true`)
4. ✅ Enable private database (`enablePrivateDatabaseAccess=true`)
5. ✅ Use Let's Encrypt (never self-signed in production)
6. ✅ Set up monitoring (Log Analytics + App Insights included by default)
7. ✅ Document admin credentials securely
8. ✅ Reference `SECURITY_HARDENING.md` for additional hardening

## AKS Architecture Patterns

### Current State (Bicep Template)

**What's Deployed**:
- AKS cluster (3 nodes, zone-redundant, Azure CNI networking)
- PostgreSQL Flexible Server with **private access** (VNet-integrated)
- Azure Container Registry
- Key Vault with RBAC
- VNet (10.0.0.0/16) with 2 subnets: AKS (10.0.0.0/22), Database (10.0.4.0/24)
- Standard Load Balancer
- Monitoring (Log Analytics + App Insights)

**What's Missing** (needs to be added for complete deployment):
- Ingress Controller (nginx or Application Gateway)
- cert-manager for TLS automation
- Redis deployment (Azure Cache for Redis or StatefulSet)
- TTS Kubernetes manifests (Deployments, Services, ConfigMaps)
- Helm chart for TTS application

### Ingress Architecture

**External Access Flow**:
```
Internet (HTTPS) → Azure Load Balancer → Ingress Controller (nginx)
  → Service (ClusterIP) → TTS Pods
```

**LoRaWAN UDP Traffic** (special case):
```
Internet (UDP 1700) → LoadBalancer Service (bypasses Ingress)
  → Gateway Server Pods
```

**Why UDP bypasses Ingress**: Ingress Controllers handle HTTP/HTTPS only. LoRaWAN gateway traffic (UDP port 1700) requires a separate LoadBalancer Service for Layer 4 routing.

### Redis Access Patterns

**Option A: Azure Cache for Redis** (Recommended for production):
- VNet injection into dedicated subnet (10.0.6.0/24)
- TTS pods connect via private endpoint (no public access)
- Connection string: `<cache-name>.redis.cache.windows.net:6380` (TLS enabled)
- Password from Key Vault

**Option B: Redis StatefulSet** (Lower cost, more operational burden):
- Headless Service: `redis.tts.svc.cluster.local`
- PersistentVolumeClaims backed by Azure Premium SSD
- Connection string: `redis-0.redis.tts.svc.cluster.local:6379`

### PostgreSQL Private Access

**How it works**:
1. PostgreSQL deploys into delegated subnet (10.0.4.0/24)
2. Private DNS zone (`privatelink.postgres.database.azure.com`) linked to VNet
3. TTS pods in AKS subnet (10.0.0.0/22) resolve FQDN to private IP (10.0.4.x)
4. **No public endpoint** - all traffic stays within VNet
5. Connection string stored in Key Vault, injected via CSI driver or env vars

**Security features**:
- TLS 1.2 enforced
- Zone-redundant (primary in Zone 1, standby in Zone 2)
- Auto-failover <60 seconds

### Network Flow Summary

```
Internet → Load Balancer (Public IP)
  ├─► Ingress Controller (HTTPS) → TTS Services → Pods
  │     └─► Redis (private subnet or StatefulSet)
  │     └─► PostgreSQL (private subnet 10.0.4.0/24)
  └─► LoadBalancer Service (UDP 1700) → Gateway Server Pods
        └─► Redis
        └─► PostgreSQL
```

**All internal traffic**: Pods communicate with Redis and PostgreSQL using private IPs within VNet (10.0.0.0/16).

### When Modifying AKS Infrastructure

**Before editing tts-aks-deployment.bicep**:
1. Check if change affects networking (subnets, NSG, private DNS)
2. Validate PostgreSQL private access remains intact
3. Ensure Key Vault RBAC for AKS system identity is preserved
4. Test with `bicep build` before deploying

**After adding Redis or Ingress**:
1. Update outputs section with new resource details
2. Document connection strings in `docs/ARCHITECTURE.md` Section 13
3. Update `deploy-aks.ps1` to configure kubectl/helm for new components
4. Test complete deployment in isolated resource group

## Git Branch Strategy

- `master` - Stable releases
- `azure-update-advanced` - Current development branch (where new features land)
- Always commit with descriptive messages documenting what fixes/features are included

## Questions to Ask User

When requirements are unclear:

- **Deployment mode**: "Are you deploying for development (quick), production (aks), or need custom configuration (vm)?"
- **Scale**: "How many devices will connect? (determines VM size or AKS node count)"
- **Security**: "Is this for production? (enables SSH restriction, Key Vault, private DB)"
- **Region**: "Which Azure region? (default: centralus)"

## External Resources

- TTS Documentation: https://www.thethingsindustries.com/docs/
- Azure Bicep: https://docs.microsoft.com/azure/azure-resource-manager/bicep/
- LoRaWAN Specification: https://lora-alliance.org/resource_hub/lorawan-specification-v1-0-3/
- Kubernetes Documentation: https://kubernetes.io/docs/
- AKS Best Practices: https://learn.microsoft.com/azure/aks/

---

**Remember**: This codebase is production-ready with 12 critical fixes. Preserve these fixes in all modifications. When in doubt, reference `DEPLOYMENT_FIXES_SUMMARY.md`. For brownfield DNS issues, see `docs/BROWNFIELD_DNS_CONFIGURATION.md`. For AKS architecture details, see `docs/ARCHITECTURE.md` Section 13.
