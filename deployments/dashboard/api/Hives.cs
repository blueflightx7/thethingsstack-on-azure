using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace DashboardApi;

public sealed class Hives
{
    private readonly ILogger _logger;
    private static readonly string? SqlConnectionString = Environment.GetEnvironmentVariable("SqlConnectionString");

    public Hives(ILoggerFactory loggerFactory)
    {
        _logger = loggerFactory.CreateLogger<Hives>();
    }

    [Function("GetHive")]
    public async Task<HttpResponseData> GetHive(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "hives/{hiveIdentity}")] HttpRequestData req,
        string hiveIdentity)
    {
        var auth = await Auth.RequireAuthenticatedAsync(req);
        if (auth != null) return auth;

        if (string.IsNullOrWhiteSpace(SqlConnectionString))
        {
            var missing = req.CreateResponse(HttpStatusCode.InternalServerError);
            await missing.WriteAsJsonAsync(new { error = "SqlConnectionString app setting is missing." });
            return missing;
        }

        if (!Guid.TryParse(hiveIdentity, out var hiveGuid))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid hiveIdentity (expected GUID)." });
            return bad;
        }

        try
        {
            await using var connection = new SqlConnection(SqlConnectionString);
            await connection.OpenAsync();

            var hive = await GetHiveSummaryAsync(connection, hiveGuid);
            if (hive == null)
            {
                var notFound = req.CreateResponse(HttpStatusCode.NotFound);
                await notFound.WriteAsJsonAsync(new { error = "Hive not found." });
                return notFound;
            }

            var res = req.CreateResponse(HttpStatusCode.OK);
            await res.WriteAsJsonAsync(hive);
            return res;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to query hive.");
            var res = req.CreateResponse(HttpStatusCode.InternalServerError);
            await res.WriteAsJsonAsync(new { error = "Failed to query hive.", details = ex.Message });
            return res;
        }
    }

    [Function("GetHiveSeries")]
    public async Task<HttpResponseData> GetHiveSeries(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "hives/{hiveIdentity}/series")] HttpRequestData req,
        string hiveIdentity)
    {
        var auth = await Auth.RequireAuthenticatedAsync(req);
        if (auth != null) return auth;

        if (string.IsNullOrWhiteSpace(SqlConnectionString))
        {
            var missing = req.CreateResponse(HttpStatusCode.InternalServerError);
            await missing.WriteAsJsonAsync(new { error = "SqlConnectionString app setting is missing." });
            return missing;
        }

        if (!Guid.TryParse(hiveIdentity, out var hiveGuid))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid hiveIdentity (expected GUID)." });
            return bad;
        }

        int minutes = 240;
        int maxPoints = 480;

        var q = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        if (int.TryParse(q.Get("minutes"), out var parsedMinutes) && parsedMinutes > 0 && parsedMinutes <= 24 * 60)
        {
            minutes = parsedMinutes;
        }
        if (int.TryParse(q.Get("maxPoints"), out var parsedMax) && parsedMax > 0 && parsedMax <= 2000)
        {
            maxPoints = parsedMax;
        }

        try
        {
            await using var connection = new SqlConnection(SqlConnectionString);
            await connection.OpenAsync();

            var series = await GetHiveSeriesAsync(connection, hiveGuid, minutes, maxPoints);

            var res = req.CreateResponse(HttpStatusCode.OK);
            await res.WriteAsJsonAsync(new { hiveIdentity = hiveGuid.ToString("D"), minutes, points = series });
            return res;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to query hive series.");
            var res = req.CreateResponse(HttpStatusCode.InternalServerError);
            await res.WriteAsJsonAsync(new { error = "Failed to query hive series.", details = ex.Message });
            return res;
        }
    }

    private static async Task<object?> GetHiveSummaryAsync(SqlConnection connection, Guid hiveIdentity)
    {
        var sql = @"
            SELECT TOP (1)
                d.DeviceID,
                d.DevEUI,
                d.HiveIdentity,
                d.HiveName,
                d.LastSeenAt,
                m.[Timestamp] AS LastMeasurementAt,
                m.Temperature_Inner,
                m.Temperature_Outer,
                m.Humidity,
                m.Weight_KG,
                m.BatteryVoltage,
                m.BatteryPercent,
                m.SoundFrequency,
                m.SoundEnergyTotal,
                m.SoundEnergyLow,
                m.SoundEnergyMid,
                m.SoundEnergyHigh,
                m.SoundDominantBin,
                m.SoundDominantBinRange,
                m.RSSI,
                m.SNR,
                COALESCE(hl.Latitude, m.Latitude) AS ResolvedLatitude,
                COALESCE(hl.Longitude, m.Longitude) AS ResolvedLongitude,
                hl.Label AS LocationLabel,
                g.GatewayIdentifier,
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
            WHERE d.HiveIdentity = @HiveIdentity
            ORDER BY ISNULL(d.LastSeenAt, '1900-01-01') DESC;
        ";

        await using var cmd = new SqlCommand(sql, connection);
        cmd.Parameters.AddWithValue("@HiveIdentity", hiveIdentity);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return null;

        return new
        {
            deviceId = reader.IsDBNull(0) ? 0 : reader.GetInt32(0),
            devEui = reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
            hiveIdentity = reader.IsDBNull(2) ? null : reader.GetGuid(2).ToString("D"),
            hiveName = reader.IsDBNull(3) ? null : reader.GetString(3),
            lastSeenAt = reader.IsDBNull(4) ? (DateTime?)null : reader.GetDateTime(4).ToUniversalTime(),
            lastMeasurementAt = reader.IsDBNull(5) ? (DateTime?)null : reader.GetDateTime(5).ToUniversalTime(),
            telemetry = new
            {
                temperatureInner = reader.IsDBNull(6) ? (decimal?)null : reader.GetDecimal(6),
                temperatureOuter = reader.IsDBNull(7) ? (decimal?)null : reader.GetDecimal(7),
                temperatureInnerF = reader.IsDBNull(25) ? (decimal?)null : reader.GetDecimal(25),
                temperatureOuterF = reader.IsDBNull(26) ? (decimal?)null : reader.GetDecimal(26),
                humidity = reader.IsDBNull(8) ? (decimal?)null : reader.GetDecimal(8),
                weightKg = reader.IsDBNull(9) ? (decimal?)null : reader.GetDecimal(9),
                batteryVoltage = reader.IsDBNull(10) ? (decimal?)null : reader.GetDecimal(10),
                batteryPercent = reader.IsDBNull(11) ? (int?)null : reader.GetInt32(11),
                soundFrequency = reader.IsDBNull(12) ? (decimal?)null : reader.GetDecimal(12),
                soundEnergyTotal = reader.IsDBNull(13) ? (long?)null : reader.GetInt64(13),
                soundEnergyLow = reader.IsDBNull(14) ? (long?)null : reader.GetInt64(14),
                soundEnergyMid = reader.IsDBNull(15) ? (long?)null : reader.GetInt64(15),
                soundEnergyHigh = reader.IsDBNull(16) ? (long?)null : reader.GetInt64(16),
                soundDominantBin = reader.IsDBNull(17) ? (int?)null : reader.GetInt32(17),
                soundDominantBinRange = reader.IsDBNull(18) ? null : reader.GetString(18),
                rssi = reader.IsDBNull(19) ? (int?)null : reader.GetInt32(19),
                snr = reader.IsDBNull(20) ? (decimal?)null : reader.GetDecimal(20),
            },
            location = new
            {
                label = reader.IsDBNull(23) ? null : reader.GetString(23),
                latitude = reader.IsDBNull(21) ? (decimal?)null : reader.GetDecimal(21),
                longitude = reader.IsDBNull(22) ? (decimal?)null : reader.GetDecimal(22),
            },
            gatewayIdentifier = reader.IsDBNull(24) ? null : reader.GetString(24),
        };
    }

    private static async Task<List<object>> GetHiveSeriesAsync(SqlConnection connection, Guid hiveIdentity, int minutes, int maxPoints)
    {
        var sql = @"
            SELECT TOP (@MaxPoints)
                m.[Timestamp],
                m.Temperature_Inner,
                m.Temperature_Outer,
                m.Humidity,
                m.Weight_KG,
                m.BatteryVoltage,
                m.BatteryPercent,
                m.SoundFrequency,
                m.SoundEnergyTotal,
                m.SoundEnergyLow,
                m.SoundEnergyMid,
                m.SoundEnergyHigh,
                m.RSSI,
                m.SNR,
                m.Latitude,
                m.Longitude,
                m.FFT_Bin_71_122,
                m.FFT_Bin_122_173,
                m.FFT_Bin_173_224,
                m.FFT_Bin_224_276,
                m.FFT_Bin_276_327,
                m.FFT_Bin_327_378,
                m.FFT_Bin_378_429,
                m.FFT_Bin_429_480,
                m.FFT_Bin_480_532,
                m.FFT_Bin_532_583,
                m.Temperature_Inner_F,
                m.Temperature_Outer_F
            FROM Measurements m
            INNER JOIN Devices d ON d.DeviceID = m.DeviceID
            WHERE d.HiveIdentity = @HiveIdentity
              AND m.[Timestamp] >= DATEADD(minute, -@Minutes, SYSUTCDATETIME())
            ORDER BY m.[Timestamp] DESC;
        ";

        await using var cmd = new SqlCommand(sql, connection);
        cmd.Parameters.AddWithValue("@HiveIdentity", hiveIdentity);
        cmd.Parameters.AddWithValue("@Minutes", minutes);
        cmd.Parameters.AddWithValue("@MaxPoints", maxPoints);

        var rows = new List<object>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            rows.Add(new
            {
                timestamp = reader.GetDateTime(0).ToUniversalTime(),
                temperatureInner = reader.IsDBNull(1) ? (decimal?)null : reader.GetDecimal(1),
                temperatureOuter = reader.IsDBNull(2) ? (decimal?)null : reader.GetDecimal(2),
                temperatureInnerF = reader.IsDBNull(26) ? (decimal?)null : reader.GetDecimal(26),
                temperatureOuterF = reader.IsDBNull(27) ? (decimal?)null : reader.GetDecimal(27),
                humidity = reader.IsDBNull(3) ? (decimal?)null : reader.GetDecimal(3),
                weightKg = reader.IsDBNull(4) ? (decimal?)null : reader.GetDecimal(4),
                batteryVoltage = reader.IsDBNull(5) ? (decimal?)null : reader.GetDecimal(5),
                batteryPercent = reader.IsDBNull(6) ? (int?)null : reader.GetInt32(6),
                soundFrequency = reader.IsDBNull(7) ? (decimal?)null : reader.GetDecimal(7),
                soundEnergyTotal = reader.IsDBNull(8) ? (long?)null : reader.GetInt64(8),
                soundEnergyLow = reader.IsDBNull(9) ? (long?)null : reader.GetInt64(9),
                soundEnergyMid = reader.IsDBNull(10) ? (long?)null : reader.GetInt64(10),
                soundEnergyHigh = reader.IsDBNull(11) ? (long?)null : reader.GetInt64(11),
                rssi = reader.IsDBNull(12) ? (int?)null : reader.GetInt32(12),
                snr = reader.IsDBNull(13) ? (decimal?)null : reader.GetDecimal(13),
                latitude = reader.IsDBNull(14) ? (decimal?)null : reader.GetDecimal(14),
                longitude = reader.IsDBNull(15) ? (decimal?)null : reader.GetDecimal(15),
                fft = new
                {
                    bin_71_122 = reader.IsDBNull(16) ? (int?)null : reader.GetInt32(16),
                    bin_122_173 = reader.IsDBNull(17) ? (int?)null : reader.GetInt32(17),
                    bin_173_224 = reader.IsDBNull(18) ? (int?)null : reader.GetInt32(18),
                    bin_224_276 = reader.IsDBNull(19) ? (int?)null : reader.GetInt32(19),
                    bin_276_327 = reader.IsDBNull(20) ? (int?)null : reader.GetInt32(20),
                    bin_327_378 = reader.IsDBNull(21) ? (int?)null : reader.GetInt32(21),
                    bin_378_429 = reader.IsDBNull(22) ? (int?)null : reader.GetInt32(22),
                    bin_429_480 = reader.IsDBNull(23) ? (int?)null : reader.GetInt32(23),
                    bin_480_532 = reader.IsDBNull(24) ? (int?)null : reader.GetInt32(24),
                    bin_532_583 = reader.IsDBNull(25) ? (int?)null : reader.GetInt32(25),
                }
            });
        }

        rows.Reverse();
        return rows;
    }
}
