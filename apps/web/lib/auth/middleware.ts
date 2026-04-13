import { NextResponse } from "next/server";
import { validateSession } from "./session";

export async function requireAuth(): Promise<{ userId: string } | NextResponse> {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}
