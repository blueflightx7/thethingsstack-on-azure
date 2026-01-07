// ==============================================================================
// Blob Storage Service Interface
// ==============================================================================

using Newtonsoft.Json.Linq;

namespace TtsIntegration.Services;

/// <summary>
/// Service for Azure Blob Storage operations (raw telemetry, processed data, dead letters).
/// Singleton lifetime - BlobServiceClient is thread-safe and reuses connections.
/// </summary>
public interface IBlobStorageService
{
    /// <summary>
    /// Initializes blob containers (creates if not exists).
    /// </summary>
    Task InitializeAsync();

    /// <summary>
    /// Archives raw and cleaned payloads to blob storage.
    /// </summary>
    Task WritePayloadBlobsAsync(
        string? gatewayId,
        DateTime timestamp,
        string deviceId,
        string correlationId,
        JObject rawPayload,
        JObject cleanedPayload);

    /// <summary>
    /// Writes a failed message to the dead-letter container.
    /// </summary>
    Task WriteDeadLetterAsync(DeadLetterData data);
}

/// <summary>
/// Data transfer object for dead letter messages.
/// </summary>
public record DeadLetterData
{
    public string? GatewayId { get; init; }
    public DateTime ReceivedAtUtc { get; init; }
    public string? DeviceId { get; init; }
    public string? CorrelationId { get; init; }
    public string Stage { get; init; } = string.Empty;
    public string ErrorType { get; init; } = string.Empty;
    public string ErrorMessage { get; init; } = string.Empty;
    public string RawMessage { get; init; } = string.Empty;
    public JObject? ParsedPayload { get; init; }
    public Exception? Exception { get; init; }
}
