# CI/CD Setup Guide for The Things Stack on Azure

## Overview

This guide walks you through setting up the complete CI/CD pipeline for automated builds, security scanning, and deployments.

## Architecture Summary

```
GitHub Push → GitHub Actions → Build → Scan → ACR → Watchtower (VM) / Flux CD (AKS)
```

---

## Prerequisites

1. **Azure Subscription** with permissions to create:
   - Azure Container Registry (ACR)
   - Role assignments
   - Microsoft Defender for Cloud (optional)

2. **GitHub Repository**:
   - Admin access to configure secrets
   - Actions enabled

3. **Tools** (for local testing):
   - Azure CLI
   - Docker Desktop
   - kubectl (for AKS)
   - Flux CLI (for AKS)

---

## Phase 1: Azure Container Registry Setup

### Step 1.1: Deploy ACR

**Option A: Using Bicep (Recommended)**

```powershell
# Set variables
$ENVIRONMENT_NAME = "ttsprod"
$LOCATION = "centralus"
$RG_NAME = "rg-$ENVIRONMENT_NAME-cicd"

# Create resource group
az group create --name $RG_NAME --location $LOCATION

# Deploy ACR using Bicep module
az deployment group create `
  --resource-group $RG_NAME `
  --template-file deployments/shared/acr.bicep `
  --parameters environmentName=$ENVIRONMENT_NAME `
               acrSku=Premium `
               enableGeoReplication=false `
               location=$LOCATION

# Get ACR name
$ACR_NAME = az deployment group show `
  --resource-group $RG_NAME `
  --name acr `
  --query properties.outputs.acrName.value `
  --output tsv

echo "ACR Name: $ACR_NAME"
```

**Option B: Using Azure CLI**

```bash
ACR_NAME="ttsprodacr$(openssl rand -hex 4)"

az acr create \
  --resource-group $RG_NAME \
  --name $ACR_NAME \
  --sku Premium \
  --location $LOCATION \
  --admin-enabled false

echo "ACR Name: $ACR_NAME"
```

### Step 1.2: Enable Microsoft Defender

```bash
# Enable Defender for Container Registries (subscription-level)
az security pricing create \
  --name ContainerRegistry \
  --tier standard

# Verify Defender is enabled
az security pricing show --name ContainerRegistry
```

**Cost**: ~$0.29 per image scanned

### Step 1.3: Test ACR Access

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Push a test image
docker pull hello-world
docker tag hello-world $ACR_NAME.azurecr.io/hello-world:test
docker push $ACR_NAME.azurecr.io/hello-world:test

# Verify image in ACR
az acr repository list --name $ACR_NAME --output table
```

---

## Phase 2: GitHub Actions Setup

### Step 2.1: Create Azure Service Principal

```bash
# Create service principal with ACR permissions
SUBSCRIPTION_ID=$(az account show --query id --output tsv)
SP_NAME="github-actions-tts"

SP_OUTPUT=$(az ad sp create-for-rbac \
  --name $SP_NAME \
  --role Contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG_NAME \
  --sdk-auth)

echo "$SP_OUTPUT"
```

**Save this JSON output** - you'll need it for GitHub secrets.

### Step 2.2: Assign ACR Roles

```bash
# Get ACR resource ID
ACR_ID=$(az acr show --name $ACR_NAME --query id --output tsv)

# Get service principal object ID
SP_OBJECT_ID=$(az ad sp list --display-name $SP_NAME --query "[0].id" --output tsv)

# Assign AcrPush role (allows push to ACR)
az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role AcrPush \
  --scope $ACR_ID

# Verify role assignment
az role assignment list --assignee $SP_OBJECT_ID --output table
```

### Step 2.3: Configure GitHub Secrets

Go to GitHub repository → Settings → Secrets and variables → Actions

Add the following **Repository Secrets**:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `AZURE_CREDENTIALS` | _(JSON from Step 2.1)_ | Azure service principal credentials |
| `ACR_NAME` | `ttsprodacr1234` | Your ACR name |
| `VM_WEBHOOK_URL` | _(leave empty for now)_ | VM webhook endpoint (configured later) |

**Screenshot**:
```
Settings → Secrets and variables → Actions → New repository secret
```

### Step 2.4: Test GitHub Actions Workflow

```bash
# Trigger workflow manually
gh workflow run build-deploy.yml

