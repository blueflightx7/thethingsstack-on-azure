#!/bin/bash
# ==============================================================================
# Simple TTS Deployment Script (Bash)
# Deploys The Things Stack to Azure with minimal prompts
# ==============================================================================

set -e

LOCATION="${1:-centralus}"
ENVIRONMENT_NAME="${2:-tts-prod}"
ADMIN_EMAIL="${3:-}"

echo "================================"
echo "  TTS Azure Deployment Script"
echo "================================"
echo ""

# Prompt for admin email if not provided
if [ -z "$ADMIN_EMAIL" ]; then
    read -p "Enter admin email address: " ADMIN_EMAIL
fi

# Validate email format
if ! echo "$ADMIN_EMAIL" | grep -qE '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'; then
    echo "ERROR: Invalid email format: $ADMIN_EMAIL"
    exit 1
fi

# Generate resource group name with timestamp
TIMESTAMP=$(date +%Y%m%d%H%M)
RESOURCE_GROUP="rg-tts-$TIMESTAMP"

echo "Creating resource group: $RESOURCE_GROUP"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# Generate Key Vault name
KV_SUFFIX=$(openssl rand -hex 4)
KEY_VAULT_NAME="kv-tts-$KV_SUFFIX"

echo "Key Vault: $KEY_VAULT_NAME"

# Prompt for passwords securely
echo ""
read -sp "Enter VM admin password (for SSH access): " VM_ADMIN_PASSWORD
echo ""
read -sp "Enter TTS admin password (for console login): " TTS_ADMIN_PASSWORD
echo ""

echo ""
echo "Starting deployment..."
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "Environment: $ENVIRONMENT_NAME"

# Deploy
az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file ./deployments/vm/tts-docker-deployment.bicep \
    --parameters \
        location="$LOCATION" \
        environmentName="$ENVIRONMENT_NAME" \
        adminUsername="ttsadmin" \
        adminPassword="$VM_ADMIN_PASSWORD" \
        adminEmail="$ADMIN_EMAIL" \
        keyVaultName="$KEY_VAULT_NAME" \
        ttsAdminPasswordParam="$TTS_ADMIN_PASSWORD" \
        enableKeyVault=true \
    --output json > "deployment-$TIMESTAMP.json"

# Extract outputs
CONSOLE_URL=$(jq -r '.properties.outputs.consoleUrl.value' "deployment-$TIMESTAMP.json")
SSH_COMMAND=$(jq -r '.properties.outputs.sshCommand.value' "deployment-$TIMESTAMP.json")
ADMIN_USERNAME=$(jq -r '.properties.outputs.adminCredentials.value.username' "deployment-$TIMESTAMP.json")
GATEWAY_ADDRESS=$(jq -r '.properties.outputs.gatewayAddress.value' "deployment-$TIMESTAMP.json")
GRPC_API=$(jq -r '.properties.outputs.grpcApiUrl.value' "deployment-$TIMESTAMP.json")

echo ""
echo "================================"
echo "  Deployment Complete!"
echo "================================"
echo ""
echo "Console URL: $CONSOLE_URL"
echo "SSH Command: $SSH_COMMAND"
echo "Admin Username: $ADMIN_USERNAME"
echo "Admin Email: $ADMIN_EMAIL"
echo ""
echo "Gateway Address: $GATEWAY_ADDRESS"
echo "gRPC API: $GRPC_API"
echo ""
echo "Note: TTS is initializing in the background. Allow 5-10 minutes for full startup."
echo "Deployment info saved to: deployment-$TIMESTAMP.json"
