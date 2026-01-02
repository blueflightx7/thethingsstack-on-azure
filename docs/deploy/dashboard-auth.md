# Dashboard Authentication & Roles (Azure Static Web Apps)

This dashboard is a **Next.js static export** hosted on **Azure Static Web Apps (SWA)** with a **BYO backend** (Azure Functions).

There are two supported ways to do auth/roles:

1) **Invite-based roles (recommended for now)**
- Fastest path for production.
- You invite specific users and assign a role like `Admin`.
- The dashboard and API enforce access using route rules in `dashboard/staticwebapp.config.json`.

2) **Microsoft Entra ID app roles (single-tenant, recommended later)**
- Proper enterprise path: single tenant restriction, groups, app roles.
- Requires an Entra App Registration and SWA configured to use it.

---

## Current Role Model

These are the roles we use in SWA:

- `authenticated`: any logged-in user
- `Admin`: invited/admin users (used for admin UI + admin API)

Where these are enforced:

- Route rules: `dashboard/staticwebapp.config.json`
- Backend API role checks: `deployments/dashboard/api/Auth.cs` (`Auth.AdminRole = "Admin"`)

---

## Option A — Invite-Based Authentication + Custom Roles (NOW)

### 1) Ensure your SWA is Standard

BYO backends and advanced auth features require Standard.

### 2) Configure SWA Authentication provider

In Azure Portal:
- Static Web App → **Authentication**
- Add Microsoft identity provider
- Enable sign-in

This makes `/.auth/login/aad` work.

### 3) Invite users + assign roles

In Azure Portal:
- Static Web App → **Role management**
- Invite a user (email)
- Assign role(s):
  - `Admin` for admin users
  - leave empty / default for regular users

### 4) Verify route authorization rules

See `dashboard/staticwebapp.config.json`:

- `/*` requires `authenticated`
- `/api/*` requires `authenticated`
- `/admin/*` requires `Admin`
- `/api/admin/*` requires `Admin`

### 5) Backend API notes

SWA injects the user principal header (`x-ms-client-principal`) when requests flow through the SWA hostname.

- If you call the Function App directly (its `*.azurewebsites.net` hostname), you won’t get SWA auth headers.
- For strong security, also enable Function App authentication (Easy Auth) so direct calls are protected.

---

## Option B — Microsoft Entra ID (Single Tenant) + App Roles (LATER)

This is how you restrict login to a specific tenant and manage roles via Entra Groups.

### 1) Create an App Registration (single tenant)

In Microsoft Entra admin center:
- App registrations → New registration
- Supported account types: **Single tenant**
- Redirect URIs (Web):
  - `https://<YOUR_SWA_HOST>/.auth/login/aad/callback`

### 2) Define App Roles

In the same app registration:
- App roles → Create:
  - Display name: `Admin`
  - Value: `Admin`
  - Allowed member types: Users/Groups

Assign the role to users/groups.

### 3) Configure SWA to use the app registration

In Azure Portal:
- Static Web App → Authentication
- Configure Microsoft provider using the app registration details

Important:
- The dashboard code and SWA config expect the role string `Admin`.

### 4) (Recommended) Lock down the backend Function App too

In Azure Portal:
- Function App → Authentication
- Add identity provider: Microsoft
- Restrict issuer/tenant
- Require authentication

This protects direct calls to `https://<functionapp>.azurewebsites.net/*`.

---

## Troubleshooting

### "I can login but Admin page is blocked"

- Confirm the user invitation includes role `Admin`
- Confirm `dashboard/staticwebapp.config.json` uses `Admin` (not `Hive.Admin`)

### "Overview shows 500 / missing tables"

The dashboard API expects schema updates (including `HiveLocations`). Apply:
- `deployments/integration/sql/schema.sql`

### "Dark mode doesn’t change everything"

Global background/foreground uses Fluent CSS variables in:
- `dashboard/src/app/globals.css`

Component styling should use Fluent tokens from `@fluentui/react-theme`.
