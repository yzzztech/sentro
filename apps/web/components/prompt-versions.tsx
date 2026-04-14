"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { diffLines, type DiffLine } from "@/lib/text-diff";

interface Version {
  version: number;
  body: string;
  tags: string[];
  createdAt: Date;
}

interface PromptVersionsProps {
  projectId: string;
  promptName: string;
  versions: Version[];
}

function tagStyle(tag: string): string {
  if (tag === "production") return "bg-green-900/40 text-green-300 border-green-800";
  if (tag === "staging") return "bg-blue-900/40 text-blue-300 border-blue-800";
  return "bg-gray-800 text-gray-300 border-gray-700";
}

function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleString();
}

function DiffView({ diff }: { diff: DiffLine[] }) {
  return (
    <pre className="px-4 py-3 text-xs font-mono bg-gray-950 overflow-x-auto">
      {diff.map((line, i) => {
        const color =
          line.op === "insert"
            ? "bg-green-900/20 text-green-300 border-l-2 border-green-500/60"
            : line.op === "delete"
            ? "bg-red-900/20 text-red-300 border-l-2 border-red-500/60"
            : "text-gray-400 border-l-2 border-transparent";
        const prefix = line.op === "insert" ? "+ " : line.op === "delete" ? "- " : "  ";
        return (
          <div key={i} className={`${color} pl-2 whitespace-pre-wrap`}>
            {prefix}
            {line.text || " "}
          </div>
        );
      })}
    </pre>
  );
}

function VersionCard({
  version,
  previousBody,
  projectId,
  promptName,
}: {
  version: Version;
  previousBody: string | null;
  projectId: string;
  promptName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isProduction = version.tags.includes("production");
  const hasPrevious = previousBody !== null;
  const diff = showDiff && hasPrevious ? diffLines(previousBody, version.body) : null;

  async function handlePromote() {
    setPromoting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/prompts/${encodeURIComponent(promptName)}/versions/${version.version}/tags`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tag: "production", exclusive: true }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to promote");
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-gray-200">v{version.version}</span>
          <div className="flex flex-wrap gap-1">
            {version.tags.map((t) => (
              <span
                key={t}
                className={`text-xs px-2 py-0.5 rounded border ${tagStyle(t)}`}
              >
                {t}
              </span>
            ))}
          </div>
          <span className="text-xs text-gray-500">{formatDate(version.createdAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          {!isProduction && (
            <button
              onClick={handlePromote}
              disabled={promoting}
              className="text-xs px-3 py-1 rounded border border-green-800 bg-green-900/30 text-green-300 hover:bg-green-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {promoting ? "Promoting..." : "Promote to production"}
            </button>
          )}
          {hasPrevious && (
            <button
              onClick={() => setShowDiff((v) => !v)}
              className="text-xs px-3 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              {showDiff ? "Hide diff" : `Diff vs v${version.version - 1}`}
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs px-3 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      {error && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-900/20 border-b border-gray-800">
          {error}
        </div>
      )}
      {diff ? (
        <DiffView diff={diff} />
      ) : (
        <pre
          className={`px-4 py-3 text-xs text-gray-300 whitespace-pre-wrap font-mono bg-gray-950 ${
            expanded ? "" : "max-h-40 overflow-hidden"
          }`}
        >
          {version.body}
        </pre>
      )}
    </div>
  );
}

export default function PromptVersions({
  projectId,
  promptName,
  versions,
}: PromptVersionsProps) {
  if (versions.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-gray-800 rounded-lg">
        <p className="text-gray-500">No versions yet</p>
      </div>
    );
  }

  // versions come in desc order — previous for versions[i] is versions[i+1]
  return (
    <div className="flex flex-col gap-4">
      {versions.map((v, i) => (
        <VersionCard
          key={v.version}
          version={v}
          previousBody={versions[i + 1]?.body ?? null}
          projectId={projectId}
          promptName={promptName}
        />
      ))}
    </div>
  );
}
