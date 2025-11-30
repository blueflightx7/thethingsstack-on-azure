# Deployment Orchestration System - Complete Guide

## 🎯 Overview

The deployment system has been completely redesigned to make **`deploy.ps1` the single, primary entry point** for all deployment scenarios. This provides a unified, menu-driven experience that automatically routes to the appropriate deployment mode based on your needs.

---

## 🏗️ Architecture

### Deployment Hierarchy

```
deploy.ps1 (PRIMARY ORCHESTRATOR)
│
├── Mode: quick ──────────► deploy-simple.ps1
│                           └── deployments/vm/tts-docker-deployment.bicep
│
├── Mode: aks ────────────► deployments/kubernetes/deploy-aks.ps1
│                           └── deployments/kubernetes/tts-aks-deployment.bicep
│
└── Mode: vm (advanced) ──► Inline advanced VM deployment
                            └── deployments/vm/tts-docker-deployment.bicep
```

---

## 🚀 Deployment Modes

### 1. Quick Deployment (VM) - Development/Testing

**Command**:
```powershell
.\deploy.ps1 -Mode quick -AdminEmail "your-email@example.com"
```

**What It Does**:
- Calls `deploy-simple.ps1` with optimized defaults
- Auto-detects deployer public IP for SSH restriction
- Creates Key Vault automatically
- Deploys single VM with Docker Compose

**Characteristics**:
- ⏱️ Deployment time: 10-15 minutes
- 💰 Monthly cost: ~$155-205
- 📊 Capacity: Up to 10,000 devices
- 🏗️ Architecture: Single VM (no HA)
- 🎯 Best for: Development, testing, PoC, small deployments

**Resources Deployed**:
- VM (Standard_B4ms - 4 vCPU, 16GB RAM)
- PostgreSQL Flexible Server (B2s)
- Key Vault
- Virtual Network + NSG
- Public IP + NIC
- Azure Monitor + Log Analytics

---

### 2. Production Deployment (AKS) - Enterprise Scale ⭐

**Command**:
```powershell
.\deploy.ps1 -Mode aks -AdminEmail "your-email@example.com" -Location "centralus"
```

**What It Does**:
- Calls `deployments/kubernetes/deploy-aks.ps1`
- Deploys full Azure Kubernetes Service cluster
- Configures high availability with zone redundancy
- Sets up auto-scaling (2-10 nodes)
- Integrates Azure Container Registry

**Characteristics**:
- ⏱️ Deployment time: 20-30 minutes
- 💰 Monthly cost: ~$500-800
- 📊 Capacity: 100,000+ devices with auto-scaling
- 🏗️ Architecture: Multi-node Kubernetes cluster (HA)
- 🎯 Best for: **Production**, enterprise scale, mission-critical

**Resources Deployed**:
- AKS Cluster (3x Standard_D4s_v3 nodes)
- Azure Container Registry (Standard)
- PostgreSQL Flexible Server (GP 4vCore with HA)
- Key Vault
- Virtual Network (with 2 subnets: AKS + Database)
- Standard Load Balancer
- Log Analytics + Application Insights
- Private DNS Zone for database

**Key Features**:
- ✅ High Availability (zone-redundant nodes and database)
- ✅ Auto-scaling (horizontal pod autoscaling + cluster autoscaling)
- ✅ Rolling updates (zero downtime deployments)
- ✅ Self-healing (automatic pod restarts)
- ✅ Load balancing (built-in)
- ✅ Advanced monitoring (Prometheus + Grafana ready)

---

### 3. Advanced VM Deployment - Custom Configuration

**Command**:
```powershell
.\deploy.ps1 -Mode vm -AdminEmail "your-email@example.com"
```

**What It Does**:
- Runs inline advanced deployment logic
- Prompts for custom configuration (VM size, security options, domain)
- Allows granular control over all parameters
- Supports custom VM sizes (B4ms, D4s_v3, D8s_v3, or custom SKU)

**Characteristics**:
- ⏱️ Deployment time: 15-20 minutes
- 💰 Monthly cost: ~$200-400 (varies by configuration)
- 📊 Capacity: Up to 50,000 devices (depends on VM size)
- 🏗️ Architecture: Single VM with custom sizing
- 🎯 Best for: Specific requirements, custom sizing, hybrid scenarios

**Interactive Configuration**:
1. VM size selection (4 presets + custom)
2. Security options (private DB, Key Vault)
3. Domain name (custom or auto-generated)
4. SSH source IP (auto-detect or specify)

---

## 📋 Usage Examples

### Interactive Menu (Recommended for First-Time Users)

```powershell
# Simply run with no parameters
.\deploy.ps1

# You'll see:
╔══════════════════════════════════════════════════════════════════╗
║   SELECT DEPLOYMENT MODE                                         ║
╚══════════════════════════════════════════════════════════════════╝

[1] Quick Deployment (VM)
[2] Production Deployment (AKS - Kubernetes) ← PRODUCTION SCALE
[3] Advanced VM Deployment (Custom)
[4] Compare All Deployment Options
```

