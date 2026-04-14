import { prisma } from "@/lib/db/prisma";
import SessionsTable from "@/components/sessions-table";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function SessionsPage({ params }: Props) {
  const { projectId } = await params;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const grouped = await prisma.agentRun.groupBy({
    by: ["sessionId"],
    where: {
      projectId,
      sessionId: { not: null },
      startedAt: { gte: since },
    },
    _count: { _all: true },
    _min: { startedAt: true },
    _max: { startedAt: true },
    _sum: { totalTokens: true, totalCost: true },
    orderBy: { _max: { startedAt: "desc" } },
    take: 100,
  });

  const sessionIds = grouped.map((g) => g.sessionId).filter(Boolean) as string[];
  const latestRuns = await prisma.agentRun.findMany({
    where: { projectId, sessionId: { in: sessionIds } },
    distinct: ["sessionId"],
    orderBy: [{ sessionId: "asc" }, { startedAt: "desc" }],
    select: { sessionId: true, userId: true, agentName: true, goal: true },
  });

  const latestBySession = new Map(latestRuns.map((r) => [r.sessionId, r]));

  const sessions = grouped.map((g) => {
    const latest = latestBySession.get(g.sessionId!);
    return {
      sessionId: g.sessionId!,
      userId: latest?.userId ?? null,
      turnCount: g._count._all,
      startedAt: g._min.startedAt ?? new Date(),
      lastActivityAt: g._max.startedAt ?? new Date(),
      totalTokens: g._sum.totalTokens ?? 0,
      totalCost: Number(g._sum.totalCost ?? 0),
      latestAgent: latest?.agentName ?? "unknown",
      latestGoal: latest?.goal ?? null,
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Sessions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Grouped agent runs from the last 7 days</p>
        </div>
      </div>
      <SessionsTable sessions={sessions} projectId={projectId} />
    </div>
  );
}
