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

**Example: Get latest 10 uplinks for a specific device**
```sql
SELECT TOP 10 *
FROM uplink_data
WHERE device_id = 'my-device-01'
ORDER BY received_at DESC;
```

**Example: Extract JSON fields**
```sql
SELECT 
    device_id,
    JSON_VALUE(payload, '$.uplink_message.f_port') AS f_port,
    JSON_VALUE(payload, '$.uplink_message.rx_metadata[0].rssi') AS rssi
FROM uplink_data
WHERE received_at > DATEADD(hour, -1, GETDATE());
```

### 2.2 Data Retention & Cleanup

The `uplink_data` table will grow indefinitely. It is recommended to implement a cleanup policy.

**Manual Cleanup (SQL Command):**
```sql
-- Delete data older than 90 days
DELETE FROM uplink_data
WHERE received_at < DATEADD(day, -90, GETDATE());
```

**Automated Cleanup:**
You can use an **Azure Logic App** or an **Azure Automation Runbook** to execute this SQL command on a schedule (e.g., weekly).

## 3. Troubleshooting Common Issues

### 3.1 "No Data Appearing in SQL"

1.  **Check IoT Hub**: Is the "Message Count" increasing? If not, check TTS Webhook status.
2.  **Check Function App**: Go to the Function App in the portal -> Functions -> `TtsBridge` -> Monitor. Are there recent successes?
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
*   **Storage/Event Hub**: Managed Identity is used, so no keys need rotation in the code.

### 5.2 Managed Identity
*   If the Function App identity is deleted, disable and re-enable "System assigned identity" in the Function App blade, then re-run the RBAC assignment commands (or redeploy the Bicep).
