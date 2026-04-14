import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import OverviewRunsChart from "@/components/overview-runs-chart";

interface Props {
  params: Promise<{ projectId: string }>;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

export default async function ProjectOverviewPage({ params }: Props) {
  const { projectId } = await params;
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    stats24h,
    statusBreakdown24h,
    recentFailures,
    topAgents,
    topModels,
    hourlyRuns,
    finishedRuns24h,
    unreadAlerts,
  ] = await Promise.all([
    prisma.agentRun.aggregate({
      where: { projectId, startedAt: { gte: since24h } },
      _count: { id: true },
      _sum: { totalTokens: true, totalCost: true },
    }),
    prisma.agentRun.groupBy({
      by: ["status"],
      where: { projectId, startedAt: { gte: since24h } },
      _count: { id: true },
    }),
    prisma.agentRun.findMany({
      where: { projectId, status: "failure", startedAt: { gte: since7d } },
      orderBy: { startedAt: "desc" },
      take: 5,
      select: {
        id: true,
        agentName: true,
        goal: true,
        errorType: true,
        errorMessage: true,
        startedAt: true,
      },
    }),
    prisma.agentRun.groupBy({
      by: ["agentName"],
      where: { projectId, startedAt: { gte: since7d } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.llmCall.groupBy({
      by: ["model"],
      where: { projectId, startedAt: { gte: since7d } },
      _sum: { cost: true, totalTokens: true },
      _count: { id: true },
      orderBy: { _sum: { cost: "desc" } },
      take: 5,
    }),
    prisma.$queryRaw<Array<{ hour: Date; count: bigint }>>`
      SELECT date_trunc('hour', started_at) AS hour, COUNT(*)::bigint AS count
      FROM agent_runs
      WHERE project_id = ${projectId} AND started_at >= ${since7d}
      GROUP BY hour
      ORDER BY hour ASC
    `,
    prisma.agentRun.findMany({
      where: {
        projectId,
        startedAt: { gte: since24h },
        finishedAt: { not: null },
      },
      select: { startedAt: true, finishedAt: true },
    }),
    prisma.alertHistory
      .count({ where: { projectId, triggeredAt: { gte: since24h } } })
      .catch(() => 0),
  ]);

  const totalRuns = stats24h._count.id;
  const successCount = statusBreakdown24h.find((s) => s.status === "success")?._count.id ?? 0;
  const failureCount = statusBreakdown24h.find((s) => s.status === "failure")?._count.id ?? 0;
  const successRate = totalRuns > 0 ? (successCount / totalRuns) * 100 : 0;
  const totalCost = Number(stats24h._sum.totalCost ?? 0);
  const totalTokens = stats24h._sum.totalTokens ?? 0;

  const avgDurationMs =
    finishedRuns24h.length > 0
      ? finishedRuns24h.reduce(
          (sum, r) => sum + (r.finishedAt!.getTime() - r.startedAt.getTime()),
          0
        ) / finishedRuns24h.length
      : 0;

  // Build a full hourly series for the last 7 days (168 buckets), zero-fill gaps
  const hourMap = new Map<string, number>();
  for (const row of hourlyRuns) {
    hourMap.set(row.hour.toISOString(), Number(row.count));
  }
  const buckets: Array<{ t: string; count: number }> = [];
  for (let i = 167; i >= 0; i--) {
    const d = new Date(Date.now() - i * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    const key = d.toISOString();
    buckets.push({ t: key, count: hourMap.get(key) ?? 0 });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Last 24 hours</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <Kpi label="Runs" value={totalRuns.toLocaleString()} />
        <Kpi
          label="Success rate"
          value={totalRuns > 0 ? `${successRate.toFixed(1)}%` : "—"}
          accent={
            totalRuns === 0
              ? undefined
              : successRate >= 95
              ? "text-green-400"
              : successRate >= 80
              ? "text-amber-400"
              : "text-red-400"
          }
        />
        <Kpi
          label="Avg duration"
          value={avgDurationMs > 0 ? formatDuration(avgDurationMs) : "—"}
        />
        <Kpi label="Tokens" value={totalTokens.toLocaleString()} />
        <Kpi
          label="Cost"
          value={`$${totalCost.toFixed(4)}`}
          accent="text-amber-300"
        />
      </div>

      {/* Runs chart */}
      <div className="mb-8">
        <OverviewRunsChart data={buckets} />
      </div>

      {/* Two-column lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent failures */}
        <div className="border border-gray-800 rounded-lg bg-gray-900/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-200">Recent failures</div>
            <span className="text-xs text-gray-500">
              {failureCount} in last 24h
            </span>
          </div>
          {recentFailures.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              No failures in the last 7 days. 🎉
            </div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {recentFailures.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/${projectId}/runs/${r.id}`}
                    className="block px-4 py-3 hover:bg-gray-900"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-gray-200 truncate">
                        {r.agentName}
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">
                        {timeAgo(r.startedAt)}
                      </span>
                    </div>
                    {r.errorMessage && (
                      <div className="text-xs text-red-300/80 mt-1 truncate font-mono">
                        {r.errorType ? `${r.errorType}: ` : ""}
                        {r.errorMessage}
                      </div>
                    )}
                    {!r.errorMessage && r.goal && (
                      <div className="text-xs text-gray-500 mt-1 truncate">{r.goal}</div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="px-4 py-2 border-t border-gray-800">
            <Link
              href={`/${projectId}/runs?status=failure`}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              View all failed runs →
            </Link>
          </div>
        </div>

        {/* Top agents + top models stacked */}
        <div className="space-y-6">
          <div className="border border-gray-800 rounded-lg bg-gray-900/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 text-sm font-medium text-gray-200">
              Top agents · 7d
            </div>
            {topAgents.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">No runs yet.</div>
            ) : (
              <ul className="divide-y divide-gray-800">
                {topAgents.map((a) => (
                  <li
                    key={a.agentName}
                    className="px-4 py-2 flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-200 truncate">{a.agentName}</span>
                    <span className="text-xs text-gray-400 font-mono">
                      {a._count.id.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border border-gray-800 rounded-lg bg-gray-900/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 text-sm font-medium text-gray-200">
              Top LLM models by spend · 7d
            </div>
            {topModels.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                No LLM calls recorded.
              </div>
            ) : (
              <ul className="divide-y divide-gray-800">
                {topModels.map((m) => (
                  <li
                    key={m.model}
                    className="px-4 py-2 flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-200 font-mono truncate">
                      {m.model}
                    </span>
                    <span className="text-xs text-amber-300 font-mono">
                      ${Number(m._sum.cost ?? 0).toFixed(4)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {unreadAlerts > 0 && (
        <div className="mt-6 p-3 border border-amber-500/30 bg-amber-500/5 rounded-lg text-sm">
          <Link
            href={`/${projectId}/alerts`}
            className="text-amber-300 hover:text-amber-200"
          >
            {unreadAlerts} alert event{unreadAlerts === 1 ? "" : "s"} in the last 24h →
          </Link>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/40">
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent ?? "text-gray-100"}`}>
        {value}
      </div>
    </div>
  );
}
