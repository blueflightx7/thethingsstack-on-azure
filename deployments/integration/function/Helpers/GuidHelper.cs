// ==============================================================================
// GUID Helper - Deterministic GUID Generation
// ==============================================================================

using System.Security.Cryptography;
using System.Text;

namespace TtsIntegration.Helpers;

/// <summary>
/// Helper for generating deterministic GUIDs using RFC 4122 name-based UUID (version 5).
/// Used to create stable HiveIdentity from device identifiers.
/// </summary>
public static class GuidHelper
{
    /// <summary>
    /// Stable namespace UUID for deterministic HiveIdentity derivation.
    /// </summary>
    public static readonly Guid HiveIdentityNamespace = new("2c52f8d7-0d12-4d7d-8f18-6dcd7bd7f9a2");

    /// <summary>
    /// Creates a deterministic GUID based on a namespace and name (RFC 4122 version 5).
    /// Uses SHA1 hash of namespace + name, then sets version 5 and variant bits.
    /// </summary>
    public static Guid CreateDeterministicGuid(Guid namespaceId, string name)
    {
        name ??= string.Empty;

        var namespaceBytes = namespaceId.ToByteArray();
        SwapGuidByteOrder(namespaceBytes);

        var nameBytes = Encoding.UTF8.GetBytes(name);

        byte[] hash;
        using (var sha1 = SHA1.Create())
        {
            sha1.TransformBlock(namespaceBytes, 0, namespaceBytes.Length, null, 0);
            sha1.TransformFinalBlock(nameBytes, 0, nameBytes.Length);
            hash = sha1.Hash!;
        }

        var newGuid = new byte[16];
        Array.Copy(hash, 0, newGuid, 0, 16);

        // Set version 5 (name-based SHA1)
        newGuid[6] = (byte)((newGuid[6] & 0x0F) | (5 << 4));
        // Set variant to RFC 4122
        newGuid[8] = (byte)((newGuid[8] & 0x3F) | 0x80);

        SwapGuidByteOrder(newGuid);
        return new Guid(newGuid);
    }

    /// <summary>
    /// Creates a HiveIdentity GUID from a device ID using the standard namespace.
    /// </summary>
    public static Guid CreateHiveIdentity(string deviceId)
    {
        return CreateDeterministicGuid(HiveIdentityNamespace, deviceId);
    }

    private static void SwapGuidByteOrder(byte[] guid)
    {
        Swap(guid, 0, 3);
        Swap(guid, 1, 2);
        Swap(guid, 4, 5);
        Swap(guid, 6, 7);
    }

    private static void Swap(byte[] buffer, int left, int right)
    {
        (buffer[right], buffer[left]) = (buffer[left], buffer[right]);
    }
}
