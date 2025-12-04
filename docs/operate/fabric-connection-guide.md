# Connecting Microsoft Fabric to TTS Data

Microsoft Fabric provides a unified analytics platform. This guide explains how to connect Fabric to your Azure SQL Database to visualize LoRaWAN telemetry.

## Prerequisites

*   An active Microsoft Fabric (or Power BI) capacity.
*   The **IoT Hub & Data Intelligence** integration deployed.
*   Your user account must have access to the Azure SQL Database (or you need the SQL Admin credentials).

## Step 1: Get Connection Details

1.  Navigate to your **Azure SQL Database** in the Azure Portal.
2.  Under **Settings**, click **Connection strings**.
3.  Copy the **Server name** (e.g., `sql-tts-integration-xyz.database.windows.net`).
4.  Ensure the firewall allows your IP (or "Allow Azure Services" if connecting from Fabric cloud).

## Step 2: Create a Lakehouse or Warehouse

1.  Open [Microsoft Fabric](https://app.fabric.microsoft.com/).
2.  Select the **Data Engineering** or **Data Warehouse** experience.
3.  Create a new **Lakehouse** or **Warehouse**.

## Step 3: Create a Shortcut (Recommended)

Shortcuts allow you to reference data without moving it.

1.  In your Lakehouse/Warehouse, select **Get data** -> **New shortcut**.
2.  Select **Azure SQL Database**.
3.  Enter the **Server** and **Database** names.
4.  **Authentication**:
    *   Select **Organizational account** (if your Entra ID user has access).
    *   Or **Basic** (using the SQL Admin login created during deployment).
5.  Select the `uplink_data` table.
6.  Click **Create**.

The table will now appear in your Fabric explorer as if it were a local table.

## Step 4: Analyze with SQL Endpoint

You can now write SQL queries directly in Fabric:

```sql
-- Calculate average RSSI per device
SELECT 
    device_id, 
    AVG(CAST(JSON_VALUE(payload, '$.uplink_message.rx_metadata[0].rssi') AS FLOAT)) as avg_rssi,
    COUNT(*) as message_count
FROM uplink_data
GROUP BY device_id
```

## Step 5: Visualize in Power BI

1.  Click the **New Report** button in the Fabric toolbar.
2.  Drag `device_id` to the Axis.
3.  Drag `received_at` to the Axis.
4.  Create measures for telemetry values (Temperature, Humidity) by parsing the JSON payload.

**Pro Tip**: Create a SQL View in the source database that pre-parses the JSON into columns. This makes Power BI reporting much easier.

```sql
CREATE VIEW v_Telemetry AS
SELECT
    id,
    device_id,
    received_at,
    CAST(JSON_VALUE(payload, '$.uplink_message.decoded_payload.temperature') AS FLOAT) as temperature,
    CAST(JSON_VALUE(payload, '$.uplink_message.decoded_payload.humidity') AS FLOAT) as humidity
FROM uplink_data;
```
