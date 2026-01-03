# Integration Function App Reference

The Integration Function App provides two Functions:

- `IngestWebhook` (HTTP): receives The Things Stack (TTS) webhook JSON and forwards it into Azure IoT Hub.
- `ProcessToSQL` (Event Hub trigger): consumes the IoT Hub-routed stream from Event Hub (`fabric-stream`), writes structured rows to Azure SQL, and archives both raw + cleaned payload JSON to Blob Storage.

This Function App is deployed by Option 6 / Integration and is defined by [deployments/integration/integration.bicep](../../deployments/integration/integration.bicep).

## Functions

### 1) `IngestWebhook`

- **Trigger**: `HttpTrigger`
- **Input**: TTS webhook payload (JSON)
- **Output**: IoT Hub message (`POST /devices/{id}/messages/events`) using the `IoTHubConnectionString` setting.

### 2) `ProcessToSQL`

- **Trigger**: `eventHubTrigger`
- **Event Hub**: `fabric-stream` (consumer group: `$Default`)
- **Output**:
  - SQL upserts/inserts into `Devices`, `Gateways`, `HiveIdentityGateways`, and `Measurements`
  - Blob writes (2 blobs per uplink) into containers:
    - `raw-telemetry`
    - `processed-data`

## Configuration (App Settings)

The Function App relies on the following Environment Variables (App Settings):

| Setting | Description |
| :--- | :--- |
| `AzureWebJobsStorage` | Storage connection string (also used for the `raw-telemetry` / `processed-data` containers). |
| `IoTHubConnectionString` | IoT Hub owner connection string used by `IngestWebhook`. |
| `EventHubConnection` | Event Hub connection string (Listen) used by `ProcessToSQL`. |
| `SqlConnectionString` | ADO.NET connection string for Azure SQL used by `ProcessToSQL` and the Dashboard API. |
| `FUNCTIONS_WORKER_RUNTIME` | `dotnet` (Azure Functions v4 C# script / in-process). |

## Code Structure (C# script)

The `ProcessToSQL` Function is implemented as C# script in [deployments/integration/function/ProcessToSQL/run.csx](../../deployments/integration/function/ProcessToSQL/run.csx).

Signature (simplified):

```csharp
public static async Task Run(string[] eventHubMessages, ILogger log)
```

## Dependency Packaging (Important)

Azure Functions v4 C# script requires shipping certain assemblies alongside the Function and referencing them via `#r`.

- Dependency project: [deployments/integration/function/deps.csproj](../../deployments/integration/function/deps.csproj)
- Prep script: [deployments/integration/function/prepare-deps.ps1](../../deployments/integration/function/prepare-deps.ps1)

The deployment flow publishes dependencies and copies DLLs (and required `runtimes/` assets) into `wwwroot/bin`, then `run.csx` references them (example: `Microsoft.Data.SqlClient`, `Azure.Storage.Blobs`, `System.Memory.Data`).

## Error Handling

- **Duplicates**: The SQL schema enforces de-duplication by `CorrelationId`; duplicates are skipped.
- **Non-uplink messages**: `ProcessToSQL` filters to uplinks to avoid NULL identity inserts.
- **Transient failures**: Event Hub checkpoints mean retries can occur until a batch succeeds.

## Performance Tuning

- **Batch size**: Configurable in `host.json`.
- **SQL throughput**: Consider batching and/or serverless max vCore adjustments if ingestion volume increases.
