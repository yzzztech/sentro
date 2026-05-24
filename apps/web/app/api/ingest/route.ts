import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { validatePayload } from "@/lib/ingestion/validate";
import { addToBatch, startFlushTimer } from "@/lib/ingestion/buffer";

// Start flush timer on first import
startFlushTimer();

const RATE_LIMIT_WINDOW_MS = 60 * 1000;

async function checkRateLimit(dsnToken: string, limitPerMinute: number): Promise<boolean> {
  const now = new Date();
  const windowKey = `ingest:${dsnToken}`;
  const resetAt = new Date(now.getTime() + RATE_LIMIT_WINDOW_MS);

  try {
    const result = await prisma.rateLimitWindow.upsert({
      where: { key: windowKey },
      create: {
        key: windowKey,
        count: 1,
        resetAt,
      },
      update: {
        count: { increment: 1 },
      },
      select: { count: true, resetAt: true },
    });

    // If the window has expired, reset the counter
    if (result.resetAt < now) {
      await prisma.rateLimitWindow.update({
        where: { key: windowKey },
        data: { count: 1, resetAt },
      });
      return true;
    }

    return result.count <= limitPerMinute;
  } catch {
    // DB failure — fall back to allowing the request (fail-open)
    return true;
  }
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

  // ── Fix: parse token from DSN URL if full URL is passed ──
  // The dsn field can be either:
  //   1. A plain token: "abc123..."
  //   2. A full DSN URL: "http://TOKEN@host:port/api/ingest/PROJECT_ID"
  // Precedence: Bearer header > token from URL > plain dsn
  let dsnFromUrl: string | undefined;
  if (typeof dsn === "string" && dsn.includes("@")) {
    const match = dsn.match(/:\/\/([^@]+)@/);
    dsnFromUrl = match?.[1];
  }
  const dsnToken = bearerToken || dsnFromUrl || (typeof dsn === "string" ? dsn : undefined);
  // ────────────────────────────────────────────────

  if (!dsnToken) {
    return NextResponse.json({ error: "DSN token is required" }, { status: 401 });
  }

  // Look up project by DSN token
  const project = await prisma.project.findUnique({ where: { dsnToken } });
  if (!project) {
    return NextResponse.json({ error: "Invalid DSN token" }, { status: 401 });
  }

  // Check rate limit (DB-backed, survives restarts)
  const allowed = await checkRateLimit(dsnToken, project.rateLimitPerMinute);
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
