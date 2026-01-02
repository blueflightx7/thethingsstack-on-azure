# Azure SQL Database Guide (Integration)

This guide covers the SQL schema used by the IoT Hub integration (Option 6), how to query JSON payloads, and basic operational guidance.

The canonical schema is defined in [deployments/integration/sql/schema.sql](../../deployments/integration/sql/schema.sql).

## 1. Schema Overview

The database uses a hybrid model: structured columns for common analytics fields plus a JSON column for the full payload.

### 1.1 Core Tables

- `Devices`
    - Device catalog keyed by `DeviceID`.
    - Includes `DevEUI` and deterministic `HiveIdentity` (GUID) used to group devices logically.

- `Gateways`
    - Gateway catalog keyed by `GatewayID`.

- `HiveIdentityGateways`
    - Mapping table linking a `HiveIdentity` to one or more gateways (derived during ingestion).

- `Measurements`
    - One row per uplink.
    - Stores extracted columns (temperature/weight/battery/FFT bins etc) and `RawPayload` JSON.
    - Includes `CorrelationId` for de-duplication.

## 2. De-duplication (CorrelationId)

`Measurements.CorrelationId` is used to prevent double-inserts when upstream systems retry.

- The schema enforces uniqueness via a unique filtered index.
- The ingestion function treats unique key violations as duplicates and skips them.

## 3. Working with JSON Data

The `Measurements.RawPayload` column contains both the original payload and a cleaned/extracted view.

### 3.1 `JSON_VALUE` vs `JSON_QUERY`

- `JSON_VALUE` extracts scalars:
    ```sql
    SELECT JSON_VALUE(RawPayload, '$.cleaned.gateway_id')
    ```

- `JSON_QUERY` extracts objects/arrays:
    ```sql
    SELECT JSON_QUERY(RawPayload, '$.raw.uplink_message.rx_metadata')
    ```

### 3.2 Example Queries

**Latest messages (last hour)**

```sql
SELECT TOP 50
    [Timestamp],
    JSON_VALUE(RawPayload, '$.cleaned.device_id') AS device_id,
    JSON_VALUE(RawPayload, '$.cleaned.gateway_id') AS gateway_id,
    Temperature_Inner,
    Weight_KG,
    BatteryPercent
FROM Measurements
WHERE [Timestamp] >= DATEADD(hour, -1, SYSUTCDATETIME())
ORDER BY [Timestamp] DESC;
```

**Gateways seen recently (last hour)**

```sql
SELECT
    JSON_VALUE(RawPayload, '$.cleaned.gateway_id') AS gateway_id,
    COUNT_BIG(1) AS messages
FROM Measurements
WHERE [Timestamp] >= DATEADD(hour, -1, SYSUTCDATETIME())
    AND JSON_VALUE(RawPayload, '$.cleaned.gateway_id') IS NOT NULL
GROUP BY JSON_VALUE(RawPayload, '$.cleaned.gateway_id')
ORDER BY messages DESC;
```

## 4. Maintenance & Ops

- **Retention**: implement a scheduled cleanup of old `Measurements` rows (and/or archive downstream).
- **Index health**: if query performance degrades at high volume, review fragmentation and add targeted indices.

## 5. Security Notes

- **Firewall**: SQL Server is configured with “Allow Azure Services” to support Function access.
- **Secrets**: connection strings are stored in Key Vault by the deployment scripts.
