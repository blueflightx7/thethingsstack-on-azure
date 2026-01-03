# IoT Hub Integration Operations Guide

This guide covers the day-to-day operations, monitoring, and troubleshooting of the IoT Hub & Data Intelligence integration.

## 1. Monitoring & Observability

### 1.1 Key Metrics to Watch

| Resource | Metric | Threshold | Action |
| :--- | :--- | :--- | :--- |
| **IoT Hub** | `Total Number of Messages Used` | >80% of daily quota | Upgrade SKU or reduce telemetry frequency. |
| **Event Hub** | `Throttled Requests` | >0 | Increase Throughput Units (TUs). |
| **Function App** | `Execution Count` | Sudden drop to 0 | Check logs for errors or connectivity issues. |
| **SQL Database** | `DTU/CPU Percentage` | >90% sustained | Increase vCore max limit. |

### 1.2 Application Insights

The Function App is integrated with Application Insights. You can use the **Live Metrics Stream** to see real-time processing.

**Useful KQL Queries:**

*   **Recent Errors:**
    ```kusto
    exceptions
    | order by timestamp desc
    | take 20
    ```

*   **Processing Latency:**
    ```kusto
    requests
    | summarize avg(duration) by bin(timestamp, 5m)
    | render timechart
    ```

## 2. Database Management

### 2.1 Querying Data

You can query the data using the **Query Editor** in the Azure Portal, Azure Data Studio, or SSMS.

**Example: Get latest 10 measurements for a specific device**
```sql
SELECT TOP 10 *
FROM Measurements
WHERE DeviceID = (SELECT TOP 1 DeviceID FROM Devices WHERE DevEUI = 'AABBCCDDEEFF0011')
ORDER BY [Timestamp] DESC;
```

**Example: Extract cleaned JSON fields (gateway + RSSI)**
```sql
SELECT 
    JSON_VALUE(RawPayload, '$.cleaned.device_id') AS device_id,
    JSON_VALUE(RawPayload, '$.cleaned.gateway_id') AS gateway_id,
    TRY_CAST(JSON_VALUE(RawPayload, '$.cleaned.rssi') AS INT) AS rssi,
    [Timestamp]
FROM Measurements
WHERE [Timestamp] > DATEADD(hour, -1, SYSUTCDATETIME());
```

### 2.2 Data Retention & Cleanup

The `Measurements` table will grow indefinitely. It is recommended to implement a cleanup policy.

**Manual Cleanup (SQL Command):**
```sql
-- Delete data older than 90 days
DELETE FROM Measurements
WHERE [Timestamp] < DATEADD(day, -90, SYSUTCDATETIME());
```

**Automated Cleanup:**
You can use an **Azure Logic App** or an **Azure Automation Runbook** to execute this SQL command on a schedule (e.g., weekly).

## 3. Troubleshooting Common Issues

### 3.1 "No Data Appearing in SQL"

1.  **Check IoT Hub**: Is the "Message Count" increasing? If not, check TTS Webhook status.
2.  **Check Function App**: Go to the Function App in the portal -> Functions -> `ProcessToSQL` -> Monitor. Are there recent successes?
3.  **Check Logs**: Look for exceptions in Application Insights.
    *   *Common Error*: `Login failed for user '<token-identified principal>'`. -> Check Managed Identity permissions on SQL Server.
    *   *Common Error*: `The server was not found`. -> Check SQL Server firewall rules ("Allow Azure Services").

### 3.2 "Function App is Throttling"

If you see "429 Too Many Requests" or high latency:
*   **Cause**: Sudden burst of telemetry.
*   **Fix**: The Consumption plan should auto-scale. If it's hitting limits, consider moving to a Premium plan or optimizing the SQL insertion (batching is already implemented).

### 3.3 "SQL Database is Paused"

*   **Symptom**: First request after a long idle period takes 30+ seconds.
*   **Cause**: Serverless "Auto-pause" feature.
*   **Fix**: If low latency is critical 24/7, disable "Auto-pause" in the SQL Database "Compute + storage" settings (will increase cost).

### 3.4 "I can’t find the raw/cleaned payload files"

The per-uplink archives written by `ProcessToSQL` are stored in the Integration Storage Account containers:

- `raw-telemetry/<gateway>/<YYYYMMDD>/<device>/<timestamp>__<device>__<correlation>.raw.json`
- `processed-data/<gateway>/<YYYYMMDD>/<device>/<timestamp>__<device>__<correlation>.cleaned.json`
- `dead-letter/<gateway>/<YYYYMMDD>/<device>/<timestamp>__<device>__<correlation>__<stage>.deadletter.json`

Note that `raw-telemetry` also contains IoT Hub’s own batched archive output under:

- `raw-telemetry/<iothub>/<partition>/<YYYY>/<MM>/<DD>/<HH>/<mm>/...`

## 4. Disaster Recovery

### 4.1 Backups
*   **SQL Database**: Azure automatically handles full, differential, and transaction log backups. You can restore to a point-in-time (PITR) within the retention period (default 7 days).
*   **Infrastructure**: The entire environment is defined in Bicep (`integration.bicep`). You can redeploy to a new region in minutes.

### 4.2 Failover
*   In case of a regional outage, redeploy the stack to a paired region (e.g., `centralus` -> `eastus2`) using the deployment script.
*   Update the TTS Webhook URL to point to the new IoT Hub.

## 5. Security Rotation

### 5.1 Access Keys
*   **IoT Hub**: If you suspect a key compromise, regenerate the Shared Access Policy keys in the portal. **Update the TTS Webhook Authorization header immediately.**
*   **Storage/Event Hub**: Connection strings are stored in Key Vault and injected as app settings. If you rotate keys, re-run the deployment script or update the relevant Key Vault secrets/app settings.

### 5.2 Managed Identity
*   If the Function App identity is deleted, disable and re-enable "System assigned identity" in the Function App blade, then re-run the RBAC assignment commands (or redeploy the Bicep).

## 6. Common Gotchas

### 6.1 "Invalid column name 'CorrelationId'" when running schema in portal

This can happen if you paste parts of the schema into the Azure Portal query editor and SQL performs name resolution within a single batch.

- Run the full [deployments/integration/sql/schema.sql](../../deployments/integration/sql/schema.sql) as-is (it uses dynamic SQL for FK/index creation).
- Prefer running schema via the deployment script (it executes the file end-to-end).

### 6.2 Function compilation error: missing `BinaryData`

If `ProcessToSQL` fails compilation, verify that the ZIP deployment includes the dependency DLLs in `wwwroot/bin` and that [deployments/integration/function/ProcessToSQL/run.csx](../../deployments/integration/function/ProcessToSQL/run.csx) contains the required `#r` references (including `System.Memory.Data.dll`).
