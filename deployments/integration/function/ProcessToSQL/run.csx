// ==============================================================================
// ProcessToSQL Function - Event Hub Trigger
// ==============================================================================
//
// PURPOSE:
// This Azure Function processes telemetry from Event Hub, extracts beehive
// sensor data, and writes structured rows to Azure SQL Database while
// preserving the raw JSON payload for re-ingestion and analysis.
//
// TRIGGER: Event Hub (fabric-stream)
// - Consumes messages forwarded by IoT Hub routing
// - Batch processing (up to 100 messages per invocation)
// - Automatic checkpointing and retry
//
// DATA FLOW:
// 1. Receive batch of messages from Event Hub
// 2. Parse TTS JSON payload (uplink_message.decoded_payload)
// 3. Extract device identity (device_id, dev_eui, application_id)
// 4. Upsert device record in SQL Devices table
// 5. Insert measurement with structured columns + RawPayload JSON
// 6. Log success/failure for monitoring
//
// SQL SCHEMA:
// - Devices: DeviceID, DevEUI, HardwareID, Name, ApplicationID, LastSeenAt
// - Measurements: MeasurementID, DeviceID, Timestamp, Temperature_Inner,
//                 Weight_KG, BatteryVoltage, BatteryPercent, FFT bins,
//                 RawPayload (full JSON for replay)
//
// ERROR HANDLING:
// - Failed messages logged to Application Insights
// - Transient SQL errors trigger automatic retry (Event Hub checkpoint)
// - Malformed JSON skipped with warning log
//
// PERFORMANCE:
// - Batch inserts (SqlBulkCopy for >10 measurements)
// - Connection pooling enabled
// - Typical latency: <500ms for 100 messages
//
// ==============================================================================

// Functions v4 C# script does not implicitly include some assemblies.
// Load Microsoft.Data.SqlClient from the root bin folder (added during packaging).
#r "../bin/Microsoft.Data.SqlClient.dll"
#r "../bin/Azure.Core.dll"
#r "../bin/Azure.Storage.Common.dll"
#r "../bin/Azure.Storage.Blobs.dll"
#r "../bin/System.Memory.Data.dll"
#r "Newtonsoft.Json"

using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Data;
using System.Text;
using System.Threading.Tasks;
using Azure;
using Azure.Storage.Blobs;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

private static string sqlConnectionString = Environment.GetEnvironmentVariable("SqlConnectionString");
private static string storageConnectionString = Environment.GetEnvironmentVariable("AzureWebJobsStorage");

// Stable namespace UUID for deterministic HiveIdentity derivation.
private static readonly Guid HiveIdentityNamespace = new Guid("2c52f8d7-0d12-4d7d-8f18-6dcd7bd7f9a2");

