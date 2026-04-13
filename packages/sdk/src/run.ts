import { Transport } from "./transport";
import { SentroStep } from "./step";
import type { StartRunOptions, EndRunOptions } from "./types";

interface RunInternalOptions {
  capturePrompts: boolean;
  tags: Record<string, string>;
  context: Record<string, unknown>;
}

export class SentroRun {
  private transport: Transport;
  private runId: string;
  private seq: number = 0;
  private capturePrompts: boolean;
  private tags: Record<string, string>;
  private context: Record<string, unknown>;

  constructor(
    transport: Transport,
    options: StartRunOptions,
    internal: RunInternalOptions
  ) {
    this.transport = transport;
    this.runId = crypto.randomUUID();
    this.capturePrompts = internal.capturePrompts;
    this.tags = internal.tags;
    this.context = internal.context;

    this.transport.send({
      type: "run.start",
      timestamp: new Date().toISOString(),
      runId: this.runId,
      agent: options.agent,
      goal: options.goal,
      model: options.model,
      trigger: options.trigger,
      metadata: options.metadata,
      tags: { ...this.tags },
      context: { ...this.context },
    });
  }

  step(content: string): SentroStep {
    const seq = ++this.seq;
    return new SentroStep(this.transport, this.runId, seq, content, {
      capturePrompts: this.capturePrompts,
    });
  }

  async trace<T>(content: string, fn: (step: SentroStep) => Promise<T>): Promise<T> {
    const s = this.step(content);
    try {
      const result = await fn(s);
      await s.end();
      return result;
    } catch (err) {
      await s.end();
      throw err;
    }
  }

  async end(options: EndRunOptions): Promise<void> {
    this.transport.send({
      type: "run.end",
      timestamp: new Date().toISOString(),
      runId: this.runId,
      status: options.status,
      errorType: options.errorType,
      errorMessage: options.errorMessage,
    });
  }

  async error(error: Error): Promise<void> {
    await this.end({
      status: "failure",
      errorType: error.name,
      errorMessage: error.message,
    });
  }
}
