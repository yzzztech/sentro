"use client";

import { useState } from "react";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface Props {
  initialKeys: ApiKeyRow[];
}

export default function ApiKeysManager({ initialKeys }: Props) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{
    plaintext: string;
    name: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    if (!name.trim()) {
      setError("Name required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const data: {
        key: ApiKeyRow & { plaintext: string };
      } = await res.json();
      setJustCreated({ plaintext: data.key.plaintext, name: data.key.name });
      setKeys((prev) => [
        {
          id: data.key.id,
          name: data.key.name,
          prefix: data.key.prefix,
          lastUsedAt: null,
          revokedAt: null,
          createdAt: data.key.createdAt,
        },
        ...prev,
      ]);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this key? It will stop working immediately.")) return;
    const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to revoke");
      return;
    }
    setKeys((prev) =>
      prev.map((k) =>
        k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k
      )
    );
  }

  async function copy() {
    if (!justCreated) return;
    await navigator.clipboard.writeText(justCreated.plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      {justCreated && (
        <div className="mb-6 border border-green-500/40 bg-green-500/10 rounded-lg p-4">
          <div className="text-sm font-medium text-green-300">
            Key &quot;{justCreated.name}&quot; created — copy it now, you won&apos;t see it again
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-gray-950 border border-gray-800 rounded font-mono text-sm text-gray-200 break-all">
              {justCreated.plaintext}
            </code>
            <button
              onClick={copy}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setJustCreated(null)}
            className="mt-3 text-xs text-gray-400 hover:text-gray-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <div className="mb-6 border border-gray-800 rounded-lg p-4 bg-gray-900/40">
        <div className="text-sm font-medium text-gray-300 mb-3">Create new key</div>
        <div className="flex gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name (e.g. 'export-script', 'laptop')"
            className="flex-1 px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-sm text-gray-200 focus:outline-none focus:border-gray-600"
          />
          <button
            onClick={create}
            disabled={creating}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-md disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create key"}
          </button>
        </div>
        {error && <div className="mt-2 text-sm text-red-400">{error}</div>}
      </div>

      {/* Keys table */}
      <div className="border border-gray-800 rounded-lg bg-gray-900/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900/60 border-b border-gray-800">
              <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Name</th>
              <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Prefix</th>
              <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Created</th>
              <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Last used</th>
              <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-gray-500 font-medium">Status</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No keys yet.
                </td>
              </tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-gray-800 last:border-0">
                <td className="px-4 py-2 text-gray-200">{k.name}</td>
                <td className="px-4 py-2 font-mono text-gray-400">{k.prefix}…</td>
                <td className="px-4 py-2 text-gray-400">
                  {new Date(k.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-gray-400">
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2">
                  {k.revokedAt ? (
                    <span className="text-red-400">revoked</span>
                  ) : (
                    <span className="text-green-400">active</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {!k.revokedAt && (
                    <button
                      onClick={() => revoke(k.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