public static async Task Run(string[] eventHubMessages, ILogger log)
{
    log.LogInformation($"Processing {eventHubMessages.Length} messages from Event Hub");

    if (string.IsNullOrEmpty(sqlConnectionString))
    {
        log.LogError("SqlConnectionString is missing - cannot write to database");
        return;
    }

    if (string.IsNullOrWhiteSpace(storageConnectionString))
    {
        log.LogError("AzureWebJobsStorage is missing - cannot write payloads to Blob Storage");
        return;
    }

    int successCount = 0;
    int errorCount = 0;
    int duplicateCount = 0;

    var blobServiceClient = new BlobServiceClient(storageConnectionString);
    var rawContainerClient = blobServiceClient.GetBlobContainerClient("raw-telemetry");
    var processedContainerClient = blobServiceClient.GetBlobContainerClient("processed-data");
    var deadLetterContainerClient = blobServiceClient.GetBlobContainerClient("dead-letter");
    await rawContainerClient.CreateIfNotExistsAsync();
    await processedContainerClient.CreateIfNotExistsAsync();
    await deadLetterContainerClient.CreateIfNotExistsAsync();

    using (var connection = new SqlConnection(sqlConnectionString))
    {
        await connection.OpenAsync();

        foreach (string message in eventHubMessages)
        {
            string stage = "start";
            string deviceId = null;
            string devEui = null;
            string applicationId = null;
            string gatewayId = null;
            string correlationId = null;
            DateTime receivedAtUtc = DateTime.UtcNow;
            JObject ttsPayload = null;
            JObject cleanedPayload = null;

            try
            {
                stage = "parse-json";
                ttsPayload = JObject.Parse(message);

                // Only process uplink messages (beehive sensor telemetry).
                // Other message types (join/location) may not have decoded payloads and can cause NULL identity values.
                var uplinkMessage = ttsPayload.SelectToken("uplink_message");
                if (uplinkMessage == null)
                {
                    string nonUplinkDeviceId = ttsPayload.SelectToken("end_device_ids.device_id")?.ToString();
                    log.LogInformation($"Skipping non-uplink message for device {nonUplinkDeviceId}");
                    continue;
                }

                // Extract device identity (TTS schema)
                stage = "extract-identity";
                deviceId = ttsPayload.SelectToken("end_device_ids.device_id")?.ToString();
                devEui = ttsPayload.SelectToken("end_device_ids.dev_eui")?.ToString();
                applicationId = ttsPayload.SelectToken("end_device_ids.application_ids.application_id")?.ToString();

                if (string.IsNullOrEmpty(deviceId))
                {
                    log.LogWarning("Skipping uplink: device_id not found");
                    await WriteDeadLetterAsync(
                        deadLetterContainerClient,
                        gatewayId,
                        receivedAtUtc,
                        deviceId,
                        correlationId,
                        stage: "validation",
                        errorType: "MissingField",
                        errorMessage: "device_id not found",
                        rawMessage: message,
                        parsedPayload: ttsPayload,
                        exception: null,
                        log: log
                    );
                    errorCount++;
                    continue;
                }

                if (string.IsNullOrEmpty(devEui))
                {
                    // DevEUI is required by current SQL schema (Devices.DevEUI NOT NULL)
                    log.LogWarning($"Skipping uplink for device {deviceId}: dev_eui not found in payload");
                    await WriteDeadLetterAsync(
                        deadLetterContainerClient,
                        gatewayId,
                        receivedAtUtc,
                        deviceId,
                        correlationId,
                        stage: "validation",
                        errorType: "MissingField",
                        errorMessage: "dev_eui not found",
                        rawMessage: message,
                        parsedPayload: ttsPayload,
                        exception: null,
                        log: log
                    );
                    errorCount++;
                    continue;
                }

                // Extract decoded payload (beehive sensors)
                var decodedPayload = uplinkMessage.SelectToken("decoded_payload");
                if (decodedPayload == null)
                {
                    log.LogWarning($"No decoded_payload for device {deviceId}");
                    await WriteDeadLetterAsync(
                        deadLetterContainerClient,
                        gatewayId,
                        receivedAtUtc,
                        deviceId,
                        correlationId,
                        stage: "validation",
                        errorType: "MissingField",
                        errorMessage: "decoded_payload not found",
                        rawMessage: message,
                        parsedPayload: ttsPayload,
                        exception: null,
                        log: log
                    );
                    errorCount++;
                    continue;
                }

                // Correlation id for dedupe + filenames
                stage = "extract-correlation";
                correlationId = ttsPayload.SelectToken("correlation_ids[0]")?.ToString();
                if (string.IsNullOrWhiteSpace(correlationId))
                {
                    correlationId = "computed:" + ComputeSha256Hex(message);
                }

                // Extract timestamp
                stage = "extract-timestamp";
                string receivedAtStr = ttsPayload.SelectToken("received_at")?.ToString();
                receivedAtUtc = string.IsNullOrEmpty(receivedAtStr) 
                    ? DateTime.UtcNow 
                    : DateTime.Parse(receivedAtStr).ToUniversalTime();

                // Extract sensor values (beehive-specific)
                decimal? tempInner = GetDecimalValue(decodedPayload, "t_i");
                decimal? tempOuter = GetDecimalValue(decodedPayload, "t_o");
                decimal? humidity = GetDecimalValue(decodedPayload, "h");
                decimal? batteryVoltage = GetDecimalValue(decodedPayload, "bv");
                int? batteryPercent = GetIntValue(decodedPayload, "bat_perc");
                decimal? soundFrequency = GetDecimalValue(decodedPayload, "sound");
                long? weightValue = GetLongValue(decodedPayload, "w_v");
                
                // FFT bins (sound frequency analysis)
                int? fftBin71_122 = GetIntValue(decodedPayload, "s_bin_71_122");
                int? fftBin122_173 = GetIntValue(decodedPayload, "s_bin_122_173");
                int? fftBin173_224 = GetIntValue(decodedPayload, "s_bin_173_224");
                int? fftBin224_276 = GetIntValue(decodedPayload, "s_bin_224_276");
                int? fftBin276_327 = GetIntValue(decodedPayload, "s_bin_276_327");
                int? fftBin327_378 = GetIntValue(decodedPayload, "s_bin_327_378");
                int? fftBin378_429 = GetIntValue(decodedPayload, "s_bin_378_429");
                int? fftBin429_480 = GetIntValue(decodedPayload, "s_bin_429_480");
                int? fftBin480_532 = GetIntValue(decodedPayload, "s_bin_480_532");
                int? fftBin532_583 = GetIntValue(decodedPayload, "s_bin_532_583");

                // Derived FFT summaries (for fast charting)
                var fftBins = new (string Range, int? Value)[]
                {
                    ("71-122", fftBin71_122),
                    ("122-173", fftBin122_173),
                    ("173-224", fftBin173_224),
                    ("224-276", fftBin224_276),
                    ("276-327", fftBin276_327),
                    ("327-378", fftBin327_378),
                    ("378-429", fftBin378_429),
                    ("429-480", fftBin429_480),
                    ("480-532", fftBin480_532),
                    ("532-583", fftBin532_583)
                };

                long? soundEnergyTotal = null;
                long? soundEnergyLow = null;
                long? soundEnergyMid = null;
                long? soundEnergyHigh = null;
                int? soundDominantBin = null;
                string soundDominantBinRange = null;

                if (fftBins.Any(b => b.Value.HasValue))
                {
                    soundEnergyTotal = fftBins.Where(b => b.Value.HasValue).Sum(b => (long)b.Value.Value);

                    soundEnergyLow = fftBins.Take(3).Where(b => b.Value.HasValue).Sum(b => (long)b.Value.Value);
                    soundEnergyMid = fftBins.Skip(3).Take(3).Where(b => b.Value.HasValue).Sum(b => (long)b.Value.Value);
                    soundEnergyHigh = fftBins.Skip(6).Where(b => b.Value.HasValue).Sum(b => (long)b.Value.Value);

                    int bestIndex = -1;
                    int bestValue = int.MinValue;
                    for (int i = 0; i < fftBins.Length; i++)
                    {
                        if (!fftBins[i].Value.HasValue) continue;
                        if (fftBins[i].Value.Value > bestValue)
                        {
                            bestValue = fftBins[i].Value.Value;
                            bestIndex = i;
                        }
                    }

                    if (bestIndex >= 0)
                    {
                        soundDominantBin = bestIndex + 1; // 1-based
                        soundDominantBinRange = fftBins[bestIndex].Range;
                    }
                }

                // Extract location from gateway metadata
                stage = "extract-gateway";
                var rxMetadata = uplinkMessage.SelectToken("rx_metadata[0]");
                gatewayId = rxMetadata?.SelectToken("gateway_ids.gateway_id")?.ToString();
                decimal? latitude = GetDecimalValue(rxMetadata, "location.latitude");
                decimal? longitude = GetDecimalValue(rxMetadata, "location.longitude");
                int? rssi = GetIntValue(rxMetadata, "rssi");
                decimal? snr = GetDecimalValue(rxMetadata, "snr");

                // Deterministic hive identity derived from device identity
                Guid hiveIdentity = CreateDeterministicGuid(HiveIdentityNamespace, deviceId);
                string hiveName = deviceId;

                // Upsert device record (only after we know this is a valid uplink with required identity)
                stage = "sql-upsert-device";
                int dbDeviceId = await UpsertDeviceAsync(connection, deviceId, devEui, applicationId, hiveIdentity, hiveName, log);

                int? dbGatewayId = null;
                if (!string.IsNullOrWhiteSpace(gatewayId))
                {
                    stage = "sql-upsert-gateway";
                    dbGatewayId = await UpsertGatewayAsync(connection, gatewayId, receivedAtUtc, log);
                    stage = "sql-upsert-hive-gateway";
                    await UpsertHiveIdentityGatewayAsync(connection, hiveIdentity, dbGatewayId.Value, receivedAtUtc, log);
                }

                // Store both raw and normalized payload for downstream use.
                stage = "build-cleaned-payload";
                cleanedPayload = new JObject
                {
                    ["device_id"] = deviceId,
                    ["dev_eui"] = devEui,
                    ["application_id"] = applicationId,
                    ["received_at"] = receivedAtUtc,
                    ["correlation_id"] = correlationId,
                    ["hive_identity"] = hiveIdentity.ToString("D"),
                    ["hive_name"] = hiveName,
                    ["decoded_payload"] = decodedPayload,
                    ["gateway_id"] = gatewayId,
                    ["rssi"] = rssi,
                    ["snr"] = snr,
                    ["latitude"] = latitude,
                    ["longitude"] = longitude,
                    ["telemetry"] = new JObject
                    {
                        ["temperature_inner"] = tempInner,
                        ["temperature_outer"] = tempOuter,
                        ["humidity"] = humidity,
                        ["weight_value_raw"] = weightValue,
                        ["battery_voltage"] = batteryVoltage,
                        ["battery_percent"] = batteryPercent,
                        ["sound_frequency"] = soundFrequency,
                        ["sound_energy_total"] = soundEnergyTotal,
                        ["sound_energy_low"] = soundEnergyLow,
                        ["sound_energy_mid"] = soundEnergyMid,
                        ["sound_energy_high"] = soundEnergyHigh,
                        ["sound_dominant_bin"] = soundDominantBin,
                        ["sound_dominant_bin_range"] = soundDominantBinRange
                    }
                };

                string storedPayload = JsonConvert.SerializeObject(new
                {
                    raw = ttsPayload,
                    cleaned = cleanedPayload
                });

                // Insert measurement (dedupe enforced by unique CorrelationId index)
                try
                {
                    stage = "sql-insert-measurement";
                    await InsertMeasurementAsync(
                        connection,
                        dbDeviceId,
                        receivedAtUtc,
                        tempInner,
                        tempOuter,
                        humidity,
                        batteryVoltage,
                        batteryPercent,
                        soundFrequency,
                        weightValue,
                        fftBin71_122, fftBin122_173, fftBin173_224, fftBin224_276,
                        fftBin276_327, fftBin327_378, fftBin378_429, fftBin429_480,
                        fftBin480_532, fftBin532_583,
                        soundEnergyTotal,
                        soundEnergyLow,
                        soundEnergyMid,
                        soundEnergyHigh,
                        soundDominantBin,
                        soundDominantBinRange,
                        latitude, longitude, rssi, snr,
                        storedPayload,
                        dbGatewayId,
                        correlationId,
                        log
                    );
                }
                catch (SqlException ex) when (ex.Number == 2601 || ex.Number == 2627)
                {
                    duplicateCount++;
                    log.LogInformation($"Duplicate correlation id - skipping. device={deviceId}, correlationId={correlationId}");
                    continue;
                }

                // Archive raw + cleaned payloads to Blob Storage
                stage = "blob-archive";
                try
                {
                    await WritePayloadBlobsAsync(
                        rawContainerClient,
                        processedContainerClient,
                        gatewayId,
                        receivedAtUtc,
                        deviceId,
                        correlationId,
                        ttsPayload,
                        cleanedPayload,
                        log
                    );
                }
                catch (RequestFailedException ex) when (ex.Status == 409)
                {
                    // Blob already exists (typically a replay/duplicate); measurement insert succeeded.
                    log.LogInformation($"Blob already exists - skipping archive. device={deviceId}, correlationId={correlationId}");
                }

                successCount++;
            }
            catch (Exception ex)
            {
                log.LogError(ex, $"Error processing message at stage '{stage}'");
                await WriteDeadLetterAsync(
                    deadLetterContainerClient,
                    gatewayId,
                    receivedAtUtc,
                    deviceId,
                    correlationId,
                    stage,
                    errorType: ex.GetType().FullName,
                    errorMessage: ex.Message,
                    rawMessage: message,
                    parsedPayload: ttsPayload,
                    exception: ex,
                    log: log
                );
                errorCount++;
            }
        }
    }

    log.LogInformation($"Processed {successCount} messages successfully, {duplicateCount} duplicates skipped, {errorCount} errors");
}

