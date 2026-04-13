import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json({ status: "error", message: "Database unavailable" }, { status: 503 });
  }
}
