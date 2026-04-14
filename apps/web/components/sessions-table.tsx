"use client";

import Link from "next/link";

interface Session {
  sessionId: string;
  userId: string | null;
  turnCount: number;
  startedAt: Date;
  lastActivityAt: Date;
  totalTokens: number;
  totalCost: number;
  latestAgent: string;
  latestGoal: string | null;
}

interface SessionsTableProps {
  sessions: Session[];
  projectId: string;
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

export default function SessionsTable({ sessions, projectId }: SessionsTableProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-24 border border-dashed border-gray-800 rounded-lg">
        <p className="text-gray-500 text-lg">No sessions found</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Session
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              User
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Agent
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Turns
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Started
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Last activity
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Tokens
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Cost
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {sessions.map((s) => (
            <tr key={s.sessionId} className="hover:bg-gray-900/60 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/${projectId}/sessions/${s.sessionId}`}
                  className="flex items-center gap-2 group"
                >
                  <span className="w-2 h-2 rounded-full shrink-0 bg-purple-400" />
                  <span className="text-sm font-medium text-purple-300 group-hover:opacity-80 transition-opacity font-mono">
                    {s.sessionId.slice(0, 8)}...
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-400 truncate max-w-xs block">
                  {s.userId ?? <span className="text-gray-600 italic">anon</span>}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-300">{s.latestAgent}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-sm text-gray-300">{s.turnCount}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-xs text-gray-500">{timeAgo(s.startedAt)}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-xs text-gray-500">{timeAgo(s.lastActivityAt)}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-sm text-gray-400">{s.totalTokens.toLocaleString()}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-sm text-amber-400">${s.totalCost.toFixed(4)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
