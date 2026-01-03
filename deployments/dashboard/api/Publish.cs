using System.IO;
using System.Net;
using System.Text.Json;
using Azure.Messaging.WebPubSub;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace DashboardApi
{
    public class Publish
    {
        private readonly ILogger _logger;

        private static readonly string? WebPubSubConnectionString = Environment.GetEnvironmentVariable("WebPubSubConnectionString");
        private const string HubName = "dashboard";

        public Publish(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<Publish>();
        }

        [Function("Publish")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = "publish")] HttpRequestData req)
        {
            if (string.IsNullOrWhiteSpace(WebPubSubConnectionString))
            {
                var missing = req.CreateResponse(HttpStatusCode.InternalServerError);
                await missing.WriteAsJsonAsync(new
                {
                    error = "WebPubSubConnectionString app setting is missing."
                });
                return missing;
            }

            string body;
            using (var reader = new StreamReader(req.Body))
            {
                body = await reader.ReadToEndAsync();
            }

            if (string.IsNullOrWhiteSpace(body))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Request body is required." });
                return bad;
            }

            JsonElement payload;
            try
            {
                payload = JsonSerializer.Deserialize<JsonElement>(body);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Invalid JSON payload for publish.");
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Body must be valid JSON." });
                return bad;
            }

            // Convention: broadcast to all connections; clients can filter by `type`.
            var message = new
            {
                type = "telemetry",
                data = payload,
                publishedAt = DateTime.UtcNow
            };

            var client = new WebPubSubServiceClient(WebPubSubConnectionString, HubName);
            await client.SendToAllAsync(JsonSerializer.Serialize(message));

            var ok = req.CreateResponse(HttpStatusCode.OK);
            await ok.WriteAsJsonAsync(new { ok = true });
            return ok;
        }
    }
}
