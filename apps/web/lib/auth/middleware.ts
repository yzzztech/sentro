import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { validateSession } from "./session";
import { resolveApiKey } from "./api-key";

export async function requireAuth(): Promise<{ userId: string } | NextResponse> {
  const session = await validateSession();
  if (session) return session;

  const h = await headers();
  const apiKey = await resolveApiKey(h.get("authorization"));
  if (apiKey) return { userId: apiKey.userId };

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
