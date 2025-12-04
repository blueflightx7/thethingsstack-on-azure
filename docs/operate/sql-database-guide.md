# Azure SQL Database Guide for TTS

This guide details the database schema, JSON handling, and optimization strategies for the SQL Database used in the integration.

## 1. Schema Design

The database uses a "Hybrid" schema: structured columns for metadata, and a JSON column for the flexible payload.

### Table: `uplink_data`

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uniqueidentifier` | Primary Key (GUID). |
| `device_id` | `nvarchar(100)` | The LoRaWAN Device EUI or ID. Indexed for fast lookups. |
| `received_at` | `datetime2` | Timestamp when the message was received by the Function. Indexed. |
| `payload` | `nvarchar(max)` | The full JSON payload from TTS Webhook. Contains `uplink_message`, `end_device_ids`, etc. |

## 2. Working with JSON Data

Azure SQL has native JSON support. You do not need to extract every field into a column.

### 2.1 `JSON_VALUE` vs `JSON_QUERY`

*   **`JSON_VALUE`**: Extracts a scalar value (string, number, boolean).
    ```sql
    SELECT JSON_VALUE(payload, '$.uplink_message.f_port')
    ```
*   **`JSON_QUERY`**: Extracts an object or array.
    ```sql
    SELECT JSON_QUERY(payload, '$.uplink_message.rx_metadata')
    ```

### 2.2 Performance Indexing

If you frequently query a specific JSON property (e.g., `f_port`), you should create a **Computed Column** and index it.

```sql
-- 1. Add computed column
ALTER TABLE uplink_data
ADD f_port AS CAST(JSON_VALUE(payload, '$.uplink_message.f_port') AS INT);

-- 2. Index the computed column
CREATE INDEX IX_uplink_data_f_port ON uplink_data(f_port);
```

Now, queries filtering by `f_port` will be extremely fast.

## 3. Maintenance

### 3.1 Index Fragmentation

Over time, indexes can become fragmented.

```sql
-- Check fragmentation
SELECT * FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, NULL);

-- Rebuild index (if > 30%)
ALTER INDEX ALL ON uplink_data REBUILD;
```

### 3.2 Statistics

Ensure statistics are up to date for the query optimizer.

```sql
UPDATE STATISTICS uplink_data;
```

## 4. Security

*   **Firewall**: Only allow access from specific IPs or Azure Services.
*   **Authentication**: Prefer Microsoft Entra ID (formerly Azure AD) authentication over SQL Login/Password.
*   **Auditing**: Enable "Auditing" in the Azure Portal to track who is accessing the data (logs to Storage Account).
