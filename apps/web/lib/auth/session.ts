import { prisma } from "@/lib/db/prisma";
import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE = "sentro_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  return process.env.SESSION_SECRET || "change-me-in-production";
}

/**
 * Creates an HMAC-signed session token: <random_hex>.<hmac_signature>
 * The signature binds the random part to the SESSION_SECRET so tokens
 * can't be forged without knowing the secret.
 */
function signToken(randomPart: string): string {
  const hmac = crypto.createHmac("sha256", getSecret());
  hmac.update(randomPart);
  return `${randomPart}.${hmac.digest("hex")}`;
}

/**
 * Verifies the HMAC signature on a signed token.
 * Returns the random part (the DB token) if valid, null otherwise.
 */
function verifyToken(signed: string): string | null {
  const dotIndex = signed.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const randomPart = signed.slice(0, dotIndex);
  const expected = signToken(randomPart);
  // Constant-time comparison to prevent timing attacks
  if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signed))) {
    return randomPart;
  }
  return null;
}

export async function createSession(userId: string): Promise<string> {
  const dbToken = crypto.randomBytes(32).toString("hex");
  const signedToken = signToken(dbToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.session.create({ data: { userId, token: dbToken, expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return signedToken;
}

export async function validateSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const signed = cookieStore.get(SESSION_COOKIE)?.value;
  if (!signed) return null;

  const dbToken = verifyToken(signed);
  if (!dbToken) return null;

  const session = await prisma.session.findUnique({
    where: { token: dbToken },
    select: { userId: true, expiresAt: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return { userId: session.userId };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const signed = cookieStore.get(SESSION_COOKIE)?.value;
  if (signed) {
    const dbToken = verifyToken(signed);
    if (dbToken) {
      await prisma.session.deleteMany({ where: { token: dbToken } });
    }
  }
  cookieStore.delete(SESSION_COOKIE);
}
