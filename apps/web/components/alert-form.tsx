"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AlertFormProps {
  projectId: string;
}

type AlertType = "error_spike" | "failure_rate" | "cost_threshold";

const ALERT_TYPE_OPTIONS: { value: AlertType; label: string; description: string }[] = [
  {
    value: "error_spike",
    label: "Error Spike",
    description: "Trigger when error count exceeds threshold in a window",
  },
  {
    value: "failure_rate",
    label: "Failure Rate",
    description: "Trigger when agent failure rate exceeds threshold",
  },
  {
    value: "cost_threshold",
    label: "Cost Threshold",
    description: "Trigger when total cost exceeds threshold in a window",
  },
];

export default function AlertForm({ projectId }: AlertFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<AlertType>("error_spike");
  const [threshold, setThreshold] = useState("");
  const [windowMinutes, setWindowMinutes] = useState("60");
  const [agentName, setAgentName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const body = {
      name,
      type,
      threshold: Number(threshold),
      windowMinutes: Number(windowMinutes),
      agentName: agentName || undefined,
      webhookUrl,
    };

    try {
      const res = await fetch(`/api/projects/${projectId}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }

      router.push(`/${projectId}/alerts`);
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
          Alert name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. High error rate"
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 placeholder-gray-600 text-sm focus:outline-none focus:border-green-500 transition-colors"
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Alert type
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as AlertType)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 text-sm focus:outline-none focus:border-green-500 transition-colors"
        >
          {ALERT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {ALERT_TYPE_OPTIONS.find((o) => o.value === type)?.description}
        </p>
      </div>

      {/* Threshold */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Threshold{" "}
          {type === "cost_threshold" && (
            <span className="text-gray-500 font-normal">(in USD)</span>
          )}
          {type === "failure_rate" && (
            <span className="text-gray-500 font-normal">(0–100%)</span>
          )}
          {type === "error_spike" && (
            <span className="text-gray-500 font-normal">(event count)</span>
          )}
        </label>
        <input
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          required
          min={0}
          step={type === "cost_threshold" ? "0.01" : "1"}
          placeholder={type === "cost_threshold" ? "1.00" : "10"}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 placeholder-gray-600 text-sm focus:outline-none focus:border-green-500 transition-colors"
        />
      </div>

      {/* Window */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Time window (minutes)
        </label>
        <input
          type="number"
          value={windowMinutes}
          onChange={(e) => setWindowMinutes(e.target.value)}
          required
          min={1}
          step={1}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 placeholder-gray-600 text-sm focus:outline-none focus:border-green-500 transition-colors"
        />
      </div>

      {/* Agent name (conditional) */}
      {type === "failure_rate" && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Agent name{" "}
            <span className="text-gray-500 font-normal">(optional — leave blank for all agents)</span>
          </label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="my-agent"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 placeholder-gray-600 text-sm focus:outline-none focus:border-green-500 transition-colors"
          />
        </div>
      )}

      {/* Webhook URL */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Webhook URL
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          required
          placeholder="https://hooks.slack.com/…"
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 placeholder-gray-600 text-sm focus:outline-none focus:border-green-500 transition-colors"
        />
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
          {submitting ? "Creating…" : "Create Alert"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/${projectId}/alerts`)}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
