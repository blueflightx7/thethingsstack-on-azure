# Plan: IoT Hub & Data Intelligence Integration

## 1. Overview
This plan adds a new deployment mode to the existing `deploy.ps1` orchestrator. It extends a running The Things Stack (TTS) instance (VM or AKS) with a comprehensive Azure IoT data platform.

**Key Constraints & Requirements:**
*   **Non-Enterprise TTS**: Must use Webhooks (HTTP) instead of native Azure integration.
*   **Real-Time Fabric**: Must provide an Event Hub feed for Azure Fabric.
*   **Data Lifecycle**: Raw data -> Hot -> Cool (30d) -> Archive (90d).
*   **Relational & KV Store**: Azure SQL (Relational) and Table Storage (KV).
*   **Event-Driven**: Use Event Grid/Hubs to decouple processing.
*   **Cost Conscious**: Use Serverless/Consumption tiers where possible.
*   **Independent Lifecycle**: Can be deployed/destroyed without affecting the main TTS deployment.

## 2. Architecture

```mermaid
graph TD
    TTS[The Things Stack] -->|HTTP Webhook| Func_Ingest[Azure Function\n(Webhook Receiver)]
    Func_Ingest -->|AMQP| IoTHub[Azure IoT Hub]
    
    subgraph "Azure IoT & Data Platform"
        IoTHub -->|Route: Telemetry| EventHub[Event Hub]
        IoTHub -->|Route: Archive| BlobRaw[Blob Storage\n(Raw JSON)]
        
        EventHub -->|Stream| Fabric[Azure Fabric\n(Real-Time Intelligence)]
        
        BlobRaw -->|Event Grid: BlobCreated| Func_Process[Azure Function\n(Data Processor)]
        
        Func_Process -->|Write| SQL[Azure SQL Database\n(Measurements/Hives)]
        Func_Process -->|Write| Table[Table Storage\n(Key-Value/State)]
        Func_Process -->|Write| BlobProc[Blob Storage\n(Formulated JSON)]
    end
```

## 3. Components & Resources

### A. Integration Infrastructure (`deployments/integration/integration.bicep`)
1.  **Azure IoT Hub (Basic Tier - B1)**
    *   Entry point for all device data.
    *   *Note*: B1 is cheapest ($10/mo). If Cloud-to-Device (Downlinks) is needed, must upgrade to Standard (S1 - $25/mo).
2.  **Azure Event Hub Namespace & Hub (Basic)**
    *   Dedicated high-throughput stream for **Azure Fabric**.
3.  **Storage Account (Data Lake Gen2)**
    *   **Containers**: `raw-telemetry`, `processed-data`.
    *   **Lifecycle Policy**: Move to Cool after 30 days, Archive after 90 days.
4.  **Azure SQL Database (Serverless)**
    *   Auto-pause enabled (1 hour delay) to save costs.
    *   Schema: `Devices`, `Measurements`, `Alerts` (mapped from Beep API).
5.  **Azure Function App (Consumption Plan)**
    *   **Runtime**: .NET 8 Isolated or PowerShell (depending on complexity).
    *   **Functions**:
        *   `IngestWebhook`: Accepts TTS JSON, pushes to IoT Hub.
        *   `ProcessTelemetry`: Triggered by Event Grid (Blob Created), parses data, writes to SQL/Table.
6.  **Event Grid System Topic**
    *   Source: Storage Account.
    *   Filter: `/blobServices/default/containers/raw-telemetry`.
    *   Target: `ProcessTelemetry` Function.

### B. Orchestration Scripts
1.  **`deployments/integration/deploy-integration.ps1`**
    *   Inputs: Resource Group, Location, SQL Admin Creds.
    *   Action: Deploys Bicep, configures IoT Hub Routes (Routing is complex in Bicep, might need PS post-config).
    *   Output: Webhook URL, Event Hub Connection String (for Fabric).
2.  **`deployments/integration/cleanup-integration.ps1`**
    *   Action: Deletes only the integration resources (tagged `Component=Integration`).
3.  **`deploy.ps1` Update**
    *   Add Menu Option `[6] Add IoT Hub & Data Intelligence`.

### C. Data Schema (`deployments/integration/sql/schema.sql`)
*   Based on Beep API documentation.
*   Tables: `hives`, `devices`, `measurements`, `alerts`.

## 4. Implementation Steps

1.  **Scaffold Directory**: Create `deployments/integration/` structure.
2.  **Develop Bicep**: Write `integration.bicep` with all resources and security rules (Managed Identities).
3.  **Develop Functions**: Create the Function App code to handle the "Non-Enterprise" bridge.
4.  **Develop SQL**: Create the initialization script.
5.  **Update Orchestrator**: Modify `deploy.ps1` to include the new mode.
6.  **Documentation**: Add `docs/INTEGRATION_GUIDE.md`.

## 5. Cost Estimate (Monthly)
*   **IoT Hub (B1)**: ~$10.00
*   **Event Hub (Basic)**: ~$11.00
*   **SQL Database (Serverless)**: ~$5.00 - $15.00 (depends on usage/pausing).
*   **Functions (Consumption)**: Free grant usually covers low/medium volume.
*   **Storage**: ~$1.00 - $5.00 (depends on data volume).
*   **Total**: ~$30 - $45 / month (added to existing TTS cost).

## 6. Fabric Connection
*   The deployment will output an **Event Hub Connection String**.
*   User Action: Go to Azure Fabric -> Real-Time Intelligence -> Eventstream -> Add Source -> Azure Event Hubs -> Paste Connection String.
