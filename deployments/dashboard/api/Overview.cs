using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using System.Net;

namespace DashboardApi
{
    public class Overview
    {
        private readonly ILogger _logger;

        private static readonly string? SqlConnectionString = Environment.GetEnvironmentVariable("SqlConnectionString");

        public Overview(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<Overview>();
        }

        [Function("GetOverview")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "overview")] HttpRequestData req)
        {
            _logger.LogInformation("Getting dashboard overview data.");

            if (string.IsNullOrWhiteSpace(SqlConnectionString))
            {
                var missing = req.CreateResponse(HttpStatusCode.InternalServerError);
                await missing.WriteAsJsonAsync(new
                {
                    error = "SqlConnectionString app setting is missing.",
                    hint = "Set Function App setting SqlConnectionString to the Integration SQL connection string (same format as integration Function App)."
                });
                return missing;
            }

            try
            {
                await using var connection = new SqlConnection(SqlConnectionString);
                await connection.OpenAsync();

                var activeDevices = await ExecuteIntAsync(connection, "SELECT COUNT_BIG(1) FROM Devices;");
                var messagesToday = await ExecuteIntAsync(connection, "SELECT COUNT_BIG(1) FROM Measurements WHERE [Timestamp] >= DATEADD(day, -1, SYSUTCDATETIME());");
                var gatewaysOnline = await ExecuteIntAsync(connection, @"
                    SELECT COUNT(DISTINCT JSON_VALUE(RawPayload, '$.cleaned.gateway_id'))
                    FROM Measurements
                    WHERE [Timestamp] >= DATEADD(hour, -1, SYSUTCDATETIME())
                      AND JSON_VALUE(RawPayload, '$.cleaned.gateway_id') IS NOT NULL;");

                var data = new
                {
                    activeDevices,
                    messagesToday,
                    gatewaysOnline,
                    systemStatus = "Healthy",
                    lastUpdated = DateTime.UtcNow
                };

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(data);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to query dashboard overview from SQL.");
                var response = req.CreateResponse(HttpStatusCode.InternalServerError);
                await response.WriteAsJsonAsync(new
                {
                    error = "Failed to query overview data.",
                    details = ex.Message
                });
                return response;
            }
        }

        private static async Task<long> ExecuteIntAsync(SqlConnection connection, string sql)
        {
            await using var command = new SqlCommand(sql, connection);
            var result = await command.ExecuteScalarAsync();
            return result == null || result == DBNull.Value ? 0 : Convert.ToInt64(result);
        }
    }
}
