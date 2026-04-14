export interface SentroConfig {
  dsn: string;
  capturePrompts?: boolean;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  defaultTags?: Record<string, string>;
}

export interface ParsedDsn {
  host: string;
  token: string;
  projectId: string;
}

export type EventLevel = "error" | "warning" | "info" | "debug";

export type IngestEventType =
  | "event"
  | "run.start"
  | "run.end"
  | "step.start"
  | "step.end"
  | "tool_call.start"
  | "tool_call.end"
  | "llm_call.start"
  | "llm_call.end";

export interface IngestEvent {
  type: IngestEventType;
  timestamp: string;
  [key: string]: unknown;
}

export interface IngestPayload {
  dsn: string;
  batch: IngestEvent[];
}

export interface StartRunOptions {
  agent: string;
  goal?: string;
  model?: string;
  trigger?: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface EndRunOptions {
  status: "success" | "failure" | "timeout";
  errorType?: string;
  errorMessage?: string;
}

export interface ToolCallOptions {
  input?: Record<string, unknown>;
}

export interface EndToolCallOptions {
  result?: unknown;
  error?: string;
}

export interface LlmCallOptions {
  model: string;
  provider?: string;
  messages?: Array<{ role: string; content: string }>;
  temperature?: number;
}

export interface EndLlmCallOptions {
  response?: unknown;
  promptTokens?: number;
  completionTokens?: number;
  cost?: number;
}