### Direct Mode Selection

```powershell
# Quick VM deployment
.\deploy.ps1 -Mode quick -AdminEmail "admin@example.com"

# Production AKS deployment
.\deploy.ps1 -Mode aks -AdminEmail "admin@example.com" -Location "centralus"

# Advanced VM with custom configuration
.\deploy.ps1 -Mode vm -AdminEmail "admin@example.com"
```

### Parameters File (Repeatable Deployments)

```powershell
# Create parameters.json with your configuration
{
  "adminEmail": "admin@example.com",
  "location": "centralus",
  "environmentName": "tts-prod",
  "nodeCount": 3,
  "nodeSize": "Standard_D4s_v3"
}

# Deploy with parameters file
.\deploy.ps1 -Mode aks -ParametersFile "parameters.json"
```

---

## 🔄 Migration Path: VM to AKS

### Why Migrate?

| Trigger | VM Limitation | AKS Solution |
|---------|---------------|--------------|
| **Device growth** | Single VM capacity limit (~10K devices) | Auto-scale to 100K+ devices |
| **Downtime concerns** | Manual updates require downtime | Rolling updates (zero downtime) |
| **Traffic spikes** | Fixed capacity | Horizontal pod autoscaling |
| **Regional expansion** | Single region | Multi-region deployment ready |
| **Team growth** | Manual management | Declarative GitOps workflow |

### Migration Steps

```powershell
# Step 1: Export TTS data from VM
ssh ttsadmin@<vm-ip>
docker exec -it lorawan-stack_stack_1 tts-lw-cli end-devices export > devices.json
pg_dump -h <db-host> -U ttsadmin tts > tts-backup.sql

# Step 2: Deploy AKS cluster
.\deploy.ps1 -Mode aks -AdminEmail "your-email@example.com"

# Step 3: Restore data to AKS
kubectl exec -it deployment/tts -n tts -- tts-lw-cli end-devices import < devices.json
kubectl exec -it deployment/postgres -n tts -- psql -U ttsadmin tts < tts-backup.sql

# Step 4: Update DNS to point to AKS load balancer
# Step 5: Validate gateway connectivity
# Step 6: Decommission VM deployment
```

---

## 🎛️ Deployment Comparison Matrix

| Feature | Quick VM | Production AKS | Advanced VM |
|---------|----------|----------------|-------------|
| **Device Capacity** | 10,000 | 100,000+ | 50,000 |
| **High Availability** | ❌ No | ✅ Yes (Zone-redundant) | ❌ No |
| **Auto-scaling** | ❌ No | ✅ Yes (HPA + Cluster) | ❌ No |
| **Zero-downtime Updates** | ❌ Manual | ✅ Rolling updates | ❌ Manual |
| **Load Balancing** | ❌ No | ✅ Built-in | ❌ No |
| **Deployment Time** | 10-15 min | 20-30 min | 15-20 min |
| **Monthly Cost** | ~$205 | ~$675 | ~$200-400 |
| **Complexity** | Low | High | Medium |
| **Management Overhead** | Manual VM | Kubernetes (managed) | Manual VM |
| **Backup/DR** | Manual snapshots | Built-in + Geo-replication | Manual snapshots |
| **Monitoring** | Azure Monitor | + Prometheus/Grafana | Azure Monitor |
| **SSL/TLS** | Let's Encrypt | Let's Encrypt + Cert-Manager | Let's Encrypt |
| **Best For** | Dev/Test/PoC | **Production/Enterprise** | Custom needs |

---

## 🏆 Recommended Deployment Strategy

### Phase 1: Development & Testing (Quick VM)
```powershell
.\deploy.ps1 -Mode quick -AdminEmail "dev@company.com"
```
- **Duration**: 2-4 weeks
- **Goal**: Validate gateways, test device integrations
- **Cost**: ~$205/month

### Phase 2: Pilot/UAT (Advanced VM)
```powershell
.\deploy.ps1 -Mode vm -AdminEmail "uat@company.com"
# Select larger VM (Standard_D8s_v3) during configuration
```
- **Duration**: 4-8 weeks
- **Goal**: Load testing, security validation
- **Cost**: ~$350/month

### Phase 3: Production (AKS)
```powershell
.\deploy.ps1 -Mode aks -AdminEmail "ops@company.com" -Location "centralus"
```
- **Duration**: Ongoing
- **Goal**: Mission-critical production deployment
- **Cost**: ~$675/month
- **Capacity**: Scales to 100K+ devices

---

## 🔧 Advanced Features

### AKS-Specific Features

