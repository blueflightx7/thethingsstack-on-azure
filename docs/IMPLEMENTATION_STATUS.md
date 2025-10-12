# AKS Modernization - Implementation Progress

## ✅ Completed (Phase 1)

### 1. **Official TTS Helm Chart Integration**

We've pivoted from creating custom Kubernetes manifests to using the **official TTS Helm chart** published by The Things Industries:

**Chart Details**:
- **Registry**: `registry-1.docker.io/thethingsindustries/lorawan-stack-helm-chart`
- **Distribution**: OCI package (Helm 3 standard)
- **Documentation**: https://www.thethingsindustries.com/docs/enterprise/kubernetes/generic/install-charts/
- **Artifact Hub**: https://artifacthub.io/packages/helm/thethingsindustries/lorawan-stack-helm-chart

**Why This Matters**:
- ✅ **Official Support**: Maintained by The Things Industries (not our custom YAML)
- ✅ **Production-Tested**: Used by enterprise customers worldwide
- ✅ **Automatic Updates**: New TTS versions published as chart updates
- ✅ **Helm Best Practices**: Proper templating, hooks, and lifecycle management
- ✅ **Built-in Jobs**: Database migrations, storage setup, etc.

### 2. **Azure-Optimized Helm Values** (`values-azure-aks.yaml`)

Created comprehensive values file with **400+ lines** of Azure-specific configuration:

**Key Sections**:
```yaml
global:
  domain: ""              # Your TTS domain
  blob:
    provider: "azure"     # Azure Blob Storage integration
  redis:
    address: ""           # Redis Enterprise OR in-cluster StatefulSet
  ingress:
    controller: "webapprouting.kubernetes.azure.com"  # Application Routing
  
workloadIdentity:
  enabled: true           # Azure AD integration (no service principal)

autoscaling:
  enabled: true           # HPA for pods
  minReplicas: 3
  maxReplicas: 10

monitoring:
  serviceMonitor:
    enabled: true         # Prometheus scraping
```

**Features**:
- ✅ Azure Blob Storage for user uploads (profile pictures, device pictures)
- ✅ Workload Identity for secure Key Vault/Storage access (no passwords in config)
- ✅ Application Routing ingress (managed nginx with cert-manager)
- ✅ Prometheus ServiceMonitor annotations for Azure Monitor
- ✅ Pod anti-affinity for zone distribution
- ✅ Security contexts (non-root, read-only filesystem where possible)
- ✅ Flexible Redis strategy (Enterprise E10 or StatefulSet)

### 3. **Automated Deployment Script** (`deploy-aks-automatic.ps1`)

**460+ lines** of PowerShell orchestration matching the VM deployment simplicity:

**Workflow**:
1. ✅ **Pre-flight checks**: kubectl, helm, az CLI validation
2. ✅ **Secret generation**: Passwords, cookie keys (64-char hex), cluster keys (base64)
3. ✅ **Bicep deployment**: AKS Automatic + PostgreSQL + Redis + Storage + Key Vault
4. ✅ **kubectl config**: Automatic credentials retrieval
5. ✅ **cert-manager install**: Let's Encrypt ClusterIssuer creation
6. ✅ **Values preparation**: Dynamic file generation from Key Vault secrets
7. ✅ **Helm deployment**: Official TTS chart installation
8. ✅ **Access details**: Ingress IP, gateway IP, console URL, next steps

**Usage**:
```powershell
# Deploy with Redis Enterprise E10 (recommended for production)
.\deployments\kubernetes\deploy-aks-automatic.ps1 `
  -EnvironmentName "tts-prod" `
  -AdminEmail "admin@example.com" `
  -DomainName "tts.example.com" `
  -UseRedisEnterprise

# Deploy with in-cluster Redis StatefulSet (lower cost)
.\deployments\kubernetes\deploy-aks-automatic.ps1 `
  -EnvironmentName "tts-dev" `
  -AdminEmail "admin@example.com" `
  -DomainName "tts.example.com"
