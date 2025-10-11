# Production Security Hardening Guide

## Overview
This guide covers security hardening measures for The Things Stack deployment on Azure.

---

## ✅ Implemented Security Features

### 1. SSH Access Restriction
**Status**: ✅ FIXED
- **Issue**: SSH was accessible from any IP (0.0.0.0/0)
- **Fix**: Auto-detects deployer's public IP and restricts SSH access
- **Implementation**:
  - `deploy-simple.ps1` detects IP via ipify.org API
  - NSG rule `AllowSSH` uses `adminSourceIP` parameter
  - Fallback: Manual IP entry if auto-detection fails
  - Warning displayed if user allows ANY

**Configuration**:
```powershell
# Automatic detection in deploy-simple.ps1
$deployerIP = (Invoke-RestMethod -Uri 'https://api.ipify.org?format=json').ip

# NSG Rule in Bicep
sourceAddressPrefix: adminSourceIP  # Not '*'
```

### 2. Private Database Access
**Status**: ✅ ENABLED BY DEFAULT
- PostgreSQL accessible only via private endpoint (VNet integration)
- Public access disabled
- Database subnet: `10.0.1.0/24` with delegation
- Parameter: `enablePrivateDatabaseAccess = true`

### 3. Key Vault Integration
**Status**: ✅ ENABLED BY DEFAULT
- All secrets stored in Azure Key Vault
- RBAC-based access control
- No secrets in plain text
- Secrets:
  - `db-password`
  - `tts-admin-password`
  - `tts-admin-username`
  - `cookie-hash-key`
  - `cookie-block-key`
  - `oauth-client-secret`
  - `admin-email`
  - `checksum`

### 4. TLS/SSL Encryption
**Status**: ✅ ENABLED
- Let's Encrypt SSL certificates auto-provisioned
- HTTPS enforced for console access
- Certificate auto-renewal via certbot
- ACME challenge via HTTP-01

