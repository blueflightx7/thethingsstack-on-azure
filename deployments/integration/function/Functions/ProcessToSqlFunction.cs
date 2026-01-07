// ==============================================================================
// ProcessToSql Function - Event Hub Trigger (.NET 8 Isolated Worker)
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
// 6. Archive to Blob Storage (raw + cleaned)
// 7. Log success/failure for monitoring
//
// ==============================================================================

using Azure;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using TtsIntegration.Helpers;
using TtsIntegration.Services;

namespace TtsIntegration.Functions;

/// <summary>
/// Event Hub trigger function for processing TTS telemetry to SQL and Blob storage.
/// </summary>
public class ProcessToSqlFunction
{
    private readonly ILogger<ProcessToSqlFunction> _logger;
    private readonly ISqlDataService _sqlDataService;
    private readonly IBlobStorageService _blobStorageService;

    public ProcessToSqlFunction(
        ILogger<ProcessToSqlFunction> logger,
        ISqlDataService sqlDataService,
        IBlobStorageService blobStorageService)
    {
        _logger = logger;
        _sqlDataService = sqlDataService;
        _blobStorageService = blobStorageService;
    }

    [Function("ProcessToSQL")]
    public async Task Run(
        [EventHubTrigger("fabric-stream", Connection = "EventHubConnection")] string[] eventHubMessages)
    {
        _logger.LogInformation("Processing {Count} messages from Event Hub", eventHubMessages.Length);

        int successCount = 0;
        int errorCount = 0;
        int duplicateCount = 0;

        try
        {
            await _sqlDataService.OpenAsync();
            await _blobStorageService.InitializeAsync();

            foreach (var message in eventHubMessages)
            {
                var result = await ProcessMessageAsync(message);
                switch (result)
                {
                    case ProcessResult.Success:
                        successCount++;
                        break;
                    case ProcessResult.Duplicate:
                        duplicateCount++;
                        break;
                    case ProcessResult.Error:
                    case ProcessResult.Skipped:
                        errorCount++;
                        break;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Fatal error processing Event Hub batch");
            throw;
        }

        _logger.LogInformation("Processed {Success} messages successfully, {Duplicates} duplicates skipped, {Errors} errors",
            successCount, duplicateCount, errorCount);
    }

    private async Task<ProcessResult> ProcessMessageAsync(string message)
    {
        string stage = "start";
        string? deviceId = null;
        string? devEui = null;
        string? applicationId = null;
        string? gatewayId = null;
        string? correlationId = null;
        DateTime receivedAtUtc = DateTime.UtcNow;
        JObject? ttsPayload = null;

        try
        {
            // Parse JSON
            stage = "parse-json";
            ttsPayload = JObject.Parse(message);

            // Only process uplink messages (beehive sensor telemetry)
            var uplinkMessage = ttsPayload.SelectToken("uplink_message");
            if (uplinkMessage == null)
            {
                var nonUplinkDeviceId = ttsPayload.GetStringValue("end_device_ids.device_id");
                _logger.LogInformation("Skipping non-uplink message for device {DeviceId}", nonUplinkDeviceId);
                return ProcessResult.Skipped;
            }

            // Extract device identity
            stage = "extract-identity";
            deviceId = ttsPayload.GetStringValue("end_device_ids.device_id");
            devEui = ttsPayload.GetStringValue("end_device_ids.dev_eui");
            applicationId = ttsPayload.GetStringValue("end_device_ids.application_ids.application_id");

            if (string.IsNullOrEmpty(deviceId))
            {
                _logger.LogWarning("Skipping uplink: device_id not found");
                await WriteDeadLetterAsync("validation", "MissingField", "device_id not found",
                    message, ttsPayload, null, gatewayId, receivedAtUtc, deviceId, correlationId);
                return ProcessResult.Error;
            }

            if (string.IsNullOrEmpty(devEui))
            {
                _logger.LogWarning("Skipping uplink for device {DeviceId}: dev_eui not found", deviceId);
                await WriteDeadLetterAsync("validation", "MissingField", "dev_eui not found",
                    message, ttsPayload, null, gatewayId, receivedAtUtc, deviceId, correlationId);
                return ProcessResult.Error;
            }

            // Extract decoded payload
            var decodedPayload = uplinkMessage.SelectToken("decoded_payload");
            if (decodedPayload == null)
            {
                _logger.LogWarning("No decoded_payload for device {DeviceId}", deviceId);
                await WriteDeadLetterAsync("validation", "MissingField", "decoded_payload not found",
                    message, ttsPayload, null, gatewayId, receivedAtUtc, deviceId, correlationId);
                return ProcessResult.Error;
            }

            // Extract correlation ID
            stage = "extract-correlation";
            correlationId = ttsPayload.GetStringValue("correlation_ids[0]");
            if (string.IsNullOrWhiteSpace(correlationId))
            {
                correlationId = "computed:" + HashHelper.ComputeSha256Hex(message);
            }

            // Extract timestamp
            stage = "extract-timestamp";
            var receivedAtStr = ttsPayload.GetStringValue("received_at");
            receivedAtUtc = string.IsNullOrEmpty(receivedAtStr)
                ? DateTime.UtcNow
                : DateTime.Parse(receivedAtStr).ToUniversalTime();

            // Extract sensor values
            var sensorData = ExtractSensorData(decodedPayload);

            // Extract gateway metadata
            stage = "extract-gateway";
            var rxMetadata = uplinkMessage.SelectToken("rx_metadata[0]");
            gatewayId = rxMetadata.GetStringValue("gateway_ids.gateway_id");
            var latitude = rxMetadata.GetDecimalValue("location.latitude");
            var longitude = rxMetadata.GetDecimalValue("location.longitude");
            var rssi = rxMetadata.GetIntValue("rssi");
            var snr = rxMetadata.GetDecimalValue("snr");

            // Create hive identity
            var hiveIdentity = GuidHelper.CreateHiveIdentity(deviceId);
            var hiveName = deviceId;

            // Upsert device
            stage = "sql-upsert-device";
            var dbDeviceId = await _sqlDataService.UpsertDeviceAsync(deviceId, devEui, applicationId, hiveIdentity, hiveName);

            // Upsert gateway
            int? dbGatewayId = null;
            if (!string.IsNullOrWhiteSpace(gatewayId))
            {
                stage = "sql-upsert-gateway";
                dbGatewayId = await _sqlDataService.UpsertGatewayAsync(gatewayId, receivedAtUtc);
                
                stage = "sql-upsert-hive-gateway";
                await _sqlDataService.UpsertHiveIdentityGatewayAsync(hiveIdentity, dbGatewayId.Value, receivedAtUtc);
            }

            // Build cleaned payload
            stage = "build-cleaned-payload";
            var cleanedPayload = BuildCleanedPayload(
                deviceId, devEui, applicationId, receivedAtUtc, correlationId,
                hiveIdentity, hiveName, decodedPayload, gatewayId, rssi, snr, latitude, longitude,
                sensorData);

            var storedPayload = JsonConvert.SerializeObject(new { raw = ttsPayload, cleaned = cleanedPayload });

            // Insert measurement
            try
            {
                stage = "sql-insert-measurement";
                await _sqlDataService.InsertMeasurementAsync(new MeasurementData
                {
                    DeviceId = dbDeviceId,
                    Timestamp = receivedAtUtc,
                    TemperatureInner = sensorData.TempInner,
                    TemperatureOuter = sensorData.TempOuter,
                    TemperatureInnerF = sensorData.TempInnerF,
                    TemperatureOuterF = sensorData.TempOuterF,
                    Humidity = sensorData.Humidity,
                    BatteryVoltage = sensorData.BatteryVoltage,
                    BatteryPercent = sensorData.BatteryPercent,
                    SoundFrequency = sensorData.SoundFrequency,
                    WeightValue = sensorData.WeightValue,
                    FftBin71_122 = sensorData.FftBin71_122,
                    FftBin122_173 = sensorData.FftBin122_173,
                    FftBin173_224 = sensorData.FftBin173_224,
                    FftBin224_276 = sensorData.FftBin224_276,
                    FftBin276_327 = sensorData.FftBin276_327,
                    FftBin327_378 = sensorData.FftBin327_378,
                    FftBin378_429 = sensorData.FftBin378_429,
                    FftBin429_480 = sensorData.FftBin429_480,
                    FftBin480_532 = sensorData.FftBin480_532,
                    FftBin532_583 = sensorData.FftBin532_583,
                    SoundEnergyTotal = sensorData.SoundEnergyTotal,
                    SoundEnergyLow = sensorData.SoundEnergyLow,
                    SoundEnergyMid = sensorData.SoundEnergyMid,
                    SoundEnergyHigh = sensorData.SoundEnergyHigh,
                    SoundDominantBin = sensorData.SoundDominantBin,
                    SoundDominantBinRange = sensorData.SoundDominantBinRange,
                    Latitude = latitude,
                    Longitude = longitude,
                    Rssi = rssi,
                    Snr = snr,
                    RawPayload = storedPayload,
                    GatewayDbId = dbGatewayId,
                    CorrelationId = correlationId
                });
            }
            catch (SqlException ex) when (ex.Number is 2601 or 2627)
            {
                _logger.LogInformation("Duplicate correlation id - skipping. device={DeviceId}, correlationId={CorrelationId}",
                    deviceId, correlationId);
                return ProcessResult.Duplicate;
            }

            // Archive to blob storage
            stage = "blob-archive";
            try
            {
                await _blobStorageService.WritePayloadBlobsAsync(
                    gatewayId, receivedAtUtc, deviceId, correlationId!,
                    ttsPayload, cleanedPayload);
            }
            catch (RequestFailedException ex) when (ex.Status == 409)
            {
                _logger.LogInformation("Blob already exists - skipping archive. device={DeviceId}, correlationId={CorrelationId}",
                    deviceId, correlationId);
            }

            return ProcessResult.Success;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing message at stage '{Stage}'", stage);
            await WriteDeadLetterAsync(stage, ex.GetType().FullName ?? "Exception", ex.Message,
                message, ttsPayload, ex, gatewayId, receivedAtUtc, deviceId, correlationId);
            return ProcessResult.Error;
        }
    }

    private async Task WriteDeadLetterAsync(string stage, string errorType, string errorMessage,
        string rawMessage, JObject? parsedPayload, Exception? exception,
        string? gatewayId, DateTime receivedAtUtc, string? deviceId, string? correlationId)
    {
        await _blobStorageService.WriteDeadLetterAsync(new DeadLetterData
        {
            GatewayId = gatewayId,
            ReceivedAtUtc = receivedAtUtc,
            DeviceId = deviceId,
            CorrelationId = correlationId,
            Stage = stage,
            ErrorType = errorType,
            ErrorMessage = errorMessage,
            RawMessage = rawMessage,
            ParsedPayload = parsedPayload,
            Exception = exception
        });
    }

    private static SensorData ExtractSensorData(JToken decodedPayload)
    {
        // Support both BEEP Base field name variants
        var tempInner = decodedPayload.GetDecimalValue("t_i") ?? decodedPayload.GetDecimalValue("t_0");
        var tempOuter = decodedPayload.GetDecimalValue("t_o") ?? decodedPayload.GetDecimalValue("t_1");
        var humidity = decodedPayload.GetDecimalValue("h");
        var batteryVoltage = decodedPayload.GetDecimalValue("bv");
        var batteryPercent = decodedPayload.GetIntValue("bat_perc");
        var soundFrequency = decodedPayload.GetDecimalValue("sound");
        var weightValue = decodedPayload.GetLongValue("w_v");

        // Calculate Fahrenheit
        var tempInnerF = tempInner.HasValue ? (decimal?)((tempInner.Value * 9m / 5m) + 32m) : null;
        var tempOuterF = tempOuter.HasValue ? (decimal?)((tempOuter.Value * 9m / 5m) + 32m) : null;

        // FFT bins
        var fftBins = new[]
        {
            ("71-122", decodedPayload.GetIntValue("s_bin_71_122")),
            ("122-173", decodedPayload.GetIntValue("s_bin_122_173")),
            ("173-224", decodedPayload.GetIntValue("s_bin_173_224")),
            ("224-276", decodedPayload.GetIntValue("s_bin_224_276")),
            ("276-327", decodedPayload.GetIntValue("s_bin_276_327")),
            ("327-378", decodedPayload.GetIntValue("s_bin_327_378")),
            ("378-429", decodedPayload.GetIntValue("s_bin_378_429")),
            ("429-480", decodedPayload.GetIntValue("s_bin_429_480")),
            ("480-532", decodedPayload.GetIntValue("s_bin_480_532")),
            ("532-583", decodedPayload.GetIntValue("s_bin_532_583"))
        };

        // Calculate derived metrics
        long? soundEnergyTotal = null;
        long? soundEnergyLow = null;
        long? soundEnergyMid = null;
        long? soundEnergyHigh = null;
        int? soundDominantBin = null;
        string? soundDominantBinRange = null;

        if (fftBins.Any(b => b.Item2.HasValue))
        {
            soundEnergyTotal = fftBins.Where(b => b.Item2.HasValue).Sum(b => (long)b.Item2!.Value);
            soundEnergyLow = fftBins.Take(3).Where(b => b.Item2.HasValue).Sum(b => (long)b.Item2!.Value);
            soundEnergyMid = fftBins.Skip(3).Take(3).Where(b => b.Item2.HasValue).Sum(b => (long)b.Item2!.Value);
            soundEnergyHigh = fftBins.Skip(6).Where(b => b.Item2.HasValue).Sum(b => (long)b.Item2!.Value);

            var bestIndex = -1;
            var bestValue = int.MinValue;
            for (var i = 0; i < fftBins.Length; i++)
            {
                if (!fftBins[i].Item2.HasValue) continue;
                if (fftBins[i].Item2!.Value > bestValue)
                {
                    bestValue = fftBins[i].Item2!.Value;
                    bestIndex = i;
                }
            }

            if (bestIndex >= 0)
            {
                soundDominantBin = bestIndex + 1;
                soundDominantBinRange = fftBins[bestIndex].Item1;
            }
        }

        return new SensorData
        {
            TempInner = tempInner,
            TempOuter = tempOuter,
            TempInnerF = tempInnerF,
            TempOuterF = tempOuterF,
            Humidity = humidity,
            BatteryVoltage = batteryVoltage,
            BatteryPercent = batteryPercent,
            SoundFrequency = soundFrequency,
            WeightValue = weightValue,
            FftBin71_122 = fftBins[0].Item2,
            FftBin122_173 = fftBins[1].Item2,
            FftBin173_224 = fftBins[2].Item2,
            FftBin224_276 = fftBins[3].Item2,
            FftBin276_327 = fftBins[4].Item2,
            FftBin327_378 = fftBins[5].Item2,
            FftBin378_429 = fftBins[6].Item2,
            FftBin429_480 = fftBins[7].Item2,
            FftBin480_532 = fftBins[8].Item2,
            FftBin532_583 = fftBins[9].Item2,
            SoundEnergyTotal = soundEnergyTotal,
            SoundEnergyLow = soundEnergyLow,
            SoundEnergyMid = soundEnergyMid,
            SoundEnergyHigh = soundEnergyHigh,
            SoundDominantBin = soundDominantBin,
            SoundDominantBinRange = soundDominantBinRange
        };
    }

    private static JObject BuildCleanedPayload(
        string deviceId, string? devEui, string? applicationId,
        DateTime receivedAtUtc, string? correlationId,
        Guid hiveIdentity, string hiveName,
        JToken decodedPayload, string? gatewayId,
        int? rssi, decimal? snr, decimal? latitude, decimal? longitude,
        SensorData sensorData)
    {
        return new JObject
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
                ["temperature_inner"] = sensorData.TempInner,
                ["temperature_outer"] = sensorData.TempOuter,
                ["humidity"] = sensorData.Humidity,
                ["weight_value_raw"] = sensorData.WeightValue,
                ["battery_voltage"] = sensorData.BatteryVoltage,
                ["battery_percent"] = sensorData.BatteryPercent,
                ["sound_frequency"] = sensorData.SoundFrequency,
                ["sound_energy_total"] = sensorData.SoundEnergyTotal,
                ["sound_energy_low"] = sensorData.SoundEnergyLow,
                ["sound_energy_mid"] = sensorData.SoundEnergyMid,
                ["sound_energy_high"] = sensorData.SoundEnergyHigh,
                ["sound_dominant_bin"] = sensorData.SoundDominantBin,
                ["sound_dominant_bin_range"] = sensorData.SoundDominantBinRange
            }
        };
    }

