"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface WebhookFormProps {
  projectId: string;
}

type WebhookEventType =
  | "error_new"
  | "error_regression"
  | "run_failed"
  | "run_completed"
  | "cost_spike";

const EVENT_OPTIONS: { value: WebhookEventType; label: string; description: string }[] = [
  {
    value: "error_new",
    label: "New Error",
    description: "Fires when a brand-new error group is created for the first time",
  },
  {
    value: "error_regression",
    label: "Error Regression",
    description: "Fires when a previously resolved error reappears",
  },
  {
    value: "run_failed",
    label: "Run Failed",
    description: "Fires when an agent run ends with status failure or timeout",
  },
  {
    value: "run_completed",
    label: "Run Completed",
    description: "Fires when any agent run finishes (success, failure, or timeout)",
  },
  {
    value: "cost_spike",
    label: "Cost Spike",
    description: "Fires when a run's total cost exceeds the configured threshold",
  },
];

const ERROR_LEVEL_OPTIONS = ["error", "warning", "info", "debug"];

export default function WebhookForm({ projectId }: WebhookFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>([]);
  const [secret, setSecret] = useState("");
  const [filterAgentName, setFilterAgentName] = useState("");
  const [filterErrorLevel, setFilterErrorLevel] = useState("");
  const [filterCostThreshold, setFilterCostThreshold] = useState("");

  function toggleEvent(evt: WebhookEventType) {
    setSelectedEvents((prev) =>
      prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedEvents.length === 0) {
      setError("Select at least one event type.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const filters: Record<string, unknown> = {};
    if (filterAgentName) filters.agentName = filterAgentName;
    if (filterErrorLevel) filters.errorLevel = filterErrorLevel;
    if (filterCostThreshold) filters.costThreshold = Number(filterCostThreshold);

    const body = {
      name,
      url,
      events: selectedEvents,
      secret: secret || undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };

    try {
      const res = await fetch(`/api/projects/${projectId}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }

      router.push(`/${projectId}/webhooks`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Webhook name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. GitHub Issues Bot"
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 placeholder-gray-600 text-sm focus:outline-none focus:border-green-500 transition-colors"
        />
      </div>

      {/* URL */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Endpoint URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="https://your-agent.example.com/webhook"
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 placeholder-gray-600 text-sm focus:outline-none focus:border-green-500 transition-colors"
        />
      </div>

      {/* Events */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Subscribe to events
        </label>
        <div className="space-y-2">
          {EVENT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-start gap-3 p-3 rounded border border-gray-700 hover:border-gray-600 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedEvents.includes(opt.value)}
                onChange={() => toggleEvent(opt.value)}
                className="mt-0.5 accent-green-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-200">{opt.label}</span>
                <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Secret */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Signing secret{" "}
          <span className="text-gray-500 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Used for HMAC-SHA256 signature verification"
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 placeholder-gray-600 text-sm focus:outline-none focus:border-green-500 transition-colors"
        />
        <p className="mt-1 text-xs text-gray-500">
          If set, each request includes{" "}
          <code className="text-gray-400">X-Sentro-Signature: sha256=...</code>
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-300">
          Filters{" "}
          <span className="text-gray-500 font-normal">(optional — leave blank to fire for all)</span>
        </p>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Agent name</label>
          <input
            type="text"
            value={filterAgentName}
            onChange={(e) => setFilterAgentName(e.target.value)}
            placeholder="e.g. order-processor"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 placeholder-gray-600 text-sm focus:outline-none focus:border-green-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Error level</label>
          <select
            value={filterErrorLevel}
            onChange={(e) => setFilterErrorLevel(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:border-green-500 transition-colors"
          >
            <option value="">Any level</option>
            {ERROR_LEVEL_OPTIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Cost threshold (USD) — for cost_spike events
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={filterCostThreshold}
            onChange={(e) => setFilterCostThreshold(e.target.value)}
            placeholder="e.g. 0.10"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 placeholder-gray-600 text-sm focus:outline-none focus:border-green-500 transition-colors"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Submit */}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
        >
          {submitting ? "Creating…" : "Create Webhook"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/${projectId}/webhooks`)}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
