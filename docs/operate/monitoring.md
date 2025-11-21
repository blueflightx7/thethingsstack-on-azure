# Monitoring Add-On for The Things Stack on Azure

## Overview

The monitoring add-on allows you to add **Log Analytics**, **Application Insights**, and **Security Alerts** to an existing TTS deployment **after** the initial infrastructure is deployed. This is particularly useful when:

- Initial deployment had monitoring disabled due to policy restrictions
- You want to use existing monitoring resources
- You need to add monitoring to a deployment in a different resource group
- You're deploying in stages (infrastructure first, monitoring later)

## Features

✅ **Flexible Component Selection**
- Create new Log Analytics Workspace or use existing
- Create new Application Insights or use existing  
- Support for cross-resource-group monitoring resources
- Mix and match existing/new components

✅ **Interactive Deployment**
- Guided selection menus
- Resource discovery across subscription
- Validation and confirmation before deployment

✅ **Comprehensive Monitoring**
- Log Analytics for centralized logging
- Application Insights for APM and telemetry
- Security Alerts for security event monitoring

## Usage

### Option 1: Through Main Menu

```powershell
.\deploy.ps1
```

Select **[4] Add Monitoring to Existing Deployment** from the menu.

### Option 2: Direct Command

```powershell
.\deploy.ps1 -Mode monitoring
```

### Option 3: Standalone Script

```powershell
.\deployments\vm\deploy-monitoring.ps1
```

## Deployment Flow

```
┌─────────────────────────────────────────┐
│ 1. Select Resource Group               │
│    - Manual entry or list selection    │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│ 2. Configure Log Analytics Workspace   │
│    [1] Create new                       │
│    [2] Use existing (current RG)        │
│    [3] Use existing (any RG)            │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│ 3. Configure Application Insights      │
│    [1] Create new (recommended)         │
│    [2] Use existing (current RG)        │
│    [3] Use existing (any RG)            │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│ 4. Review Summary & Confirm             │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│ 5. Deploy Monitoring Infrastructure    │
│    - Creates selected resources         │
│    - Links components together          │
│    - Creates security alerts            │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│ 6. Output Connection Details           │
│    - Workspace ID                       │
│    - Instrumentation Key                │
│    - Connection String                  │
└─────────────────────────────────────────┘
```

## Example Scenarios

### Scenario 1: Add New Monitoring (Clean Slate)

You deployed TTS with `enableMonitoring=false` due to policy restrictions. Now the policy is lifted:

```powershell
.\deploy.ps1 -Mode monitoring
```

- Select your TTS resource group
- Choose **[1] Create new** for Log Analytics
- Choose **[1] Create new** for Application Insights
- Confirm and deploy

**Result**: New dedicated monitoring resources for your TTS deployment.

---

### Scenario 2: Use Existing Organization-Wide Workspace

Your organization has a centralized Log Analytics Workspace in a different resource group:

```powershell
.\deployments\vm\deploy-monitoring.ps1
```

- Select your TTS resource group
- Choose **[3] Use existing (any RG)**
- Select your central workspace from the list
- Choose **[1] Create new** for App Insights (specific to TTS)
- Confirm and deploy

**Result**: TTS logs go to central workspace, App Insights is TTS-specific.

---

### Scenario 3: Fully Existing Resources

You already have monitoring infrastructure you want to reuse:

```powershell
.\deploy.ps1 -Mode monitoring
```

- Select your TTS resource group
- Choose **[3] Use existing** for Log Analytics (select from list)
- Choose **[3] Use existing** for App Insights (select from list)
- Confirm and deploy

**Result**: Links existing resources, adds security alerts to your TTS RG.

## Outputs

After successful deployment, you'll receive:

```
Monitoring Resources:
  Log Analytics Workspace: tts-prod-logs-202501151030
  Workspace ID: /subscriptions/.../workspaces/tts-prod-logs-...

  Application Insights: tts-prod-appinsights
  Instrumentation Key: abc123...
  Connection String: InstrumentationKey=abc123...

  Security Alert: tts-prod-security-alert

Next Steps:
  1. Update your TTS application to use the Application Insights connection string
  2. Configure VM diagnostic settings to send logs to Log Analytics
  3. Set up custom alerts in the Azure Portal
```

