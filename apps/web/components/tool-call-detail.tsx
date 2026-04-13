interface ToolCallDetailProps {
  toolName: string;
  latencyMs: number;
  status: "success" | "error";
  output: unknown;
  errorMessage: string | null;
}

export default function ToolCallDetail({
  toolName,
  latencyMs,
  status,
  output,
  errorMessage,
}: ToolCallDetailProps) {
  const isError = status === "error";

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        isError
          ? "border-red-500/40 bg-red-500/5"
          : "border-blue-500/20 bg-blue-500/5"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">
            Tool
          </span>
          <span className="font-mono text-sm text-gray-200">{toolName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{latencyMs}ms</span>
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              isError
                ? "bg-red-500/20 text-red-400"
                : "bg-green-500/20 text-green-400"
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {isError && errorMessage && (
        <p className="text-red-400 text-xs font-mono mb-2 break-words">
          {errorMessage}
        </p>
      )}

      {!isError && output !== null && output !== undefined && (
        <pre className="text-xs text-gray-400 bg-gray-950/60 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words font-mono">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
    </div>
  );
}
