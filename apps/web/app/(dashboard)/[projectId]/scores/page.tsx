import { prisma } from "@/lib/db/prisma";
import ScoresTable from "@/components/scores-table";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ScoresPage({ params }: Props) {
  const { projectId } = await params;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Aggregate scores by name + source
  const aggregated = await prisma.score.groupBy({
    by: ["name", "source"],
    where: { projectId, createdAt: { gte: since } },
    _count: { _all: true },
    _avg: { value: true },
    _min: { value: true },
    _max: { value: true },
  });

  // Recent individual scores for the table
  const recentScores = await prisma.score.findMany({
    where: { projectId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      run: {
        select: { id: true, agentName: true },
      },
    },
  });

  const aggregates = aggregated.map((a) => ({
    name: a.name,
    source: a.source,
    count: a._count._all,
    avg: a._avg.value ?? 0,
    min: a._min.value ?? 0,
    max: a._max.value ?? 0,
  }));

  const scores = recentScores.map((s) => ({
    id: s.id,
    runId: s.runId,
    agentName: s.run.agentName,
    name: s.name,
    value: s.value,
    source: s.source,
    comment: s.comment,
    createdAt: s.createdAt,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Scores</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quality metrics from the last 7 days</p>
        </div>
      </div>

      {/* Aggregate summary cards */}
      {aggregates.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {aggregates.map((a) => (
            <div
              key={`${a.name}-${a.source}`}
              className="border border-gray-800 rounded-lg p-4 bg-gray-900/40"
            >
              <div className="text-xs text-gray-500 uppercase tracking-wider">{a.source}</div>
              <div className="text-sm font-medium text-gray-300 mt-1">{a.name}</div>
              <div className="text-2xl font-bold text-gray-100 mt-2">{a.avg.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">
                {a.count} scored · range {a.min.toFixed(2)}–{a.max.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}

      <ScoresTable scores={scores} projectId={projectId} />
    </div>
  );
}
