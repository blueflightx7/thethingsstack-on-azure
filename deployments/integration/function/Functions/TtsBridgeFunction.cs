// ==============================================================================
// TtsBridge Function - HTTP Trigger (.NET 8 Isolated Worker)
// ==============================================================================
//
// PURPOSE:
// This Azure Function acts as a webhook endpoint for The Things Stack (TTS)
// to bridge telemetry data to Azure IoT Hub. It receives TTS webhook payloads,
// transforms them, and forwards to IoT Hub using the REST API.
//
// ARCHITECTURE:
// - Uses IHttpClientFactory for proper connection management
// - Auto-registers devices in IoT Hub if not exists
// - Adds routing properties for downstream processing
//
// DATA FLOW:
// 1. Receive TTS webhook POST request (JSON payload)
// 2. Extract device ID from payload (end_device_ids.device_id)
// 3. Ensure device exists in IoT Hub (auto-create if needed)
// 4. Generate device-level SAS token
// 5. POST to IoT Hub with routing headers
// 6. Return success/failure to TTS
//
// ==============================================================================

using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;
using TtsIntegration.Helpers;
using TtsIntegration.Services;

namespace TtsIntegration.Functions;

/// <summary>
/// HTTP trigger function for bridging TTS webhooks to Azure IoT Hub.
/// </summary>
public class TtsBridgeFunction
{
    private readonly ILogger<TtsBridgeFunction> _logger;
    private readonly IIoTHubService _ioTHubService;

    public TtsBridgeFunction(ILogger<TtsBridgeFunction> logger, IIoTHubService ioTHubService)
    {
        _logger = logger;
        _ioTHubService = ioTHubService;
    }

    [Function("TtsBridge")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "IngestWebhook")] HttpRequest req)
    {
        var sw = Stopwatch.StartNew();

        try
        {
            // Read request body
            using var reader = new StreamReader(req.Body);
            var requestBody = await reader.ReadToEndAsync();

            if (string.IsNullOrEmpty(requestBody))
            {
                return new BadRequestObjectResult("Empty body");
            }

            // Parse TTS payload
            var ttsPayload = JObject.Parse(requestBody);
            var deviceId = ttsPayload.GetStringValue("end_device_ids.device_id");
            var devEui = ttsPayload.GetStringValue("end_device_ids.dev_eui");
            var applicationId = ttsPayload.GetStringValue("end_device_ids.application_ids.application_id");

            if (string.IsNullOrEmpty(deviceId))
            {
                _logger.LogWarning("device_id not found in payload");
                return new BadRequestObjectResult("Missing device_id in payload");
            }

            // Determine message type
            var messageType = "uplink";
            if (ttsPayload.SelectToken("uplink_message") != null) messageType = "uplink";
            else if (ttsPayload.SelectToken("join_accept") != null) messageType = "join";
            else if (ttsPayload.SelectToken("location_solved") != null) messageType = "location";

            _logger.LogInformation("Processing {MessageType} for device: {DeviceId}", messageType, deviceId);

            // Ensure device exists in IoT Hub
            await _ioTHubService.EnsureDeviceExistsAsync(deviceId);

            // Create cancellation token with timeout
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(req.HttpContext.RequestAborted);
            cts.CancelAfter(TimeSpan.FromSeconds(10));

            // Send to IoT Hub
            var result = await _ioTHubService.SendTelemetryAsync(
                deviceId,
                requestBody,
                new TelemetryMetadata
                {
                    MessageType = messageType,
                    DevEui = devEui,
                    ApplicationId = applicationId
                },
                cts.Token);

            sw.Stop();

            if (!result.Success)
            {
                _logger.LogError("IoT Hub Error: {StatusCode} - {Error} (took {ElapsedMs}ms)",
                    result.StatusCode, result.ErrorMessage, sw.ElapsedMilliseconds);
                return new StatusCodeResult(result.StatusCode);
            }

            _logger.LogInformation("Forwarded {MessageType} to IoT Hub. Device: {DeviceId}, DevEUI: {DevEui} (took {ElapsedMs}ms)",
                messageType, deviceId, devEui, sw.ElapsedMilliseconds);

            return new OkObjectResult(new
            {
                success = true,
                deviceId,
                messageType,
                processingTimeMs = sw.ElapsedMilliseconds
            });
        }
        catch (TaskCanceledException)
        {
            sw.Stop();
            _logger.LogError("IoT Hub request timed out after 10 seconds (total: {ElapsedMs}ms)", sw.ElapsedMilliseconds);
            return new StatusCodeResult(504);
        }
        catch (HttpRequestException ex)
        {
            sw.Stop();
            _logger.LogError("Network error: {Message} (took {ElapsedMs}ms)", ex.Message, sw.ElapsedMilliseconds);
            return new StatusCodeResult(502);
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "Error processing webhook (took {ElapsedMs}ms)", sw.ElapsedMilliseconds);
            return new StatusCodeResult(500);
        }
    }
}
