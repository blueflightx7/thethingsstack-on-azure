# AKS Deployment Modernization Plan

## 🎯 Executive Summary

**Current State**: Our AKS deployment uses **AKS Standard** with manual configuration.

**Target State**: Modernize to **AKS Automatic** with Azure-managed services matching The Things Stack official architecture patterns, scaled for production.

**Key Gap**: The current deployment (`tts-aks-deployment.bicep`) doesn't match the simple/quick VM deployment experience at scale. We need to:
1. Use **AKS Automatic** (Azure's modern, production-ready Kubernetes)
2. Implement **managed ingress** (Application Routing add-on with nginx)
3. Use **Azure Monitor managed Prometheus** (not self-hosted)
4. Build & push TTS container images to **Azure Container Registry**
5. Match The Things Stack's official Kubernetes architecture (adapted for Azure best practices)

---

## 📚 Reference Architecture Sources

### 1. **Azure AKS Automatic** (Microsoft Best Practice - November 2025)
Source: https://learn.microsoft.com/en-us/azure/aks/intro-aks-automatic

**Key Features (Preconfigured)**:
- **Managed Prometheus** for metrics (built-in, no manual setup)
- **Container Insights** for log collection (automatic)
- **Managed NGINX** via Application Routing add-on (ingress included)
- **Azure CNI Overlay with Cilium** (high-performance networking + security)
- **Managed NAT Gateway** for egress
- **Node Autoprovisioning** (automatic node scaling based on workload)
- **Horizontal Pod Autoscaler (HPA)**, **KEDA**, **VPA** (all enabled)
- **Azure Linux** OS (optimized for containers)
- **Standard tier** with 5,000 node support + uptime SLA
- **Automatic cluster upgrades** with maintenance windows
- **Azure RBAC for Kubernetes** authorization
- **Workload Identity** with Entra ID
- **Deployment safeguards** via Azure Policy
- **Image cleaner** for vulnerability removal

**Cost Impact**: Standard tier (~$73/month cluster management fee) + compute

### 2. **The Things Stack Official Azure Kubernetes Architecture**
Source: https://www.thethingsindustries.com/docs/enterprise/kubernetes/azure/architecture/

**Key Architectural Decisions**:
- **PostgreSQL**: Azure Database for PostgreSQL Flexible Server ✅ (matches our current design)
- **Redis**: **In-cluster deployment** (NOT Azure Cache for Redis)
  - Reason: Azure Cache max version is 6.0, TTS requires 6.2+
  - Azure Managed Redis supports 7.x but only in clustered mode (TTS incompatible)
  - **Solution**: Deploy Redis as StatefulSet in AKS
- **Networking**: Virtual Network with NAT Gateway for egress
- **Load Balancer**: Internal LB for incoming traffic, static Public IP
- **Storage**: Azure Storage Containers for user uploads (profile pictures, device images)
- **Configuration**: Terraform + Helm (we'll use Bicep + Helm)

**Critical Insight**: The Things Stack officially uses **in-cluster Redis** for Azure deployments, not managed service.

---

## 🔄 What Needs to Change

### Current Deployment vs. Modern Architecture

| Component | Current (tts-aks-deployment.bicep) | Modern Target (AKS Automatic) |
|-----------|-----------------------------------|-------------------------------|
| **Cluster Type** | AKS Standard | **AKS Automatic** |
| **Ingress** | ❌ Not deployed | ✅ Managed NGINX (Application Routing) |
| **Monitoring** | Log Analytics + App Insights (manual) | ✅ Managed Prometheus + Container Insights (automatic) |
| **Networking** | Azure CNI (manual config) | ✅ Azure CNI Overlay + Cilium (preconfigured) |
| **Redis** | ❌ Not deployed | ✅ StatefulSet (in-cluster, Redis 7.x) |
| **TTS Images** | ❌ No build pipeline | ✅ ACR Tasks (automated builds) |
| **TLS Certificates** | ❌ Not configured | ✅ cert-manager + Let's Encrypt (via Application Routing) |
| **Autoscaling** | Manual node scaling | ✅ Node Autoprovisioning + HPA/KEDA/VPA |
| **Security** | Basic NSG | ✅ Deployment safeguards + Image cleaner |
| **Node OS** | Ubuntu (default) | ✅ Azure Linux (optimized) |
| **Egress** | Azure Load Balancer | ✅ Managed NAT Gateway |

---

## 🏗️ New Architecture Design

### Infrastructure Components (Bicep)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AKS AUTOMATIC CLUSTER                           │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Managed Virtual Network (Azure CNI Overlay + Cilium)      │     │
│  │  Service CIDR: 10.1.0.0/16                                 │     │
│  │  Pod CIDR: 10.244.0.0/16                                   │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Node Autoprovisioning (2-10 nodes, Standard_D4s_v3)       │     │
│  │  OS: Azure Linux                                           │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Application Routing Add-on (Managed NGINX Ingress)        │     │
│  │  ├─► HTTPS (443) → TTS Console, API                        │     │
│  │  └─► HTTP (80) → Let's Encrypt validation                  │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  TTS Workloads (Deployments)                               │     │
│  │  ├─► tts-server (3 replicas)                               │     │
│  │  ├─► tts-console (2 replicas)                              │     │
│  │  ├─► tts-gateway-server (3 replicas)                       │     │
│  │  └─► tts-network-server (3 replicas)                       │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Redis StatefulSet (in-cluster)                            │     │
│  │  ├─► Redis 7.2 (3 replicas with persistence)               │     │
│  │  └─► PersistentVolumeClaims (Azure Premium SSD)            │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Monitoring (Automatic)                                    │     │
│  │  ├─► Managed Prometheus (metrics)                          │     │
│  │  ├─► Container Insights (logs)                             │     │
│  │  └─► Managed Grafana (visualization)                       │     │
│  └────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                               │
│                                                                     │
│  ┌────────────────────────────────────┐                             │
│  │  PostgreSQL Flexible Server        │                             │
│  │  ├─► Zone-redundant (Zones 1, 2)   │                             │
│  │  ├─► Private VNet integration      │                             │
│  │  └─► Version: PostgreSQL 15        │                             │
│  └────────────────────────────────────┘                             │
│                                                                     │
│  ┌────────────────────────────────────┐                             │
│  │  Azure Container Registry (ACR)    │                             │
│  │  ├─► Premium tier (geo-replication)│                             │
│  │  ├─► ACR Tasks (auto-build on push)│                             │
│  │  └─► Vulnerability scanning        │                             │
│  └────────────────────────────────────┘                             │
│                                                                     │
│  ┌────────────────────────────────────┐                             │
│  │  Azure Key Vault                   │                             │
│  │  ├─► Workload Identity integration │                             │
│  │  └─► CSI Driver for secret mounting│                             │
│  └────────────────────────────────────┘                             │
│                                                                     │
│  ┌────────────────────────────────────┐                             │
│  │  Azure Storage Account             │                             │
│  │  └─► Blob containers (user uploads)│                             │
│  └────────────────────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     NETWORKING                                      │
│                                                                     │
│  ┌────────────────────────────────────┐                             │
│  │  Managed NAT Gateway (egress)      │                             │
│  │  └─► Public IP Prefix              │                             │
│  └────────────────────────────────────┘                             │
│                                                                     │
│  ┌────────────────────────────────────┐                             │
│  │  Azure Load Balancer (Standard)    │                             │
│  │  ├─► Public IP (HTTPS ingress)     │                             │
│  │  └─► UDP 1700 (LoRaWAN gateways)   │                             │
│  └────────────────────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Implementation Plan

### Phase 1: Update Bicep Template → AKS Automatic

**File**: `deployments/kubernetes/tts-aks-deployment.bicep`

**Changes Required**:

1. **Replace AKS Standard with AKS Automatic**:
```bicep
resource aks 'Microsoft.ContainerService/managedClusters@2024-09-01' = {
  name: aksClusterName
  location: location
  sku: {
    name: 'Automatic'
    tier: 'Standard'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    // AKS Automatic handles node pools automatically
    // No agentPoolProfiles needed
    
    // Enable Application Routing (Managed NGINX Ingress)
    ingressProfile: {
      webAppRouting: {
        enabled: true
        dnsZoneResourceIds: [dnsZone.id] // Optional: for custom domain
      }
    }
    
    // Azure Monitor (Prometheus + Container Insights)
    azureMonitorProfile: {
      metrics: {
        enabled: true
        kubeStateMetrics: {
          metricLabelsAllowlist: ''
          metricAnnotationsAllowList: ''
        }
      }
      containerInsights: {
        enabled: true
        logAnalyticsWorkspaceResourceId: logAnalytics.id
      }
    }
    
    // Workload Identity (replaces pod identity)
    oidcIssuerProfile: {
      enabled: true
    }
    securityProfile: {
      workloadIdentity: {
        enabled: true
      }
    }
  }
}
```

2. **Add Azure Monitor Workspace** (for Prometheus):
```bicep
resource azureMonitorWorkspace 'Microsoft.Monitor/accounts@2023-04-03' = {
  name: '${environmentName}-prometheus'
  location: location
}

// Link to Managed Grafana
resource grafana 'Microsoft.Dashboard/grafana@2023-09-01' = {
  name: '${environmentName}-grafana'
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    grafanaIntegrations: {
      azureMonitorWorkspaceIntegrations: [
        {
          azureMonitorWorkspaceResourceId: azureMonitorWorkspace.id
        }
      ]
    }
  }
}
```

3. **Remove Manual Node Pool Config** (AKS Automatic handles this):
```bicep
// DELETE: agentPoolProfiles section
// AKS Automatic uses Node Autoprovisioning
```

4. **Add Storage Account** (for user uploads):
```bicep
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS' // Or Standard_ZRS for zone redundancy
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: true // TTS needs public blob access for images
    minimumTlsVersion: 'TLS1_2'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storage
  name: 'default'
}

resource uploadContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'uploads'
  properties: {
    publicAccess: 'Blob'
  }
}
```

5. **Upgrade ACR to Premium** (for geo-replication + vulnerability scanning):
```bicep
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Premium' // Changed from Standard
  }
  properties: {
    adminUserEnabled: false // Use workload identity instead
    publicNetworkAccess: 'Enabled'
    anonymousPullEnabled: false
  }
}

// Enable vulnerability scanning
resource acrTasks 'Microsoft.ContainerRegistry/registries/tasks@2023-07-01' = {
  parent: acr
  name: 'build-tts-image'
  properties: {
    platform: {
      os: 'Linux'
      architecture: 'amd64'
    }
    step: {
      type: 'Docker'
      dockerFilePath: 'Dockerfile'
      contextPath: 'https://github.com/TheThingsNetwork/lorawan-stack.git#v3.x' // Use official TTS repo
      imageNames: [
        '${acrName}.azurecr.io/tts-stack:{{.Run.ID}}'
        '${acrName}.azurecr.io/tts-stack:latest'
      ]
    }
    trigger: {
      sourceTriggers: [
        {
          name: 'github-trigger'
          sourceRepository: {
            sourceControlType: 'Github'
            repositoryUrl: 'https://github.com/TheThingsNetwork/lorawan-stack.git'
            branch: 'v3.x'
          }
          sourceTriggerEvents: ['commit']
        }
      ]
      timerTriggers: [
        {
          name: 'daily-rebuild'
          schedule: '0 2 * * *' // Rebuild daily at 2 AM UTC
        }
      ]
    }
  }
}
```

### Phase 2: Create Kubernetes Manifests (Helm Chart)

**Directory Structure**:
```
charts/
└── thethingsstack/
    ├── Chart.yaml
    ├── values.yaml
    ├── templates/
    │   ├── _helpers.tpl
    │   ├── namespace.yaml
    │   ├── redis-statefulset.yaml
    │   ├── tts-deployment.yaml
    │   ├── tts-services.yaml
    │   ├── ingress.yaml
    │   ├── configmap.yaml
    │   ├── secrets.yaml (from Key Vault via CSI)
    │   └── servicemonitor.yaml (Prometheus scraping)
    └── README.md
```

**Key Files**:

1. **Redis StatefulSet** (`redis-statefulset.yaml`):
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: tts
spec:
  serviceName: redis
  replicas: 3
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7.2-alpine
        ports:
        - containerPort: 6379
          name: redis
        command:
        - redis-server
        - --appendonly
        - "yes"
        - --save
        - "60 1000" # Persistence: save after 60s if 1000 keys changed
        volumeMounts:
        - name: redis-data
          mountPath: /data
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          tcpSocket:
            port: 6379
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
  volumeClaimTemplates:
  - metadata:
      name: redis-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: managed-csi-premium # Azure Premium SSD
      resources:
        requests:
          storage: 20Gi
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: tts
spec:
  clusterIP: None # Headless service
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

2. **TTS Deployment** (`tts-deployment.yaml`):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tts-stack
  namespace: tts
spec:
  replicas: 3
  selector:
    matchLabels:
      app: tts-stack
  template:
    metadata:
      labels:
        app: tts-stack
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
    spec:
      serviceAccountName: tts-workload-identity
      containers:
      - name: tts
        image: {{ .Values.image.repository }}:{{ .Values.image.tag }}
        ports:
        - containerPort: 1885
          name: http
        - containerPort: 8885
          name: https
        - containerPort: 1700
          protocol: UDP
          name: lorawan-udp
        - containerPort: 8080
          name: metrics
        env:
        - name: TTN_LW_BLOB_LOCAL_DIRECTORY
          value: /srv/ttn-lorawan/public/blob
        - name: TTN_LW_REDIS_ADDRESS
          value: redis-0.redis.tts.svc.cluster.local:6379
        - name: TTN_LW_IS_DATABASE_URI
          valueFrom:
            secretKeyRef:
              name: tts-secrets
              key: database-uri
        - name: TTN_LW_IS_EMAIL_SENDER_ADDRESS
          valueFrom:
            secretKeyRef:
              name: tts-secrets
              key: admin-email
        volumeMounts:
        - name: config
          mountPath: /config
        - name: tls-certs
          mountPath: /run/secrets
        - name: blob-storage
          mountPath: /srv/ttn-lorawan/public/blob
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 1885
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /healthz
            port: 1885
          initialDelaySeconds: 30
          periodSeconds: 10
      volumes:
      - name: config
        configMap:
          name: tts-config
      - name: tls-certs
        secret:
          secretName: tts-tls
      - name: blob-storage
        persistentVolumeClaim:
          claimName: tts-blob-storage
```

3. **Ingress** (`ingress.yaml` - uses Application Routing):
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tts-ingress
  namespace: tts
  annotations:
    # Application Routing Add-on annotations
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
spec:
  ingressClassName: webapprouting.kubernetes.azure.com
  tls:
  - hosts:
    - {{ .Values.domain }}
    secretName: tts-tls-cert
  rules:
  - host: {{ .Values.domain }}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: tts-frontend
            port:
              number: 443
---
# Separate LoadBalancer Service for UDP traffic
apiVersion: v1
kind: Service
metadata:
  name: tts-gateway-udp
  namespace: tts
  annotations:
    service.beta.kubernetes.io/azure-load-balancer-resource-group: {{ .Values.resourceGroup }}
spec:
  type: LoadBalancer
  loadBalancerIP: {{ .Values.gatewayPublicIP }} # Reserved static IP
  ports:
  - port: 1700
    targetPort: 1700
    protocol: UDP
    name: lorawan-udp
  selector:
    app: tts-stack
```

4. **ServiceMonitor** (Prometheus scraping):
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: tts-metrics
  namespace: tts
  labels:
    app: tts-stack
spec:
  selector:
    matchLabels:
      app: tts-stack
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

### Phase 3: Update Deployment Script

**File**: `deployments/kubernetes/deploy-aks.ps1`

**Key Changes**:

```powershell
# After Bicep deployment completes...

# Step 4: Configure kubectl
Write-Host "`nConfiguring kubectl..." -ForegroundColor Yellow
az aks get-credentials -g $resourceGroupName -n $aksClusterName --overwrite-existing

# Step 5: Install cert-manager (for Let's Encrypt)
Write-Host "`nInstalling cert-manager..." -ForegroundColor Yellow
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager-webhook -n cert-manager

# Create Let's Encrypt ClusterIssuer
@"
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: $AdminEmail
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: webapprouting.kubernetes.azure.com
"@ | kubectl apply -f -

# Step 6: Build TTS Image with ACR Tasks
Write-Host "`nBuilding TTS container image..." -ForegroundColor Yellow
az acr task run --registry $acrName --name build-tts-image

# Step 7: Deploy TTS Helm Chart
Write-Host "`nDeploying The Things Stack..." -ForegroundColor Yellow
helm upgrade --install tts ./charts/thethingsstack `
  --namespace tts --create-namespace `
  --set image.repository="$acrLoginServer/tts-stack" `
  --set image.tag="latest" `
  --set domain="$DomainName" `
  --set database.host="$($bicepOutputs.databaseHost)" `
  --set database.name="$($bicepOutputs.databaseName)" `
  --set keyVault.name="$($bicepOutputs.keyVaultName)" `
  --set resourceGroup="$resourceGroupName" `
  --wait --timeout 10m

# Step 8: Verify Prometheus Scraping
Write-Host "`nVerifying monitoring configuration..." -ForegroundColor Yellow
kubectl get servicemonitor -n tts

# Step 9: Get Ingress Public IP
$ingressIP = kubectl get ingress tts-ingress -n tts -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
$gatewayIP = kubectl get svc tts-gateway-udp -n tts -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

Write-Host "`n✅ Deployment Complete!" -ForegroundColor Green
Write-Host "`nAccess Points:" -ForegroundColor Cyan
Write-Host "  Console: https://$DomainName" -ForegroundColor White
Write-Host "  Ingress IP: $ingressIP" -ForegroundColor White
Write-Host "  Gateway UDP: $gatewayIP:1700" -ForegroundColor White
Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "  1. Create DNS A record: $DomainName → $ingressIP"
Write-Host "  2. Configure gateways to use: $gatewayIP:1700"
Write-Host "  3. Access Grafana: $(az grafana show -g $resourceGroupName -n $grafanaName --query properties.url -o tsv)"
Write-Host "  4. View logs: kubectl logs -n tts -l app=tts-stack -f"
```

---

## 📊 Cost Comparison

### Current AKS Standard Deployment (~$1,080/month)
| Component | Cost |
|-----------|------|
| 3x Standard_D4s_v3 nodes | $350 |
| PostgreSQL Standard_D4s_v3 (zone-redundant) | $360 |
| Azure Cache for Redis Premium P1 | $200 |
| Standard Load Balancer | $20 |
| ACR Standard | $20 |
| Storage | $20 |
| Log Analytics + App Insights | $55 |
| Networking | $50 |
| Key Vault | $5 |
| **TOTAL** | **$1,080** |

### Modern AKS Automatic Deployment (~$900/month)
| Component | Cost |
|-----------|------|
| AKS Automatic Standard tier (cluster mgmt) | $73 |
| Node Autoprovisioning (avg 3x D4s_v3) | $350 |
| PostgreSQL Standard_D4s_v3 (zone-redundant) | $360 |
| ~~Azure Cache for Redis~~ (removed) | ~~$200~~ → **$0** |
| Redis StatefulSet storage (60 GB Premium SSD) | $12 |
| Standard Load Balancer | $20 |
| Managed NAT Gateway | $45 |
| ACR Premium (with geo-replication) | $40 |
| Azure Monitor Workspace (Prometheus) | $0 (first 2M samples free) |
| Managed Grafana Standard | $25 |
| Container Insights | $30 |
| Storage Account (blob uploads) | $10 |
| Networking | $30 |
| Key Vault | $5 |
| **TOTAL** | **~$900/month** |

**Savings**: ~$180/month (-17%) with **better features** (auto-scaling, managed monitoring, automatic upgrades)

**With Reserved Instances** (3-year):
- Node compute: $350 → $140 (60% savings)
- **New Total**: ~$690/month (-36% vs. current)

---

## 🔐 Security Improvements

### AKS Automatic Security Features (Automatic)
1. ✅ **Workload Identity** with Entra ID (replaces pod identity)
2. ✅ **Deployment Safeguards** via Azure Policy (enforce best practices)
3. ✅ **Image Cleaner** (removes vulnerable images automatically)
4. ✅ **Azure RBAC for Kubernetes** authorization
5. ✅ **API Server VNet Integration** (private control plane)
6. ✅ **Azure Linux OS** (hardened, minimal attack surface)
7. ✅ **Automatic security patches** and node repair

### Additional Configuration
1. **Network Policies** (via Cilium):
```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: tts-db-access
  namespace: tts
spec:
  endpointSelector:
    matchLabels:
      app: tts-stack
  egress:
  - toEndpoints:
    - matchLabels:
        # PostgreSQL private endpoint
    toPorts:
    - ports:
      - port: "5432"
        protocol: TCP
```

2. **Pod Security Standards** (restricted):
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tts
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
```

3. **Key Vault CSI Driver** (mount secrets as volumes):
```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: tts-kv-secrets
  namespace: tts
spec:
  provider: azure
  parameters:
    usePodIdentity: "false"
    useVMManagedIdentity: "false"
    clientID: <workload-identity-client-id>
    keyvaultName: <keyvault-name>
    objects: |
      array:
        - objectName: db-password
          objectType: secret
        - objectName: tts-admin-password
          objectType: secret
```

---

## 🚀 Migration Path from VM Deployment

### Similarity to "Simple/Quick" Deployment

**Goal**: AKS Automatic should feel as simple as `deploy.ps1 -Mode quick` but at production scale.

**User Experience Comparison**:

| Step | VM Quick Deployment | AKS Automatic Deployment |
|------|---------------------|-------------------------|
| 1. Run command | `.\deploy.ps1 -Mode quick -AdminEmail x@y.com` | `.\deploy.ps1 -Mode aks -AdminEmail x@y.com` |
| 2. Wait time | 10-15 minutes | 15-20 minutes |
| 3. Outputs | VM IP, Console URL | Ingress IP, Console URL, Gateway IP |
| 4. Post-config | Create DNS A record | Create DNS A record |
| 5. TLS | Automatic (Let's Encrypt) | Automatic (cert-manager + Let's Encrypt) |
| 6. Monitoring | Azure Monitor (basic) | Managed Prometheus + Grafana (advanced) |
| 7. Scaling | Manual (resize VM) | Automatic (node autoprovisioning) |

**Key Insight**: With AKS Automatic, the deployment experience matches VM simplicity but delivers Kubernetes scalability.

### Data Migration (VM → AKS)

**Prerequisites**: Existing VM deployment with PostgreSQL + Redis data

**Steps**:

1. **Backup VM Data**:
```bash
# SSH to VM
ssh azureuser@<vm-ip>

# Export PostgreSQL
docker exec -i lorawan-stack_postgres_1 \
  pg_dump -U ttsadmin tts > /tmp/tts-backup-$(date +%F).sql

# Export Redis
docker exec lorawan-stack_redis_1 redis-cli SAVE
docker cp lorawan-stack_redis_1:/data/dump.rdb /tmp/redis-backup-$(date +%F).rdb

# Download backups
scp azureuser@<vm-ip>:/tmp/*.{sql,rdb} ./backups/
```

2. **Deploy AKS Cluster**:
```powershell
.\deploy.ps1 -Mode aks -AdminEmail "<email>" -DomainName "<domain>"
```

3. **Import Data to AKS**:
```bash
# Import PostgreSQL
kubectl run psql-import --rm -i --restart=Never \
  --image=postgres:15 \
  --env="PGPASSWORD=<password>" \
  -- psql -h <db-host> -U ttsadmin tts < backups/tts-backup.sql

# Import Redis
kubectl cp backups/redis-backup.rdb tts/redis-0:/data/dump.rdb
kubectl exec -n tts redis-0 -- redis-cli SHUTDOWN
# Redis will load dump.rdb on restart
```

4. **Verify & Cutover**:
- Test TTS console: `https://<domain>`
- Configure test gateway to use new UDP IP
- Monitor logs: `kubectl logs -n tts -l app=tts-stack -f`
- Update DNS to point to new ingress IP
- Decommission VM after 48 hours

---

## 📝 Documentation Updates Required

### Files to Update

1. **`docs/ARCHITECTURE.md`** - Section 13:
   - Replace current AKS architecture with AKS Automatic details
   - Update networking diagrams (managed VNet, Cilium, NAT Gateway)
   - Document Application Routing add-on
   - Explain in-cluster Redis (remove Azure Cache references)
   - Add Managed Prometheus + Grafana architecture

2. **`README.md`**:
   - Update "Production Deployment (AKS)" section
   - Change cost estimate: ~$1,080 → ~$900/month
   - Simplify deployment steps (AKS Automatic reduces complexity)

3. **`.github/copilot-instructions.md`**:
   - Add AKS Automatic patterns
   - Document Helm chart structure
   - Add ACR Tasks guidance for image building
   - Update Redis deployment approach (StatefulSet, not managed service)

4. **New Files**:
   - `docs/AKS_IMAGE_BUILD.md` - Guide for building TTS images with ACR Tasks
   - `docs/PROMETHEUS_MONITORING.md` - Managed Prometheus + Grafana setup
   - `charts/thethingsstack/README.md` - Helm chart documentation

---

## ✅ Acceptance Criteria

### Deployment Must:
1. ✅ Match VM deployment simplicity (single command, ~15 min)
2. ✅ Use **AKS Automatic** (not Standard)
3. ✅ Include **Managed NGINX Ingress** (Application Routing add-on)
4. ✅ Use **Managed Prometheus** (not self-hosted)
5. ✅ Deploy **Redis as StatefulSet** (per TTS official architecture)
6. ✅ Build TTS images automatically (ACR Tasks)
7. ✅ Support **Let's Encrypt TLS** (via cert-manager)
8. ✅ Enable **Node Autoprovisioning** (automatic scaling)
9. ✅ Integrate with **Azure Monitor** (logs + metrics)
10. ✅ Support **LoRaWAN UDP 1700** (LoadBalancer service)
11. ✅ Use **Workload Identity** (not pod identity)
12. ✅ Match or beat VM deployment cost (~$205/month for VM vs. ~$900 for AKS)

### Monitoring Must:
1. ✅ Prometheus metrics from TTS pods
2. ✅ Ingress controller metrics (nginx)
3. ✅ Redis metrics
4. ✅ PostgreSQL connection pool metrics
5. ✅ Container resource utilization (CPU, memory)
6. ✅ Network traffic (ingress, egress, pod-to-pod)
7. ✅ Pre-configured Grafana dashboards (TTS + nginx)

---

## 🎯 Next Steps

### Immediate Actions

1. **Create Helm Chart** (`charts/thethingsstack/`):
   - Templates for all Kubernetes resources
   - values.yaml with sensible defaults
   - Document parameters

2. **Update Bicep Template**:
   - Convert AKS Standard → AKS Automatic
   - Add Azure Monitor Workspace
   - Add Managed Grafana
   - Add Storage Account for blobs
   - Upgrade ACR to Premium with Tasks

3. **Update Deployment Script**:
   - Add cert-manager installation
   - Add ACR image build step
   - Add Helm deployment step
   - Add post-deployment verification

4. **Create Image Build Pipeline**:
   - Define Dockerfile for TTS
   - Configure ACR Tasks
   - Set up automated builds

5. **Test Complete Flow**:
   - Deploy to isolated resource group
   - Verify all components
   - Test data migration
   - Validate monitoring

6. **Update Documentation**:
   - Architecture docs (Section 13)
   - README deployment steps
   - Copilot instructions
   - New guides (image building, monitoring)

### Timeline

- **Week 1**: Helm chart + Bicep updates
- **Week 2**: Deployment script + image builds
- **Week 3**: Testing + documentation
- **Week 4**: Production validation

---

## 📚 References

1. **AKS Automatic**: https://learn.microsoft.com/en-us/azure/aks/intro-aks-automatic
2. **Application Routing Add-on**: https://learn.microsoft.com/en-us/azure/aks/app-routing
3. **Managed Prometheus**: https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/prometheus-metrics-overview
4. **The Things Stack Kubernetes**: https://www.thethingsindustries.com/docs/enterprise/kubernetes/azure/architecture/
5. **ACR Tasks**: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-tasks-overview
6. **Workload Identity**: https://learn.microsoft.com/en-us/azure/aks/workload-identity-overview

---

**Status**: Ready for implementation
**Owner**: DevOps Team
**Last Updated**: October 11, 2025