# Monitor workflow
gh run list --workflow=build-deploy.yml
gh run view --log
```

Or trigger via Git push:
```bash
git add .
git commit -m "test: Trigger CI/CD pipeline"
git push origin main
```

**Expected Output**:
- ✅ Build image
- ✅ Scan for vulnerabilities (Trivy)
- ✅ Upload scan results to GitHub Security tab
- ✅ Push image to ACR with 4 tags (commit SHA, version, timestamp, latest)

---

## Phase 3: VM Deployment Integration

### Step 3.1: Add ACR to VM Bicep Template

Edit `deployments/vm/tts-docker-deployment.bicep`:

```bicep
// Add ACR module reference
module acr '../shared/acr.bicep' = {
  name: 'acr-deployment'
  params: {
    environmentName: environmentName
    location: location
    acrSku: 'Premium'
    enableGeoReplication: false
  }
}

// Assign AcrPull role to VM managed identity
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vm.id, acr.outputs.acrId, 'AcrPull')
  scope: resourceId('Microsoft.ContainerRegistry/registries', acr.outputs.acrName)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')  // AcrPull
    principalId: vm.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

### Step 3.2: Update cloud-init Script

Add ACR login and Watchtower to cloud-init (in Bicep):

```yaml
#cloud-config

# ... existing cloud-init ...

runcmd:
  # Login to ACR using managed identity
  - |
    az login --identity
    az acr login --name ${acr.outputs.acrName}
    
  # Pull TTS image from ACR
  - docker pull ${acr.outputs.acrLoginServer}/thethingsstack:latest
  
  # Update docker-compose.yml to use ACR image
  - |
    sed -i 's|image: thethingsindustries/lorawan-stack:.*|image: ${acr.outputs.acrLoginServer}/thethingsstack:latest|g' /opt/lorawan-stack/docker-compose.yml
  
  # Add Watchtower service
  - |
    cat >> /opt/lorawan-stack/docker-compose.yml << 'WATCHTOWER'
    
      watchtower:
        image: containrrr/watchtower:latest
        container_name: tts-watchtower
        restart: unless-stopped
        volumes:
          - /var/run/docker.sock:/var/run/docker.sock
          - /root/.docker/config.json:/config.json:ro
        environment:
          - WATCHTOWER_POLL_INTERVAL=300
          - WATCHTOWER_CLEANUP=true
          - WATCHTOWER_ROLLING_RESTART=true
          - WATCHTOWER_LOG_LEVEL=info
    WATCHTOWER
  
  # Start containers
  - cd /opt/lorawan-stack && docker-compose up -d
```

### Step 3.3: Redeploy VM with ACR Integration

```powershell
# Deploy updated VM template
.\deploy.ps1 -Mode quick -AdminEmail "admin@onemtc.net"

# Verify Watchtower is running
ssh ttsadmin@<vm-ip> "docker ps | grep watchtower"

# Check Watchtower logs
ssh ttsadmin@<vm-ip> "docker logs tts-watchtower --tail 50"
```

### Step 3.4: Test Automated Updates

```bash
# Make a trivial change to Dockerfile
echo "# Test update $(date)" >> Dockerfile

# Commit and push
git add Dockerfile
git commit -m "test: Trigger automated VM update"
git push origin main

# Wait for GitHub Actions to complete (~5 minutes)
# Wait for Watchtower to detect new image (~5 minutes)

# Verify new image deployed
ssh ttsadmin@<vm-ip> "docker images | grep thethingsstack"
ssh ttsadmin@<vm-ip> "docker inspect lorawan-stack_stack_1 | grep Image"
```

---

## Phase 4: AKS Deployment Integration

### Step 4.1: Enable Flux CD on AKS

```bash
# Set variables
AKS_CLUSTER="ttsprod-aks"
AKS_RG="rg-ttsprod-aks"

# Install Flux extension
az k8s-extension create \
  --cluster-name $AKS_CLUSTER \
  --resource-group $AKS_RG \
  --cluster-type managedClusters \
  --extension-type microsoft.flux \
  --name flux \
  --configuration-settings \
    "helmController.enable=true" \
    "imageAutomationController.enable=true" \
    "imageReflectionController.enable=true"

# Verify Flux is running
kubectl get pods -n flux-system
```

