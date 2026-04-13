import { prisma } from "@/lib/db/prisma";
import RunStats from "@/components/run-stats";
import RunsTable from "@/components/runs-table";

interface RunsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function RunsPage({ params }: RunsPageProps) {
  const { projectId } = await params;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Fetch runs with step count
  const runs = await prisma.agentRun.findMany({
    where: { projectId },
    orderBy: { startedAt: "desc" },
    take: 100,
    include: {
      _count: { select: { steps: true } },
    },
  });

  // Aggregate stats for last 24h
  const [stats24h, allStats] = await Promise.all([
    prisma.agentRun.aggregate({
      where: { projectId, startedAt: { gte: since24h } },
      _count: { id: true },
      _avg: { totalCost: true },
      _sum: { totalTokens: true, totalCost: true },
    }),
    prisma.agentRun.groupBy({
      by: ["status"],
      where: { projectId, startedAt: { gte: since24h } },
      _count: { id: true },
    }),
  ]);

  const totalRuns = stats24h._count.id;
  const successCount = allStats.find((s) => s.status === "success")?._count.id ?? 0;
  const successRate = totalRuns > 0 ? (successCount / totalRuns) * 100 : 0;
  const totalCost = Number(stats24h._sum.totalCost ?? 0);
  const totalTokens = stats24h._sum.totalTokens ?? 0;

  // Avg duration for finished runs
  const finishedRuns = await prisma.agentRun.findMany({
    where: {
      projectId,
      startedAt: { gte: since24h },
      finishedAt: { not: null },
    },
    select: { startedAt: true, finishedAt: true },
  });

  let avgDurationMs = 0;
  if (finishedRuns.length > 0) {
    const totalMs = finishedRuns.reduce(
      (sum, r) =>
        sum + (new Date(r.finishedAt!).getTime() - new Date(r.startedAt).getTime()),
      0
    );
    avgDurationMs = totalMs / finishedRuns.length;
  }

  const tableRuns = runs.map((r) => ({
    id: r.id,
    agentName: r.agentName,
    goal: r.goal,
    status: r.status,
    stepCount: r._count.steps,
    durationMs:
      r.finishedAt
        ? new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()
        : null,
    totalCost: Number(r.totalCost),
    startedAt: r.startedAt,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Agent Runs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Stats shown for last 24 hours</p>
        </div>
      </div>

      <RunStats
        totalRuns={totalRuns}
        successRate={successRate}
        avgDurationMs={avgDurationMs}
        totalCost={totalCost}
        totalTokens={totalTokens}
      />

      <RunsTable runs={tableRuns} projectId={projectId} />
    </div>
  );
}
