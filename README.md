# The Things Stack on Azure

Complete deployment solution for The Things Stack (LoRaWAN Network Server) on Azure using Docker containers and PostgreSQL Flexible Server.

## 🚀 Quick Start

### Prerequisites

- Azure subscription
- Azure CLI or PowerShell with Az module
- Bicep CLI (for development)

### Simple Deployment (PowerShell)

```powershell
.\deploy-simple.ps1 -AdminEmail "your-email@example.com"
```

### Advanced Deployment (PowerShell)

```powershell
.\deploy.ps1 `
    -Location "centralus" `
    -EnvironmentName "tts-prod" `
    -AdminEmail "your-email@example.com" `
    -VMSize "Standard_B4ms"
```

### Bash Deployment

```bash
chmod +x deploy.sh
./deploy.sh centralus tts-prod your-email@example.com
```

## 📋 What Gets Deployed

### Core Infrastructure

- **Virtual Machine**: Ubuntu 22.04 LTS running Docker
- **PostgreSQL Database**: Flexible Server with optional private access
- **Networking**: VNet, NSG, Public IP with DNS
- **Storage**: Managed disks for VM and database
- **Key Vault**: Secure secrets management (optional)
- **Monitoring**: Log Analytics and Application Insights

### The Things Stack Components

- **Identity Server**: User and application management
- **Network Server**: LoRaWAN network management
- **Application Server**: Application integrations and webhooks
- **Join Server**: Device activation
- **Gateway Server**: Gateway connectivity (UDP, MQTT, Basic Station)
- **Console**: Web-based management interface

## 🔧 Configuration

### Default Ports

| Service | Port | Protocol | Description |
|---------|------|----------|-------------|
| Console | 443 | HTTPS | Web management interface |
| HTTP | 80 | HTTP | Redirects to HTTPS |
| Gateway UDP | 1700 | UDP | Semtech UDP protocol |
| gRPC API | 8884 | TCP | API access |
| SSH | 22 | TCP | VM management |

### Environment Variables

All sensitive configuration is managed through:
- Azure Key Vault (recommended for production)
- Secure parameters during deployment
- Cloud-init for initial VM setup

## 🛡️ Security Features

### Implemented Security (All 11 Fixes Applied)

1. ✅ **PostgreSQL Password Validation**: Alphanumeric-only passwords
2. ✅ **Database Username Sync**: Consistent username across all configs
3. ✅ **Cookie Key Length**: Exactly 64 characters for encryption
4. ✅ **PostgreSQL State Check**: Verify server readiness before deployment
5. ✅ **Admin Email Validation**: Proper email format enforcement
6. ✅ **Database Config Path**: Correct `/config/tts.yml` path
7. ✅ **Console API URLs**: Proper base URL configuration
8. ✅ **OAuth Redirect URI**: Single, correct redirect URI
9. ✅ **Retry Logic**: Handle timing issues during initialization
10. ✅ **Password Confirmation**: Proper stdin handling for user creation
11. ✅ **Container Readiness**: Wait for TTS to be fully ready

### Network Security

- Network Security Groups (NSG) with minimal required ports
- Optional private database access (VNet integration)
- SSH access restriction by source IP
- HTTPS-only console access
- Managed identities for Key Vault access

## 📊 Monitoring

### Built-in Monitoring

- **Log Analytics Workspace**: Centralized logging
- **Application Insights**: Performance monitoring
- **Activity Log Alerts**: Security event notifications
- **Container Logs**: Docker container output via SSH

### Access Logs

```bash
# SSH to VM
ssh ttsadmin@<vm-ip-address>

# View TTS logs
docker logs lorawan-stack_stack_1 -f

# View cloud-init logs
sudo cat /var/log/cloud-init-output.log
```

## 🔑 Access Credentials

### After Deployment

1. **Console Access**:
   - URL: `https://<your-domain>/console`
   - Username: `ttsadmin`
   - Password: (what you specified during deployment)

2. **SSH Access**:
   - User: `ttsadmin`
   - Password: (what you specified during deployment)
   - Command: `ssh ttsadmin@<public-ip>`

3. **Database Access**:
   - Host: `<db-server>.postgres.database.azure.com`
   - Database: `ttn_lorawan`
   - User: `ttsadmin`
   - Password: (derived from admin password)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Public Internet                      │
