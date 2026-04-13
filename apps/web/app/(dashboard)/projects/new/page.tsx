"use client";

import { useState } from "react";
import Link from "next/link";
import Nav from "@/components/nav";

export default function NewProjectPage() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ id: string; dsn: string; name: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create project");
        return;
      }

      setCreated({ id: data.project.id, dsn: data.dsnUrl, name: data.project.name });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Nav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="max-w-lg">
          <h1 className="text-2xl font-bold text-gray-100 mb-6">New Project</h1>

          {!created ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                    Project Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    placeholder="My Project"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
                  >
                    {loading ? "Creating…" : "Create Project"}
                  </button>
                  <Link
                    href="/projects"
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded transition-colors"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-gray-100 font-medium">
                  Project &ldquo;{created.name}&rdquo; created
                </span>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-2">
                  Your DSN — use this in your SDK configuration:
                </p>
                <pre className="bg-gray-800 border border-gray-700 rounded px-4 py-3 text-sm text-green-300 font-mono overflow-x-auto">
                  {created.dsn}
                </pre>
                <p className="text-xs text-gray-500 mt-2">
                  Keep this safe — it won&apos;t be shown again.
                </p>
              </div>

              <Link
                href={`/${created.id}/issues`}
                className="inline-block px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded transition-colors"
              >
                Go to Project
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
