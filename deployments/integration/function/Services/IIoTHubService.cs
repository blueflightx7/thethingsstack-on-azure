// ==============================================================================
// IoT Hub Service Interface
// ==============================================================================

namespace TtsIntegration.Services;

/// <summary>
/// Service for Azure IoT Hub operations (device registration, telemetry forwarding).
/// Singleton lifetime - HttpClient should be reused to prevent socket exhaustion.
/// </summary>
public interface IIoTHubService
{
    /// <summary>
    /// Ensures a device exists in IoT Hub, creating it if necessary.
    /// </summary>
    Task EnsureDeviceExistsAsync(string deviceId);

    /// <summary>
    /// Gets the primary key for a device from IoT Hub.
    /// </summary>
    Task<string?> GetDeviceKeyAsync(string deviceId);

    /// <summary>
    /// Sends a telemetry message to IoT Hub on behalf of a device.
    /// </summary>
    Task<IoTHubSendResult> SendTelemetryAsync(string deviceId, string payload, TelemetryMetadata metadata, CancellationToken cancellationToken = default);
}

/// <summary>
/// Metadata for telemetry messages.
/// </summary>
public record TelemetryMetadata
{
    public string MessageType { get; init; } = "uplink";
    public string? DevEui { get; init; }
    public string? ApplicationId { get; init; }
}

/// <summary>
/// Result of sending telemetry to IoT Hub.
/// </summary>
public record IoTHubSendResult
{
    public bool Success { get; init; }
    public int StatusCode { get; init; }
    public string? ErrorMessage { get; init; }
}
