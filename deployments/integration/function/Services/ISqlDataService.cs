// ==============================================================================
// SQL Data Service Interface
// ==============================================================================

namespace TtsIntegration.Services;

/// <summary>
/// Service for SQL database operations (devices, measurements, gateways).
/// Scoped lifetime - one connection per function invocation.
/// </summary>
public interface ISqlDataService : IAsyncDisposable
{
    /// <summary>
    /// Opens the database connection.
    /// </summary>
    Task OpenAsync();

    /// <summary>
    /// Upserts a device record and returns the database device ID.
    /// </summary>
    Task<int> UpsertDeviceAsync(string deviceId, string devEui, string? applicationId, Guid hiveIdentity, string hiveName);

    /// <summary>
    /// Upserts a gateway record and returns the database gateway ID.
    /// </summary>
    Task<int> UpsertGatewayAsync(string gatewayId, DateTime lastSeenAt);

    /// <summary>
    /// Links a hive identity to a gateway.
    /// </summary>
    Task UpsertHiveIdentityGatewayAsync(Guid hiveIdentity, int gatewayDbId, DateTime seenAt);

    /// <summary>
    /// Inserts a measurement record.
    /// </summary>
    Task InsertMeasurementAsync(MeasurementData data);
}

/// <summary>
/// Data transfer object for measurement insertion.
/// </summary>
public record MeasurementData
{
    public int DeviceId { get; init; }
    public DateTime Timestamp { get; init; }
    public decimal? TemperatureInner { get; init; }
    public decimal? TemperatureOuter { get; init; }
    public decimal? TemperatureInnerF { get; init; }
    public decimal? TemperatureOuterF { get; init; }
    public decimal? Humidity { get; init; }
    public decimal? BatteryVoltage { get; init; }
    public int? BatteryPercent { get; init; }
    public decimal? SoundFrequency { get; init; }
    public long? WeightValue { get; init; }
    
    // FFT bins
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
    
    // Derived sound metrics
    public long? SoundEnergyTotal { get; init; }
    public long? SoundEnergyLow { get; init; }
    public long? SoundEnergyMid { get; init; }
    public long? SoundEnergyHigh { get; init; }
    public int? SoundDominantBin { get; init; }
    public string? SoundDominantBinRange { get; init; }
    
    // Location/signal
    public decimal? Latitude { get; init; }
    public decimal? Longitude { get; init; }
    public int? Rssi { get; init; }
    public decimal? Snr { get; init; }
    
    // Metadata
    public string RawPayload { get; init; } = string.Empty;
    public int? GatewayDbId { get; init; }
    public string? CorrelationId { get; init; }
}