### Step 4.2: Attach ACR to AKS

```bash
# Attach ACR (automatic managed identity configuration)
az aks update \
  --name $AKS_CLUSTER \
  --resource-group $AKS_RG \
  --attach-acr $ACR_NAME

# Verify ACR attachment
az aks show \
  --name $AKS_CLUSTER \
  --resource-group $AKS_RG \
  --query "identity.principalId" \
  --output tsv

# Verify role assignment
az role assignment list \
  --scope $(az acr show --name $ACR_NAME --query id --output tsv) \
  --output table
```

### Step 4.3: Create Kubernetes Manifests

Create `deployments/kubernetes/manifests/tts-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lorawan-stack
  namespace: tts
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: lorawan-stack
  template:
    metadata:
      labels:
        app: lorawan-stack
      annotations:
        # Flux CD will update this automatically
        fluxcd.io/automated: "true"
    spec:
      containers:
      - name: stack
        image: ${ACR_NAME}.azurecr.io/thethingsstack:latest  # {"$imagepolicy": "flux-system:tts-semver-policy"}
        imagePullPolicy: Always
        ports:
        - containerPort: 1885
          name: http
        - containerPort: 8885
          name: grpc
        readinessProbe:
          httpGet:
            path: /healthz
            port: 1885
          initialDelaySeconds: 30
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /healthz
            port: 1885
          initialDelaySeconds: 60
          periodSeconds: 20
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        env:
        - name: TTS_DOMAIN
          value: "tts.onemtc.net"
        # ... other TTS environment variables ...
```

### Step 4.4: Apply Flux Configuration

```bash
# Update Flux config with actual ACR name
sed -i "s/\${ACR_NAME}/$ACR_NAME/g" deployments/kubernetes/flux-config.yaml

# Apply Flux configuration
kubectl apply -f deployments/kubernetes/flux-config.yaml

# Verify Flux is watching ACR
flux get images all
flux get image policy tts-semver-policy

# Check Flux logs
flux logs --level=info
```

### Step 4.5: Test Automated AKS Updates

```bash
# Make a change and push
echo "# AKS test update $(date)" >> Dockerfile
git add .
git commit -m "test: Trigger AKS automated update"
git push origin main

# Monitor GitHub Actions
gh run list --workflow=build-deploy.yml --limit 1

# Monitor Flux
flux logs --follow

# Verify deployment update
kubectl get pods -n tts -w
kubectl rollout status deployment/lorawan-stack -n tts

# Check image version
kubectl get deployment lorawan-stack -n tts -o jsonpath='{.spec.template.spec.containers[0].image}'
```

---

## Phase 5: Security & Monitoring

### Step 5.1: Enable Continuous Patching

Create ACR Task for daily patching:

```bash
# Create daily patching task
az acr task create \
  --registry $ACR_NAME \
  --name tts-daily-patch \
  --schedule "0 2 * * *" \
  --cmd \
    "mcr.microsoft.com/copacetic/copa:latest patch \
      -i {{.Run.Registry}}/thethingsstack:latest \
      -o {{.Run.Registry}}/thethingsstack:patched-{{.Run.ID}}" \
  --timeout 3600

# Test patch task
az acr task run --registry $ACR_NAME --name tts-daily-patch
```

### Step 5.2: Configure Alerts

```bash
# Create Action Group for alerts
az monitor action-group create \
  --name "TTS-DevOps-Alerts" \
  --resource-group $RG_NAME \
  --short-name "TTS-Alerts" \
  --email-receiver \
    Name=Admin \
    EmailAddress=admin@onemtc.net

# Create alert for ACR push failures
az monitor metrics alert create \
  --name "ACR-Push-Failures" \
  --resource-group $RG_NAME \
  --scopes $(az acr show --name $ACR_NAME --query id --output tsv) \
  --condition "count FailedImagePushCount > 0" \
  --action "TTS-DevOps-Alerts" \
  --evaluation-frequency 5m \
  --window-size 15m
```

### Step 5.3: Review Security Scan Results

**In GitHub**:
1. Go to repository → Security tab
2. Click "Code scanning"
3. View Trivy vulnerability results
4. Filter by severity (CRITICAL, HIGH)

