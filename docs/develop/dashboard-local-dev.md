# Dashboard local development (Windows + Linux)

This project’s dashboard is a **Next.js static site** in [dashboard/](../../dashboard/). You need Node.js to build and run it locally.

## Prerequisites

- Node.js **20.x** recommended (18.x typically works, but 20.x is the safest default).
- npm (ships with Node).

### Windows

- Install Node.js from: https://nodejs.org/
- Verify:
  - `node --version`
  - `npm --version`

### Linux (Ubuntu/Debian example)

Use your preferred Node installation method. If you already use `nvm`, that’s fine.

Example using NodeSource (Ubuntu/Debian):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version
```

## Run locally (dev server)

From repo root:

```bash
cd dashboard
npm ci
npm run dev
```

- Default URL: http://localhost:3000

## Build a static export (what SWA deploys)

```bash
cd dashboard
npm ci
npm run build
```

This generates the static output under `dashboard/out/`.

## Optional: Static Web Apps CLI (local SWA emulation)

If you want a SWA-like local experience:

```bash
npm install -g @azure/static-web-apps-cli
cd dashboard
swa start http://localhost:3000 --swa-config-location .
```

Notes:
- This is optional; normal `npm run dev` is usually enough.

## Windows: deploy the dashboard to Azure (local)

This path deploys from your Windows machine using the repo’s PowerShell orchestrator.

### Prerequisites (Windows)

- Azure CLI installed and logged in:
  - Install: https://learn.microsoft.com/cli/azure/install-azure-cli
  - Login: `az login`
- Node.js 20+ installed (includes `node`, `npm`, `npx`): https://nodejs.org/

Tip: if you don’t want Node.js on your workstation, use CI/CD to build and deploy the dashboard instead.

### 1) Deploy infrastructure (one-time)

From repo root (PowerShell):

```powershell
\deploy.ps1 -Mode dashboard
```

This creates/updates the Azure Static Web App and prints the Static Web App name and URL.

### 2) Deploy UI only (repeat for updates)

From repo root (PowerShell):

```powershell
\deploy.ps1 -Mode dashboard-update
```

What it does:
- Validates dependencies (`az`, `node`, `npm`) and that `az` is logged in
- Builds the dashboard (`npm ci`/`npm install`, then `npm run build`)
- Retrieves the SWA deployment token automatically
- Deploys the exported output (`dashboard/out`) to the existing Static Web App

If you need to run the script directly (advanced), it’s:
- [deployments/dashboard/update-dashboard.ps1](../../deployments/dashboard/update-dashboard.ps1)
