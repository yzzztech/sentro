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
  const { searchParams } = new URL(request.url);

  const agent = searchParams.get("agent") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const sessionId = searchParams.get("sessionId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const hours = parseInt(searchParams.get("hours") ?? "24", 10);

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const where = {
    projectId,
    startedAt: { gte: since },
    ...(agent ? { agentName: agent } : {}),
    ...(status ? { status: status as "running" | "success" | "failure" | "timeout" } : {}),
    ...(sessionId ? { sessionId } : {}),
  };

  const [runs, allRuns] = await Promise.all([
    prisma.agentRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit,
      include: {
        _count: {
          select: { steps: true },
        },
      },
    }),
    prisma.agentRun.findMany({
      where,
      select: {
        status: true,
        startedAt: true,
        finishedAt: true,
        totalTokens: true,
        totalCost: true,
      },
    }),
  ]);

  const totalRuns = allRuns.length;
  const successCount = allRuns.filter((r) => r.status === "success").length;
  const successRate = totalRuns > 0 ? (successCount / totalRuns) * 100 : 0;

  const completedRuns = allRuns.filter(
    (r) => r.finishedAt !== null && r.startedAt !== null
  );
  const avgDurationMs =
    completedRuns.length > 0
      ? completedRuns.reduce((sum, r) => {
          return sum + (r.finishedAt!.getTime() - r.startedAt.getTime());
        }, 0) / completedRuns.length
      : 0;

  const totalTokens = allRuns.reduce((sum, r) => sum + r.totalTokens, 0);
  const totalCost = allRuns.reduce(
    (sum, r) => sum + parseFloat(r.totalCost.toString()),
    0
  );

  const stats = {
    totalRuns,
    successRate: Math.round(successRate * 100) / 100,
    avgDurationMs: Math.round(avgDurationMs),
    totalTokens,
    totalCost,
  };

  const runsWithStepCount = runs.map((run) => ({
    ...run,
    stepCount: run._count.steps,
    _count: undefined,
  }));

  return NextResponse.json({ runs: runsWithStepCount, stats });
}
