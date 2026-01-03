using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using System.Net;

namespace DashboardApi
{
    public class Realtime
    {
        private readonly ILogger _logger;

        private static readonly string? SqlConnectionString = Environment.GetEnvironmentVariable("SqlConnectionString");

        public Realtime(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<Realtime>();
        }

        [Function("GetRealtime")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "realtime")] HttpRequestData req)
        {
            _logger.LogInformation("Getting realtime ingestion snapshot.");

            var auth = await Auth.RequireAuthenticatedAsync(req);
            if (auth != null) return auth;

            if (string.IsNullOrWhiteSpace(SqlConnectionString))
            {
                var missing = req.CreateResponse(HttpStatusCode.InternalServerError);
                await missing.WriteAsJsonAsync(new
                {
                    error = "SqlConnectionString app setting is missing."
                });
                return missing;
            }

            try
            {
                await using var connection = new SqlConnection(SqlConnectionString);
                await connection.OpenAsync();

                const int windowMinutes = 30;

                var points = await GetRecentPointsAsync(connection, windowMinutes);
                var lastMessageAt = await ExecuteDateTimeAsync(connection, "SELECT MAX([Timestamp]) FROM Measurements;");
                var messagesLastMinute = await ExecuteLongAsync(connection, "SELECT COUNT_BIG(1) FROM Measurements WHERE [Timestamp] >= DATEADD(minute, -1, SYSUTCDATETIME());");

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    windowMinutes,
                    points,
                    lastMessageAt,
                    messagesLastMinute
                });
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to query realtime data from SQL.");
                var response = req.CreateResponse(HttpStatusCode.InternalServerError);
                await response.WriteAsJsonAsync(new
                {
                    error = "Failed to query realtime data.",
                    details = ex.Message
                });
                return response;
            }
        }

        private static async Task<List<object>> GetRecentPointsAsync(SqlConnection connection, int windowMinutes)
        {
            var sql = @"
                WITH buckets AS (
                    SELECT
                        DATEADD(minute, DATEDIFF(minute, 0, [Timestamp]), 0) AS Bucket,
                        COUNT_BIG(1) AS Cnt
                    FROM Measurements
                    WHERE [Timestamp] >= DATEADD(minute, -@WindowMinutes, SYSUTCDATETIME())
                    GROUP BY DATEADD(minute, DATEDIFF(minute, 0, [Timestamp]), 0)
                )
                SELECT Bucket, Cnt
                FROM buckets
                ORDER BY Bucket ASC;
            ";

            await using var command = new SqlCommand(sql, connection);
            command.Parameters.AddWithValue("@WindowMinutes", windowMinutes);

            var points = new List<object>();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var bucket = reader.GetDateTime(0);
                var count = reader.GetInt64(1);
                points.Add(new { timestamp = bucket, count });
            }

            return points;
        }

        private static async Task<long> ExecuteLongAsync(SqlConnection connection, string sql)
        {
            await using var command = new SqlCommand(sql, connection);
            var result = await command.ExecuteScalarAsync();
            return result == null || result == DBNull.Value ? 0 : Convert.ToInt64(result);
        }

        private static async Task<DateTime?> ExecuteDateTimeAsync(SqlConnection connection, string sql)
        {
            await using var command = new SqlCommand(sql, connection);
            var result = await command.ExecuteScalarAsync();
            if (result == null || result == DBNull.Value)
            {
                return null;
            }
            return Convert.ToDateTime(result).ToUniversalTime();
        }
    }
}
