"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface QueueItem {
  id: string;
  agentName: string;
  goal: string | null;
  status: string;
  model: string | null;
  totalTokens: number;
  totalCost: number;
  durationMs: number | null;
  startedAt: string;
}

interface Props {
  projectId: string;
  scoreName: string;
  initialQueue: QueueItem[];
}

const SCORE_VALUES = [1, 2, 3, 4, 5];

export default function AnnotationQueue({ projectId, scoreName, initialQueue }: Props) {
  const [queue, setQueue] = useState<QueueItem[]>(initialQueue);
  const [index, setIndex] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoredCount, setScoredCount] = useState(0);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const current = queue[index];

  const advance = useCallback(() => {
    setComment("");
    setError(null);
    if (index < queue.length - 1) {
      setIndex((i) => i + 1);
    } else {
      setQueue([]);
    }
  }, [index, queue.length]);

  const submit = useCallback(
    async (value: number) => {
      if (!current || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/runs/${current.id}/scores`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: scoreName,
              value,
              comment: comment.trim() || undefined,
              source: "human",
            }),
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setScoredCount((n) => n + 1);
        advance();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to submit");
      } finally {
        setSubmitting(false);
      }
    },
    [current, submitting, projectId, scoreName, comment, advance]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't trigger shortcuts while typing in the comment box
      if (document.activeElement === commentRef.current) return;
      if (e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        submit(Number(e.key));
      } else if (e.key === "j" || e.key === "J") {
        if (index < queue.length - 1) setIndex((i) => i + 1);
      } else if (e.key === "k" || e.key === "K") {
        if (index > 0) setIndex((i) => i - 1);
      } else if (e.key === "s" || e.key === "S") {
        advance();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, advance, index, queue.length]);

  if (queue.length === 0) {
    return (
      <div className="border border-gray-800 rounded-lg p-8 bg-gray-900/40 text-center">
        <div className="text-gray-300 font-medium">All caught up</div>
        <div className="text-sm text-gray-500 mt-2">
          Scored {scoredCount} run{scoredCount === 1 ? "" : "s"} this session.
        </div>
        <Link
          href={`/${projectId}/scores`}
          className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300"
        >
          Back to scores →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Run queue sidebar */}
      <div className="col-span-4 border border-gray-800 rounded-lg bg-gray-900/40 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500 flex items-center justify-between">
          <span>Queue</span>
          <span>{index + 1}/{queue.length}</span>
        </div>
        <div className="divide-y divide-gray-800 max-h-[520px] overflow-y-auto">
          {queue.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setIndex(i)}
              className={`w-full text-left px-3 py-2 hover:bg-gray-800/40 ${
                i === index ? "bg-gray-800/60" : ""
              }`}
            >
              <div className="text-sm font-medium text-gray-200 truncate">
                {item.agentName}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {item.goal ?? "—"}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                <span
                  className={
                    item.status === "success" ? "text-green-400" : "text-red-400"
                  }
                >
                  {item.status}
                </span>
                {" · "}
                {item.totalTokens.toLocaleString()} tok
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Scoring panel */}
      <div className="col-span-8">
        {current && (
          <div className="border border-gray-800 rounded-lg bg-gray-900/40 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Run</div>
                <div className="text-lg font-semibold text-gray-100 mt-0.5">
                  {current.agentName}
                </div>
              </div>
              <Link
                href={`/${projectId}/runs/${current.id}`}
                target="_blank"
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Open run detail ↗
              </Link>
            </div>

            {current.goal && (
              <div className="mt-3 text-sm text-gray-300 whitespace-pre-wrap break-words">
                {current.goal}
              </div>
            )}

            <div className="mt-4 grid grid-cols-4 gap-3 text-xs">
              <Stat label="Status" value={current.status} />
              <Stat label="Model" value={current.model ?? "—"} />
              <Stat label="Tokens" value={current.totalTokens.toLocaleString()} />
              <Stat
                label="Duration"
                value={
                  current.durationMs != null
                    ? `${(current.durationMs / 1000).toFixed(2)}s`
                    : "—"
                }
              />
            </div>

            <div className="mt-6">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                Score — {scoreName}
              </div>
              <div className="flex gap-2">
                {SCORE_VALUES.map((v) => (
                  <button
                    key={v}
                    disabled={submitting}
                    onClick={() => submit(v)}
                    className="flex-1 py-3 border border-gray-700 rounded-md text-lg font-semibold text-gray-100 hover:bg-blue-500/10 hover:border-blue-500 transition disabled:opacity-50"
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <textarea
                  ref={commentRef}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional comment (press Escape to unfocus and use shortcuts)"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
                  }}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-md text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-600 resize-y"
                  rows={2}
                />
              </div>
              {error && (
                <div className="mt-2 text-sm text-red-400">{error}</div>
              )}
              <div className="mt-3 text-xs text-gray-500">
                Scored {scoredCount} in this session
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-gray-200 font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
