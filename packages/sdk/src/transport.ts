import type { ParsedDsn, IngestEvent, IngestPayload } from "./types";

interface TransportOptions {
  flushIntervalMs?: number;
  maxBatchSize?: number;
}

export class Transport {
  private dsn: ParsedDsn;
  private buffer: IngestEvent[] = [];
  private flushIntervalMs: number;
  private maxBatchSize: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(dsn: ParsedDsn, options: TransportOptions = {}) {
    this.dsn = dsn;
    this.flushIntervalMs = options.flushIntervalMs ?? 1000;
    this.maxBatchSize = options.maxBatchSize ?? 100;
    this.startTimer();
  }

  send(event: IngestEvent): void {
    this.buffer.push(event);
    if (this.buffer.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);
    const payload: IngestPayload = {
      dsn: this.dsn.projectId,
      batch,
    };

    try {
      await fetch(`${this.dsn.host}/api/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.dsn.token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Drop events silently — no local queue for v1
    }
  }

  async shutdown(): Promise<void> {
    this.stopTimer();
    await this.flush();
  }

  private startTimer(): void {
    this.timer = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