private static async Task WriteDeadLetterAsync(
    BlobContainerClient deadLetterContainer,
    string gatewayId,
    DateTime receivedAtUtc,
    string deviceId,
    string correlationId,
    string stage,
    string errorType,
    string errorMessage,
    string rawMessage,
    JObject parsedPayload,
    Exception exception,
    ILogger log)
{
    try
    {
        var now = DateTime.UtcNow;
        string gatewaySegment = SanitizePathSegment(string.IsNullOrWhiteSpace(gatewayId) ? "unknown-gateway" : gatewayId);
        string dateSegment = now.ToString("yyyyMMdd");
        string deviceSegment = SanitizePathSegment(string.IsNullOrWhiteSpace(deviceId) ? "unknown-device" : deviceId);
        string tsSegment = now.ToString("yyyyMMddTHHmmssfffZ");
        string correlationSegment = SanitizeFileComponent(string.IsNullOrWhiteSpace(correlationId) ? "unknown-correlation" : correlationId, 120);
        string stageSegment = SanitizeFileComponent(string.IsNullOrWhiteSpace(stage) ? "unknown-stage" : stage, 60);
        string baseName = $"{tsSegment}__{deviceSegment}__{correlationSegment}__{stageSegment}";

        string blobName = $"{gatewaySegment}/{dateSegment}/{deviceSegment}/{baseName}.deadletter.json";

        var envelope = new JObject
        {
            ["occurred_at"] = now,
            ["received_at"] = receivedAtUtc,
            ["stage"] = stage,
            ["device_id"] = deviceId,
            ["gateway_id"] = gatewayId,
            ["correlation_id"] = correlationId,
            ["error"] = new JObject
            {
                ["type"] = errorType,
                ["message"] = errorMessage
            },
            ["raw"] = rawMessage
        };

        if (parsedPayload != null)
        {
            envelope["parsed"] = parsedPayload;
        }

        if (exception != null)
        {
            envelope["exception"] = new JObject
            {
                ["stackTrace"] = exception.StackTrace
            };
        }

        await deadLetterContainer.GetBlobClient(blobName)
            .UploadAsync(BinaryData.FromString(envelope.ToString(Formatting.None)), overwrite: true);
    }
    catch (Exception dlqEx)
    {
        // Never allow DLQ writing to crash the batch.
        log.LogError(dlqEx, "Failed to write dead-letter blob");
    }
}

