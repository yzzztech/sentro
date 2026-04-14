import { NextResponse } from "next/server";
import { destroySession, validateSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";

export async function POST() {
  try {
    const session = await validateSession();
    await destroySession();
    if (session) {
      await logAudit({ action: "logout", resource: "user", userId: session.userId });
    }
    return NextResponse.json({ message: "Logged out successfully" }, { status: 200 });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
