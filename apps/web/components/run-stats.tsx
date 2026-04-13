interface RunStatsProps {
  totalRuns: number;
  successRate: number;
  avgDurationMs: number;
  totalCost: number;
  totalTokens: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function RunStats({
  totalRuns,
  successRate,
  avgDurationMs,
  totalCost,
  totalTokens,
}: RunStatsProps) {
  const stats = [
    {
      label: "Total Runs",
      value: totalRuns.toLocaleString(),
      color: "text-green-400",
    },
    {
      label: "Success Rate",
      value: `${successRate.toFixed(1)}%`,
      color: successRate >= 80 ? "text-green-400" : "text-red-400",
    },
    {
      label: "Avg Duration",
      value: formatDuration(avgDurationMs),
      color: "text-green-400",
    },
    {
      label: "Total Cost",
      value: `$${totalCost.toFixed(4)}`,
      color: "text-amber-400",
    },
    {
      label: "Total Tokens",
      value: formatTokens(totalTokens),
      color: "text-green-400",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-3 mb-6">
      {stats.map(({ label, value, color }) => (
        <div
          key={label}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3"
        >
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className={`text-xl font-bold ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}
