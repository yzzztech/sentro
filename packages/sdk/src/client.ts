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

  async getPrompt(
    name: string,
    options?: { tag?: string; version?: number }
  ): Promise<{
    name: string;
    version: number;
    body: string;
    variables: string[];
    tags: string[];
  }> {
    const params = new URLSearchParams();
    if (options?.tag) params.set("tag", options.tag);
    if (options?.version) params.set("version", String(options.version));

    const qs = params.toString();
    const url = `${this.parsedDsn.host}/api/v1/prompts/${encodeURIComponent(name)}${qs ? `?${qs}` : ""}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.parsedDsn.token}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch prompt: ${res.status}`);
    }
    return res.json();
  }

  async getDataset(name: string): Promise<{
    name: string;
    description: string | null;
    items: Array<{ id: string; input: unknown; expectedOutput: unknown; metadata: Record<string, unknown> }>;
  }> {
    const baseUrl = this.parsedDsn.host;
    const token = this.parsedDsn.token;

    const res = await fetch(`${baseUrl}/api/v1/datasets/${encodeURIComponent(name)}/items`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch dataset: ${res.status}`);
    }
    return res.json();
  }

  async runEval(
    datasetName: string,
    runner: (input: unknown, expectedOutput: unknown) => Promise<{ output: unknown; runId?: string; scores?: Array<{ name: string; value: number; comment?: string }> }>,
    options?: {
      evaluator?: (actual: unknown, expected: unknown) => number | Promise<number>;
      name?: string;
    }
  ): Promise<{ results: Array<{ itemId: string; output: unknown; runId?: string; scores: Array<{ name: string; value: number }> }> }> {
    const dataset = await this.getDataset(datasetName);
    const evalName = options?.name ?? `eval-${datasetName}-${Date.now()}`;
    const results: Array<{ itemId: string; output: unknown; runId?: string; scores: Array<{ name: string; value: number }> }> = [];

    for (const item of dataset.items) {
      const runResult = await runner(item.input, item.expectedOutput);
      const itemScores: Array<{ name: string; value: number }> = [];

      // User-provided scores
      if (runResult.scores) {
        for (const s of runResult.scores) {
          if (runResult.runId) {
            await this.score(runResult.runId, s.name, s.value, { source: "programmatic", comment: s.comment });
          }
          itemScores.push({ name: s.name, value: s.value });
        }
      }

      // Auto-evaluator
      if (options?.evaluator && item.expectedOutput !== null && item.expectedOutput !== undefined) {
        const score = await options.evaluator(runResult.output, item.expectedOutput);
        if (runResult.runId) {
          await this.score(runResult.runId, evalName, score, { source: "programmatic", comment: "auto-evaluator" });
        }
        itemScores.push({ name: evalName, value: score });
      }

      results.push({
        itemId: item.id,
        output: runResult.output,
        runId: runResult.runId,
        scores: itemScores,
      });
    }

    return { results };
  }

  static evaluators = {
    exactMatch: (actual: unknown, expected: unknown): number => {
      return JSON.stringify(actual) === JSON.stringify(expected) ? 1 : 0;
    },
    contains: (actual: unknown, expected: unknown): number => {
      const a = String(actual ?? "").toLowerCase();
      const e = String(expected ?? "").toLowerCase();
      return a.includes(e) ? 1 : 0;
    },
    regexMatch: (pattern: RegExp) => (actual: unknown): number => {
      return pattern.test(String(actual ?? "")) ? 1 : 0;
    },
  };

  async score(
    runId: string,
    name: string,
    value: number,
    options?: {
      comment?: string;
      source?: "human" | "llm_judge" | "programmatic";
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    const baseUrl = this.parsedDsn.host;
    const token = this.parsedDsn.token;

    await fetch(`${baseUrl}/api/v1/scores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        runId,
        name,
        value,
        comment: options?.comment,
        source: options?.source ?? "programmatic",
        metadata: options?.metadata,
      }),
    });
  }

  async flush(): Promise<void> {
    await this.transport.flush();
  }

  async shutdown(): Promise<void> {
    await this.transport.shutdown();
  }
}
