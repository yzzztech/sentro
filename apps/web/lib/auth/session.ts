import { prisma } from "@/lib/db/prisma";
import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE = "sentro_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.session.create({ data: { userId, token, expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function validateSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    select: { userId: true, expiresAt: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return { userId: session.userId };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookieStore.delete(SESSION_COOKIE);
}
