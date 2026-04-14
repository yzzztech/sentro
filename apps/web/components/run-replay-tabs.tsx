"use client";

import { useState } from "react";
import StepTimeline from "./step-timeline";
import RunReplay from "./run-replay";

type CallStatus = "success" | "error";
type StepType = "thought" | "action" | "observation";

interface ToolCall {
  id: string;
  toolName: string;
  latencyMs: number;
  status: CallStatus;
  output: unknown;
  errorMessage: string | null;
  input?: unknown;
  startedAt: string | Date;
}

interface LlmCall {
  id: string;
  model: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  cost: number;
  messages: unknown;
  response: unknown;
  provider?: string;
  startedAt: string | Date;
}

interface Step {
  id: string;
  sequenceNumber: number;
  type: StepType;
  content: string;
  startedAt: Date | string;
  finishedAt: Date | string | null;
  toolCalls: ToolCall[];
  llmCalls: LlmCall[];
}

interface Props {
  steps: Step[];
  runStartedAt: string | Date;
  runFinishedAt: string | Date | null;
  projectId?: string;
}

export default function RunReplayTabs(props: Props) {
  const [tab, setTab] = useState<"timeline" | "replay">("timeline");

  // Normalize steps for RunReplay (fill optional fields with safe defaults)
  const replaySteps = props.steps.map((step) => ({
    id: step.id,
    content: step.content,
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
    toolCalls: step.toolCalls.map((tc) => ({
      id: tc.id,
      toolName: tc.toolName,
      input: tc.input ?? null,
      output: tc.output,
      startedAt: tc.startedAt ?? step.startedAt,
      status: tc.status,
      latencyMs: tc.latencyMs,
    })),
    llmCalls: step.llmCalls.map((lc) => ({
      id: lc.id,
      model: lc.model,
      provider: lc.provider ?? "llm",
      promptTokens: lc.promptTokens,
      completionTokens: lc.completionTokens,
      cost: lc.cost,
      startedAt: lc.startedAt ?? step.startedAt,
      latencyMs: lc.latencyMs,
    })),
  }));

  // StepTimeline's Step type expects Date objects and its ToolCall shape
  const timelineSteps = props.steps.map((step) => ({
    id: step.id,
    sequenceNumber: step.sequenceNumber,
    type: step.type,
    content: step.content,
    startedAt: new Date(step.startedAt),
    finishedAt: step.finishedAt ? new Date(step.finishedAt) : null,
    toolCalls: step.toolCalls.map((tc) => ({
      id: tc.id,
      toolName: tc.toolName,
      latencyMs: tc.latencyMs,
      status: tc.status,
      output: tc.output,
      errorMessage: tc.errorMessage,
    })),
    llmCalls: step.llmCalls.map((lc) => ({
      id: lc.id,
      model: lc.model,
      totalTokens: lc.totalTokens,
      promptTokens: lc.promptTokens,
      completionTokens: lc.completionTokens,
      latencyMs: lc.latencyMs,
      cost: lc.cost,
      messages: lc.messages,
      response: lc.response,
    })),
  }));

  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        <button
          onClick={() => setTab("timeline")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            tab === "timeline"
              ? "border-purple-500 text-gray-100"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Timeline
        </button>
        <button
          onClick={() => setTab("replay")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            tab === "replay"
              ? "border-purple-500 text-gray-100"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Replay
        </button>
      </div>
      {tab === "timeline" ? (
        <StepTimeline steps={timelineSteps} projectId={props.projectId} />
      ) : (
        <RunReplay
          steps={replaySteps}
          runStartedAt={props.runStartedAt}
          runFinishedAt={props.runFinishedAt}
        />
      )}
    </div>
  );
}
