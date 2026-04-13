import { Transport } from "./transport";
import { SentroToolCall } from "./tool-call";
import { SentroLlmCall } from "./llm-call";
import type { ToolCallOptions, LlmCallOptions } from "./types";

interface StepInternalOptions {
  capturePrompts: boolean;
}

export class SentroStep {
  private transport: Transport;
  private runId: string;
  private seq: number;
  private stepId: string;
  private capturePrompts: boolean;

  constructor(
    transport: Transport,
    runId: string,
    seq: number,
    content: string,
    internal: StepInternalOptions
  ) {
    this.transport = transport;
    this.runId = runId;
    this.seq = seq;
    this.stepId = crypto.randomUUID();
    this.capturePrompts = internal.capturePrompts;

    this.transport.send({
      type: "step.start",
      timestamp: new Date().toISOString(),
      runId: this.runId,
      stepId: this.stepId,
      seq: this.seq,
      content,
    });
  }

  toolCall(toolName: string, options?: ToolCallOptions): SentroToolCall {
    return new SentroToolCall(this.transport, this.runId, this.stepId, toolName, options);
  }

  async traceToolCall<T>(
    toolName: string,
    input: Record<string, unknown>,
    fn: (tc: SentroToolCall) => Promise<T>
  ): Promise<T> {
    const tc = this.toolCall(toolName, { input });
    try {
      const result = await fn(tc);
      await tc.end({ result });
      return result;
    } catch (err) {
      await tc.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  llmCall(options: LlmCallOptions): SentroLlmCall {
    return new SentroLlmCall(this.transport, this.runId, this.stepId, options, {
      capturePrompts: this.capturePrompts,
    });
  }

  async end(): Promise<void> {
    this.transport.send({
      type: "step.end",
      timestamp: new Date().toISOString(),
      runId: this.runId,
      stepId: this.stepId,
      seq: this.seq,
    });
  }
}
