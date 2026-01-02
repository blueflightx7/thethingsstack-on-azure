# Integration Bicep Reference

This document describes the resources defined in `deployments/integration/integration.bicep`.

## Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `location` | string | Resource Group Location | Azure region for deployment. |
| `prefix` | string | `tts-int` | Prefix for resource names (must be unique). |
| `sqlAdminLogin` | string | `ttsadmin` | Username for SQL Server administrator. |
| `sqlAdminPassword` | securestring | (Required) | Password for SQL Server administrator. |
| `enableMonitoring` | bool | `true` | Whether to deploy Application Insights. |

## Resources Deployed

### 1. Storage Account (`Microsoft.Storage/storageAccounts`)
*   **SKU**: Standard_LRS
*   **Purpose**: Integration storage for:
	*   IoT Hub raw archive routing endpoint
	*   `ProcessToSQL` per-uplink raw/cleaned archives
	*   Function host files + Event Hub checkpoints
*   **Containers**:
	*   `raw-telemetry`
	*   `processed-data`
	*   `dead-letter`
	*   (plus Azure Functions internal containers such as `azure-webjobs-hosts` / checkpoint state)

### 2. Azure IoT Hub (`Microsoft.Devices/IotHubs`)
*   **SKU**: B1 (Basic)
*   **Purpose**: Message ingestion + routing for telemetry.
*   **Routing**:
	*   `ToFabric` → Event Hub (`fabric-stream`)
	*   `ToArchive` → Storage container `raw-telemetry`

### 3. Event Hub Namespace (`Microsoft.EventHub/namespaces`)
*   **SKU**: Basic
*   **Purpose**: High-throughput message bus.
*   **Hubs**: `fabric-stream` (2 partitions).

### 4. App Service Plan (`Microsoft.Web/serverfarms`)
*   **SKU**: Y1 (Dynamic/Consumption)
*   **Purpose**: Hosting plan for the Function App.

### 5. Function App (`Microsoft.Web/sites`)
*   **Runtime**: Azure Functions v4 (`FUNCTIONS_WORKER_RUNTIME=dotnet`)
*   **Purpose**: Runs:
	*   `IngestWebhook` (HTTP)
	*   `ProcessToSQL` (Event Hub trigger)
*   **Identity**: System Assigned Managed Identity enabled.

### 6. SQL Server (`Microsoft.Sql/servers`)
*   **Purpose**: Logical server for the database.
*   **Security**: "Allow Azure Services" firewall rule enabled.

### 7. SQL Database (`Microsoft.Sql/servers/databases`)
*   **SKU**: General Purpose Serverless (GP_S_Gen5_1)
*   **Config**: Auto-pause enabled (60 min), Min vCore 0.5, Max vCore 4.

### 8. Application Insights (`Microsoft.Insights/components`)
*   **Purpose**: Monitoring and logging for the Function App.
*   *(Optional - only if `enableMonitoring` is true)*

## Outputs

| Output | Description |
| :--- | :--- |
| `iotHubName` | Name of the created IoT Hub. |
| `sqlServerName` | FQDN of the SQL Server. |
| `databaseName` | Name of the SQL Database. |
| `functionAppName` | Name of the Function App. |
