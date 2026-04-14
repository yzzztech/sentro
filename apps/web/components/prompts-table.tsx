"use client";

import Link from "next/link";

interface Prompt {
  id: string;
  name: string;
  description: string | null;
  latestVersion: number;
  latestTags: string[];
  versionCount: number;
  updatedAt: Date;
}

interface PromptsTableProps {
  prompts: Prompt[];
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

function tagStyle(tag: string): string {
  if (tag === "production") return "bg-green-900/40 text-green-300 border-green-800";
  if (tag === "staging") return "bg-blue-900/40 text-blue-300 border-blue-800";
  return "bg-gray-800 text-gray-300 border-gray-700";
}

export default function PromptsTable({ prompts, projectId }: PromptsTableProps) {
  if (prompts.length === 0) {
    return (
      <div className="text-center py-24 border border-dashed border-gray-800 rounded-lg">
        <p className="text-gray-500 text-lg">No prompts found</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Description
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Latest
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Tags
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Versions
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Updated
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {prompts.map((p) => (
            <tr key={p.id} className="hover:bg-gray-900/60 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/${projectId}/prompts/${encodeURIComponent(p.name)}`}
                  className="flex items-center gap-2 group"
                >
                  <span className="w-2 h-2 rounded-full shrink-0 bg-purple-400" />
                  <span className="text-sm font-medium text-purple-300 group-hover:opacity-80 transition-opacity">
                    {p.name}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-400 truncate max-w-xs block">
                  {p.description ?? <span className="text-gray-600 italic">no description</span>}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-sm text-gray-300 font-mono">v{p.latestVersion}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {p.latestTags.length === 0 ? (
                    <span className="text-gray-600 italic text-xs">—</span>
                  ) : (
                    p.latestTags.map((t) => (
                      <span
                        key={t}
                        className={`text-xs px-2 py-0.5 rounded border ${tagStyle(t)}`}
                      >
                        {t}
                      </span>
                    ))
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-sm text-gray-300">{p.versionCount}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-xs text-gray-500">{timeAgo(p.updatedAt)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