#### Horizontal Pod Autoscaling (HPA)
```yaml
# Automatically configured in AKS deployment
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: tts-hpa
spec:
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

#### Cluster Autoscaling
- **Min nodes**: 2
- **Max nodes**: 10
- **Trigger**: CPU/Memory utilization > 80%
- **Scale-down**: After 10 min of low utilization

#### Zone Redundancy
- **AKS nodes**: Distributed across 3 availability zones
- **PostgreSQL**: Zone-redundant HA with automatic failover
- **RPO**: < 1 minute
- **RTO**: < 5 minutes

---

## 📊 Cost Optimization

### VM Deployments

| Strategy | Savings | Implementation |
|----------|---------|----------------|
| **Reserved Instances** | 40-60% | Purchase 1-year RI for VM + DB |
| **Auto-shutdown** | ~30% | Schedule VM stop during off-hours |
| **Database Tier** | 20-30% | Start with B1ms, scale as needed |
| **Backup Retention** | 10-15% | Reduce from 35 to 7 days |

**Potential Monthly Savings**: ~$100/month

### AKS Deployments

| Strategy | Savings | Implementation |
|----------|---------|----------------|
| **Reserved Instances** | 40-60% | Purchase RIs for node VMs |
| **Spot Instances** | 60-90% | Use for non-critical workloads |
| **Cluster Autoscaling** | 30-50% | Scale down during low traffic |
| **Database Tier** | 20-30% | Right-size based on actual load |
| **ACR Geo-replication** | Remove if single region | ~$20/month |

**Potential Monthly Savings**: ~$200-300/month

---

## 🛠️ Troubleshooting

### Common Issues

#### Issue 1: AKS Deployment Fails (kubectl not found)
```powershell
# Install kubectl
az aks install-cli

# Or download manually
https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/
```

#### Issue 2: Helm not found
```powershell
# Install Helm 3
choco install kubernetes-helm  # Windows
brew install helm              # macOS
```

#### Issue 3: Cannot push to ACR
```powershell
# Get ACR credentials
az acr credential show --name <acr-name>

# Login to ACR
az acr login --name <acr-name>
```

#### Issue 4: AKS nodes not ready
```powershell
# Check node status
kubectl get nodes

# Describe node for details
kubectl describe node <node-name>

# Check cluster events
kubectl get events --all-namespaces --sort-by='.lastTimestamp'
```

---

## 📚 Next Steps

### After VM Deployment
1. ✅ Access console at provided URL
2. ✅ Create API keys
3. ✅ Register gateways
4. ✅ Add devices
5. ✅ Configure integrations (HTTP webhooks, MQTT)
6. ✅ Set up monitoring alerts

### After AKS Deployment
1. ✅ Configure kubectl: `az aks get-credentials -g <rg> -n <cluster>`
2. ✅ Deploy TTS Helm chart (in development)
3. ✅ Configure ingress controller (nginx or application gateway)
4. ✅ Set up cert-manager for TLS automation
5. ✅ Configure DNS for custom domain
6. ✅ Set up Prometheus + Grafana dashboards
7. ✅ Configure backup policies
8. ✅ Implement CI/CD pipeline (GitHub Actions recommended)

---

## 🔗 Related Documentation

- **Architecture**: See `docs/ARCHITECTURE.md` for detailed technical design
- **Security**: See `SECURITY_HARDENING.md` for production security checklist
- **Deployment Fixes**: See `DEPLOYMENT_FIXES_SUMMARY.md` for all 7 critical fixes
- **Cost Optimization**: README.md Section "Cost Estimation"
- **Operations**: README.md Section "Operations Guide"

---

## 🆘 Support

### Deployment Issues
- Check deployment logs in Azure Portal → Resource Group → Deployments
- Review cloud-init logs: `ssh <vm> && cat /var/log/cloud-init-output.log`
- Check container logs: `docker logs lorawan-stack_stack_1`

### AKS-Specific Issues
- Check pod status: `kubectl get pods -n tts`
- View pod logs: `kubectl logs <pod-name> -n tts`
- Describe pod: `kubectl describe pod <pod-name> -n tts`
- Check events: `kubectl get events -n tts --sort-by='.lastTimestamp'`

### Getting Help
- **GitHub Issues**: https://github.com/blueflightx7/thethingsstack-on-azure/issues
- **TTS Community**: https://www.thethingsnetwork.org/forum/
- **Azure Support**: https://azure.microsoft.com/support/

---

## ✅ Production Readiness Checklist

### Pre-Deployment
- [ ] Azure subscription with sufficient quota
- [ ] Domain name configured (or use Azure-provided)
- [ ] Admin email for notifications
- [ ] Budget approval (~$675/month for AKS)
- [ ] kubectl and Helm installed (for AKS)

### Post-Deployment
- [ ] Console accessible via HTTPS
- [ ] Admin user can log in
- [ ] Gateways can connect
- [ ] Devices can join
- [ ] Uplink/downlink working
- [ ] Monitoring dashboards configured
- [ ] Backup policy implemented
- [ ] Security hardening completed
- [ ] DNS configured for custom domain
- [ ] SSL certificates valid

---

**🎉 Congratulations!** You now have a comprehensive understanding of the deployment orchestration system and can choose the right deployment mode for your use case.
