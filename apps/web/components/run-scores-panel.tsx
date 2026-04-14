"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Score {
  id: string;
  name: string;
  value: number;
  source: string;
  comment: string | null;
  createdAt: string;
}

interface Props {
  projectId: string;
  runId: string;
  initialScores: Score[];
  knownScoreNames: string[];
}

const SOURCE_COLORS: Record<string, string> = {
  human: "bg-blue-500/15 border-blue-500/30 text-blue-300",
  llm: "bg-purple-500/15 border-purple-500/30 text-purple-300",
  programmatic: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
};

export default function RunScoresPanel({ projectId, runId, initialScores, knownScoreNames }: Props) {
  const router = useRouter();
  const [scores, setScores] = useState(initialScores);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(knownScoreNames[0] ?? "quality");
  const [value, setValue] = useState<string>("5");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const numeric = Number(value);
    if (!name.trim() || isNaN(numeric)) {
      setError("Name and numeric value required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/runs/${runId}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          value: numeric,
          comment: comment.trim() || undefined,
          source: "human",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const data: { score: Score } = await res.json();
      const filtered = scores.filter((s) => !(s.name === data.score.name && s.source === data.score.source));
      setScores([data.score, ...filtered]);
      setComment("");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-6 p-4 border border-gray-800 rounded-lg bg-gray-900/40">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Scores</h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs px-2 py-1 border border-gray-700 rounded-md text-gray-300 hover:bg-gray-800"
        >
          {open ? "Cancel" : "+ Add score"}
        </button>
      </div>

      {scores.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {scores.map((s) => (
            <div
              key={s.id}
              className={`px-2.5 py-1 rounded-md border text-xs flex items-center gap-2 ${
                SOURCE_COLORS[s.source] ?? "bg-gray-500/15 border-gray-600 text-gray-300"
              }`}
              title={s.comment ?? undefined}
            >
              <span className="font-medium">{s.name}</span>
              <span>{s.value}</span>
              <span className="opacity-60 text-[10px] uppercase">{s.source}</span>
            </div>
          ))}
        </div>
      ) : (
        !open && <div className="mt-3 text-xs text-gray-500">No scores yet.</div>
      )}

      {open && (
        <div className="mt-4 grid grid-cols-12 gap-3">
          <div className="col-span-4">
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input
              list="score-names"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-950 border border-gray-800 rounded-md text-sm text-gray-200 focus:outline-none focus:border-gray-600"
            />
            <datalist id="score-names">
              {knownScoreNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Value</label>
            <input
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-950 border border-gray-800 rounded-md text-sm text-gray-200 focus:outline-none focus:border-gray-600"
            />
          </div>
          <div className="col-span-6">
            <label className="block text-xs text-gray-500 mb-1">Comment (optional)</label>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-950 border border-gray-800 rounded-md text-sm text-gray-200 focus:outline-none focus:border-gray-600"
            />
          </div>
          <div className="col-span-12 flex items-center gap-3">
            <button
              disabled={submitting}
              onClick={submit}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save score"}
            </button>
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
