import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import WebhookActions from "./webhook-actions";

interface WebhooksPageProps {
  params: Promise<{ projectId: string }>;
}

const EVENT_LABELS: Record<string, string> = {
  error_new: "error.new",
  error_regression: "error.regression",
  run_failed: "run.failed",
  run_completed: "run.completed",
  cost_spike: "cost.spike",
};

const EVENT_COLORS: Record<string, string> = {
  error_new: "bg-red-500/15 text-red-400 border-red-500/30",
  error_regression: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  run_failed: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  run_completed: "bg-green-500/15 text-green-400 border-green-500/30",
  cost_spike: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + "…";
}

export default async function WebhooksPage({ params }: WebhooksPageProps) {
  const { projectId } = await params;

  const webhooks = await prisma.webhook.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Webhooks</h1>
        <Link
          href={`/${projectId}/webhooks/new`}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded transition-colors"
        >
          New Webhook
        </Link>
      </div>

      {webhooks.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-lg">
          <p className="text-gray-500 text-lg">No webhooks configured</p>
          <p className="text-gray-600 text-sm mt-1">
            Create a webhook to fire HTTP POST requests when events occur.
          </p>
          <Link
            href={`/${projectId}/webhooks/new`}
            className="inline-block mt-4 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded transition-colors"
          >
            Create Webhook
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
                  URL
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Events
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {webhooks.map((wh) => (
                <tr key={wh.id} className="hover:bg-gray-900/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          wh.enabled ? "bg-green-500" : "bg-gray-600"
                        }`}
                      />
                      <span className="text-sm text-gray-200">{wh.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-sm text-gray-400 font-mono"
                      title={wh.url}
                    >
                      {truncateUrl(wh.url)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {wh.events.map((evt) => (
                        <span
                          key={evt}
                          className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono ${
                            EVENT_COLORS[evt] ?? "bg-gray-700 text-gray-300 border-gray-600"
                          }`}
                        >
                          {EVENT_LABELS[evt] ?? evt}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <WebhookActions
                      projectId={projectId}
                      webhookId={wh.id}
                      enabled={wh.enabled}
                    />
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