    private enum ProcessResult
    {
        Success,
        Duplicate,
        Error,
        Skipped
    }

    private record SensorData
    {
        public decimal? TempInner { get; init; }
        public decimal? TempOuter { get; init; }
        public decimal? TempInnerF { get; init; }
        public decimal? TempOuterF { get; init; }
        public decimal? Humidity { get; init; }
        public decimal? BatteryVoltage { get; init; }
        public int? BatteryPercent { get; init; }
        public decimal? SoundFrequency { get; init; }
        public long? WeightValue { get; init; }
        public int? FftBin71_122 { get; init; }
        public int? FftBin122_173 { get; init; }
        public int? FftBin173_224 { get; init; }
        public int? FftBin224_276 { get; init; }
        public int? FftBin276_327 { get; init; }
        public int? FftBin327_378 { get; init; }
        public int? FftBin378_429 { get; init; }
        public int? FftBin429_480 { get; init; }
        public int? FftBin480_532 { get; init; }
        public int? FftBin532_583 { get; init; }
        public long? SoundEnergyTotal { get; init; }
        public long? SoundEnergyLow { get; init; }
        public long? SoundEnergyMid { get; init; }
        public long? SoundEnergyHigh { get; init; }
        public int? SoundDominantBin { get; init; }
        public string? SoundDominantBinRange { get; init; }
    }
}
