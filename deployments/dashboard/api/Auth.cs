using System.Security.Claims;
using System.Text;
using Microsoft.Azure.Functions.Worker.Http;

namespace DashboardApi;

internal static class Auth
{
    // Role used by Azure Static Web Apps role invitations (Portal -> Role management).
    internal const string AdminRole = "Admin";

    internal static bool TryGetClientPrincipal(HttpRequestData req, out ClientPrincipal principal)
    {
        principal = ClientPrincipal.Anonymous;

        if (!req.Headers.TryGetValues("x-ms-client-principal", out var values))
        {
            return false;
        }

        var encoded = values.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(encoded))
        {
            return false;
        }

        try
        {
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(encoded));
            principal = System.Text.Json.JsonSerializer.Deserialize<ClientPrincipal>(decoded,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? ClientPrincipal.Anonymous;

            return !string.IsNullOrWhiteSpace(principal.UserId);
        }
        catch
        {
            principal = ClientPrincipal.Anonymous;
            return false;
        }
    }

    internal static bool HasRole(ClientPrincipal principal, string role)
    {
        if (string.IsNullOrWhiteSpace(role)) return false;

        var roles = principal.Claims
            .Where(c => string.Equals(c.Type, "roles", StringComparison.OrdinalIgnoreCase)
                        || string.Equals(c.Type, ClaimTypes.Role, StringComparison.OrdinalIgnoreCase)
                        || string.Equals(c.Type, "role", StringComparison.OrdinalIgnoreCase))
            .Select(c => c.Value)
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return roles.Contains(role);
    }

    internal static async Task<HttpResponseData?> RequireAuthenticatedAsync(HttpRequestData req)
    {
        if (TryGetClientPrincipal(req, out _))
        {
            return null;
        }

        var res = req.CreateResponse(System.Net.HttpStatusCode.Unauthorized);
        await res.WriteAsJsonAsync(new { error = "Authentication required." });
        return res;
    }

    internal static async Task<HttpResponseData?> RequireAdminAsync(HttpRequestData req)
    {
        if (!TryGetClientPrincipal(req, out var principal))
        {
            var res = req.CreateResponse(System.Net.HttpStatusCode.Unauthorized);
            await res.WriteAsJsonAsync(new { error = "Authentication required." });
            return res;
        }

        if (!HasRole(principal, AdminRole))
        {
            var res = req.CreateResponse(System.Net.HttpStatusCode.Forbidden);
            await res.WriteAsJsonAsync(new { error = "Admin role required.", requiredRole = AdminRole });
            return res;
        }

        return null;
    }
}

internal sealed class ClientPrincipal
{
    public static readonly ClientPrincipal Anonymous = new ClientPrincipal();

    public string? UserId { get; set; }
    public string? UserDetails { get; set; }
    public string? IdentityProvider { get; set; }
    public IEnumerable<ClientClaim> Claims { get; set; } = Array.Empty<ClientClaim>();
}

internal sealed class ClientClaim
{
    public string Type { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}
