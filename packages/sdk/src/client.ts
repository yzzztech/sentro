import { Transport } from "./transport";
import { SentroRun } from "./run";
import type {
  SentroConfig,
  ParsedDsn,
  EventLevel,
  StartRunOptions,
} from "./types";

function parseDsn(dsn: string): ParsedDsn {
  const url = new URL(dsn);
  const token = url.username;
  // pathname is like /api/ingest/projectId
  const pathParts = url.pathname.split("/").filter(Boolean);
  const projectId = pathParts[pathParts.length - 1];
  const host = `${url.protocol}//${url.host}`;
  return { host, token, projectId };
}

export class Sentro {
  private transport: Transport;
  private parsedDsn: ParsedDsn;
  private capturePrompts: boolean;
  private tags: Record<string, string> = {};
  private context: Record<string, unknown> = {};

  constructor(config: SentroConfig) {
    this.parsedDsn = parseDsn(config.dsn);
    this.capturePrompts = config.capturePrompts ?? false;
    this.transport = new Transport(this.parsedDsn, {
      flushIntervalMs: config.flushIntervalMs,
      maxBatchSize: config.maxBatchSize,
    });
    if (config.defaultTags) {
      this.tags = { ...config.defaultTags };
    }
  }

  setTags(tags: Record<string, string>): void {
    this.tags = { ...this.tags, ...tags };
  }

  setContext(context: Record<string, unknown>): void {
    this.context = { ...this.context, ...context };
  }

  captureException(error: Error): void {
    this.transport.send({
      type: "event",
      timestamp: new Date().toISOString(),
      level: "error" as EventLevel,
      message: error.message,
      stackTrace: error.stack,
      tags: { ...this.tags },
      context: { ...this.context },
    });
  }

  captureMessage(message: string, level: EventLevel = "info"): void {
    this.transport.send({
      type: "event",
      timestamp: new Date().toISOString(),
      level,
      message,
      tags: { ...this.tags },
      context: { ...this.context },
    });
  }

  startRun(options: StartRunOptions): SentroRun {
    return new SentroRun(this.transport, options, {
      capturePrompts: this.capturePrompts,
      tags: this.tags,
      context: this.context,
    });
  }

  async trace<T>(
    agent: string,
    options: Omit<StartRunOptions, "agent">,
    fn: (run: SentroRun) => Promise<T>
  ): Promise<T> {
    const run = this.startRun({ agent, ...options });
    try {
      const result = await fn(run);
      await run.end({ status: "success" });
      return result;
    } catch (err) {
      await run.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async flush(): Promise<void> {
    await this.transport.flush();
  }

  async shutdown(): Promise<void> {
    await this.transport.shutdown();
  }
}
