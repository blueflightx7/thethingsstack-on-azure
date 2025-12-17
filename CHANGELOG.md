# Changelog

All notable changes to this TTS deployment project are documented in this file.

## [2.0.0] - 2025-01-XX - AKS Production Deployment (UNRELEASED)

### Added - Phase 1: Official TTS Helm Chart Integration

**New Deployment Mode**: AKS Production (`deploy.ps1 -Mode aks`)

**New Files**:
- `deployments/kubernetes/values-azure-aks.yaml` (400+ lines) - Azure-specific Helm values
- `deployments/kubernetes/deploy-aks.ps1` (460+ lines) - AKS deployment orchestrator  
- `docs/IMPLEMENTATION_STATUS.md` (740+ lines) - Phase 1-3 progress tracking
- `docs/AKS_MODERNIZATION_PLAN.md` (1096 lines) - Modernization roadmap
- `docs/PHASE_2_COMPLETION_SUMMARY.md` (449 lines) - Phase 2 deliverables

**Features**:
- ✅ Official TTS Helm chart (`registry-1.docker.io/thethingsindustries/lorawan-stack-helm-chart`)
- ✅ Azure Blob Storage (avatars, pictures, uploads containers)
- ✅ Workload Identity (Azure AD authentication, no service principal secrets)
- ✅ Application Routing (managed nginx + cert-manager)
- ✅ Prometheus ServiceMonitor (metrics scraping)
- ✅ HPA (Horizontal Pod Autoscaler, 2-10 replicas)
- ✅ Pod anti-affinity (zone distribution)
- ✅ Security contexts (non-root, read-only filesystem)

### Added - Phase 2: CI/CD Pipelines & Script Consolidation

**New Files**:
- `azure-pipelines-dashboard.yml` - Azure DevOps pipeline for Dashboard
- `deployments/dashboard/update-dashboard.ps1` - Dashboard UI deployment script

**Dashboard Fixes (v2-web)**:
- Fixed Fluent UI v9 import issues (split packages for Card, Icons)
- Resolved NPM high-severity vulnerabilities
- Fixed SWA deployment caching issues
- Added region mapping for Static Web Apps (eastus -> eastus2)

**New Files**:
- `.azure-pipelines/tts-aks-deploy.yml` (300+ lines) - Azure DevOps pipeline
- `.github/workflows/tts-aks-deploy.yml` (275+ lines) - GitHub Actions workflow

**Changes**:
- Updated `deploy.ps1` with AKS mode, Redis selection menu, domain prompt
- Renamed `deploy-aks-automatic.ps1` → `deploy-aks.ps1` (single script)

**CI/CD Features**:
- Automated Bicep validation on every push
- Infrastructure deployment with secret management
- cert-manager + Let's Encrypt ClusterIssuer
- Dynamic Helm values from Key Vault
- Post-deployment verification

### Added - Phase 3: Bicep Template Modernization (AKS Automatic)

**Changed File**:
- `deployments/kubernetes/tts-aks-deployment.bicep` (REWRITTEN - 554 lines, +194/-87 changes)

**Infrastructure Changes**:

1. **AKS Cluster Upgrade** (Standard → Automatic):
   - API version: `2024-05-02-preview`
   - SKU: `{ name: 'Automatic', tier: 'Standard' }`
   - Node Provisioning: Auto (automatic node pool management)
   - OIDC Issuer + Workload Identity enabled
   - Application Routing (`ingressProfile.webAppRouting`)
   - Managed Prometheus (`azureMonitorProfile.metrics`)
   - Azure CNI networking with Azure dataplane

2. **New Resources**:
   - **Storage Account**: `sttts{uniqueString}` with 3 blob containers
   - **Workload Identity**: Managed Identity with federated credentials
   - **Federated Credential**: Links AKS OIDC → K8s ServiceAccount (`tts:tts`)
   - **Role Assignments**: Storage Blob Data Contributor + Key Vault Secrets User
   - **Redis Enterprise E10** (conditional): 12 GB, Redis 7.2, non-clustered, zone-redundant
   - **Redis Database**: Port 10000, AOF + RDB persistence

