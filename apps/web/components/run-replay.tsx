"use client";

import { useState, useEffect, useRef } from "react";

type EventKind = "step" | "tool" | "llm";

interface TimelineEvent {
  kind: EventKind;
  at: Date;
  title: string;
  detail: string;
  meta?: Record<string, unknown>;
  status?: "success" | "error" | "running";
}

interface Step {
  id: string;
  content: string;
  startedAt: string | Date;
  finishedAt: string | Date | null;
  toolCalls: Array<{
    id: string;
    toolName: string;
    input: unknown;
    output: unknown;
    startedAt: string | Date;
    status: string;
    latencyMs: number;
  }>;
  llmCalls: Array<{
    id: string;
    model: string;
    provider: string;
    promptTokens: number;
    completionTokens: number;
    cost: number;
    startedAt: string | Date;
    latencyMs: number;
  }>;
}

interface Props {
  steps: Step[];
  runStartedAt: string | Date;
  runFinishedAt: string | Date | null;
}

export default function RunReplay({ steps, runStartedAt, runFinishedAt }: Props) {
  // Build flat timeline
  const events: TimelineEvent[] = [];
  for (const step of steps) {
    events.push({
      kind: "step",
      at: new Date(step.startedAt),
      title: step.content,
      detail: "Step started",
    });
    for (const tc of step.toolCalls) {
      events.push({
        kind: "tool",
        at: new Date(tc.startedAt),
        title: tc.toolName,
        detail:
          typeof tc.input === "object"
            ? JSON.stringify(tc.input).slice(0, 200)
            : String(tc.input),
        status: tc.status === "error" ? "error" : "success",
        meta: { latencyMs: tc.latencyMs },
      });
    }
    for (const llm of step.llmCalls) {
      events.push({
        kind: "llm",
        at: new Date(llm.startedAt),
        title: `${llm.provider}/${llm.model}`,
        detail: `${llm.promptTokens} + ${llm.completionTokens} tokens · $${llm.cost.toFixed(4)}`,
        meta: { latencyMs: llm.latencyMs },
      });
    }
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  const startMs = new Date(runStartedAt).getTime();
  const endMs = runFinishedAt
    ? new Date(runFinishedAt).getTime()
    : events[events.length - 1]?.at.getTime() ?? startMs + 1000;
  const totalMs = Math.max(1, endMs - startMs);

  const [playheadMs, setPlayheadMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    lastTickRef.current = performance.now();
    const tick = (now: number) => {
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setPlayheadMs((ph) => {
        const next = ph + delta * speed;
        if (next >= totalMs) {
          setPlaying(false);
          return totalMs;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, totalMs]);

  const visibleEvents = events.filter(
    (e) => e.at.getTime() - startMs <= playheadMs,
  );

  const playheadPct = (playheadMs / totalMs) * 100;

  return (
    <div className="border border-gray-800 rounded-lg bg-gray-950 p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => {
            if (playheadMs >= totalMs) setPlayheadMs(0);
            setPlaying(!playing);
          }}
          className="w-10 h-10 rounded-full bg-green-500 hover:bg-green-400 text-black font-bold flex items-center justify-center transition-colors"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          onClick={() => {
            setPlayheadMs(0);
            setPlaying(false);
          }}
          className="text-xs text-gray-400 hover:text-gray-200"
        >
          Reset
        </button>
        <div className="flex gap-1 text-xs">
          {[1, 2, 5, 10].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded ${
                speed === s
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="text-xs font-mono text-gray-400">
          {(playheadMs / 1000).toFixed(1)}s / {(totalMs / 1000).toFixed(1)}s
        </div>
      </div>

      {/* Timeline scrubber */}
      <div className="relative h-10 mb-6 bg-gray-900 rounded">
        {/* Event markers */}
        {events.map((e, i) => {
          const offsetPct = ((e.at.getTime() - startMs) / totalMs) * 100;
          const color =
            e.kind === "step"
              ? "bg-purple-500"
              : e.kind === "tool"
                ? "bg-blue-500"
                : "bg-green-500";
          return (
            <div
              key={i}
              className={`absolute top-2 w-1 h-6 rounded-sm ${color} opacity-60`}
              style={{ left: `${offsetPct}%` }}
              title={`${e.kind}: ${e.title}`}
            />
          );
        })}
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white"
          style={{ left: `${playheadPct}%` }}
        />
        {/* Click to seek */}
        <button
          onClick={(ev) => {
            const rect = ev.currentTarget.getBoundingClientRect();
            const x = ev.clientX - rect.left;
            const pct = x / rect.width;
            setPlayheadMs(pct * totalMs);
          }}
          className="absolute inset-0 cursor-pointer"
          aria-label="Seek timeline"
        />
      </div>

      {/* Events feed */}
      <div className="space-y-2 min-h-[400px]">
        {visibleEvents.length === 0 ? (
          <div className="text-gray-600 text-sm text-center py-16">
            Press play to replay this run
          </div>
        ) : (
          visibleEvents.map((e, i) => {
            const kindColor =
              e.kind === "step"
                ? "text-purple-400"
                : e.kind === "tool"
                  ? "text-blue-400"
                  : "text-green-400";
            const kindLabel =
              e.kind === "step" ? "STEP" : e.kind === "tool" ? "TOOL" : "LLM";
            const offsetMs = e.at.getTime() - startMs;
            return (
              <div
                key={`${e.kind}-${i}`}
                className="flex items-start gap-3 p-3 border border-gray-800 rounded bg-gray-900/30 animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-mono font-bold ${kindColor}`}>
                    {kindLabel}
                  </span>
                  <span className="text-xs font-mono text-gray-600">
                    {(offsetMs / 1000).toFixed(2)}s
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-200 truncate">
                    {e.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {e.detail}
                  </div>
                  {e.status === "error" && (
                    <div className="text-xs text-red-400 mt-0.5">error</div>
                  )}
                </div>
                {e.meta?.latencyMs ? (
                  <div className="text-xs font-mono text-gray-600 shrink-0">
                    {Math.round(e.meta.latencyMs as number)}ms
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
