import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { addToBatch, startFlushTimer } from "@/lib/ingestion/buffer";
import { translateOtlp } from "@/lib/ingestion/otlp/translate";
import type { OtlpTraceRequest } from "@/lib/ingestion/otlp/types";

startFlushTimer();

export async function POST(req: NextRequest) {
  // OTLP exporters only support Bearer auth
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return NextResponse.json({ error: "Bearer token required" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-protobuf")) {
    return NextResponse.json(
      { error: "Protobuf format not yet supported. Use Content-Type: application/json" },
      { status: 415 }
    );
  }

  let body: OtlpTraceRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { dsnToken: bearerToken } });
  if (!project) {
    return NextResponse.json({ error: "Invalid DSN token" }, { status: 401 });
  }

  const events = translateOtlp(body);
  if (events.length === 0) {
    return NextResponse.json({ partialSuccess: {} }, { status: 200 });
  }

  addToBatch(bearerToken, events);

  // OTLP-compliant response
  return NextResponse.json({ partialSuccess: {} }, { status: 200 });
}

// OTLP spec allows GET for health check probe
export async function GET() {
  return NextResponse.json({ status: "ok", service: "sentro-otlp" });
}
