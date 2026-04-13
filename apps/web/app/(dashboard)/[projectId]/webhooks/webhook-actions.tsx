"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface WebhookActionsProps {
  projectId: string;
  webhookId: string;
  enabled: boolean;
}

export default function WebhookActions({ projectId, webhookId, enabled }: WebhookActionsProps) {
  const router = useRouter();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: number; ok: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/webhooks/${webhookId}/test`,
        { method: "POST" }
      );
      const data = await res.json();
      setTestResult({ status: data.status ?? res.status, ok: data.ok ?? res.ok });
    } catch {
      setTestResult({ status: 0, ok: false });
    } finally {
      setTesting(false);
    }
  }

  async function handleToggle() {
    await fetch(`/api/projects/${projectId}/webhooks/${webhookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this webhook?")) return;
    setDeleting(true);
    await fetch(`/api/projects/${projectId}/webhooks/${webhookId}`, {
      method: "DELETE",
    });
    router.refresh();
    setDeleting(false);
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {testResult && (
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            testResult.ok
              ? "bg-green-500/15 text-green-400"
              : "bg-red-500/15 text-red-400"
          }`}
        >
          {testResult.ok ? `${testResult.status} OK` : `${testResult.status || "err"}`}
        </span>
      )}

      <button
        onClick={handleTest}
        disabled={testing}
        className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors disabled:opacity-50"
      >
        {testing ? "Sending…" : "Test"}
      </button>

      <button
        onClick={handleToggle}
        className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
      >
        {enabled ? "Disable" : "Enable"}
      </button>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-xs px-2 py-1 bg-red-900/40 hover:bg-red-800/60 text-red-400 rounded transition-colors disabled:opacity-50"
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}
