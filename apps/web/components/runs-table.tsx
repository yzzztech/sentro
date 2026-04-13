"use client";

import Link from "next/link";

type RunStatus = "running" | "success" | "failure" | "timeout";

interface Run {
  id: string;
  agentName: string;
  goal: string | null;
  status: RunStatus;
  stepCount: number;
  durationMs: number | null;
  totalCost: number;
  startedAt: Date;
}

interface RunsTableProps {
  runs: Run[];
  projectId: string;
}

const STATUS_STYLES: Record<RunStatus, { dot: string; label: string }> = {
  success: { dot: "bg-green-500", label: "text-green-400" },
  failure: { dot: "bg-red-500", label: "text-red-400" },
  running: { dot: "bg-blue-400 animate-pulse", label: "text-blue-400" },
  timeout: { dot: "bg-amber-400", label: "text-amber-400" },
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

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

export default function RunsTable({ runs, projectId }: RunsTableProps) {
  if (runs.length === 0) {
    return (
      <div className="text-center py-24 border border-dashed border-gray-800 rounded-lg">
        <p className="text-gray-500 text-lg">No runs found</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Agent
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Goal
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Steps
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Duration
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Cost
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Time
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {runs.map((run) => {
            const style = STATUS_STYLES[run.status];
            return (
              <tr key={run.id} className="hover:bg-gray-900/60 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/${projectId}/runs/${run.id}`}
                    className="flex items-center gap-2 group"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                    <span className={`text-sm font-medium ${style.label} group-hover:opacity-80 transition-opacity`}>
                      {run.agentName}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-400 truncate max-w-xs block">
                    {run.goal ?? <span className="text-gray-600 italic">no goal</span>}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-gray-300">{run.stepCount}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-gray-400">{formatDuration(run.durationMs)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-amber-400">${run.totalCost.toFixed(4)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs text-gray-500">{timeAgo(run.startedAt)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
