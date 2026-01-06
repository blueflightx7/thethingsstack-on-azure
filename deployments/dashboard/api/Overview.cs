using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using System.Net;
using System.Globalization;

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

            var auth = await Auth.RequireAuthenticatedAsync(req);
            if (auth != null) return auth;

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
                    SELECT COUNT_BIG(1)
                    FROM Gateways
                    WHERE LastSeen >= DATEADD(hour, -1, SYSUTCDATETIME());");

                var hives = await GetHivesWithLocationsAsync(connection, top: 25);

                var data = new
                {
                    activeDevices,
                    messagesToday,
                    gatewaysOnline,
                    hives,
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

        private static async Task<List<object>> GetHivesWithLocationsAsync(SqlConnection connection, int top)
        {
            var sql = @"
                SELECT TOP (@Top)
                    d.DeviceID,
                    d.DevEUI,
                    d.HardwareID,
                    d.Name,
                    d.HiveIdentity,
                    d.HiveName,
                    d.LastSeenAt,
                    m.[Timestamp] AS LastMeasurementAt,
                    COALESCE(hl.Latitude, m.Latitude) AS ResolvedLatitude,
                    COALESCE(hl.Longitude, m.Longitude) AS ResolvedLongitude,
                    hl.Label AS LocationLabel,
                    g.GatewayIdentifier,
                    m.Temperature_Inner,
                    m.Temperature_Outer,
                    m.Humidity,
                    m.Weight_KG,
                    m.BatteryVoltage,
                    m.BatteryPercent,
                    m.SoundEnergyTotal,
                    m.SoundDominantBinRange,
                    m.Temperature_Inner_F,
                    m.Temperature_Outer_F
                FROM Devices d
                LEFT JOIN HiveLocations hl ON hl.HiveIdentity = d.HiveIdentity
                OUTER APPLY (
                    SELECT TOP (1) *
                    FROM Measurements
                    WHERE DeviceID = d.DeviceID
                    ORDER BY [Timestamp] DESC
                ) m
                LEFT JOIN Gateways g ON g.GatewayID = m.GatewayID
                ORDER BY ISNULL(d.LastSeenAt, '1900-01-01') DESC;
            ";

            await using var command = new SqlCommand(sql, connection);
            command.Parameters.AddWithValue("@Top", top);

            var rows = new List<object>();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                int deviceId = reader.GetInt32(0);
                string devEui = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);
                string? hardwareId = reader.IsDBNull(2) ? null : reader.GetString(2);
                string? name = reader.IsDBNull(3) ? null : reader.GetString(3);
                Guid? hiveIdentity = reader.IsDBNull(4) ? null : reader.GetGuid(4);
                string? hiveName = reader.IsDBNull(5) ? null : reader.GetString(5);
                DateTime? lastSeenAt = reader.IsDBNull(6) ? null : reader.GetDateTime(6).ToUniversalTime();
                DateTime? lastMeasurementAt = reader.IsDBNull(7) ? null : reader.GetDateTime(7).ToUniversalTime();
                decimal? latitude = reader.IsDBNull(8) ? null : reader.GetDecimal(8);
                decimal? longitude = reader.IsDBNull(9) ? null : reader.GetDecimal(9);
                string? locationLabel = reader.IsDBNull(10) ? null : reader.GetString(10);
                string? gatewayIdentifier = reader.IsDBNull(11) ? null : reader.GetString(11);

                decimal? temperatureInner = reader.IsDBNull(12) ? null : reader.GetDecimal(12);
                decimal? temperatureOuter = reader.IsDBNull(13) ? null : reader.GetDecimal(13);
                decimal? humidity = reader.IsDBNull(14) ? null : reader.GetDecimal(14);
                decimal? weightKg = reader.IsDBNull(15) ? null : reader.GetDecimal(15);
                decimal? batteryVoltage = reader.IsDBNull(16) ? null : reader.GetDecimal(16);
                int? batteryPercent = reader.IsDBNull(17) ? null : reader.GetInt32(17);
                long? soundEnergyTotal = reader.IsDBNull(18) ? null : reader.GetInt64(18);
                string? soundDominantBinRange = reader.IsDBNull(19) ? null : reader.GetString(19);
                decimal? temperatureInnerF = reader.IsDBNull(20) ? null : reader.GetDecimal(20);
                decimal? temperatureOuterF = reader.IsDBNull(21) ? null : reader.GetDecimal(21);

                var displayName = hiveName;
                if (string.IsNullOrWhiteSpace(displayName)) displayName = name;
                if (string.IsNullOrWhiteSpace(displayName)) displayName = hardwareId;
                if (string.IsNullOrWhiteSpace(displayName)) displayName = devEui;
                if (string.IsNullOrWhiteSpace(displayName)) displayName = $"device:{deviceId}";

                rows.Add(new
                {
                    deviceId,
                    devEui,
                    hiveIdentity = hiveIdentity?.ToString("D"),
                    hiveName = displayName,
                    lastSeenAt,
                    lastMeasurementAt,
                    location = new
                    {
                        label = locationLabel,
                        latitude,
                        longitude,
                    },
                    telemetry = new
                    {
                        temperatureInner,
                        temperatureOuter,
                        temperatureInnerF,
                        temperatureOuterF,
                        humidity,
                        weightKg,
                        batteryVoltage,
                        batteryPercent,
                        soundEnergyTotal,
                        soundDominantBinRange,
                    },
                    gatewayIdentifier
                });
            }

            return rows;
        }
    }
}
