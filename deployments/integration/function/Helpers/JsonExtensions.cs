// ==============================================================================
// JSON Extensions - Safe Value Extraction
// ==============================================================================

using Newtonsoft.Json.Linq;

namespace TtsIntegration.Helpers;

/// <summary>
/// Extension methods for safely extracting typed values from JSON tokens.
/// </summary>
public static class JsonExtensions
{
    /// <summary>
    /// Safely extracts a decimal value from a JSON path.
    /// </summary>
    public static decimal? GetDecimalValue(this JToken? token, string path)
    {
        var value = token?.SelectToken(path);
        return value != null && decimal.TryParse(value.ToString(), out var result) ? result : null;
    }

    /// <summary>
    /// Safely extracts an integer value from a JSON path.
    /// </summary>
    public static int? GetIntValue(this JToken? token, string path)
    {
        var value = token?.SelectToken(path);
        return value != null && int.TryParse(value.ToString(), out var result) ? result : null;
    }

    /// <summary>
    /// Safely extracts a long value from a JSON path.
    /// </summary>
    public static long? GetLongValue(this JToken? token, string path)
    {
        var value = token?.SelectToken(path);
        return value != null && long.TryParse(value.ToString(), out var result) ? result : null;
    }

    /// <summary>
    /// Safely extracts a string value from a JSON path.
    /// </summary>
    public static string? GetStringValue(this JToken? token, string path)
    {
        return token?.SelectToken(path)?.ToString();
    }
}
