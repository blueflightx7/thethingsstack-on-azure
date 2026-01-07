// ==============================================================================
// SQL Data Service Implementation
// ==============================================================================

using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace TtsIntegration.Services;

/// <summary>
/// SQL database operations for TTS telemetry persistence.
/// Uses SQL MERGE for upsert operations and parameterized queries for security.
/// </summary>
public class SqlDataService : ISqlDataService
{
    private readonly ILogger<SqlDataService> _logger;
    private readonly SqlConnection _connection;
    private bool _disposed;

    public SqlDataService(ILogger<SqlDataService> logger)
    {
        _logger = logger;
        
        var connectionString = Environment.GetEnvironmentVariable("SqlConnectionString");
        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException("SqlConnectionString environment variable is not set");
        }
        
        _connection = new SqlConnection(connectionString);
    }

    public async Task OpenAsync()
    {
        if (_connection.State != System.Data.ConnectionState.Open)
        {
            await _connection.OpenAsync();
        }
    }

    public async Task<int> UpsertDeviceAsync(string deviceId, string devEui, string? applicationId, Guid hiveIdentity, string hiveName)
    {
        const string query = @"
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

        await using var command = new SqlCommand(query, _connection);
        command.Parameters.AddWithValue("@DevEUI", devEui ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@DeviceId", deviceId);
        command.Parameters.AddWithValue("@ApplicationId", applicationId ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@HiveIdentity", hiveIdentity);
        command.Parameters.AddWithValue("@HiveName", hiveName ?? (object)DBNull.Value);

        var result = await command.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }

    public async Task<int> UpsertGatewayAsync(string gatewayId, DateTime lastSeenAt)
    {
        const string query = @"
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

        await using var command = new SqlCommand(query, _connection);
        command.Parameters.AddWithValue("@GatewayIdentifier", gatewayId);
        command.Parameters.AddWithValue("@LastSeen", lastSeenAt);
        var result = await command.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }

    public async Task UpsertHiveIdentityGatewayAsync(Guid hiveIdentity, int gatewayDbId, DateTime seenAt)
    {
        const string query = @"
            MERGE INTO HiveIdentityGateways AS target
            USING (SELECT @HiveIdentity AS HiveIdentity, @GatewayID AS GatewayID) AS source
            ON target.HiveIdentity = source.HiveIdentity AND target.GatewayID = source.GatewayID
            WHEN MATCHED THEN
                UPDATE SET LastSeen = @SeenAt
            WHEN NOT MATCHED THEN
                INSERT (HiveIdentity, GatewayID, FirstSeen, LastSeen)
                VALUES (@HiveIdentity, @GatewayID, @SeenAt, @SeenAt);
        ";

        await using var command = new SqlCommand(query, _connection);
        command.Parameters.AddWithValue("@HiveIdentity", hiveIdentity);
        command.Parameters.AddWithValue("@GatewayID", gatewayDbId);
        command.Parameters.AddWithValue("@SeenAt", seenAt);
        await command.ExecuteNonQueryAsync();
    }

    public async Task InsertMeasurementAsync(MeasurementData data)
    {
        const string query = @"
            INSERT INTO Measurements (
                DeviceID, Timestamp,
                Temperature_Inner, Temperature_Outer, Temperature_Inner_F, Temperature_Outer_F, Humidity,
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
                @Temperature_Inner, @Temperature_Outer, @Temperature_Inner_F, @Temperature_Outer_F, @Humidity,
                @Weight_KG, @BatteryVoltage, @BatteryPercent, @SoundFrequency,
                @FFT_Bin_71_122, @FFT_Bin_122_173, @FFT_Bin_173_224, @FFT_Bin_224_276,
                @FFT_Bin_276_327, @FFT_Bin_327_378, @FFT_Bin_378_429, @FFT_Bin_429_480,
                @FFT_Bin_480_532, @FFT_Bin_532_583,
                @SoundEnergyTotal, @SoundEnergyLow, @SoundEnergyMid, @SoundEnergyHigh, @SoundDominantBin, @SoundDominantBinRange,
                @Latitude, @Longitude, @RSSI, @SNR, @RawPayload,
                @GatewayID, @CorrelationId
            )
        ";

        await using var command = new SqlCommand(query, _connection);
        command.Parameters.AddWithValue("@DeviceID", data.DeviceId);
        command.Parameters.AddWithValue("@Timestamp", data.Timestamp);
        command.Parameters.AddWithValue("@Temperature_Inner", data.TemperatureInner ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Temperature_Outer", data.TemperatureOuter ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Temperature_Inner_F", data.TemperatureInnerF ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Temperature_Outer_F", data.TemperatureOuterF ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Humidity", data.Humidity ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@BatteryVoltage", data.BatteryVoltage ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@BatteryPercent", data.BatteryPercent ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@SoundFrequency", data.SoundFrequency ?? (object)DBNull.Value);
        
        // Weight: w_v is a Beep sensor scaled integer, convert to kg by dividing by 32,100
        // Empirically determined: w_v=1765572 → 55 kg (per Beep portal calibration)
        command.Parameters.AddWithValue("@Weight_KG", data.WeightValue.HasValue 
            ? (object)(data.WeightValue.Value / 32100.0m) 
            : DBNull.Value);
        
        command.Parameters.AddWithValue("@FFT_Bin_71_122", data.FftBin71_122 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_122_173", data.FftBin122_173 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_173_224", data.FftBin173_224 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_224_276", data.FftBin224_276 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_276_327", data.FftBin276_327 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_327_378", data.FftBin327_378 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_378_429", data.FftBin378_429 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_429_480", data.FftBin429_480 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_480_532", data.FftBin480_532 ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@FFT_Bin_532_583", data.FftBin532_583 ?? (object)DBNull.Value);

        command.Parameters.AddWithValue("@SoundEnergyTotal", data.SoundEnergyTotal ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@SoundEnergyLow", data.SoundEnergyLow ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@SoundEnergyMid", data.SoundEnergyMid ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@SoundEnergyHigh", data.SoundEnergyHigh ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@SoundDominantBin", data.SoundDominantBin ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@SoundDominantBinRange", data.SoundDominantBinRange ?? (object)DBNull.Value);
        
        command.Parameters.AddWithValue("@Latitude", data.Latitude ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Longitude", data.Longitude ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@RSSI", data.Rssi ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@SNR", data.Snr ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@RawPayload", data.RawPayload);
        command.Parameters.AddWithValue("@GatewayID", data.GatewayDbId ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@CorrelationId", data.CorrelationId ?? (object)DBNull.Value);

        await command.ExecuteNonQueryAsync();
    }

    public async ValueTask DisposeAsync()
    {
        if (!_disposed)
        {
            await _connection.DisposeAsync();
            _disposed = true;
        }
    }
}