3. **Updated Secrets** (8 total in Key Vault):
   - `db-password`, `tts-admin-password`, `admin-email`
   - `cookie-hash-key` (64 hex chars) - NEW
   - `cookie-block-key` (64 hex chars) - NEW
   - `cluster-keys` (base64) - NEW
   - `redis-password` (conditional) - NEW
   - `checksum`

4. **Simplified Parameters** (11 → 8):
   - **Removed**: `nodeCount`, `nodeSize`, `kubernetesVersion`, `enableMonitoring`, `enableAutoScaling`, `minNodeCount`, `maxNodeCount`, `keyVaultName`, `acrName`
   - **Added**: `cookieHashKey`, `cookieBlockKey`, `clusterKeys`, `useRedisEnterprise`

5. **Updated Outputs**:
   - Added: `storageAccountName`, `workloadIdentityClientId`, `tenantId`, `redisHost` (conditional)
   - Removed: `applicationInsightsConnectionString`, `clusterInfo.nodeCount`, `clusterInfo.nodeSize`

### Changed - Documentation

**Updated Files**:
- `docs/ARCHITECTURE.md`: Reorganized with AKS as Section 2 (1,200+ new lines)
- `docs/IMPLEMENTATION_STATUS.md`: Phase 3 completion status
- `docs/AKS_MODERNIZATION_PLAN.md`: Implementation status markers
- `CHANGELOG.md`: Complete change history (this file)
- `README.md`: AKS deployment instructions (pending)

**Architecture Documentation**:
- ✅ Moved AKS from Section 13 → Section 2 (primary production deployment)
- ✅ Decision matrix (VM vs AKS)
- ✅ AKS Automatic architecture diagrams
- ✅ PostgreSQL private access flow
- ✅ Redis Enterprise E10 architecture (VNet injection, zone-redundant)
- ✅ Storage Account blob structure
- ✅ Workload Identity OIDC flow
- ✅ Application Routing traffic flows
- ✅ Network topology (10.0.0.0/16 VNet)
- ✅ Cost breakdown (~$675/month optimized)

### Infrastructure Costs

**AKS Production** (~$675/month with 3-year reserved instances):
- AKS cluster management (Standard tier): $73/month
- Compute (2-10 nodes, Standard_D4s_v3, reserved): $200/month
- PostgreSQL (Standard_D2s_v3, zone-redundant): $240/month
- Redis Enterprise E10 (12 GB, zone-redundant): $175/month
- Azure Storage (blob containers): $6/month
- Azure Container Registry (Standard): $20/month
- Load Balancer (Standard): $20/month
- Key Vault: $5/month
- Monitoring (Log Analytics): $55/month
- Networking: $20/month
- **Total**: $814/month → **$675/month** (with reserved instances)

**VM Development** (~$205/month - UNCHANGED):
- All VM deployment costs remain the same (see v1.5.0)

### AKS vs VM Comparison

| Factor | VM Development | AKS Production |
|--------|----------------|----------------|
| **Device Count** | <10,000 | 100,000+ |
| **High Availability** | ❌ Single VM | ✅ Multi-zone |
| **Cost** | ~$205/month | ~$675/month |
| **Scalability** | Vertical (resize) | Horizontal (HPA) |
| **Redis** | Container | Enterprise E10 (managed) |
| **Database HA** | Single zone | Zone-redundant |
| **TLS** | certbot cron | cert-manager |
| **Complexity** | Low | High (Kubernetes) |

### Breaking Changes

**None** - All changes scoped to AKS deployment only. VM deployments unchanged.

### Migration Path (VM → AKS)

1. Export PostgreSQL database:
   ```bash
   docker exec -i lorawan-stack_postgres_1 pg_dump -U ttsadmin tts > tts-backup.sql
   ```

2. Deploy AKS infrastructure:
   ```powershell
   .\deploy.ps1 -Mode aks -AdminEmail "admin@example.com" -DomainName "tts.example.com"
   ```

3. Import database:
   ```bash
   kubectl run -i --rm psql-client --image=postgres:15 --restart=Never -- \
     psql -h <db-host> -U ttsadmin tts < tts-backup.sql
   ```

4. Update DNS to new AKS ingress IP

5. Monitor both environments for 24-48 hours before decommissioning VM

### Known Issues

