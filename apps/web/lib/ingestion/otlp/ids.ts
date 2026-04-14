import crypto from "crypto";

const NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // UUID namespace

export function uuidFromHex(hex: string): string {
  // Simple deterministic hash → UUID v5-ish
  const hash = crypto.createHash("sha1").update(NAMESPACE + hex).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "5" + hash.slice(13, 16),
    "a" + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

export function normalizeHex(id: string): string {
  // OTLP JSON can send hex or base64 — normalize to hex lowercase
  if (/^[0-9a-f]+$/i.test(id)) return id.toLowerCase();
  try {
    return Buffer.from(id, "base64").toString("hex");
  } catch {
    return id;
  }
}
