import { prisma } from "@/lib/db/prisma";
import PerformanceCharts from "@/components/performance-charts";

interface PerformancePageProps {
  params: Promise<{ projectId: string }>;
}

export default async function PerformancePage({ params }: PerformancePageProps) {
  const { projectId } = await params;

  // LLM usage grouped by model
  const llmGrouped = await prisma.llmCall.groupBy({
    by: ["model"],
    where: { projectId },
    _count: { id: true },
    _sum: { totalTokens: true, cost: true },
    _avg: { latencyMs: true },
    orderBy: { _sum: { cost: "desc" } },
  });

  const llmByModel = llmGrouped.map((row) => ({
    model: row.model,
    callCount: row._count.id,
    totalTokens: row._sum.totalTokens ?? 0,
    totalCost: Number(row._sum.cost ?? 0),
    avgLatencyMs: row._avg.latencyMs ?? 0,
  }));

  // Slowest tool calls (grouped by toolName, avg latency desc)
  const toolGrouped = await prisma.toolCall.groupBy({
    by: ["toolName"],
    where: { projectId },
    _count: { id: true },
    _avg: { latencyMs: true },
    orderBy: { _avg: { latencyMs: "desc" } },
    take: 10,
  });

  // Get error counts per tool
  const toolErrors = await prisma.toolCall.groupBy({
    by: ["toolName"],
    where: { projectId, status: "error" },
    _count: { id: true },
  });
  const errorMap: Record<string, number> = Object.fromEntries(
    toolErrors.map((t) => [t.toolName, t._count.id])
  );

  const slowestToolCalls = toolGrouped.map((row) => ({
    toolName: row.toolName,
    avgLatencyMs: row._avg.latencyMs ?? 0,
    callCount: row._count.id,
    errorCount: errorMap[row.toolName] ?? 0,
  }));

  // Slowest individual LLM calls
  const slowestLlmRaw = await prisma.llmCall.findMany({
    where: { projectId },
    orderBy: { latencyMs: "desc" },
    take: 10,
    select: {
      id: true,
      model: true,
      latencyMs: true,
      totalTokens: true,
      cost: true,
    },
  });

  const slowestLlmCalls = slowestLlmRaw.map((lc) => ({
    id: lc.id,
    model: lc.model,
    latencyMs: lc.latencyMs,
    totalTokens: lc.totalTokens,
    cost: Number(lc.cost),
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Performance</h1>
        <p className="text-sm text-gray-500 mt-0.5">All-time performance metrics</p>
      </div>

      <PerformanceCharts
        slowestToolCalls={slowestToolCalls}
        slowestLlmCalls={slowestLlmCalls}
        llmByModel={llmByModel}
        projectId={projectId}
      />
    </div>
  );
}