1. **Bicep Linter Warnings** (cosmetic only):
   - Lines 514, 540: `use-resource-symbol-reference` warnings
   - **Impact**: None - template builds/deploys successfully

2. **Redis Enterprise E10 Limitation**:
   - Non-clustered policy only for caches ≤25 GB
   - **Current**: 12 GB sufficient for 100K+ devices
   - **Workaround**: Use E20 tier (50 GB) if needed

### Commits (Branch: azure-update-aks)

**Phase 1**:
- 68df9e1: AKS modernization plan
- 3 commits: Helm chart integration, values, deployment script

**Phase 2**:
- 5 commits: CI/CD pipelines, script consolidation, deploy.ps1 integration

**Phase 3**:
- a96a6de: Bicep template modernization (AKS Automatic)
- 10 commits: Parameters, variables, AKS conversion, new resources, outputs

**Total**: 11 commits (68df9e1 → a96a6de)

### Testing

**Bicep Validation**:
```bash
az bicep build --file deployments/kubernetes/tts-aks-deployment.bicep
# Result: SUCCESS (2 cosmetic warnings only)
```

**Status**:
- ✅ Infrastructure provisioning tested
- ✅ Bicep template validated
- ✅ All resources deploy successfully
- ⏳ End-to-end Helm chart deployment (pending)

### References

- AKS Automatic: https://learn.microsoft.com/azure/aks/intro-aks-automatic
- Application Routing: https://learn.microsoft.com/azure/aks/app-routing
- Workload Identity: https://learn.microsoft.com/azure/aks/workload-identity-overview
- Redis Enterprise: https://learn.microsoft.com/azure/azure-cache-for-redis/cache-overview
- TTS Helm Chart: https://artifacthub.io/packages/helm/thethingsindustries/lorawan-stack-helm-chart

---

## [1.5.0] - 2025-10-11 - CURRENT VM VERSION

### Added - Fix #11: Container Readiness Wait
- Added comprehensive container readiness checks before admin user creation
- Initial 30-second wait after container start
- Readiness test loop (10 attempts × 10 seconds) using `is-db --help`
- Admin user creation retry with proper delays (5 attempts × 10 seconds)
- Total maximum initialization time: ~3 minutes
- **Impact**: Admin user now created reliably during automated deployment

### Fixed
- Admin user creation now succeeds during cloud-init (not just manual creation)
- Eliminated "password did not match" errors
- Deployment fully automated - no manual post-deployment steps required

## [1.4.0] - 2025-10-10

### Fixed - Fix #10 Corrected: Password Confirmation
- Changed from `echo -e '{9}\n{9}'` to `printf '%s\n%s\n' '{9}' '{9}'`
- Fixed shell escape sequence interpretation issue
- Password confirmation now works in Bicep format strings

### Known Issues (Resolved in 1.5.0)
- Admin user creation still failed during deployment
- Worked when manually executed after deployment

## [1.3.0] - 2025-10-10

### Added - Fix #10 (Initial Attempt - FAILED)
- Attempted to fix password confirmation with `echo -e '{9}\n{9}'`
- Did not work due to single-quote escape issue

### Known Issues (Fixed in 1.4.0)
- Single quotes prevented `\n` interpretation
- "password did not match" errors persisted

## [1.2.0] - 2025-10-09

### Added - Fixes #6-9
- **Fix #6**: Database config path - Always use `/config/tts.yml`
- **Fix #7**: Console API base URLs - Correct domain references
- **Fix #8**: OAuth single redirect URI - Proper OAuth flow
- **Fix #9**: Retry logic for timing issues - Robust initialization

### Improved
- More reliable database initialization
- Better error handling with retries
- Proper OAuth client creation

## [1.1.0] - 2025-10-08

### Added - Fixes #1-5
- **Fix #1**: PostgreSQL password validation - Alphanumeric only
- **Fix #2**: Database username synchronization - Consistent everywhere
- **Fix #3**: Cookie block key length - Exactly 64 characters
- **Fix #4**: PostgreSQL server state check - Wait for readiness
- **Fix #5**: Admin email validation - Proper format enforcement

### Improved
- Database connection reliability
- TTS startup stability
- Configuration consistency

## [1.0.0] - 2025-10-07

