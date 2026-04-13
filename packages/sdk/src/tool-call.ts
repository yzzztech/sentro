import { Transport } from "./transport";
import type { ToolCallOptions, EndToolCallOptions } from "./types";

export class SentroToolCall {
  private transport: Transport;
  private runId: string;
  private stepId: string;
  private toolCallId: string;
  private toolName: string;

  constructor(
    transport: Transport,
    runId: string,
    stepId: string,
    toolName: string,
    options?: ToolCallOptions
  ) {
    this.transport = transport;
    this.runId = runId;
    this.stepId = stepId;
    this.toolCallId = crypto.randomUUID();
    this.toolName = toolName;

    this.transport.send({
      type: "tool_call.start",
      timestamp: new Date().toISOString(),
      runId: this.runId,
      stepId: this.stepId,
      toolCallId: this.toolCallId,
      toolName: this.toolName,
      input: options?.input,
    });
  }

  async end(options?: EndToolCallOptions): Promise<void> {
    this.transport.send({
      type: "tool_call.end",
      timestamp: new Date().toISOString(),
      runId: this.runId,
      stepId: this.stepId,
      toolCallId: this.toolCallId,
      toolName: this.toolName,
      status: options?.error ? "error" : "success",
      result: options?.result,
      error: options?.error,
    });
  }

  async error(error: Error): Promise<void> {
    await this.end({ error: error.message });
  }
}
