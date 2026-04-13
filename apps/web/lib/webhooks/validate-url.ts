import { resolve4, resolve6 } from "node:dns/promises";

/**
 * Validates a webhook URL to prevent SSRF attacks.
 * Blocks private/reserved IP ranges, localhost, and non-HTTP protocols.
 */
export async function validateWebhookUrl(
  url: string
): Promise<{ valid: boolean; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL" };
  }

  // Only allow http and https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only http and https protocols are allowed" };
  }

  const hostname = parsed.hostname;

  // Block localhost by name
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost")
  ) {
    return { valid: false, error: "Localhost URLs are not allowed" };
  }

  // Resolve hostname to IPs and check against blocked ranges
  let ips: string[] = [];
  try {
    const [ipv4, ipv6] = await Promise.allSettled([
      resolve4(hostname),
      resolve6(hostname),
    ]);
    if (ipv4.status === "fulfilled") ips.push(...ipv4.value);
    if (ipv6.status === "fulfilled") ips.push(...ipv6.value);
  } catch {
    return { valid: false, error: "Could not resolve hostname" };
  }

  if (ips.length === 0) {
    return { valid: false, error: "Could not resolve hostname" };
  }

  for (const ip of ips) {
    if (isBlockedIP(ip)) {
      return {
        valid: false,
        error: "URL resolves to a private or reserved IP address",
      };
    }
  }

  return { valid: true };
}

function isBlockedIP(ip: string): boolean {
  // IPv6 loopback
  if (ip === "::1") return true;

  // IPv6 unique local (fc00::/7 covers fc00:: - fdff::)
  if (/^f[cd]/i.test(ip)) return true;

  // IPv4
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
    const [a, b] = parts;

    // 0.0.0.0
    if (ip === "0.0.0.0") return true;

    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;

    // 10.0.0.0/8 (private)
    if (a === 10) return true;

    // 172.16.0.0/12 (private) — 172.16.x.x through 172.31.x.x
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16 (private)
    if (a === 192 && b === 168) return true;

    // 169.254.0.0/16 (link-local / AWS metadata)
    if (a === 169 && b === 254) return true;
  }

  return false;
}
