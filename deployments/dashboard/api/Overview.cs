using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Net;

namespace DashboardApi
{
    public class Overview
    {
        private readonly ILogger _logger;

        public Overview(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<Overview>();
        }

        [Function("GetOverview")]
        public HttpResponseData Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "overview")] HttpRequestData req)
        {
            _logger.LogInformation("Getting dashboard overview data.");

            // TODO: Connect to Real Data Source
            // Options:
            // 1. Query TTS PostgreSQL Database (requires VNet integration or public access)
            // 2. Query TTS HTTP API (requires API Key)
            // 3. Query Azure Digital Twins / IoT Hub (if integration module is used)
            
            // Current: Mock Data
            var data = new
            {
                activeDevices = 124, // Replace with: await _ttsService.GetActiveDeviceCountAsync()
                messagesToday = 4521, // Replace with: await _metricsService.GetMessageCountAsync(TimeSpan.FromHours(24))
                gatewaysOnline = 8,   // Replace with: await _ttsService.GetOnlineGatewayCountAsync()
                systemStatus = "Healthy",
                lastUpdated = DateTime.UtcNow
            };

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.WriteAsJsonAsync(data);

            return response;
        }
    }
}
