using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace DashboardApi
{
    public class Negotiate
    {
        private readonly ILogger _logger;

        public Negotiate(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<Negotiate>();
        }

        [Function("Negotiate")]
        public HttpResponseData Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "negotiate")] HttpRequestData req,
            [WebPubSubConnectionInput(Hub = "dashboard", Connection = "WebPubSubConnectionString")] WebPubSubConnection connectionInfo)
        {
            _logger.LogInformation("Generating Web PubSub connection string...");

            var response = req.CreateResponse(System.Net.HttpStatusCode.OK);
            response.WriteAsJsonAsync(connectionInfo);

            return response;
        }
    }
}
