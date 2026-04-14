import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { projectId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const hours = parseInt(searchParams.get("hours") ?? "24", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const userId = searchParams.get("userId");

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const grouped = await prisma.agentRun.groupBy({
    by: ["sessionId"],
    where: {
      projectId,
      sessionId: { not: null },
      startedAt: { gte: since },
      ...(userId ? { userId } : {}),
    },
    _count: { _all: true },
    _min: { startedAt: true },
    _max: { startedAt: true },
    _sum: { totalTokens: true, totalCost: true },
    orderBy: { _max: { startedAt: "desc" } },
    take: limit,
  });

  // Fetch the latest run per session for context
  const sessionIds = grouped.map((g) => g.sessionId).filter(Boolean) as string[];
  const latestRuns = await prisma.agentRun.findMany({
    where: { projectId, sessionId: { in: sessionIds } },
    distinct: ["sessionId"],
    orderBy: [{ sessionId: "asc" }, { startedAt: "desc" }],
    select: {
      sessionId: true,
      userId: true,
      agentName: true,
      goal: true,
    },
  });

  const latestBySession = new Map(latestRuns.map((r) => [r.sessionId, r]));

  const sessions = grouped.map((g) => {
    const latest = latestBySession.get(g.sessionId);
    return {
      sessionId: g.sessionId,
      userId: latest?.userId ?? null,
      turnCount: g._count._all,
      startedAt: g._min.startedAt,
      lastActivityAt: g._max.startedAt,
      totalTokens: g._sum.totalTokens ?? 0,
      totalCost: Number(g._sum.totalCost ?? 0),
      latestAgent: latest?.agentName ?? null,
      latestGoal: latest?.goal ?? null,
    };
  });

  return NextResponse.json({ sessions });
}
