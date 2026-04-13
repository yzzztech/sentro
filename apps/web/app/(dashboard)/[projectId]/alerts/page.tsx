import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

interface AlertsPageProps {
  params: Promise<{ projectId: string }>;
}

const TYPE_LABELS = {
  error_spike: "Error Spike",
  failure_rate: "Failure Rate",
  cost_threshold: "Cost Threshold",
} as const;

function timeAgo(date: Date | null): string {
  if (!date) return "Never";
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

export default async function AlertsPage({ params }: AlertsPageProps) {
  const { projectId } = await params;

  const rules = await prisma.alertRule.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { history: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Alerts</h1>
        <Link
          href={`/${projectId}/alerts/new`}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded transition-colors"
        >
          New Alert
        </Link>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-lg">
          <p className="text-gray-500 text-lg">No alert rules yet</p>
          <p className="text-gray-600 text-sm mt-1">
            Create an alert to get notified when something goes wrong.
          </p>
          <Link
            href={`/${projectId}/alerts/new`}
            className="inline-block mt-4 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded transition-colors"
          >
            Create Alert
          </Link>
        </div>
      ) : (
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Triggers
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Last triggered
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-900/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          rule.enabled ? "bg-green-500" : "bg-gray-600"
                        }`}
                      />
                      <span className="text-sm text-gray-200">{rule.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-400">
                      {TYPE_LABELS[rule.type] ?? rule.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-300">
                      {rule._count.history.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-500">
                      {timeAgo(rule.lastTriggeredAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
