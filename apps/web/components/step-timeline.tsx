import ToolCallDetail from "./tool-call-detail";
import LlmCallDetail from "./llm-call-detail";

type CallStatus = "success" | "error";
type StepType = "thought" | "action" | "observation";

interface ToolCall {
  id: string;
  toolName: string;
  latencyMs: number;
  status: CallStatus;
  output: unknown;
  errorMessage: string | null;
}

interface LlmCall {
  id: string;
  model: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  cost: number;
  messages: unknown;
  response: unknown;
}

interface Step {
  id: string;
  sequenceNumber: number;
  type: StepType;
  content: string;
  startedAt: Date;
  finishedAt: Date | null;
  toolCalls: ToolCall[];
  llmCalls: LlmCall[];
}

interface StepTimelineProps {
  steps: Step[];
  projectId?: string;
}

const TYPE_STYLES: Record<StepType, string> = {
  thought: "text-purple-400 bg-purple-500/20 border-purple-500/30",
  action: "text-blue-400 bg-blue-500/20 border-blue-500/30",
  observation: "text-green-400 bg-green-500/20 border-green-500/30",
};

function hasError(step: Step): boolean {
  return step.toolCalls.some((tc) => tc.status === "error");
}

export default function StepTimeline({ steps, projectId }: StepTimelineProps) {
  if (steps.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-gray-800 rounded-lg">
        <p className="text-gray-500">No steps recorded</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {steps.map((step, index) => {
        const errored = hasError(step);
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="relative flex gap-4">
            {/* Left column: circle + line */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 z-10 ${
                  errored
                    ? "bg-red-500/20 border-red-500 text-red-400"
                    : "bg-green-500/20 border-green-500 text-green-400"
                }`}
              >
                {step.sequenceNumber}
              </div>
              {!isLast && (
                <div className="w-0.5 flex-1 bg-gray-800 my-1" />
              )}
            </div>

            {/* Right column: content */}
            <div className={`flex-1 pb-6 ${isLast ? "" : ""}`}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium border ${TYPE_STYLES[step.type]}`}
                >
                  {step.type}
                </span>
                {step.finishedAt && step.startedAt && (
                  <span className="text-xs text-gray-500">
                    {new Date(step.finishedAt).getTime() -
                      new Date(step.startedAt).getTime()}
                    ms
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-300 mb-3 break-words leading-relaxed">
                {step.content}
              </p>

              {/* Tool calls */}
              {step.toolCalls.length > 0 && (
                <div className="space-y-2 mb-2">
                  {step.toolCalls.map((tc) => (
                    <ToolCallDetail
                      key={tc.id}
                      toolName={tc.toolName}
                      latencyMs={tc.latencyMs}
                      status={tc.status}
                      output={tc.output}
                      errorMessage={tc.errorMessage}
                    />
                  ))}
                </div>
              )}

              {/* LLM calls */}
              {step.llmCalls.length > 0 && (
                <div className="space-y-2">
                  {step.llmCalls.map((lc) => (
                    <LlmCallDetail
                      key={lc.id}
                      id={lc.id}
                      projectId={projectId}
                      model={lc.model}
                      totalTokens={lc.totalTokens}
                      promptTokens={lc.promptTokens}
                      completionTokens={lc.completionTokens}
                      latencyMs={lc.latencyMs}
                      cost={lc.cost}
                      messages={lc.messages}
                      response={lc.response}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
