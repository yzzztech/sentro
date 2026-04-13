import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import StepTimeline from "@/components/step-timeline";

interface RunDetailPageProps {
  params: Promise<{ projectId: string; runId: string }>;
}

const STATUS_STYLES = {
  success: "bg-green-500/20 text-green-400 border border-green-500/30",
  failure: "bg-red-500/20 text-red-400 border border-red-500/30",
  running: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  timeout: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
} as const;

function formatDuration(startedAt: Date, finishedAt: Date | null): string {
  if (!finishedAt) return "running…";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { projectId, runId } = await params;

  const run = await prisma.agentRun.findFirst({
    where: { id: runId, projectId },
    include: {
      steps: {
        orderBy: { sequenceNumber: "asc" },
        include: {
          toolCalls: { orderBy: { startedAt: "asc" } },
          llmCalls: { orderBy: { startedAt: "asc" } },
        },
      },
    },
  });

  if (!run) {
    notFound();
  }

  const steps = run.steps.map((step) => ({
    id: step.id,
    sequenceNumber: step.sequenceNumber,
    type: step.type,
    content: step.content,
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
    toolCalls: step.toolCalls.map((tc) => ({
      id: tc.id,
      toolName: tc.toolName,
      latencyMs: tc.latencyMs,
      status: tc.status,
      output: tc.output,
      errorMessage: tc.errorMessage,
    })),
    llmCalls: step.llmCalls.map((lc) => ({
      id: lc.id,
      model: lc.model,
      totalTokens: lc.totalTokens,
      promptTokens: lc.promptTokens,
      completionTokens: lc.completionTokens,
      latencyMs: lc.latencyMs,
      cost: Number(lc.cost),
      messages: lc.messages,
      response: lc.response,
    })),
  }));

  const statusStyle =
    STATUS_STYLES[run.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.running;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-xl font-bold text-gray-100">{run.agentName}</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle}`}>
            {run.status}
          </span>
        </div>

        {run.goal && (
          <p className="text-gray-400 text-sm mb-4 max-w-2xl">{run.goal}</p>
        )}

        <div className="flex flex-wrap gap-6 text-sm text-gray-400">
          <div>
            <span className="text-gray-500">Duration: </span>
            <span className="text-gray-300">
              {formatDuration(run.startedAt, run.finishedAt)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Tokens: </span>
            <span className="text-gray-300">{run.totalTokens.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Cost: </span>
            <span className="text-amber-400">${Number(run.totalCost).toFixed(6)}</span>
          </div>
          {run.model && (
            <div>
              <span className="text-gray-500">Model: </span>
              <span className="text-gray-300 font-mono text-xs">{run.model}</span>
            </div>
          )}
          <div>
            <span className="text-gray-500">Steps: </span>
            <span className="text-gray-300">{run.steps.length}</span>
          </div>
        </div>
      </div>

      {/* Error message */}
      {run.status === "failure" && run.errorMessage && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-xs font-medium text-red-400 mb-1 uppercase tracking-wide">
            {run.errorType ?? "Error"}
          </p>
          <p className="text-sm text-red-300 font-mono break-words">{run.errorMessage}</p>
        </div>
      )}

      {/* Step timeline */}
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        Step Replay
      </h2>

      <StepTimeline steps={steps} />
    </div>
  );
}
