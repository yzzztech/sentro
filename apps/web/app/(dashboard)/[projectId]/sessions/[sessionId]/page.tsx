import { prisma } from "@/lib/db/prisma";
import RunsTable from "@/components/runs-table";
import Link from "next/link";

interface Props {
  params: Promise<{ projectId: string; sessionId: string }>;
}

export default async function SessionDetailPage({ params }: Props) {
  const { projectId, sessionId } = await params;

  const runs = await prisma.agentRun.findMany({
    where: { projectId, sessionId },
    orderBy: { startedAt: "asc" },
    include: { _count: { select: { steps: true } } },
  });

  if (runs.length === 0) {
    return <div className="text-gray-500">Session not found.</div>;
  }

  const totalTokens = runs.reduce((s, r) => s + r.totalTokens, 0);
  const totalCost = runs.reduce((s, r) => s + Number(r.totalCost), 0);

  const tableRuns = runs.map((r) => ({
    id: r.id,
    agentName: r.agentName,
    goal: r.goal,
    status: r.status,
    stepCount: r._count.steps,
    durationMs: r.finishedAt ? new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime() : null,
    totalCost: Number(r.totalCost),
    startedAt: r.startedAt,
  }));

  return (
    <div>
      <Link href={`/${projectId}/sessions`} className="text-sm text-gray-400 hover:text-gray-200">
        ← Back to sessions
      </Link>
      <h1 className="text-2xl font-bold text-gray-100 mt-2">Session {sessionId.slice(0, 8)}...</h1>
      <div className="flex gap-4 mt-2 text-sm text-gray-400">
        <span>{runs.length} turns</span>
        <span>·</span>
        <span>{totalTokens.toLocaleString()} tokens</span>
        <span>·</span>
        <span className="text-amber-400">${totalCost.toFixed(4)}</span>
        {runs[0]?.userId && (<><span>·</span><span>user: {runs[0].userId}</span></>)}
      </div>
      <div className="mt-6">
        <RunsTable runs={tableRuns} projectId={projectId} />
      </div>
    </div>
  );
}
