// ==============================================================================
// Hash Helper - SHA256 Computation
// ==============================================================================

using System.Security.Cryptography;
using System.Text;

namespace TtsIntegration.Helpers;

/// <summary>
/// Helper for computing hashes for message deduplication.
/// </summary>
public static class HashHelper
{
    /// <summary>
    /// Computes SHA256 hash of text and returns as lowercase hex string.
    /// Used for generating correlation IDs when not present in payload.
    /// </summary>
    public static string ComputeSha256Hex(string text)
    {
        var bytes = Encoding.UTF8.GetBytes(text ?? string.Empty);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
