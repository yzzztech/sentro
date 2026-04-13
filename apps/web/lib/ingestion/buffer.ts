import { processFlush } from "./processor";

type IngestEvent = Record<string, unknown>;

// Buffer grouped by DSN token
const buffer = new Map<string, IngestEvent[]>();
const FLUSH_INTERVAL_MS = 1000;
const FLUSH_BATCH_SIZE = 100;

let flushTimer: ReturnType<typeof setInterval> | null = null;

export function addToBatch(dsnToken: string, events: IngestEvent[]): void {
  const existing = buffer.get(dsnToken) ?? [];
  existing.push(...events);
  buffer.set(dsnToken, existing);

  // Flush immediately if buffer exceeds threshold
  if (existing.length >= FLUSH_BATCH_SIZE) {
    flushProject(dsnToken);
  }
}

function flushProject(dsnToken: string): void {
  const events = buffer.get(dsnToken);
  if (!events || events.length === 0) return;

  buffer.delete(dsnToken);

  // Fire and forget — errors are logged inside processFlush
  processFlush(dsnToken, events).catch((err) => {
    console.error(`Flush error for DSN ${dsnToken}:`, err);
  });
}

function flushAll(): void {
  for (const dsnToken of buffer.keys()) {
    flushProject(dsnToken);
  }
}

export function startFlushTimer(): void {
  if (flushTimer !== null) return;
  flushTimer = setInterval(flushAll, FLUSH_INTERVAL_MS);
  // Allow process to exit even if timer is active
  if (flushTimer.unref) {
    flushTimer.unref();
  }
}
