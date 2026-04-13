import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { validatePayload } from "@/lib/ingestion/validate";
import { addToBatch, startFlushTimer } from "@/lib/ingestion/buffer";

// Start flush timer on first import
startFlushTimer();

// In-memory rate limiter: Map<dsnToken, { count: number; resetAt: number }>
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(dsnToken: string, limitPerMinute: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(dsnToken);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(dsnToken, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= limitPerMinute) {
    return false;
  }

  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate payload
  const validation = validatePayload(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { dsn, batch } = validation.data;

  // Check Authorization header for Bearer token
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // DSN token can come from payload or Authorization header
  const dsnToken = dsn || bearerToken;
  if (!dsnToken) {
    return NextResponse.json({ error: "DSN token is required" }, { status: 401 });
  }

  // Look up project by DSN token
  const project = await prisma.project.findUnique({ where: { dsnToken } });
  if (!project) {
    return NextResponse.json({ error: "Invalid DSN token" }, { status: 401 });
  }

  // Check rate limit
  const allowed = checkRateLimit(dsnToken, project.rateLimitPerMinute);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  // Add events to buffer
  addToBatch(dsnToken, batch as Record<string, unknown>[]);

  return NextResponse.json({ accepted: batch.length }, { status: 202 });
}