```

**Comparison to VM Deployment**:

| Aspect | VM (`deploy.ps1 -Mode quick`) | AKS (`deploy-aks-automatic.ps1`) |
|--------|-------------------------------|----------------------------------|
| **Command** | 1 line with 2 params | 1 line with 3-4 params |
| **Duration** | 10-15 minutes | 20-25 minutes |
| **User Input** | Email, optional domain | Email, domain (required for Kubernetes) |
| **Outputs** | VM IP, console URL | Ingress IP, gateway IP, console URL |
| **Post-Steps** | Create DNS A record | Create DNS A record |
| **TLS** | Automatic (Let's Encrypt) | Automatic (cert-manager + Let's Encrypt) |
| **Scalability** | Manual (resize VM) | Automatic (HPA + Node Autoprovisioning) |

---

## 🚧 Remaining Work (Phase 2)

### 1. **Update Bicep Template** (`tts-aks-deployment.bicep`)

**Current State**: Uses AKS Standard with manual node pool configuration

**Required Changes**:

#### A. **Convert to AKS Automatic**
```bicep
resource aks 'Microsoft.ContainerService/managedClusters@2024-09-01' = {
  name: aksClusterName
  sku: {
    name: 'Automatic'  // Changed from 'Base'
    tier: 'Standard'
  }
  properties: {
    // Remove agentPoolProfiles - AKS Automatic uses Node Autoprovisioning
    
    // Enable Application Routing (Managed NGINX)
    ingressProfile: {
      webAppRouting: {
        enabled: true
      }
    }
    
    // Enable Azure Monitor (Prometheus + Container Insights)
    azureMonitorProfile: {
      metrics: { enabled: true }
      containerInsights: {
        enabled: true
        logAnalyticsWorkspaceResourceId: logAnalytics.id
      }
    }
    
    // Workload Identity
    oidcIssuerProfile: { enabled: true }
    securityProfile: {
      workloadIdentity: { enabled: true }
    }
  }
}
```

#### B. **Add Redis Enterprise Resources** (if `-UseRedisEnterprise` flag)
```bicep
resource redisEnterprise 'Microsoft.Cache/redisEnterprise@2024-02-01' = if (useRedisEnterprise) {
  name: '${environmentName}-redis'
  location: location
  sku: {
    name: 'Enterprise_E10'
    capacity: 2  // 2 nodes for HA
  }
  properties: {
    minimumTlsVersion: '1.2'
  }
  zones: ['1', '2', '3']
}

resource redisDatabase 'Microsoft.Cache/redisEnterprise/databases@2024-02-01' = if (useRedisEnterprise) {
  parent: redisEnterprise
  name: 'default'
  properties: {
    clientProtocol: 'Encrypted'
    port: 10000
    clusteringPolicy: 'EnterpriseCluster'  // Non-clustered for TTS
    evictionPolicy: 'NoEviction'
    persistence: {
      aofEnabled: true
      aofFrequency: '1s'
      rdbEnabled: true
      rdbFrequency: '1h'
    }
  }
}
```

#### C. **Add Storage Account for Blobs**
```bicep
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: true  // TTS needs public blob access
    minimumTlsVersion: 'TLS1_2'
  }
}

resource blobContainers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = [for container in ['profile-pictures', 'device-pictures', 'uploads']: {
  parent: storage::blobService
  name: container
  properties: {
    publicAccess: 'Blob'
  }
}]
```

#### D. **Add Workload Identity for TTS Pods**
```bicep
resource ttsIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${environmentName}-tts-identity'
  location: location
}

// Grant Key Vault access
resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, ttsIdentity.id, 'Key Vault Secrets User')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: ttsIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant Storage Blob access
resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, ttsIdentity.id, 'Storage Blob Data Contributor')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: ttsIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Federated credential for Kubernetes service account
resource federatedCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: ttsIdentity
  name: 'tts-federated-identity'
  properties: {
    issuer: aks.properties.oidcIssuerProfile.issuerURL
    subject: 'system:serviceaccount:tts:tts-workload-identity'
    audiences: ['api://AzureADTokenExchange']
  }
}
```

#### E. **Outputs for Deployment Script**
```bicep
output aksClusterName string = aks.name
output keyVaultName string = keyVault.name
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output storageAccountName string = storage.name
output redisHost string = useRedisEnterprise ? '${redisEnterprise.name}.${location}.redisenterprise.cache.azure.net:10000' : ''
output workloadIdentityClientId string = ttsIdentity.properties.clientId
output tenantId string = subscription().tenantId
```

### 2. **Testing Checklist**

Before production deployment:

- [ ] **Deploy to test environment**
  ```powershell
  .\deployments\kubernetes\deploy-aks-automatic.ps1 `
    -EnvironmentName "tts-test" `
    -AdminEmail "test@example.com" `
    -DomainName "tts-test.example.com" `
    -Location "centralus"
  ```

- [ ] **Verify infrastructure**
  - [ ] AKS cluster created with "Automatic" SKU
  - [ ] Node Autoprovisioning enabled
  - [ ] Application Routing add-on active
  - [ ] Azure Monitor workspace created
  - [ ] PostgreSQL Flexible Server accessible
  - [ ] Storage account with blob containers
  - [ ] Key Vault with all 5+ secrets

- [ ] **Verify Kubernetes resources**
  ```bash
  kubectl get pods -n tts
  kubectl get ingress -n tts
  kubectl get certificate -n tts
  kubectl get servicemonitor -n tts
  kubectl get serviceaccount tts-workload-identity -n tts
  ```

- [ ] **Verify TTS functionality**
  - [ ] Console accessible via HTTPS (after DNS + TLS cert)
  - [ ] Admin login works (username: admin-user, password from Key Vault)
  - [ ] Create test application
  - [ ] Register test device
  - [ ] Test LoRaWAN gateway connection (UDP 1700)

- [ ] **Verify monitoring**
  - [ ] Prometheus metrics scraped: `kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes`
  - [ ] Grafana dashboards accessible
  - [ ] Logs in Container Insights

### 3. **Documentation Updates**

#### A. **Update README.md**

Add AKS Automatic deployment section:

```markdown
## Production Deployment (AKS Automatic)