└────────────────┬────────────────────────────────────────┘
                 │
    ┌────────────▼───────────────┐
    │   Public IP + DNS Name     │
    │   Network Security Group   │
    └────────────┬───────────────┘
                 │
    ┌────────────▼───────────────┐
    │   Virtual Network (VNet)   │
    │                            │
    │  ┌──────────────────────┐  │
    │  │   Ubuntu 22.04 VM    │  │
    │  │                      │  │
    │  │  ┌────────────────┐  │  │
    │  │  │ Docker Engine  │  │  │
    │  │  │                │  │  │
    │  │  │ • TTS Stack    │  │  │
    │  │  │ • Redis        │  │  │
    │  │  └────────────────┘  │  │
    │  └──────────┬───────────┘  │
    │             │              │
    │  ┌──────────▼───────────┐  │
    │  │ PostgreSQL Flexible  │  │
    │  │ Server (Private)     │  │
    │  └──────────────────────┘  │
    └─────────────────────────────┘
             │
    ┌────────▼─────────┐
    │   Key Vault      │
    │   (Secrets)      │
    └──────────────────┘
             │
    ┌────────▼─────────┐
    │  Log Analytics   │
    │  App Insights    │
    └──────────────────┘
```

## 📝 Parameters Reference

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `adminEmail` | string | Admin email for certificates and user account |
| `adminPassword` | securestring | VM SSH password |
| `ttsAdminPasswordParam` | securestring | TTS console login password |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `location` | string | `resourceGroup().location` | Azure region |
| `environmentName` | string | `tts-docker` | Resource naming prefix |
| `adminUsername` | string | `ttsadmin` | VM and DB admin username |
| `vmSize` | string | `Standard_B4ms` | VM size |
| `domainName` | string | (auto-generated) | Custom domain name |
| `keyVaultName` | string | (auto-generated) | Key Vault name |
| `adminSourceIP` | string | `*` | SSH source IP restriction |
| `enablePrivateDatabaseAccess` | bool | `true` | Use VNet-integrated database |
| `enableKeyVault` | bool | `true` | Enable Key Vault |
| `cookieHashKey` | string | (auto-generated) | Session hash key (64 chars) |
| `cookieBlockKey` | string | (auto-generated) | Session encryption key (64 chars) |
| `oauthClientSecret` | securestring | `console` | OAuth client secret |

## 🧪 Development

### Build Bicep Template

```powershell
bicep build deployments/vm/tts-docker-deployment.bicep
```

### Validate Template

```powershell
az deployment group validate `
    --resource-group <rg-name> `
    --template-file deployments/vm/tts-docker-deployment.bicep `
    --parameters @parameters.json
```

### What-If Analysis

```powershell
az deployment group what-if `
    --resource-group <rg-name> `
    --template-file deployments/vm/tts-docker-deployment.bicep `
    --parameters @parameters.json
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Admin User Not Created

**Symptoms**: Can't login to console
**Cause**: Container wasn't ready when cloud-init ran
**Fix**: SSH to VM and manually create:

```bash
ssh ttsadmin@<vm-ip>
printf 'YourPassword\nYourPassword\n' | sudo docker exec -i lorawan-stack_stack_1 \
    ttn-lw-stack -c /config/tts.yml is-db create-admin-user \
    --id ttsadmin --email admin@example.com
```

#### 2. OAuth Client Missing

**Symptoms**: Console shows OAuth errors
**Fix**: SSH to VM and create:

```bash
sudo docker exec lorawan-stack_stack_1 ttn-lw-stack -c /config/tts.yml \
    is-db create-oauth-client --id console --name 'Console' \
    --secret 'console' --owner ttsadmin \
    --redirect-uri '/console/oauth/callback' \
    --logout-redirect-uri '/console'
```

#### 3. Database Connection Errors

**Symptoms**: "driver error" messages
**Check**:
1. PostgreSQL server is running
2. Firewall rules allow VM access
3. Connection string is correct in `/home/ttsadmin/config/tts.yml`

#### 4. Container Not Starting

**Check logs**:
```bash
docker logs lorawan-stack_stack_1
docker logs lorawan-stack_redis_1
sudo cat /var/log/cloud-init-output.log
```

## 📚 Additional Resources

- [The Things Stack Documentation](https://www.thethingsindustries.com/docs/)
- [Azure Bicep Documentation](https://docs.microsoft.com/azure/azure-resource-manager/bicep/)
- [LoRaWAN Specification](https://lora-alliance.org/resource_hub/lorawan-specification-v1-1/)

## 🤝 Contributing

This deployment is based on The Things Stack open-source project. Contributions welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This deployment configuration is provided as-is. The Things Stack is licensed separately.

## ⚠️ Important Notes

- **Initialization Time**: Allow 5-10 minutes after deployment for TTS to fully start
- **Passwords**: Save all passwords securely - they cannot be retrieved later
- **Costs**: Monitor Azure costs - running VMs and databases incur charges
- **Production**: For production use, enable private database access and restrict SSH access
- **Backups**: Configure database backups according to your requirements
- **SSL Certificates**: The deployment uses self-signed certificates. Replace with proper certificates for production.

## 🆘 Support

For issues with:
- **This deployment**: Check troubleshooting section above
- **The Things Stack**: Visit [The Things Stack forum](https://www.thethingsnetwork.org/forum/)
- **Azure**: Contact [Azure Support](https://azure.microsoft.com/support/)
