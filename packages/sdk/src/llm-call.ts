import { Transport } from "./transport";
import type { LlmCallOptions, EndLlmCallOptions } from "./types";

interface LlmCallInternalOptions {
  capturePrompts: boolean;
}

export class SentroLlmCall {
  private transport: Transport;
  private runId: string;
  private stepId: string;
  private llmCallId: string;
  private capturePrompts: boolean;

  constructor(
    transport: Transport,
    runId: string,
    stepId: string,
    options: LlmCallOptions,
    internal: LlmCallInternalOptions
  ) {
    this.transport = transport;
    this.runId = runId;
    this.stepId = stepId;
    this.llmCallId = crypto.randomUUID();
    this.capturePrompts = internal.capturePrompts;

    const event: Record<string, unknown> = {
      type: "llm_call.start",
      timestamp: new Date().toISOString(),
      runId: this.runId,
      stepId: this.stepId,
      llmCallId: this.llmCallId,
      model: options.model,
      provider: options.provider,
      temperature: options.temperature,
    };

    if (this.capturePrompts && options.messages) {
      event.messages = options.messages;
    }

    this.transport.send(event as import("./types").IngestEvent);
  }

  async end(options?: EndLlmCallOptions): Promise<void> {
    const event: Record<string, unknown> = {
      type: "llm_call.end",
      timestamp: new Date().toISOString(),
      runId: this.runId,
      stepId: this.stepId,
      llmCallId: this.llmCallId,
      promptTokens: options?.promptTokens,
      completionTokens: options?.completionTokens,
      cost: options?.cost,
    };

    if (this.capturePrompts && options?.response !== undefined) {
      event.response = options.response;
    }

    this.transport.send(event as import("./types").IngestEvent);
  }
}
