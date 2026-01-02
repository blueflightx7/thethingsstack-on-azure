using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace DashboardApi;

public sealed class AdminLocations
{
    private readonly ILogger _logger;
    private static readonly string? SqlConnectionString = Environment.GetEnvironmentVariable("SqlConnectionString");

    public AdminLocations(ILoggerFactory loggerFactory)
    {
        _logger = loggerFactory.CreateLogger<AdminLocations>();
    }

    public sealed record UpsertLocationRequest(string? Label, decimal? Latitude, decimal? Longitude);

    [Function("UpsertHiveLocation")]
    public async Task<HttpResponseData> UpsertHiveLocation(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "admin/hives/{hiveIdentity}/location")] HttpRequestData req,
        string hiveIdentity)
    {
        var auth = await Auth.RequireAdminAsync(req);
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

        UpsertLocationRequest? body;
        try
        {
            body = await req.ReadFromJsonAsync<UpsertLocationRequest>();
        }
        catch
        {
            body = null;
        }

        if (body == null)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Body is required." });
            return bad;
        }

        // Validation: either both lat/lon are provided, or neither.
        if ((body.Latitude.HasValue && !body.Longitude.HasValue) || (!body.Latitude.HasValue && body.Longitude.HasValue))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Latitude and Longitude must be provided together." });
            return bad;
        }

        if (body.Latitude is < -90 or > 90)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Latitude must be between -90 and 90." });
            return bad;
        }

        if (body.Longitude is < -180 or > 180)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Longitude must be between -180 and 180." });
            return bad;
        }

        Auth.TryGetClientPrincipal(req, out var principal);
        var updatedBy = principal?.UserDetails;

        try
        {
            await using var connection = new SqlConnection(SqlConnectionString);
            await connection.OpenAsync();

            await UpsertAsync(connection, hiveGuid, body.Label, body.Latitude, body.Longitude, updatedBy);

            var res = req.CreateResponse(HttpStatusCode.OK);
            await res.WriteAsJsonAsync(new
            {
                hiveIdentity = hiveGuid.ToString("D"),
                label = body.Label,
                latitude = body.Latitude,
                longitude = body.Longitude,
                updatedBy
            });
            return res;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upsert HiveLocations.");
            var res = req.CreateResponse(HttpStatusCode.InternalServerError);
            await res.WriteAsJsonAsync(new { error = "Failed to upsert location.", details = ex.Message });
            return res;
        }
    }

    [Function("DeleteHiveLocation")]
    public async Task<HttpResponseData> DeleteHiveLocation(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "admin/hives/{hiveIdentity}/location")] HttpRequestData req,
        string hiveIdentity)
    {
        var auth = await Auth.RequireAdminAsync(req);
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

            var deleted = await DeleteAsync(connection, hiveGuid);

            var res = req.CreateResponse(HttpStatusCode.OK);
            await res.WriteAsJsonAsync(new { hiveIdentity = hiveGuid.ToString("D"), deleted });
            return res;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete HiveLocations.");
            var res = req.CreateResponse(HttpStatusCode.InternalServerError);
            await res.WriteAsJsonAsync(new { error = "Failed to delete location.", details = ex.Message });
            return res;
        }
    }

    private static async Task UpsertAsync(
        SqlConnection connection,
        Guid hiveIdentity,
        string? label,
        decimal? latitude,
        decimal? longitude,
        string? updatedBy)
    {
        var sql = @"
            MERGE HiveLocations AS target
            USING (SELECT @HiveIdentity AS HiveIdentity) AS source
            ON target.HiveIdentity = source.HiveIdentity
            WHEN MATCHED THEN
                UPDATE SET
                    Label = @Label,
                    Latitude = @Latitude,
                    Longitude = @Longitude,
                    UpdatedAt = SYSUTCDATETIME(),
                    UpdatedBy = @UpdatedBy
            WHEN NOT MATCHED THEN
                INSERT (HiveIdentity, Label, Latitude, Longitude, UpdatedAt, UpdatedBy, CreatedAt)
                VALUES (@HiveIdentity, @Label, @Latitude, @Longitude, SYSUTCDATETIME(), @UpdatedBy, SYSUTCDATETIME());
        ";

        await using var cmd = new SqlCommand(sql, connection);
        cmd.Parameters.AddWithValue("@HiveIdentity", hiveIdentity);
        cmd.Parameters.AddWithValue("@Label", (object?)label ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Latitude", (object?)latitude ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Longitude", (object?)longitude ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@UpdatedBy", (object?)updatedBy ?? DBNull.Value);

        await cmd.ExecuteNonQueryAsync();
    }

    private static async Task<int> DeleteAsync(SqlConnection connection, Guid hiveIdentity)
    {
        var sql = "DELETE FROM HiveLocations WHERE HiveIdentity = @HiveIdentity";
        await using var cmd = new SqlCommand(sql, connection);
        cmd.Parameters.AddWithValue("@HiveIdentity", hiveIdentity);
        return await cmd.ExecuteNonQueryAsync();
    }
}