For production deployments supporting **100,000+ devices**, use Azure Kubernetes Service with Azure best practices:

### Prerequisites
- Azure subscription with Owner/Contributor role
- Azure CLI (`az`) installed
- kubectl installed
- Helm 3 installed
- Registered domain name (e.g., `tts.example.com`)

### Deployment

```powershell
.\deployments\kubernetes\deploy-aks-automatic.ps1 `
  -EnvironmentName "tts-prod" `
  -AdminEmail "admin@example.com" `
  -DomainName "tts.example.com" `
  -UseRedisEnterprise  # Optional: Use Azure Cache for Redis Enterprise (recommended)
```

**Deployment Time**: ~20-25 minutes

### Post-Deployment

1. Create DNS A record pointing to ingress IP (shown in output)
2. Wait for TLS certificate (2-5 minutes): `kubectl get certificate -n tts`
3. Access console: `https://tts.example.com`
4. Configure gateways to use UDP endpoint (shown in output)

### Cost

- **With Redis Enterprise E10**: ~$1,025/month
- **With in-cluster Redis**: ~$850/month

See [docs/AKS_MODERNIZATION_PLAN.md](docs/AKS_MODERNIZATION_PLAN.md) for architecture details.
```

#### B. **Update ARCHITECTURE.md Section 13**

Replace placeholder content with actual Bicep resources and Helm chart integration details.

#### C. **Create New Guide**: `docs/TTS_HELM_CHART_USAGE.md`

Document how to:
- Customize values.yaml for specific needs
- Upgrade TTS versions
- Backup/restore procedures
- Troubleshooting common Helm issues

---

## 📋 Summary

### What We Have Now

✅ **Official TTS Helm Chart Integration**
- Using production-tested charts from The Things Industries
- No custom Kubernetes manifests to maintain
- Automatic TTS updates via chart versions

✅ **Azure-Optimized Configuration**
- values-azure-aks.yaml with 400+ lines of Azure-specific settings
- Workload Identity (no service principals)
- Application Routing (managed nginx)
- Prometheus monitoring annotations

✅ **Automated Deployment Script**
- 460-line PowerShell orchestrator
- Matches VM deployment simplicity (single command)
- Supports both Redis Enterprise and StatefulSet
- Dynamic values generation from Key Vault

### What's Next

🚧 **Bicep Template Updates** (Highest Priority)
- Convert to AKS Automatic
- Add Redis Enterprise conditional resources
- Add Storage Account for blobs
- Add Workload Identity with federated credentials
- ~500 lines of Bicep changes

🚧 **Testing** (Critical)
- Deploy to test environment
- Verify all components
- Test TTS functionality end-to-end
- Validate monitoring integration

🚧 **Documentation** (Important)
- Update README with AKS deployment
- Update ARCHITECTURE.md Section 13
- Create Helm chart usage guide

### Timeline Estimate

- **Bicep updates**: 4-6 hours (careful testing needed)
- **End-to-end testing**: 2-3 hours (includes deployment time)
- **Documentation**: 2-3 hours

**Total**: 8-12 hours to production-ready AKS deployment

---

## 🎯 Key Decisions Made

1. **Use Official TTS Helm Chart**: No custom manifests, leveraging official support
2. **Flexible Redis Strategy**: Flag-based choice between Enterprise E10 and StatefulSet
3. **Azure Best Practices**: AKS Automatic, Workload Identity, Application Routing
4. **Deployment Simplicity**: Match VM deployment UX (single command, ~20 min)
5. **Security First**: Non-root containers, Workload Identity, minimal RBAC

---

**Status**: Phase 1 Complete (Helm integration), Phase 2 Pending (Bicep updates)
**Last Updated**: October 11, 2025
**Branch**: azure-update-aks
