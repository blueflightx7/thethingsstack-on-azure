# Dashboard (Website) Deployment Guide

This guide deploys the **Dashboard** resources:
- Azure Static Web App (SWA) for the dashboard UI
- Azure Web PubSub for future realtime views

## Prerequisites

- Azure PowerShell (`Az`) and authenticated session (`Connect-AzAccount`)
- Azure CLI (`az`) authenticated (`az login`)
- Node.js 20+ and npm (for building the dashboard UI)
- Azure Static Web Apps CLI (for pushing content): `npm i -g @azure/static-web-apps-cli`

Note:
- The UI-only update script ([deployments/dashboard/update-dashboard.ps1](../../deployments/dashboard/update-dashboard.ps1)) will fail fast if required dependencies (`az`, `node`, `npm`) are missing.
- If you don’t want Node.js on your workstation, use CI/CD to build/deploy the dashboard instead.

Local dev (Windows + Linux):
- [docs/develop/dashboard-local-dev.md](../develop/dashboard-local-dev.md)

## Deploy infrastructure

Run the main orchestrator:

```powershell
.\deploy.ps1 -Mode dashboard
```

You will be prompted for a target Resource Group. The script deploys:
- [deployments/dashboard/dashboard.bicep](../../deployments/dashboard/dashboard.bicep)
- via [deployments/dashboard/deploy-dashboard.ps1](../../deployments/dashboard/deploy-dashboard.ps1)

On success it prints:
- Static Web App URL
- Static Web App name (needed to retrieve deployment token)
- Web PubSub hostname/name

## Deploy/update the dashboard UI

The UI source lives in [dashboard/package.json](../../dashboard/package.json) and is configured as a **static export** (`next.config.ts` uses `output: 'export'`).

### 1) Build the site

```powershell
cd .\dashboard
npm install
npm run build
```

The exported site will be under `dashboard/out`.

### 2) Deploy to Azure

The update script handles the SWA CLI deployment:

```powershell
.\deployments\dashboard\update-dashboard.ps1
```

You will be prompted for:
- Resource Group Name
- Static Web App Name (e.g., `tts-dash-xyz`)

## Troubleshooting

### Default Page Caching
If you see the default "Your Azure Static Web App is live" page after deployment:
1. Wait 5-10 minutes (Azure CDN caching).
2. Hard refresh your browser (`Ctrl+F5`).
3. Try accessing a specific file (e.g., `/404.html`) to verify content is present.

### Build Errors
If `npm run build` fails with "Module not found":
- Ensure all Fluent UI packages are installed:
  ```bash
  npm install @fluentui/react-components @fluentui/react-card @fluentui/react-icons @griffel/react
  ```
- Check for split packages (e.g., `Card` is in `@fluentui/react-card`, not `react-components`).

### SWA CLI
If deployment fails with "swa not found":
- Install the CLI globally: `npm i -g @azure/static-web-apps-cli`
- Or ensure `npx` is available on your PATH.

### 2) Retrieve the SWA deployment token

Use the Static Web App name printed by deployment:

```bash
az staticwebapp secrets list -n <static-web-app-name> -g <resource-group> --query properties.apiKey -o tsv
```

### 3) Push the content

```bash
swa deploy --app-location ./dashboard --output-location out --swa-config-location ./dashboard --env production --deployment-token <token>
```

## UI-only update via deploy.ps1

Once the infrastructure exists, you can update only the UI (no Bicep) via:

```powershell
.\deploy.ps1 -Mode dashboard-update
```

This will:
- build `dashboard/`
- retrieve the SWA deployment token
- deploy the exported output to the existing Static Web App

## Notes

- Entra ID auth is expected to be enabled for the dashboard, but requires an App Registration and SWA auth configuration. This guide intentionally deploys the core resources first.
- The Web PubSub endpoint is provisioned for realtime features; the current UI is a read-only shell with placeholders for Fabric RTI embedding and Digital Twins.
- Azure Static Web Apps isn't available in every Azure region. If you deploy from an unsupported region (for example `eastus`), the template will deploy the Static Web App in a supported region (for example `eastus2`).
