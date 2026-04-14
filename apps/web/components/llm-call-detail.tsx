interface LlmCallDetailProps {
  id?: string;
  projectId?: string;
  model: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  cost: number;
  messages: unknown;
  response: unknown;
}

export default function LlmCallDetail({
  id,
  projectId,
  model,
  totalTokens,
  promptTokens,
  completionTokens,
  latencyMs,
  cost,
  messages,
  response,
}: LlmCallDetailProps) {
  return (
    <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-purple-400 uppercase tracking-wide">
            LLM
          </span>
          <span className="font-mono text-sm text-gray-200">{model}</span>
          {id && projectId && (
            <a
              href={`/${projectId}/playground?llmCallId=${id}`}
              className="text-xs text-green-400 hover:text-green-300 transition-colors ml-2"
            >
              Playground →
            </a>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="text-amber-400">${cost.toFixed(6)}</span>
          <span>{latencyMs}ms</span>
          <span>{totalTokens.toLocaleString()} tok</span>
          <span className="text-gray-600">
            ({promptTokens}↑ {completionTokens}↓)
          </span>
        </div>
      </div>

      {messages != null && (
        <details className="mb-1.5">
          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300 transition-colors select-none">
            Prompt ({promptTokens} tokens)
          </summary>
          <pre className="mt-1.5 text-xs text-gray-400 bg-gray-950/60 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words font-mono">
            {JSON.stringify(messages, null, 2)}
          </pre>
        </details>
      )}

      {response != null && (
        <details>
          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300 transition-colors select-none">
            Response ({completionTokens} tokens)
          </summary>
          <pre className="mt-1.5 text-xs text-gray-400 bg-gray-950/60 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words font-mono">
            {JSON.stringify(response, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
