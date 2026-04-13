"use client";

import Link from "next/link";

interface Issue {
  id: string;
  title: string;
  level: string;
  lastSeen: Date;
  count: number;
  eventCount: number;
  affectedRunCount: number;
}

interface IssuesTableProps {
  issues: Issue[];
  projectId: string;
}

function levelBadge(level: string) {
  const colors: Record<string, string> = {
    error: "bg-red-500/20 text-red-400 border border-red-500/30",
    warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    info: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    debug: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
  };
  return colors[level] ?? colors.error;
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

export default function IssuesTable({ issues, projectId }: IssuesTableProps) {
  if (issues.length === 0) {
    return (
      <div className="text-center py-24 border border-dashed border-gray-800 rounded-lg">
        <p className="text-gray-500 text-lg">No issues found</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Issue
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Events
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Last seen
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Affected runs
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {issues.map((issue) => (
            <tr
              key={issue.id}
              className="hover:bg-gray-900/60 transition-colors"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/${projectId}/issues/${issue.id}`}
                  className="flex items-center gap-2 group"
                >
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${levelBadge(issue.level)}`}
                  >
                    {issue.level}
                  </span>
                  <span className="text-gray-200 text-sm group-hover:text-white transition-colors truncate max-w-lg">
                    {issue.title}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-sm font-medium text-red-400">
                  {issue.eventCount.toLocaleString()}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-sm text-gray-400">
                  {timeAgo(issue.lastSeen)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {issue.affectedRunCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    {issue.affectedRunCount} run{issue.affectedRunCount !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-gray-600 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
