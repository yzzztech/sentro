import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { processIngestBatch } from "@repo/agent-runner";
import { authRateLimit } from "@repo/security";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawDsn: string | undefined = body.dsn;

  // ── Fix: extract token from DSN URL if full URL is passed ──
  // The dsn field can be either:
  //   1. A plain token: "abc123..."
  //   2. A full DSN URL: "http://TOKEN@host:port/api/ingest/PROJECT_ID"
  // The official Claude Code hook sends the full URL, so we must
  // parse the token out of it.  Precedence:
  //   Bearer header  >  token extracted from dsn URL  >  plain dsn
  let dsnFromUrl: string | undefined;
  if (rawDsn?.includes("@")) {
    const match = rawDsn.match(/:\/\/([^@]+)@/);
    dsnFromUrl = match?.[1];
  }
  const dsnToken = bearerToken || dsnFromUrl || rawDsn;
  // ──────────────────────────────────────────────────────

  if (!dsnToken) {
    return NextResponse.json({ error: "Missing DSN token" }, { status: 401 });
  }

  // Rate-limit by DSN token (500 req/min per project)
  const rateLimitOk = await authRateLimit(dsnToken, 500, 60_000);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const project = await prisma.project.findUnique({
    where: { dsnToken },
    select: { id: true, rateLimitPerMinute: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Invalid DSN token" }, { status: 401 });
  }

  const batch = body.batch ?? [body];
  if (!Array.isArray(batch) || batch.length === 0) {
    return NextResponse.json({ error: "Empty or missing batch" }, { status: 400 });
  }

  try {
    await processIngestBatch(project.id, batch);
    return NextResponse.json({ ok: true, count: batch.length });
  } catch (err: any) {
    console.error("Ingest batch failed:", err);
    return NextResponse.json(
      { error: "Internal server error", detail: err?.message },
      { status: 500 }
    );
  }
}
