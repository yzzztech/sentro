import { prisma } from "@/lib/db/prisma";
import RunStats from "@/components/run-stats";
import RunsTable from "@/components/runs-table";

interface RunsPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string; agent?: string }>;
}

const VALID_STATUSES = ["success", "failure", "running", "timeout"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

export default async function RunsPage({ params, searchParams }: RunsPageProps) {
  const { projectId } = await params;
  const { status: statusParam, agent: agentParam } = await searchParams;

  const statusFilter = VALID_STATUSES.includes(statusParam as ValidStatus)
    ? (statusParam as ValidStatus)
    : undefined;
  const agentFilter = agentParam?.trim() || undefined;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Pull recent distinct agent names for the filter dropdown
  const distinctAgents = await prisma.agentRun.findMany({
    where: { projectId },
    distinct: ["agentName"],
    orderBy: { agentName: "asc" },
    select: { agentName: true },
    take: 50,
  });

  // Fetch runs with step count, applying filters
  const runs = await prisma.agentRun.findMany({
    where: {
      projectId,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(agentFilter ? { agentName: agentFilter } : {}),
    },
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

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            name="status"
            defaultValue={statusFilter ?? ""}
            className="px-2 py-1.5 bg-gray-950 border border-gray-800 rounded-md text-sm text-gray-200 focus:outline-none focus:border-gray-600"
          >
            <option value="">All</option>
            {VALID_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Agent</label>
          <select
            name="agent"
            defaultValue={agentFilter ?? ""}
            className="px-2 py-1.5 bg-gray-950 border border-gray-800 rounded-md text-sm text-gray-200 focus:outline-none focus:border-gray-600 min-w-[160px]"
          >
            <option value="">All</option>
            {distinctAgents.map((a) => (
              <option key={a.agentName} value={a.agentName}>{a.agentName}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md"
        >
          Filter
        </button>
        {(statusFilter || agentFilter) && (
          <a
            href={`/${projectId}/runs`}
            className="px-3 py-1.5 border border-gray-700 text-gray-300 hover:bg-gray-800 text-sm rounded-md"
          >
            Clear
          </a>
        )}
      </form>

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