### Initial Release
- Basic TTS deployment on Azure
- Docker-based deployment
- PostgreSQL Flexible Server
- Manual post-deployment steps required
- SSL certificate generation
- Basic networking and security

### Known Issues (Fixed in subsequent versions)
- Required manual admin user creation
- Required manual OAuth client creation
- Database connection issues
- Timing-related failures
- Configuration inconsistencies

---

## Migration Guide

### From 1.0.0 to 1.5.0

If you have deployments from version 1.0.0:

1. **No migration needed** - Just redeploy with new template
2. **Manual cleanups** will be automated in new deployments
3. **Existing deployments** can continue to run but won't have auto-fixes

### What Changed

**Removed Manual Steps:**
- ❌ No longer need to SSH and create admin user manually
- ❌ No longer need to create OAuth client manually
- ❌ No longer need to restart containers manually

**New Automated Steps:**
- ✅ Admin user created automatically during deployment
- ✅ OAuth client created automatically during deployment
- ✅ All initialization retried automatically on failure
- ✅ Container readiness verified before proceeding

## Future Roadmap

### Planned Features
- [ ] Azure Container Instances deployment option
- [ ] Azure Kubernetes Service (AKS) deployment
- [ ] Let's Encrypt certificate automation
- [ ] Custom domain with Azure DNS
- [ ] Multi-region deployment
- [ ] Automated backup configuration
- [ ] Prometheus metrics export
- [ ] Grafana dashboard templates

### Under Consideration
- [ ] Azure Application Gateway integration
- [ ] Azure Front Door CDN
- [ ] Azure Firewall integration
- [ ] Private Link for all services
- [ ] Azure Monitor alerting
- [ ] Cost optimization recommendations

## Version Support

| Version | Status | Support End Date |
|---------|--------|------------------|
| 1.5.0 | Current | - |
| 1.4.0 | Superseded | 2025-10-11 |
| 1.3.0 | Superseded | 2025-10-10 |
| 1.2.0 | Deprecated | 2025-10-09 |
| 1.1.0 | Deprecated | 2025-10-08 |
| 1.0.0 | Deprecated | 2025-10-07 |

## Breaking Changes

### 1.5.0
- None (fully backward compatible)

### 1.4.0
- None (fully backward compatible)

### 1.3.0
- None (fully backward compatible)

### 1.2.0
- Changed OAuth client creation to use single redirect URI
- May affect existing OAuth configurations

### 1.1.0
- Changed database password generation (alphanumeric only)
- May require redeployment if using special characters

### 1.0.0
- Initial release

## Upgrade Instructions

### To Upgrade to Latest Version

1. **Backup existing data** (if applicable):
   ```bash
   ssh ttsadmin@<vm-ip>
   sudo docker exec lorawan-stack_stack_1 pg_dump -U ttsadmin ttn_lorawan > backup.sql
   ```

2. **Deploy new version**:
   ```powershell
   .\deployments\vm\deploy-simple.ps1 -AdminEmail "your-email@example.com"
   ```

3. **Restore data** (if needed):
   ```bash
   cat backup.sql | sudo docker exec -i lorawan-stack_stack_1 psql -U ttsadmin ttn_lorawan
   ```

## Bug Fixes by Version

### 1.5.0
- Fixed: Admin user not created during deployment
- Fixed: Container readiness not properly checked
- Fixed: Timing issues in cloud-init

### 1.4.0
- Fixed: Password confirmation escape sequence issue
- Fixed: printf vs echo behavior in cloud-init

### 1.3.0
- Attempted fix for password confirmation (unsuccessful)

### 1.2.0
- Fixed: OAuth redirect URI mismatch
- Fixed: Console API URLs incorrect
- Fixed: Database config path wrong
- Fixed: Timing issues in initialization

### 1.1.0
- Fixed: PostgreSQL password rejection
- Fixed: Database username inconsistency
- Fixed: Cookie key length validation
- Fixed: PostgreSQL not ready before connection
- Fixed: Invalid email format allowed

### 1.0.0
- Initial bugs documented in FIXES.md

## Contributors

This project incorporates fixes and improvements discovered through:
- Deployment testing and validation
- User feedback
- Azure best practices
- The Things Stack community input

## License

See LICENSE file for details.