// Upsert device record (insert if not exists, update LastSeenAt)
private static async Task<int> UpsertDeviceAsync(SqlConnection connection, string deviceId, string devEui, string applicationId, Guid hiveIdentity, string hiveName, ILogger log)
{
    string query = @"
        MERGE INTO Devices AS target
        USING (SELECT @DevEUI AS DevEUI, @DeviceId AS HardwareID, @ApplicationId AS ApplicationID, @HiveIdentity AS HiveIdentity, @HiveName AS HiveName) AS source
        ON target.DevEUI = source.DevEUI
        WHEN MATCHED THEN
            UPDATE SET LastSeenAt = GETUTCDATE(), HardwareID = @DeviceId, ApplicationID = @ApplicationId, HiveIdentity = @HiveIdentity, HiveName = @HiveName
        WHEN NOT MATCHED THEN
            INSERT (DevEUI, HardwareID, Name, ApplicationID, HiveIdentity, HiveName, CreatedAt, LastSeenAt)
            VALUES (@DevEUI, @DeviceId, @DeviceId, @ApplicationId, @HiveIdentity, @HiveName, GETUTCDATE(), GETUTCDATE());

        SELECT DeviceID FROM Devices WHERE DevEUI = @DevEUI;
    ";

    using (var command = new SqlCommand(query, connection))
    {
        command.Parameters.AddWithValue("@DevEUI", devEui ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@DeviceId", deviceId);
        command.Parameters.AddWithValue("@ApplicationId", applicationId ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@HiveIdentity", hiveIdentity);
        command.Parameters.AddWithValue("@HiveName", hiveName ?? (object)DBNull.Value);

        var result = await command.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }
}

private static async Task<int> UpsertGatewayAsync(SqlConnection connection, string gatewayId, DateTime lastSeenAt, ILogger log)
{
    string query = @"
        MERGE INTO Gateways AS target
        USING (SELECT @GatewayIdentifier AS GatewayIdentifier) AS source
        ON target.GatewayIdentifier = source.GatewayIdentifier
        WHEN MATCHED THEN
            UPDATE SET LastSeen = @LastSeen
        WHEN NOT MATCHED THEN
            INSERT (GatewayIdentifier, LastSeen, CreatedAt)
            VALUES (@GatewayIdentifier, @LastSeen, GETUTCDATE());

        SELECT GatewayID FROM Gateways WHERE GatewayIdentifier = @GatewayIdentifier;
    ";

    using (var command = new SqlCommand(query, connection))
    {
        command.Parameters.AddWithValue("@GatewayIdentifier", gatewayId);
        command.Parameters.AddWithValue("@LastSeen", lastSeenAt);
        var result = await command.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }
}

private static async Task UpsertHiveIdentityGatewayAsync(SqlConnection connection, Guid hiveIdentity, int gatewayDbId, DateTime seenAt, ILogger log)
{
    string query = @"
        MERGE INTO HiveIdentityGateways AS target
        USING (SELECT @HiveIdentity AS HiveIdentity, @GatewayID AS GatewayID) AS source
        ON target.HiveIdentity = source.HiveIdentity AND target.GatewayID = source.GatewayID
        WHEN MATCHED THEN
            UPDATE SET LastSeen = @SeenAt
        WHEN NOT MATCHED THEN
            INSERT (HiveIdentity, GatewayID, FirstSeen, LastSeen)
            VALUES (@HiveIdentity, @GatewayID, @SeenAt, @SeenAt);
    ";

    using (var command = new SqlCommand(query, connection))
    {
        command.Parameters.AddWithValue("@HiveIdentity", hiveIdentity);
        command.Parameters.AddWithValue("@GatewayID", gatewayDbId);
        command.Parameters.AddWithValue("@SeenAt", seenAt);
        await command.ExecuteNonQueryAsync();
    }
}

// Insert measurement with all sensor values + raw JSON
private static async Task InsertMeasurementAsync(
    SqlConnection connection,
    int deviceId,
    DateTime timestamp,
    decimal? tempInner,
    decimal? tempOuter,
    decimal? humidity,
    decimal? batteryVoltage,
    int? batteryPercent,
    decimal? soundFrequency,
    long? weightValue,
    int? fftBin71_122, int? fftBin122_173, int? fftBin173_224, int? fftBin224_276,
    int? fftBin276_327, int? fftBin327_378, int? fftBin378_429, int? fftBin429_480,
    int? fftBin480_532, int? fftBin532_583,
    long? soundEnergyTotal,
    long? soundEnergyLow,
    long? soundEnergyMid,
    long? soundEnergyHigh,
    int? soundDominantBin,
    string soundDominantBinRange,
    decimal? latitude, decimal? longitude, int? rssi, decimal? snr,
    string rawPayload,
    int? gatewayDbId,
    string correlationId,
    ILogger log)
{
    string query = @"
        INSERT INTO Measurements (
            DeviceID, Timestamp,
            Temperature_Inner, Temperature_Outer, Humidity,
            Weight_KG, BatteryVoltage, BatteryPercent, SoundFrequency,
            FFT_Bin_71_122, FFT_Bin_122_173, FFT_Bin_173_224, FFT_Bin_224_276,
            FFT_Bin_276_327, FFT_Bin_327_378, FFT_Bin_378_429, FFT_Bin_429_480,
            FFT_Bin_480_532, FFT_Bin_532_583,
            SoundEnergyTotal, SoundEnergyLow, SoundEnergyMid, SoundEnergyHigh, SoundDominantBin, SoundDominantBinRange,
            Latitude, Longitude, RSSI, SNR, RawPayload,
            GatewayID, CorrelationId
        )
        VALUES (
            @DeviceID, @Timestamp,
            @Temperature_Inner, @Temperature_Outer, @Humidity,
            @Weight_KG, @BatteryVoltage, @BatteryPercent, @SoundFrequency,
            @FFT_Bin_71_122, @FFT_Bin_122_173, @FFT_Bin_173_224, @FFT_Bin_224_276,
            @FFT_Bin_276_327, @FFT_Bin_327_378, @FFT_Bin_378_429, @FFT_Bin_429_480,
            @FFT_Bin_480_532, @FFT_Bin_532_583,
            @SoundEnergyTotal, @SoundEnergyLow, @SoundEnergyMid, @SoundEnergyHigh, @SoundDominantBin, @SoundDominantBinRange,
            @Latitude, @Longitude, @RSSI, @SNR, @RawPayload,
            @GatewayID, @CorrelationId
        )
    ";

    using (var command = new SqlCommand(query, connection))
    {
        command.Parameters.AddWithValue("@DeviceID", deviceId);
        command.Parameters.AddWithValue("@Timestamp", timestamp);
        command.Parameters.AddWithValue("@Temperature_Inner", tempInner ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Temperature_Outer", tempOuter ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Humidity", humidity ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@BatteryVoltage", batteryVoltage ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@BatteryPercent", batteryPercent ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@SoundFrequency", soundFrequency ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Weight_KG", weightValue.HasValue ? (object)(weightValue.Value / 1000.0m) : DBNull.Value);
        
        command.Parameters.AddWithValue("@FFT_Bin_71_122", fftBin71_122 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_122_173", fftBin122_173 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_173_224", fftBin173_224 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_224_276", fftBin224_276 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_276_327", fftBin276_327 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_327_378", fftBin327_378 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_378_429", fftBin378_429 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_429_480", fftBin429_480 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_480_532", fftBin480_532 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_532_583", fftBin532_583 ?? (object)DBNull.Value);

        command.Parameters.AddWithValue("@SoundEnergyTotal", soundEnergyTotal ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@SoundEnergyLow", soundEnergyLow ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@SoundEnergyMid", soundEnergyMid ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@SoundEnergyHigh", soundEnergyHigh ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@SoundDominantBin", soundDominantBin ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@SoundDominantBinRange", soundDominantBinRange ?? (object)DBNull.Value);
        
        command.Parameters.AddWithValue("@Latitude", latitude ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Longitude", longitude ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@RSSI", rssi ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@SNR", snr ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@RawPayload", rawPayload);
        command.Parameters.AddWithValue("@GatewayID", gatewayDbId.HasValue ? (object)gatewayDbId.Value : DBNull.Value);
        command.Parameters.AddWithValue("@CorrelationId", correlationId ?? (object)DBNull.Value);

        await command.ExecuteNonQueryAsync();
    }
}

private static async Task WritePayloadBlobsAsync(
    BlobContainerClient rawContainer,
    BlobContainerClient processedContainer,
    string gatewayId,
    DateTime timestamp,
    string deviceId,
    string correlationId,
    JObject rawPayload,
    JObject cleanedPayload,
    ILogger log)
{
    string gatewaySegment = SanitizePathSegment(string.IsNullOrWhiteSpace(gatewayId) ? "unknown-gateway" : gatewayId);
    string dateSegment = timestamp.ToUniversalTime().ToString("yyyyMMdd");
    string deviceSegment = SanitizePathSegment(deviceId);
    string tsSegment = timestamp.ToUniversalTime().ToString("yyyyMMddTHHmmssfffZ");
    string correlationSegment = SanitizeFileComponent(correlationId, 200);
    string baseName = $"{tsSegment}__{deviceSegment}__{correlationSegment}";

    string rawBlobName = $"{gatewaySegment}/{dateSegment}/{deviceSegment}/{baseName}.raw.json";
    string cleanedBlobName = $"{gatewaySegment}/{dateSegment}/{deviceSegment}/{baseName}.cleaned.json";

    var rawClient = rawContainer.GetBlobClient(rawBlobName);
    var cleanedClient = processedContainer.GetBlobClient(cleanedBlobName);

    await rawClient.UploadAsync(BinaryData.FromString(rawPayload.ToString(Formatting.None)), overwrite: false);
    await cleanedClient.UploadAsync(BinaryData.FromString(cleanedPayload.ToString(Formatting.None)), overwrite: false);
}

private static string SanitizePathSegment(string value)
{
    if (string.IsNullOrWhiteSpace(value)) return "unknown";
    var cleaned = new string(value.Select(ch =>
        (char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' || ch == '.') ? ch : '_'
    ).ToArray());
    return cleaned.Trim('_');
}

private static string SanitizeFileComponent(string value, int maxLength)
{
    var cleaned = SanitizePathSegment(value);
    if (string.IsNullOrWhiteSpace(cleaned)) cleaned = "unknown";
    if (cleaned.Length > maxLength) cleaned = cleaned.Substring(0, maxLength);
    return cleaned;
}

private static string ComputeSha256Hex(string text)
{
    using (var sha = SHA256.Create())
    {
        var bytes = Encoding.UTF8.GetBytes(text ?? string.Empty);
        var hash = sha.ComputeHash(bytes);
        var sb = new StringBuilder(hash.Length * 2);
        foreach (var b in hash)
        {
            sb.Append(b.ToString("x2"));
        }
        return sb.ToString();
    }
}

// Name-based deterministic GUID (RFC 4122 style: SHA1 over namespace + name; sets version 5 bits)
private static Guid CreateDeterministicGuid(Guid namespaceId, string name)
{
    if (name == null) name = string.Empty;

    byte[] namespaceBytes = namespaceId.ToByteArray();
    SwapGuidByteOrder(namespaceBytes);

    byte[] nameBytes = Encoding.UTF8.GetBytes(name);

    byte[] hash;
    using (var sha1 = SHA1.Create())
    {
        sha1.TransformBlock(namespaceBytes, 0, namespaceBytes.Length, null, 0);
        sha1.TransformFinalBlock(nameBytes, 0, nameBytes.Length);
        hash = sha1.Hash;
    }

    var newGuid = new byte[16];
    Array.Copy(hash, 0, newGuid, 0, 16);

    newGuid[6] = (byte)((newGuid[6] & 0x0F) | (5 << 4));
    newGuid[8] = (byte)((newGuid[8] & 0x3F) | 0x80);

    SwapGuidByteOrder(newGuid);
    return new Guid(newGuid);
}

private static void SwapGuidByteOrder(byte[] guid)
{
    Swap(guid, 0, 3);
    Swap(guid, 1, 2);
    Swap(guid, 4, 5);
    Swap(guid, 6, 7);
}

private static void Swap(byte[] buffer, int left, int right)
{
    byte temp = buffer[left];
    buffer[left] = buffer[right];
    buffer[right] = temp;
}

// Helper methods to safely extract values from JSON
private static decimal? GetDecimalValue(JToken token, string path)
{
    var value = token?.SelectToken(path);
    return value != null && decimal.TryParse(value.ToString(), out decimal result) ? result : (decimal?)null;
}

private static int? GetIntValue(JToken token, string path)
{
    var value = token?.SelectToken(path);
    return value != null && int.TryParse(value.ToString(), out int result) ? result : (int?)null;
}

private static long? GetLongValue(JToken token, string path)
{
    var value = token?.SelectToken(path);
    return value != null && long.TryParse(value.ToString(), out long result) ? result : (long?)null;
}
