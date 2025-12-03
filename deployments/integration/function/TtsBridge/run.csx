#r "Newtonsoft.Json"

using System.Net;
using System.Net.Http;
using System.Text;
using System.Security.Cryptography;
using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

// Singleton HttpClient is thread-safe and recommended
private static readonly HttpClient httpClient = new HttpClient();
private static string connectionString = Environment.GetEnvironmentVariable("BridgeConnectionString");

public static async Task<IActionResult> Run(HttpRequest req, ILogger log)
{
    try 
    {
        if (string.IsNullOrEmpty(connectionString))
        {
            log.LogError("BridgeConnectionString is missing");
            return new StatusCodeResult(500);
        }

        string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
        
        if (string.IsNullOrEmpty(requestBody)) {
            return new BadRequestObjectResult("Empty body");
        }

        // Parse Connection String
        var csParts = ParseConnectionString(connectionString);
        string hostName = csParts["HostName"];
        string deviceId = csParts["DeviceId"];
        string sharedAccessKey = csParts["SharedAccessKey"];

        // Parse Payload to get actual device ID
        JObject data = JObject.Parse(requestBody);
        string actualDeviceId = data.SelectToken("end_device_ids.device_id")?.ToString() ?? "unknown";
        string messageType = "uplink";
        
        if (data.SelectToken("uplink_message") != null) messageType = "uplink";
        else if (data.SelectToken("join_accept") != null) messageType = "join";
        else if (data.SelectToken("location_solved") != null) messageType = "location";

        // Generate SAS Token
        string sasToken = GenerateSasToken(hostName, deviceId, sharedAccessKey);

        // Send to IoT Hub REST API
        // Endpoint: https://{hostName}/devices/{deviceId}/messages/events?api-version=2020-03-13
        string uri = $"https://{hostName}/devices/{deviceId}/messages/events?api-version=2020-03-13";
        
        var content = new StringContent(requestBody, Encoding.UTF8, "application/json");
        
        // Add Routing Properties as Headers
        // Format: iothub-app-{property-name}
        content.Headers.Add("iothub-app-deviceId", actualDeviceId);
        content.Headers.Add("iothub-app-messageType", messageType);
        content.Headers.Add("iothub-app-source", "tts-webhook");

        // Add Authorization
        httpClient.DefaultRequestHeaders.Authorization = null; // Clear previous
        var request = new HttpRequestMessage(HttpMethod.Post, uri);
        request.Headers.Add("Authorization", sasToken);
        request.Content = content;

        var response = await httpClient.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            string responseBody = await response.Content.ReadAsStringAsync();
            log.LogError($"IoT Hub Error: {response.StatusCode} - {responseBody}");
            return new StatusCodeResult((int)response.StatusCode);
        }

        return new OkObjectResult($"Forwarded to IoT Hub. Device: {actualDeviceId}");
    }
    catch (Exception ex)
    {
        log.LogError($"Error forwarding message: {ex.Message}");
        return new StatusCodeResult(500);
    }
}

private static Dictionary<string, string> ParseConnectionString(string cs)
{
    return cs.Split(';')
             .Select(part => part.Split(new[] { '=' }, 2))
             .Where(part => part.Length == 2)
             .ToDictionary(part => part[0].Trim(), part => part[1].Trim(), StringComparer.OrdinalIgnoreCase);
}

private static string GenerateSasToken(string resourceUri, string keyName, string key, int expiryInSeconds = 3600)
{
    TimeSpan fromEpochStart = DateTime.UtcNow - new DateTime(1970, 1, 1);
    string expiry = Convert.ToString((int)fromEpochStart.TotalSeconds + expiryInSeconds);

    string stringToSign = WebUtility.UrlEncode(resourceUri) + "\n" + expiry;

    HMACSHA256 hmac = new HMACSHA256(Convert.FromBase64String(key));
    string signature = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(stringToSign)));

    return $"SharedAccessSignature sr={WebUtility.UrlEncode(resourceUri)}&sig={WebUtility.UrlEncode(signature)}&se={expiry}";
}

// Overload for Device Connection String (no KeyName needed usually, but format varies)
private static string GenerateSasToken(string hostName, string deviceId, string key)
{
    string resourceUri = $"{hostName}/devices/{deviceId}";
    return GenerateSasToken(resourceUri, null, key);
}