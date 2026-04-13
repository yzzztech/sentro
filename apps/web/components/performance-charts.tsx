"use client";

interface ToolCallRow {
  toolName: string;
  avgLatencyMs: number;
  callCount: number;
  errorCount: number;
}

interface LlmCallRow {
  id: string;
  model: string;
  latencyMs: number;
  totalTokens: number;
  cost: number;
}

interface LlmModelRow {
  model: string;
  callCount: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
}

interface PerformanceChartsProps {
  slowestToolCalls: ToolCallRow[];
  slowestLlmCalls: LlmCallRow[];
  llmByModel: LlmModelRow[];
  projectId: string;
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function PerformanceCharts({
  slowestToolCalls,
  slowestLlmCalls,
  llmByModel,
}: PerformanceChartsProps) {
  const maxToolLatency = slowestToolCalls[0]?.avgLatencyMs ?? 1;
  const maxLlmLatency = slowestLlmCalls[0]?.latencyMs ?? 1;

  return (
    <div className="space-y-8">
      {/* Section 1: LLM Usage by Model */}
      <section>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
          LLM Usage by Model
        </h2>
        {llmByModel.length === 0 ? (
          <p className="text-gray-600 text-sm py-4">No LLM calls recorded yet.</p>
        ) : (
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900 border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Model
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Calls
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Tokens
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Avg Latency
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {llmByModel.map((row) => (
                  <tr key={row.model} className="hover:bg-gray-900/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-200">{row.model}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-300">
                      {row.callCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-300">
                      {row.totalTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-amber-400">
                      ${row.totalCost.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-400">
                      {row.avgLatencyMs.toFixed(0)}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 2: Slowest Tool Calls */}
      <section>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
          Slowest Tool Calls
        </h2>
        {slowestToolCalls.length === 0 ? (
          <p className="text-gray-600 text-sm py-4">No tool calls recorded yet.</p>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800">
            {slowestToolCalls.map((row) => {
              const errorRate =
                row.callCount > 0
                  ? ((row.errorCount / row.callCount) * 100).toFixed(0)
                  : "0";
              return (
                <div
                  key={row.toolName}
                  className="px-4 py-3 flex items-center gap-4"
                >
                  <span className="w-48 shrink-0 font-mono text-sm text-blue-400 truncate">
                    {row.toolName}
                  </span>
                  <Bar value={row.avgLatencyMs} max={maxToolLatency} />
                  <span className="w-20 text-right text-sm text-gray-300 shrink-0">
                    {row.avgLatencyMs.toFixed(0)}ms avg
                  </span>
                  <span className="w-24 text-right text-xs shrink-0">
                    {row.errorCount > 0 ? (
                      <span className="text-red-400">{errorRate}% errors</span>
                    ) : (
                      <span className="text-green-400">healthy</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 3: Slowest LLM Calls */}
      <section>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
          Slowest LLM Calls
        </h2>
        {slowestLlmCalls.length === 0 ? (
          <p className="text-gray-600 text-sm py-4">No LLM calls recorded yet.</p>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800">
            {slowestLlmCalls.map((row) => (
              <div
                key={row.id}
                className="px-4 py-3 flex items-center gap-4"
              >
                <span className="w-48 shrink-0 font-mono text-sm text-purple-400 truncate">
                  {row.model}
                </span>
                <Bar value={row.latencyMs} max={maxLlmLatency} />
                <span className="w-20 text-right text-sm text-gray-300 shrink-0">
                  {row.latencyMs}ms
                </span>
                <span className="w-24 text-right text-xs text-gray-400 shrink-0">
                  {row.totalTokens.toLocaleString()} tok
                </span>
                <span className="w-20 text-right text-xs text-amber-400 shrink-0">
                  ${row.cost.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