**In Azure**:
1. Azure Portal → Container Registry → Repositories
2. Select `thethingsstack` repository
3. Click on a tag → Security findings
4. Review Microsoft Defender scan results

---

## Cost Breakdown

| Component | Monthly Cost | Notes |
|-----------|--------------|-------|
| **ACR Premium** | $165 | Required for Tasks, Defender, Content Trust |
| **ACR Tasks** | ~$5 | ~250 builds/month @ $0.0001/sec |
| **Defender for Containers** | ~$30 | ~100 images scanned @ $0.29/image |
| **GitHub Actions** | $0 | 2,000 free minutes/month (public repo) |
| **Storage (images)** | ~$10 | 100GB @ $0.10/GB |
| **Bandwidth** | ~$5 | 50GB egress @ $0.087/GB |
| **Total** | **~$215/month** | Can reduce to ~$75 with Standard SKU (no Defender) |

---

## Troubleshooting

### Issue: GitHub Actions fails to push to ACR

**Symptoms**: Error: "denied: access forbidden"

**Solution**:
```bash
# Verify service principal has AcrPush role
az role assignment list \
  --assignee $(az ad sp list --display-name github-actions-tts --query "[0].id" --output tsv) \
  --output table

# Re-assign role if missing
az role assignment create \
  --assignee $(az ad sp list --display-name github-actions-tts --query "[0].id" --output tsv) \
  --role AcrPush \
  --scope $(az acr show --name $ACR_NAME --query id --output tsv)
```

### Issue: Watchtower not updating containers

**Symptoms**: New image in ACR, but container not updated

**Solution**:
```bash
# Check Watchtower logs
docker logs tts-watchtower --tail 100

# Verify ACR credentials
docker pull $ACR_NAME.azurecr.io/thethingsstack:latest

# Restart Watchtower
docker restart tts-watchtower
```

### Issue: Flux not detecting new images

**Symptoms**: Image pushed to ACR, but Kubernetes not updated

**Solution**:
```bash
# Check Flux image reflector logs
kubectl logs -n flux-system \
  -l app=image-reflector-controller \
  --tail 100

# Manually trigger reconciliation
flux reconcile image repository tts-image

# Verify image policy
flux get image policy tts-semver-policy
```

---

## Next Steps

1. **Configure DNS**: Point `tts.onemtc.net` to VM/AKS IP
2. **Setup Let's Encrypt**: Enable automatic SSL certificates
3. **Configure Monitoring**: Azure Monitor + Application Insights
4. **Multi-Region**: Replicate to secondary region for DR
5. **Canary Deployments**: Implement gradual rollout (10% → 50% → 100%)

---

## Rollback Procedures

### GitHub Actions Rollback

```bash
# Revert last commit
git revert HEAD
git push origin main

# This triggers new build with previous code
```

### VM Rollback

```bash
# SSH to VM
ssh ttsadmin@<vm-ip>

# List recent images
docker images | grep thethingsstack

# Stop containers
cd /opt/lorawan-stack
docker-compose down

# Update to specific tag
sed -i 's|thethingsstack:.*|thethingsstack:<old-tag>|g' docker-compose.yml

# Restart
docker-compose up -d
```

### AKS Rollback

```bash
# View rollout history
kubectl rollout history deployment/lorawan-stack -n tts

# Rollback to previous version
kubectl rollout undo deployment/lorawan-stack -n tts

# Or rollback to specific revision
kubectl rollout undo deployment/lorawan-stack -n tts --to-revision=3
```

---

## Maintenance

### Weekly Tasks

- [ ] Review security scan results in GitHub Security tab
- [ ] Check ACR Task logs for patching failures
- [ ] Verify Watchtower/Flux are updating containers

### Monthly Tasks

- [ ] Review ACR storage usage and clean up old images
- [ ] Update TTS version in Dockerfile if new release available
- [ ] Review Azure costs and optimize

### Quarterly Tasks

- [ ] Rotate service principal credentials
- [ ] Update base images for security patches
- [ ] Review and update semver policy in Flux

---

## Support

**Issues**: https://github.com/blueflightx7/thethingsstack-on-azure/issues
**Documentation**: See `docs/CI-CD-ARCHITECTURE.md`
**Azure Support**: https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade
