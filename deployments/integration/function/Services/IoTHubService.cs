// ==============================================================================
// IoT Hub Service Implementation
// ==============================================================================

using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace TtsIntegration.Services;

/// <summary>
/// Azure IoT Hub operations using REST API with SAS token authentication.
/// Uses IHttpClientFactory for proper connection management.
/// </summary>
public class IoTHubService : IIoTHubService
{
    private readonly ILogger<IoTHubService> _logger;
    private readonly HttpClient _httpClient;
    private readonly string _hostName;
    private readonly string _sharedAccessKeyName;
    private readonly string _sharedAccessKey;
    private readonly bool _isConfigured;

    public IoTHubService(HttpClient httpClient, ILogger<IoTHubService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        var connectionString = Environment.GetEnvironmentVariable("IoTHubConnectionString");
        if (string.IsNullOrEmpty(connectionString))
        {
            _logger.LogWarning("IoTHubConnectionString is not configured");
            _isConfigured = false;
            _hostName = string.Empty;
            _sharedAccessKeyName = string.Empty;
            _sharedAccessKey = string.Empty;
            return;
        }

        var parts = ParseConnectionString(connectionString);
        _hostName = parts.GetValueOrDefault("HostName", string.Empty);
        _sharedAccessKeyName = parts.GetValueOrDefault("SharedAccessKeyName", "iothubowner");
        _sharedAccessKey = parts.GetValueOrDefault("SharedAccessKey", string.Empty);
        _isConfigured = !string.IsNullOrEmpty(_hostName) && !string.IsNullOrEmpty(_sharedAccessKey);
    }

    public async Task EnsureDeviceExistsAsync(string deviceId)
    {
        if (!_isConfigured) return;

        try
        {
            var checkUri = $"https://{_hostName}/devices/{deviceId}?api-version=2020-05-31-preview";
            var sasToken = GenerateSasTokenForRegistry(_hostName, _sharedAccessKeyName, _sharedAccessKey);

            using var checkRequest = new HttpRequestMessage(HttpMethod.Get, checkUri);
            checkRequest.Headers.Add("Authorization", sasToken);

            var checkResponse = await _httpClient.SendAsync(checkRequest);

            if (checkResponse.StatusCode == HttpStatusCode.NotFound)
            {
                _logger.LogInformation("Device {DeviceId} not found, creating...", deviceId);

                var createUri = $"https://{_hostName}/devices/{deviceId}?api-version=2020-05-31-preview";
                var deviceBody = new { deviceId };
                var createContent = new StringContent(JsonConvert.SerializeObject(deviceBody), Encoding.UTF8, "application/json");

                using var createRequest = new HttpRequestMessage(HttpMethod.Put, createUri);
                createRequest.Headers.Add("Authorization", sasToken);
                createRequest.Content = createContent;

                var createResponse = await _httpClient.SendAsync(createRequest);

                if (createResponse.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Device {DeviceId} created successfully", deviceId);
                }
                else
                {
                    var errorBody = await createResponse.Content.ReadAsStringAsync();
                    _logger.LogWarning("Failed to create device {DeviceId}: {StatusCode} - {Error}", 
                        deviceId, createResponse.StatusCode, errorBody);
                }
            }
            else if (checkResponse.IsSuccessStatusCode)
            {
                _logger.LogDebug("Device {DeviceId} already exists", deviceId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking/creating device {DeviceId}", deviceId);
        }
    }

    public async Task<string?> GetDeviceKeyAsync(string deviceId)
    {
        if (!_isConfigured) return null;

        try
        {
            var uri = $"https://{_hostName}/devices/{deviceId}?api-version=2020-05-31-preview";
            var sasToken = GenerateSasTokenForRegistry(_hostName, _sharedAccessKeyName, _sharedAccessKey);

            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.Add("Authorization", sasToken);

            var response = await _httpClient.SendAsync(request);

            if (response.IsSuccessStatusCode)
            {
                var responseBody = await response.Content.ReadAsStringAsync();
                var deviceInfo = JObject.Parse(responseBody);
                return deviceInfo.SelectToken("authentication.symmetricKey.primaryKey")?.ToString();
            }
            else
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to retrieve device key for {DeviceId}: {StatusCode} - {Error}", 
                    deviceId, response.StatusCode, errorBody);
                return null;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving device key for {DeviceId}", deviceId);
            return null;
        }
    }

    public async Task<IoTHubSendResult> SendTelemetryAsync(string deviceId, string payload, TelemetryMetadata metadata, CancellationToken cancellationToken = default)
    {
        if (!_isConfigured)
        {
            return new IoTHubSendResult { Success = false, StatusCode = 500, ErrorMessage = "IoT Hub not configured" };
        }

        // Get device key for per-device SAS token
        var deviceKey = await GetDeviceKeyAsync(deviceId);
        if (string.IsNullOrEmpty(deviceKey))
        {
            return new IoTHubSendResult { Success = false, StatusCode = 500, ErrorMessage = "Failed to retrieve device key" };
        }

        // Generate device-level SAS token
        var sasToken = GenerateSasToken(_hostName, deviceId, deviceKey);

        var uri = $"https://{_hostName}/devices/{deviceId}/messages/events?api-version=2020-03-13";
        var content = new StringContent(payload, Encoding.UTF8, "application/json");

        using var request = new HttpRequestMessage(HttpMethod.Post, uri);
        request.Content = content;

        // Add routing metadata (IoT Hub message properties)
        request.Headers.Add("iothub-app-deviceId", deviceId);
        request.Headers.Add("iothub-app-messageType", metadata.MessageType);
        request.Headers.Add("iothub-app-source", "tts-webhook");
        if (!string.IsNullOrEmpty(metadata.DevEui)) request.Headers.Add("iothub-app-devEui", metadata.DevEui);
        if (!string.IsNullOrEmpty(metadata.ApplicationId)) request.Headers.Add("iothub-app-applicationId", metadata.ApplicationId);
        request.Headers.Add("Authorization", sasToken);

        try
        {
            var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return new IoTHubSendResult { Success = true, StatusCode = (int)response.StatusCode };
            }
            else
            {
                var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
                return new IoTHubSendResult 
                { 
                    Success = false, 
                    StatusCode = (int)response.StatusCode, 
                    ErrorMessage = responseBody 
                };
            }
        }
        catch (TaskCanceledException)
        {
            return new IoTHubSendResult { Success = false, StatusCode = 504, ErrorMessage = "Request timed out" };
        }
        catch (HttpRequestException ex)
        {
            return new IoTHubSendResult { Success = false, StatusCode = 502, ErrorMessage = ex.Message };
        }
    }

    private static Dictionary<string, string> ParseConnectionString(string cs)
    {
        return cs.Split(';')
            .Select(part => part.Split(new[] { '=' }, 2))
            .Where(part => part.Length == 2)
            .ToDictionary(part => part[0].Trim(), part => part[1].Trim(), StringComparer.OrdinalIgnoreCase);
    }

    private static string GenerateSasTokenForRegistry(string hostName, string keyName, string key, int expiryInSeconds = 3600)
    {
        var resourceUri = hostName;
        var fromEpochStart = DateTime.UtcNow - new DateTime(1970, 1, 1);
        var expiry = Convert.ToString((int)fromEpochStart.TotalSeconds + expiryInSeconds);

        var stringToSign = WebUtility.UrlEncode(resourceUri) + "\n" + expiry;
        using var hmac = new HMACSHA256(Convert.FromBase64String(key));
        var signature = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(stringToSign)));

        return $"SharedAccessSignature sr={WebUtility.UrlEncode(resourceUri)}&sig={WebUtility.UrlEncode(signature)}&se={expiry}&skn={keyName}";
    }

    private static string GenerateSasToken(string hostName, string deviceId, string deviceKey, int expiryInSeconds = 3600)
    {
        var resourceUri = $"{hostName}/devices/{deviceId}";
        var fromEpochStart = DateTime.UtcNow - new DateTime(1970, 1, 1);
        var expiry = Convert.ToString((int)fromEpochStart.TotalSeconds + expiryInSeconds);

        var stringToSign = WebUtility.UrlEncode(resourceUri) + "\n" + expiry;
        using var hmac = new HMACSHA256(Convert.FromBase64String(deviceKey));
        var signature = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(stringToSign)));

        return $"SharedAccessSignature sr={WebUtility.UrlEncode(resourceUri)}&sig={WebUtility.UrlEncode(signature)}&se={expiry}";
    }
}