## Configuration Integration

### Update TTS to Use App Insights

Add the connection string to your TTS configuration:

```yaml
# In docker-compose.yml or tts.yml
environment:
  - APPLICATIONINSIGHTS_CONNECTION_STRING=${AI_CONNECTION_STRING}
```

### Configure VM Diagnostics

```powershell
# Enable VM diagnostic extension
Set-AzVMDiagnosticsExtension `
  -ResourceGroupName "your-rg" `
  -VMName "your-vm" `
  -DiagnosticsConfigurationPath "./diagnostics.json" `
  -StorageAccountName "diagstorage"
```

### Link PostgreSQL to Log Analytics

```azurecli
# Enable diagnostic settings for PostgreSQL
az monitor diagnostic-settings create \
  --resource /subscriptions/.../providers/Microsoft.DBforPostgreSQL/flexibleServers/tts-db \
  --name "Send to Log Analytics" \
  --workspace /subscriptions/.../workspaces/tts-logs \
  --logs '[{"category":"PostgreSQLLogs","enabled":true}]' \
  --metrics '[{"category":"AllMetrics","enabled":true}]'
```

## Cost Considerations

| Component | Pricing Model | Estimated Cost |
|-----------|---------------|----------------|
| Log Analytics Workspace | Pay-per-GB ingested | ~$2-10/GB |
| Application Insights | Pay-per-GB + transaction costs | ~$2-5/GB |
| Security Alerts | Free | $0 |

**Typical Monthly Cost**: $20-50 for small deployments (<5GB/month of logs)

### Cost Optimization Tips

1. **Set retention policies**: Default is 30 days, adjust based on needs
2. **Use workspace-based App Insights**: Links to Log Analytics, avoids duplication
3. **Filter logs**: Don't send debug logs to production monitoring
4. **Use sampling**: Application Insights sampling reduces data volume

## Troubleshooting

### Policy Error: "Disallowed to create Log Analytics"

**Solution**: Use **[3] Use existing** and select a workspace in an approved resource group, or request policy exemption from your Azure admin.

---

### "Workspace not found in resource group"

**Solution**: Ensure the workspace name is correct and you have `Reader` permission on the resource group containing it.

---

### Application Insights Not Linked to Workspace

**Symptom**: App Insights shows "Classic" mode

**Solution**: When creating new App Insights, the script automatically links it to the selected Log Analytics Workspace (workspace-based mode).

---

### Security Alert Not Triggering

**Check**:
1. Verify alert is enabled: `az monitor activity-log alert show`
2. Check Action Groups are configured
3. Review alert rules in Azure Portal

## Advanced Usage

### Programmatic Deployment

```powershell
# Non-interactive deployment
.\deployments\vm\deploy-monitoring.ps1 `
  -ResourceGroupName "my-tts-rg" `
  -Location "eastus" `
  -LogAnalyticsWorkspaceName "my-logs" `
  -AppInsightsName "my-appinsights" `
  -UseExistingLogAnalytics $false `
  -UseExistingAppInsights $false
```

### Update Existing Deployment

If you initially deployed with `enableMonitoring=false`, you can now:

1. Deploy monitoring components using this add-on
2. Update your Bicep deployment with `enableMonitoring=true` and redeploy

The existing resources won't be recreated; the deployment will link to them.

## Security Considerations

✅ **RBAC Permissions**: Uses Azure RBAC for workspace access
✅ **Private Network Access**: Supports workspace firewall rules
✅ **Data Encryption**: Logs encrypted at rest and in transit
✅ **Audit Logging**: All monitoring access is logged

## Related Documentation

- [Azure Monitor Overview](https://docs.microsoft.com/azure/azure-monitor/overview)
- [Log Analytics Workspaces](https://docs.microsoft.com/azure/azure-monitor/logs/log-analytics-workspace-overview)
- [Application Insights](https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview)
- [TTS Deployment Guide](../../README.md)

---

**Last Updated**: January 15, 2025  
**Version**: 1.0.0
