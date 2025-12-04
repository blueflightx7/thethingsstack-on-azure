# Integration Bicep Reference

This document describes the resources defined in `deployments/integration/integration.bicep`.

## Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `location` | string | Resource Group Location | Azure region for deployment. |
| `prefix` | string | `ttsint` | Prefix for resource names (must be unique). |
| `sqlAdminLogin` | string | `ttsadmin` | Username for SQL Server administrator. |
| `sqlAdminPassword` | securestring | (Required) | Password for SQL Server administrator. |
| `enableMonitoring` | bool | `true` | Whether to deploy Application Insights. |

## Resources Deployed

### 1. Storage Account (`Microsoft.Storage/storageAccounts`)
*   **SKU**: Standard_LRS
*   **Purpose**: Stores Function App code, Event Hub checkpoints, and Dead-letter messages.
*   **Containers**: `azure-webjobs-hosts`, `azure-webjobs-eventhub`, `dead-letter`.

### 2. Azure IoT Hub (`Microsoft.Devices/IotHubs`)
*   **SKU**: S1 (Standard)
*   **Purpose**: MQTT/HTTP ingestion point for TTS Webhooks.
*   **Routing**: Configured to route all messages to the Event Hub.

### 3. Event Hub Namespace (`Microsoft.EventHub/namespaces`)
*   **SKU**: Basic
*   **Purpose**: High-throughput message bus.
*   **Hubs**: `telemetry` (2 partitions).

### 4. App Service Plan (`Microsoft.Web/serverfarms`)
*   **SKU**: Y1 (Dynamic/Consumption)
*   **Purpose**: Hosting plan for the Function App.

### 5. Function App (`Microsoft.Web/sites`)
*   **Runtime**: .NET 8 Isolated
*   **Purpose**: Runs the `TtsBridge` function.
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
