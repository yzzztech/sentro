import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import AnnotationQueue from "@/components/annotation-queue";

interface Props {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ name?: string }>;
}

export default async function AnnotatePage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const { name: scoreNameParam } = await searchParams;
  const scoreName = scoreNameParam?.trim() || "quality";
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Pull recent runs and filter out ones already scored under this name by a human
  const scoredRunIds = await prisma.score.findMany({
    where: { projectId, name: scoreName, source: "human" },
    select: { runId: true },
  });
  const scoredSet = new Set(scoredRunIds.map((s) => s.runId));

  const candidates = await prisma.agentRun.findMany({
    where: {
      projectId,
      startedAt: { gte: since },
      status: { in: ["success", "failure", "timeout"] },
    },
    orderBy: { startedAt: "desc" },
    take: 200,
    select: {
      id: true,
      agentName: true,
      goal: true,
      status: true,
      model: true,
      totalTokens: true,
      totalCost: true,
      startedAt: true,
      finishedAt: true,
    },
  });

  const queue = candidates
    .filter((r) => !scoredSet.has(r.id))
    .slice(0, 50)
    .map((r) => ({
      id: r.id,
      agentName: r.agentName,
      goal: r.goal,
      status: r.status,
      model: r.model,
      totalTokens: r.totalTokens,
      totalCost: Number(r.totalCost),
      durationMs:
        r.finishedAt && r.startedAt
          ? r.finishedAt.getTime() - r.startedAt.getTime()
          : null,
      startedAt: r.startedAt.toISOString(),
    }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href={`/${projectId}/scores`}
            className="text-sm text-gray-400 hover:text-gray-200"
          >
            ← Back to scores
          </Link>
          <h1 className="text-2xl font-bold text-gray-100 mt-2">Annotate runs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Score unrated runs with <code className="text-gray-300">{scoreName}</code>. Use keys{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs">1</kbd>–
            <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs">5</kbd> to score,{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs">J</kbd>/
            <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs">K</kbd> to navigate,{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs">S</kbd> to skip.
          </p>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="border border-gray-800 rounded-lg p-8 bg-gray-900/40 text-center">
          <div className="text-gray-300 font-medium">Queue empty</div>
          <div className="text-sm text-gray-500 mt-2">
            No unrated runs in the last 30 days for score{" "}
            <code className="text-gray-300">{scoreName}</code>.
          </div>
        </div>
      ) : (
        <AnnotationQueue projectId={projectId} scoreName={scoreName} initialQueue={queue} />
      )}
    </div>
  );
}
