import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";

const KEY_PREFIX = "sk_";
const KEY_RANDOM_BYTES = 32;

export interface GeneratedKey {
  plaintext: string;
  prefix: string;
  keyHash: string;
}

export function generateApiKey(): GeneratedKey {
  const rand = crypto.randomBytes(KEY_RANDOM_BYTES).toString("base64url");
  const plaintext = `${KEY_PREFIX}${rand}`;
  const prefix = plaintext.slice(0, 11); // "sk_" + 8 chars
  const keyHash = hashApiKey(plaintext);
  return { plaintext, prefix, keyHash };
}

export function hashApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

/**
 * Resolves an Authorization header value to a user ID if it contains a valid,
 * non-revoked API key. Returns null for missing/invalid/revoked keys.
 * Also updates lastUsedAt (fire-and-forget).
 */
export async function resolveApiKey(authHeader: string | null): Promise<{ userId: string; keyId: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token.startsWith(KEY_PREFIX)) return null;

  const keyHash = hashApiKey(token);
  const record = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, userId: true, revokedAt: true },
  });
  if (!record || record.revokedAt) return null;

  // Fire-and-forget last-used update
  prisma.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { userId: record.userId, keyId: record.id };
}
