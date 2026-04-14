"use client";

import { useRouter } from "next/navigation";

interface Dataset {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  updatedAt: Date;
}

interface DatasetsTableProps {
  datasets: Dataset[];
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

export default function DatasetsTable({ datasets, projectId }: DatasetsTableProps) {
  const router = useRouter();

  if (datasets.length === 0) {
    return (
      <div className="text-center py-24 border border-dashed border-gray-800 rounded-lg">
        <p className="text-gray-500 text-lg">No datasets found</p>
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
              Items
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
              Updated
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {datasets.map((d) => (
            <tr
              key={d.id}
              onClick={() => router.push(`/${projectId}/datasets/${d.id}`)}
              className="hover:bg-gray-900/60 transition-colors cursor-pointer"
            >
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-gray-100">{d.name}</span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-400 truncate max-w-md block">
                  {d.description ?? <span className="text-gray-600 italic">—</span>}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-sm text-gray-300">{d.itemCount}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-xs text-gray-500">{timeAgo(d.updatedAt)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
