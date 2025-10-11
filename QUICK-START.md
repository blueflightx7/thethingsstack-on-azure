# Quick Reference Guide

## 🚀 Fastest Deployment (5 minutes)

```powershell
# 1. Login to Azure
Connect-AzAccount

# 2. Deploy
.\deploy-simple.ps1 -AdminEmail "your@email.com"

# 3. Wait 10-15 minutes for initialization
# 4. Access console at the URL provided
```

## 📝 Common Commands

### Deployment

```powershell
# Simple deployment
.\deploy-simple.ps1 -AdminEmail "admin@example.com"

# Custom location
.\deploy-simple.ps1 -Location "eastus" -AdminEmail "admin@example.com"

# Advanced deployment with all options
.\deploy.ps1 -Location "centralus" -EnvironmentName "tts-prod" -AdminEmail "admin@example.com" -VMSize "Standard_B4ms"
```

### Validation

```powershell
# Validate deployment
.\validate.ps1 -ResourceGroupName "rg-tts-202510101234"
```

### Cleanup

```powershell
# Delete specific resource group
.\cleanup.ps1 -ResourceGroupName "rg-tts-202510101234"

# Delete old deployments (older than 7 days)
.\cleanup.ps1 -OlderThanDays -Days 7

# Delete ALL TTS deployments (DANGEROUS!)
.\cleanup.ps1 -DeleteAll
```

## 🔧 SSH Commands

```bash
# Connect to VM
ssh ttsadmin@<vm-ip-address>

# View TTS logs
docker logs lorawan-stack_stack_1 -f

# View all containers
docker ps -a

# View cloud-init logs
sudo cat /var/log/cloud-init-output.log

# Restart TTS
docker restart lorawan-stack_stack_1

# Check TTS database
docker exec lorawan-stack_stack_1 ttn-lw-stack -c /config/tts.yml is-db --help
```

## 🐛 Troubleshooting Quick Fixes

### Admin User Not Created

```bash
ssh ttsadmin@<vm-ip>
printf 'YourPassword\nYourPassword\n' | sudo docker exec -i lorawan-stack_stack_1 \
    ttn-lw-stack -c /config/tts.yml is-db create-admin-user \
    --id ttsadmin --email admin@example.com
```

### OAuth Client Missing

```bash
sudo docker exec lorawan-stack_stack_1 ttn-lw-stack -c /config/tts.yml \
    is-db create-oauth-client --id console --name 'Console' \
    --secret 'console' --owner ttsadmin \
    --redirect-uri '/console/oauth/callback' \
    --logout-redirect-uri '/console'
```

### Check Database Connection

```bash
sudo docker exec lorawan-stack_stack_1 \
    ttn-lw-stack -c /config/tts.yml is-db get-user ttsadmin
```

### Restart Everything

```bash
cd /home/ttsadmin
docker-compose down
docker-compose up -d
```

## 📊 Monitoring

### View Deployment Outputs

```powershell
$deployment = Get-AzResourceGroupDeployment -ResourceGroupName "rg-tts-XXX" -Name "tts-docker-deployment"
$deployment.Outputs
```

### Check Resource Health

```powershell
# Get latest resource group
$rg = Get-AzResourceGroup | Where-Object ResourceGroupName -like 'rg-tts-*' | Sort-Object -Descending | Select-Object -First 1

# Check VM
Get-AzVM -ResourceGroupName $rg.ResourceGroupName -Status

# Check Database
Get-AzPostgreSqlFlexibleServer -ResourceGroupName $rg.ResourceGroupName
```

### View Logs in Azure Portal

1. Navigate to Resource Group
2. Click on Log Analytics Workspace
3. Go to "Logs"
4. Query:
   ```kql
   Syslog
   | where Computer contains "tts"
   | order by TimeGenerated desc
   ```

## 🔑 Default Credentials

### Console Login
- **URL**: https://<your-domain>/console
- **Username**: `ttsadmin`
- **Password**: (what you entered during deployment)

### SSH Access
- **User**: `ttsadmin`
- **Password**: (VM password from deployment)
- **Command**: `ssh ttsadmin@<vm-ip>`

### Database Access
- **Host**: <server-name>.postgres.database.azure.com
- **Database**: `ttn_lorawan`
- **User**: `ttsadmin`
- **Password**: (derived from VM password - alphanumeric only)

## 🌐 Important URLs

After deployment, you'll receive:

- **Console**: https://<domain>/console
- **OAuth**: https://<domain>/oauth
- **API**: https://<domain>/api/v3
- **Gateway UDP**: <domain>:1700
- **gRPC**: <domain>:8884

## ⚙️ Configuration Files Location

All configuration is in the VM at:

- **Docker Compose**: `/home/ttsadmin/docker-compose.yml`
- **TTS Config**: `/home/ttsadmin/config/tts.yml`
- **Certificates**: `/home/ttsadmin/certs/`
- **Data Volumes**: Docker volumes (stack_data, redis_data)

## 📦 Included Azure Resources

Each deployment creates:

- 1 × Virtual Machine (Ubuntu 22.04)
- 1 × PostgreSQL Flexible Server
- 1 × Virtual Network + Subnet
- 1 × Network Security Group
- 1 × Public IP + DNS
- 1 × Network Interface
- 1 × Key Vault (optional)
- 1 × Log Analytics Workspace
- 1 × Application Insights
- 1 × Activity Log Alert

## 💰 Cost Estimates

Approximate monthly costs (Central US region):

| Component | SKU | Monthly Cost |
|-----------|-----|--------------|
| VM | Standard_B4ms | ~$120 |
| PostgreSQL | Standard_B1ms | ~$25 |
| Storage | Premium SSD 128GB | ~$20 |
| Public IP | Standard | ~$4 |
| Key Vault | Standard | ~$1 |
| Log Analytics | Pay-as-you-go | ~$5-10 |
| **TOTAL** | | **~$175-180/month** |

> 💡 **Tip**: Use smaller VM sizes for testing (Standard_B2s ~$30/month)

## 🔒 Security Checklist

- [x] HTTPS-only console access
- [x] SSH key or strong password
- [x] Network Security Group rules
- [x] Private database access (optional)
- [x] Key Vault for secrets (optional)
- [x] Monitoring and alerts enabled
- [x] Regular database backups

## 📞 Getting Help

1. **Check logs first**: `docker logs lorawan-stack_stack_1`
2. **Review FIXES.md**: All common issues documented
3. **Run validation**: `.\validate.ps1 -ResourceGroupName "rg-tts-XXX"`
4. **Check Azure Portal**: View deployment errors
5. **The Things Network Forum**: https://www.thethingsnetwork.org/forum/

## 🎯 Next Steps After Deployment

1. **Verify deployment**: Run `.\validate.ps1`
2. **Login to console**: Use the console URL provided
3. **Change default passwords**: For security
4. **Configure backups**: Set up database backup schedule
5. **Add gateways**: Register your LoRaWAN gateways
6. **Create applications**: Set up your first application
7. **Register devices**: Add your end devices

## 📚 Additional Resources

- [Main README](README.md) - Complete documentation
- [FIXES.md](FIXES.md) - All fixes explained
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [TTS Documentation](https://www.thethingsindustries.com/docs/)

---

**Version**: 1.5.0  
**Last Updated**: October 11, 2025  
**Status**: ✅ Production Ready
