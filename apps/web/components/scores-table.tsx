"use client";

import Link from "next/link";

type ScoreSource = "human" | "llm_judge" | "programmatic";

interface Score {
  id: string;
  runId: string;
  agentName: string;
  name: string;
  value: number;
  source: ScoreSource;
  comment: string | null;
  createdAt: Date;
}

interface ScoresTableProps {
  scores: Score[];
  projectId: string;
}

const SOURCE_STYLES: Record<ScoreSource, string> = {
  human: "bg-gray-800 text-gray-300 border-gray-700",
  llm_judge: "bg-purple-950/50 text-purple-300 border-purple-900",
  programmatic: "bg-blue-950/50 text-blue-300 border-blue-900",
};

const SOURCE_LABELS: Record<ScoreSource, string> = {
  human: "human",
  llm_judge: "llm judge",
  programmatic: "programmatic",
};

function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ValueBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = clamped * 100;
  // Hue: 0 (red) → ~130 (green)
  let barColor = "bg-red-500";
  if (clamped >= 0.75) barColor = "bg-green-500";
  else if (clamped >= 0.5) barColor = "bg-lime-500";
  else if (clamped >= 0.25) barColor = "bg-amber-500";

  return (
    <div className="mt-1 h-1 w-16 rounded-full bg-gray-800 overflow-hidden">
      <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function ScoresTable({ scores, projectId }: ScoresTableProps) {
  if (scores.length === 0) {
    return (
      <div className="text-center py-24 border border-dashed border-gray-800 rounded-lg">
        <p className="text-gray-500 text-lg">No scores found</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Run
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Score
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Value
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Source
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Comment
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Time
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {scores.map((s) => {
            const showBar = s.value >= 0 && s.value <= 1;
            return (
              <tr key={s.id} className="hover:bg-gray-900/60 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/${projectId}/runs/${s.runId}`}
                    className="text-sm font-medium text-blue-400 hover:text-blue-300"
                  >
                    {s.agentName}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-200">{s.name}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex flex-col items-end">
                    <span className="text-sm font-mono text-gray-100">{s.value.toFixed(2)}</span>
                    {showBar && <ValueBar value={s.value} />}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium border ${SOURCE_STYLES[s.source]}`}
                  >
                    {SOURCE_LABELS[s.source]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-400 truncate max-w-xs block">
                    {s.comment ?? <span className="text-gray-600 italic">—</span>}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs text-gray-500">{timeAgo(s.createdAt)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
