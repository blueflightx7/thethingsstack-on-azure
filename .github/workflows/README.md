# GitHub Actions Setup for AKS Deployment

This directory contains GitHub Actions workflows for automated deployment of The Things Stack to Azure Kubernetes Service.

## Required GitHub Secrets

Before the workflow can run, you must configure the following secrets in your GitHub repository:

### Repository Settings → Secrets and variables → Actions → New repository secret

| Secret Name | Description | How to Generate |
|-------------|-------------|-----------------|
| `AZURE_CREDENTIALS` | Service principal credentials for Azure login | See [Azure Login Setup](#azure-login-setup) below |
| `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID (GUID) | `az account show --query id -o tsv` |
| `TTS_DOMAIN` | Domain name for TTS deployment | Your domain (e.g., `tts.example.com`) |
| `ADMIN_EMAIL` | Admin email for Let's Encrypt certificates | Your email address |
| `DB_PASSWORD` | PostgreSQL admin password | Generate: `openssl rand -base64 32 \| tr -d /=+` |
| `TTS_ADMIN_PASSWORD` | TTS console admin password | Generate: `openssl rand -base64 24` |
| `COOKIE_HASH_KEY` | Session cookie HMAC key (64 hex chars) | See [Cookie Keys](#cookie-keys) below |
| `COOKIE_BLOCK_KEY` | Session cookie encryption key (64 hex chars) | See [Cookie Keys](#cookie-keys) below |
| `CLUSTER_KEYS` | TTS cluster encryption keys (base64) | See [Cluster Keys](#cluster-keys) below |

## Azure Login Setup

### Create Service Principal

```bash
# Login to Azure
az login

# Set your subscription
az account set --subscription "<subscription-id>"

# Create service principal with Contributor role
az ad sp create-for-rbac \
  --name "github-actions-tts-aks" \
  --role Contributor \
  --scopes /subscriptions/<subscription-id> \
  --sdk-auth
```

**Output** (copy entire JSON):
```json
{
  "clientId": "<client-id>",
  "clientSecret": "<client-secret>",
  "subscriptionId": "<subscription-id>",
  "tenantId": "<tenant-id>",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

**Add to GitHub**:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `AZURE_CREDENTIALS`
4. Value: Paste the entire JSON output
5. Click **Add secret**

### Grant Additional Permissions

The service principal needs permissions to create resources:

```bash
# Get service principal object ID
SP_ID=$(az ad sp list --display-name "github-actions-tts-aks" --query "[0].id" -o tsv)

# Grant Key Vault Administrator role (for secret management)
az role assignment create \
  --assignee $SP_ID \
  --role "Key Vault Administrator" \
  --scope /subscriptions/<subscription-id>

# Grant User Access Administrator (for role assignments)
az role assignment create \
  --assignee $SP_ID \
  --role "User Access Administrator" \
  --scope /subscriptions/<subscription-id>
```

## Cookie Keys

Generate 64-character hexadecimal strings for session cookie security:

```bash
# Cookie Hash Key (HMAC for integrity)
openssl rand -hex 32  # Outputs 64 hex chars

# Cookie Block Key (encryption for confidentiality)
openssl rand -hex 32  # Outputs 64 hex chars
```

**Add to GitHub**:
- `COOKIE_HASH_KEY`: First generated value
- `COOKIE_BLOCK_KEY`: Second generated value

## Cluster Keys

Generate base64-encoded encryption keys for TTS cluster:

```bash
# Generate cluster keys (32 bytes, base64-encoded)
openssl rand -base64 32
```

**Add to GitHub**:
- `CLUSTER_KEYS`: Generated base64 value

## GitHub Environments (Optional)

For production deployments with approval requirements:

1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name: `production`
4. **Deployment protection rules**:
   - ✅ Required reviewers (add team members)
   - ✅ Wait timer: 5 minutes (optional)
5. Click **Save protection rules**

The workflow will pause before deploying to `production` and require approval.

## Workflow Triggers

### Automatic (on push)

Workflow runs automatically when you push changes to:
- `deployments/kubernetes/**` (any Bicep or script changes)
- `.github/workflows/tts-aks-deploy.yml` (workflow itself)

**Branches**: `master`, `azure-update-aks`

**Jobs**:
- **validate**: Runs on all branches (validates Bicep template)
- **deploy**: Runs only on `master` branch (deploys infrastructure + TTS)

### Manual (workflow_dispatch)

1. Go to **Actions** tab in GitHub
2. Select **Deploy TTS to AKS** workflow
3. Click **Run workflow**
4. Choose:
   - **Branch**: `master` or `azure-update-aks`
   - **Environment**: `production` or `staging`
   - **Use Redis Enterprise**: `true` or `false`
5. Click **Run workflow**

## Verifying Secret Configuration

Run this workflow manually to test:

```bash
# Clone repository
git clone https://github.com/<your-org>/thethingsstack-on-azure.git
cd thethingsstack-on-azure

# Push a change to trigger workflow
git checkout azure-update-aks
echo "# Test" >> .github/workflows/README.md
git add .github/workflows/README.md
git commit -m "test: Trigger GitHub Actions"
git push
```

Check **Actions** tab:
- ✅ Green check = All secrets configured correctly
- ❌ Red X = Missing or invalid secrets (check workflow logs)

## Troubleshooting

### Error: "The subscription is not registered to use namespace 'Microsoft.ContainerService'"

```bash
az provider register --namespace Microsoft.ContainerService
az provider register --namespace Microsoft.DBforPostgreSQL
az provider register --namespace Microsoft.Cache
az provider register --namespace Microsoft.Storage
az provider register --namespace Microsoft.KeyVault
```

### Error: "Service principal does not have permission to create role assignments"

```bash
# Grant User Access Administrator role
az role assignment create \
  --assignee <service-principal-id> \
  --role "User Access Administrator" \
  --scope /subscriptions/<subscription-id>
```

### Error: "Invalid AZURE_CREDENTIALS format"

Ensure the secret is valid JSON (use `--sdk-auth` flag when creating service principal).

### Error: "Resource group already exists"

The workflow will skip creation if the resource group exists. This is expected for re-deployments.

## Cost Alerts (Recommended)

Set up budget alerts to avoid unexpected charges:

```bash
az consumption budget create \
  --budget-name "tts-aks-monthly" \
  --amount 1000 \
  --time-grain Monthly \
  --category Cost \
  --notifications \
    actualGreaterThan=90 action=email contactEmails="<your-email>" \
    forecastedGreaterThan=100 action=email contactEmails="<your-email>"
```

## Next Steps

After secrets are configured:

1. **Test validation**: Push a change to `azure-update-aks` branch
2. **Check workflow**: Go to **Actions** tab, verify `validate` job succeeds
3. **Merge to master**: Create PR from `azure-update-aks` → `master`
4. **Deploy**: Merge triggers deployment to production (with approval if configured)
5. **Monitor**: Check deployment logs in **Actions** tab

## Workflow Outputs

After successful deployment, check the **Summary** page for:
- ✅ AKS cluster name
- ✅ Ingress public IP
- ✅ Console URL (https://<your-domain>)
- ✅ Gateway UDP endpoint (for LoRaWAN gateways)
- ✅ Next steps (DNS configuration, Helm chart deployment)

---

**Security Note**: Never commit secrets to Git. Always use GitHub Secrets for sensitive values.