### 5. Network Security Groups (NSG)
**Current Rules**:
- ✅ SSH (22): Restricted to deployer IP
- ✅ HTTP (80): Open (required for Let's Encrypt)
- ✅ HTTPS (443): Open (console access)
- ✅ LoRaWAN UDP (1700): Open (gateway communication)
- ✅ gRPC (8884): Open (API access)

### 6. VM Security
- Managed Identity enabled
- Azure VM Agent installed
- Password authentication (SSH key support available)
- Regular security updates via cloud-init

---

## 📋 Additional Production Security Recommendations

### HIGH PRIORITY

#### 1. Implement Azure Bastion (Recommended)
**Current**: Direct SSH via public IP  
**Recommended**: Use Azure Bastion for jump-box access

**Benefits**:
- No public IP exposure for VM
- RDP/SSH over SSL through Azure portal
- No client software required
- Centralized access logging

**Implementation**:
```bicep
// Add to Bicep template
param enableBastion bool = false

resource bastionSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-04-01' = if (enableBastion) {
  parent: vnet
  name: 'AzureBastionSubnet'
  properties: {
    addressPrefix: '10.0.2.0/24'
  }
}

resource bastion 'Microsoft.Network/bastionHosts@2023-04-01' = if (enableBastion) {
  name: 'bastion-${environmentName}'
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'bastion-ipconfig'
        properties: {
          subnet: {
            id: bastionSubnet.id
          }
          publicIPAddress: {
            id: bastionPublicIP.id
          }
        }
      }
    ]
  }
}
```

#### 2. Remove Public IP from VM (if using Bastion)
```bicep
param usePublicIP bool = true  // Set to false with Bastion

resource pip 'Microsoft.Network/publicIPAddresses@2023-04-01' = if (usePublicIP) {
  // ...
}
```

#### 3. Disable SSH After Initial Setup
**Option A**: Remove NSG rule after deployment
```bash
# After successful deployment
az network nsg rule delete \
  --resource-group rg-tts-xxx \
  --nsg-name nsg-tts-xxx \
  --name AllowSSH
```

**Option B**: Change SSH to deny
```bash
az network nsg rule update \
  --resource-group rg-tts-xxx \
  --nsg-name nsg-tts-xxx \
  --name AllowSSH \
  --access Deny
```

#### 4. Implement Azure Firewall
- Centralized network security
- Threat intelligence
- Application-level filtering
- Outbound traffic control

#### 5. Enable Azure DDoS Protection
```bicep
resource ddosProtectionPlan 'Microsoft.Network/ddosProtectionPlans@2023-04-01' = {
  name: 'ddos-${environmentName}'
  location: location
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-04-01' = {
  properties: {
    enableDdosProtection: true
    ddosProtectionPlan: {
      id: ddosProtectionPlan.id
    }
  }
}
```

### MEDIUM PRIORITY

#### 6. Restrict gRPC API Access
**Current**: Open to world  
**Recommended**: Restrict to known client IPs or VPN

```bicep
{
  name: 'AllowGRPC'
  properties: {
    sourceAddressPrefix: clientIPRange  // Not '*'
    destinationPortRange: '8884'
  }
}
```

#### 7. Implement API Rate Limiting
Configure Redis-based rate limiting in TTS:
```yaml
rate-limiting:
  provider: redis
  redis:
    address: redis:6379
```

#### 8. Enable Azure Monitor & Logging
```bicep
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'law-${environmentName}'
  location: location
}

resource vmDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: vm
  name: 'vm-diagnostics'
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      {
        category: 'Administrative'
        enabled: true
      }
    ]
  }
}
```

#### 9. Enable Azure Security Center
- Vulnerability assessment
- Security recommendations
- Threat detection
- Compliance monitoring

#### 10. Implement Network Watcher
- Flow logs for NSG
- Connection monitoring
- Packet capture capabilities

### LOW PRIORITY

#### 11. Enable VM Disk Encryption
```bicep
resource vm 'Microsoft.Compute/virtualMachines@2023-03-01' = {
  properties: {
    storageProfile: {
      osDisk: {
        encryptionSettings: {
          enabled: true
          diskEncryptionKey: {
            sourceVault: {
              id: keyVault.id
            }
          }
        }
      }
    }
  }
}
```

#### 12. Implement Azure Policy
- Enforce naming conventions
- Require specific tags
- Enforce encryption
- Audit compliance

#### 13. Regular Security Audits
```bash
# Run Azure Security Benchmark assessment
az security assessment list --resource-group rg-tts-xxx

# Check for vulnerabilities
az security assessment-metadata list
```

---

## 🔒 Application-Level Security

### 1. TTS Admin Password Policy
**Current**: User-defined  
**Recommended**:
- Minimum 16 characters
- Must include: uppercase, lowercase, numbers, special chars
- No dictionary words
- Rotate every 90 days

### 2. OAuth Security
**Implemented**:
- Client ID: `console`
- Client Secret: `console` (⚠️ CHANGE THIS!)

**Recommended**:
```bash
# Generate strong OAuth secret
ssh ttsadmin@<VM-IP>
sudo docker exec ttsadmin_stack_1 ttn-lw-stack -c /config/tts.yml \
  is-db create-oauth-client \
  --id console \
  --name 'Console' \
  --secret "$(openssl rand -base64 32)" \
  --owner admin \
  --redirect-uri '/console/oauth/callback'
```

### 3. Enable MFA (Multi-Factor Authentication)
Configure TOTP in TTS:
```yaml
is:
  user-registration:
    contact-info-validation:
      required: true
```

### 4. Session Management
```yaml
http:
  cookie:
    hash-key: <64-byte-key>    # Already implemented
    block-key: <64-byte-key>   # Already implemented
```

### 5. API Key Rotation
- Rotate API keys every 30-90 days
- Revoke unused keys
- Monitor API key usage

---

## 🛡️ Docker Security

### 1. Run Containers as Non-Root
**Current**: Running as root  
**Recommended**:
```yaml
services:
  stack:
    user: "1000:1000"  # Non-root user
```

### 2. Limit Container Resources
```yaml
services:
  stack:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

### 3. Security Scanning
```bash
# Scan Docker images
docker scan thethingsnetwork/lorawan-stack:latest

# Update to latest secure version
docker pull thethingsnetwork/lorawan-stack:latest
```

### 4. Enable Docker Content Trust
```bash
export DOCKER_CONTENT_TRUST=1
```

---

## 📊 Monitoring & Alerting

### 1. Set Up Alerts
- Failed login attempts > 5
- SSH connections from unexpected IPs
- High CPU/Memory usage
- Database connection failures
- SSL certificate expiry (< 30 days)

### 2. Log Aggregation
- Send Docker logs to Azure Monitor
- Centralize TTS application logs
- Enable audit logging

### 3. Health Checks
```bash
# Add health check endpoint monitoring
curl https://your-domain.com/healthz
```

---

## 🔐 Secrets Management

### Current State
✅ Secrets stored in Azure Key Vault  
✅ RBAC-based access  
✅ No hardcoded credentials

### Best Practices
1. **Rotate Secrets Regularly**:
   - Database password: Every 90 days
   - TTS admin password: Every 90 days
   - Cookie keys: Every 180 days

2. **Audit Secret Access**:
```bash
az monitor activity-log list \
  --resource-group rg-tts-xxx \
  --start-time 2025-01-01 \
  --query "[?contains(resourceType, 'KeyVault')]"
```

3. **Enable Key Vault Soft Delete**:
```bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  properties: {
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
  }
}
```

---

## 🚨 Incident Response

### 1. Prepare Runbooks
- Compromised credentials
- DDoS attack
- Data breach
- Service outage

### 2. Contact Points
- Azure Support
- Security team
- On-call engineer

### 3. Backup & Recovery
```bash
# Automated PostgreSQL backups
# Retention: 7 days (configurable)

# Manual backup
az postgres flexible-server backup create \
  --resource-group rg-tts-xxx \
  --name tts-prod-db-xxx \
  --backup-name manual-backup-$(date +%Y%m%d)
```

---

## 📝 Compliance

### Standards to Consider
- **ISO 27001**: Information Security Management
- **SOC 2**: Service Organization Controls
- **GDPR**: Data protection (if EU users)
- **HIPAA**: Healthcare data (if applicable)

---

## ✅ Quick Security Checklist

Before going to production:

- [ ] SSH restricted to known IPs or Bastion
- [ ] All secrets in Key Vault
- [ ] TLS/SSL enabled with valid certificates
- [ ] Database private endpoint configured
- [ ] Strong admin passwords (16+ chars)
- [ ] OAuth secret changed from default
- [ ] Monitoring & alerting configured
- [ ] Backup strategy defined
- [ ] Incident response plan documented
- [ ] Security scan completed
- [ ] Penetration testing performed (recommended)
- [ ] Security review with team
- [ ] Compliance requirements met

---

## 🔄 Maintenance Schedule

### Daily
- Monitor alerts
- Check service health

### Weekly
- Review access logs
- Check for security updates

### Monthly
- Security audit
- Review NSG rules
- Check for unused resources

### Quarterly
- Rotate secrets
- Penetration testing
- Disaster recovery drill
- Review security policies

---

## 📞 Support & Resources

- **Azure Security Documentation**: https://docs.microsoft.com/azure/security/
- **TTS Security Guide**: https://www.thethingsindustries.com/docs/reference/security/
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/

---

## Version History

- **v1.0** (2025-10-11): Initial security hardening guide
  - SSH IP restriction implemented
  - Production recommendations documented
