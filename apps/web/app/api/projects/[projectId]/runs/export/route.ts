import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const MAX_ROWS = 10_000;
const VALID_STATUSES = ["success", "failure", "running", "timeout"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "string" ? v : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { projectId } = await params;

  // Scope to the caller's projects
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId },
    select: { id: true, name: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const agentParam = url.searchParams.get("agent");
  const sinceParam = url.searchParams.get("since");

  const statusFilter = VALID_STATUSES.includes(statusParam as ValidStatus)
    ? (statusParam as ValidStatus)
    : undefined;
  const agentFilter = agentParam?.trim() || undefined;
  const sinceFilter = sinceParam ? new Date(sinceParam) : undefined;

  const runs = await prisma.agentRun.findMany({
    where: {
      projectId,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(agentFilter ? { agentName: agentFilter } : {}),
      ...(sinceFilter && !isNaN(sinceFilter.getTime())
        ? { startedAt: { gte: sinceFilter } }
        : {}),
    },
    orderBy: { startedAt: "desc" },
    take: MAX_ROWS,
    select: {
      id: true,
      agentName: true,
      goal: true,
      model: true,
      sessionId: true,
      userId: true,
      trigger: true,
      status: true,
      totalTokens: true,
      totalCost: true,
      errorType: true,
      errorMessage: true,
      startedAt: true,
      finishedAt: true,
    },
  });

  const header = [
    "id",
    "agent_name",
    "goal",
    "model",
    "session_id",
    "user_id",
    "trigger",
    "status",
    "total_tokens",
    "total_cost",
    "duration_ms",
    "error_type",
    "error_message",
    "started_at",
    "finished_at",
  ];

  const lines = [header.join(",")];
  for (const r of runs) {
    const duration =
      r.finishedAt && r.startedAt
        ? r.finishedAt.getTime() - r.startedAt.getTime()
        : "";
    lines.push(
      [
        r.id,
        r.agentName,
        r.goal,
        r.model,
        r.sessionId,
        r.userId,
        r.trigger,
        r.status,
        r.totalTokens,
        Number(r.totalCost),
        duration,
        r.errorType,
        r.errorMessage,
        r.startedAt.toISOString(),
        r.finishedAt?.toISOString() ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const body = lines.join("\n") + "\n";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const filename = `sentro-runs-${project.name.replace(/[^a-z0-9]/gi, "-")}-${stamp}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
