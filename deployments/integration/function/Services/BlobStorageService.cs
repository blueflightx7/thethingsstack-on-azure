// ==============================================================================
// Blob Storage Service Implementation
// ==============================================================================

using Azure;
using Azure.Storage.Blobs;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace TtsIntegration.Services;

/// <summary>
/// Azure Blob Storage operations for telemetry archival and dead-letter handling.
/// Thread-safe singleton using BlobServiceClient connection pooling.
/// </summary>
public class BlobStorageService : IBlobStorageService
{
    private readonly ILogger<BlobStorageService> _logger;
    private readonly BlobServiceClient _blobServiceClient;
    private BlobContainerClient? _rawContainerClient;
    private BlobContainerClient? _processedContainerClient;
    private BlobContainerClient? _deadLetterContainerClient;
    private bool _initialized;
    private readonly SemaphoreSlim _initLock = new(1, 1);

    public BlobStorageService(ILogger<BlobStorageService> logger)
    {
        _logger = logger;
        
        var connectionString = Environment.GetEnvironmentVariable("AzureWebJobsStorage");
        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException("AzureWebJobsStorage environment variable is not set");
        }
        
        _blobServiceClient = new BlobServiceClient(connectionString);
    }

    public async Task InitializeAsync()
    {
        if (_initialized) return;

        await _initLock.WaitAsync();
        try
        {
            if (_initialized) return;

            _rawContainerClient = _blobServiceClient.GetBlobContainerClient("raw-telemetry");
            _processedContainerClient = _blobServiceClient.GetBlobContainerClient("processed-data");
            _deadLetterContainerClient = _blobServiceClient.GetBlobContainerClient("dead-letter");

            await Task.WhenAll(
                _rawContainerClient.CreateIfNotExistsAsync(),
                _processedContainerClient.CreateIfNotExistsAsync(),
                _deadLetterContainerClient.CreateIfNotExistsAsync()
            );

            _initialized = true;
            _logger.LogInformation("Blob containers initialized");
        }
        finally
        {
            _initLock.Release();
        }
    }

    public async Task WritePayloadBlobsAsync(
        string? gatewayId,
        DateTime timestamp,
        string deviceId,
        string correlationId,
        JObject rawPayload,
        JObject cleanedPayload)
    {
        await InitializeAsync();

        var gatewaySegment = SanitizePathSegment(string.IsNullOrWhiteSpace(gatewayId) ? "unknown-gateway" : gatewayId);
        var dateSegment = timestamp.ToUniversalTime().ToString("yyyyMMdd");
        var deviceSegment = SanitizePathSegment(deviceId);
        var tsSegment = timestamp.ToUniversalTime().ToString("yyyyMMddTHHmmssfffZ");
        var correlationSegment = SanitizeFileComponent(correlationId, 200);
        var baseName = $"{tsSegment}__{deviceSegment}__{correlationSegment}";

        var rawBlobName = $"{gatewaySegment}/{dateSegment}/{deviceSegment}/{baseName}.raw.json";
        var cleanedBlobName = $"{gatewaySegment}/{dateSegment}/{deviceSegment}/{baseName}.cleaned.json";

        var rawClient = _rawContainerClient!.GetBlobClient(rawBlobName);
        var cleanedClient = _processedContainerClient!.GetBlobClient(cleanedBlobName);

        await Task.WhenAll(
            rawClient.UploadAsync(BinaryData.FromString(rawPayload.ToString(Formatting.None)), overwrite: false),
            cleanedClient.UploadAsync(BinaryData.FromString(cleanedPayload.ToString(Formatting.None)), overwrite: false)
        );
    }

    public async Task WriteDeadLetterAsync(DeadLetterData data)
    {
        try
        {
            await InitializeAsync();

            var now = DateTime.UtcNow;
            var gatewaySegment = SanitizePathSegment(string.IsNullOrWhiteSpace(data.GatewayId) ? "unknown-gateway" : data.GatewayId);
            var dateSegment = now.ToString("yyyyMMdd");
            var deviceSegment = SanitizePathSegment(string.IsNullOrWhiteSpace(data.DeviceId) ? "unknown-device" : data.DeviceId);
            var tsSegment = now.ToString("yyyyMMddTHHmmssfffZ");
            var correlationSegment = SanitizeFileComponent(string.IsNullOrWhiteSpace(data.CorrelationId) ? "unknown-correlation" : data.CorrelationId, 120);
            var stageSegment = SanitizeFileComponent(string.IsNullOrWhiteSpace(data.Stage) ? "unknown-stage" : data.Stage, 60);
            var baseName = $"{tsSegment}__{deviceSegment}__{correlationSegment}__{stageSegment}";

            var blobName = $"{gatewaySegment}/{dateSegment}/{deviceSegment}/{baseName}.deadletter.json";

            var envelope = new JObject
            {
                ["occurred_at"] = now,
                ["received_at"] = data.ReceivedAtUtc,
                ["stage"] = data.Stage,
                ["device_id"] = data.DeviceId,
                ["gateway_id"] = data.GatewayId,
                ["correlation_id"] = data.CorrelationId,
                ["error"] = new JObject
                {
                    ["type"] = data.ErrorType,
                    ["message"] = data.ErrorMessage
                },
                ["raw"] = data.RawMessage
            };

            if (data.ParsedPayload != null)
            {
                envelope["parsed"] = data.ParsedPayload;
            }

            if (data.Exception != null)
            {
                envelope["exception"] = new JObject
                {
                    ["stackTrace"] = data.Exception.StackTrace
                };
            }

            await _deadLetterContainerClient!.GetBlobClient(blobName)
                .UploadAsync(BinaryData.FromString(envelope.ToString(Formatting.None)), overwrite: true);
        }
        catch (Exception dlqEx)
        {
            // Never allow DLQ writing to crash the batch
            _logger.LogError(dlqEx, "Failed to write dead-letter blob");
        }
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
        if (cleaned.Length > maxLength) cleaned = cleaned[..maxLength];
        return cleaned;
    }
}
