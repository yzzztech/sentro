import { prisma } from "@/lib/db/prisma";
import { generateFingerprint } from "./fingerprint";
import { EventLevel, RunStatus, StepType, CallStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

type IngestEvent = Record<string, unknown>;

function toEventLevel(level: unknown): EventLevel {
  if (level === "error" || level === "warning" || level === "info" || level === "debug") {
    return level as EventLevel;
  }
  return EventLevel.info;
}

function toRunStatus(status: unknown): RunStatus {
  if (
    status === "running" ||
    status === "success" ||
    status === "failure" ||
    status === "timeout"
  ) {
    return status as RunStatus;
  }
  return RunStatus.success;
}

function toStepType(type: unknown): StepType {
  if (type === "thought" || type === "action" || type === "observation") {
    return type as StepType;
  }
  return StepType.action;
}

function toCallStatus(status: unknown): CallStatus {
  if (status === "success" || status === "error") {
    return status as CallStatus;
  }
  return CallStatus.success;
}

function toDate(ts: unknown): Date {
  if (typeof ts === "string") return new Date(ts);
  if (ts instanceof Date) return ts;
  return new Date();
}

function toInt(val: unknown, fallback = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : Math.round(n);
}

function toJson(val: unknown): object {
  if (val && typeof val === "object") return val as object;
  return {};
}

export async function processFlush(projectDsnToken: string, events: IngestEvent[]): Promise<void> {
  const project = await prisma.project.findUnique({ where: { dsnToken: projectDsnToken } });
  if (!project) {
    console.warn(`Project not found for DSN token: ${projectDsnToken}`);
    return;
  }

  for (const event of events) {
    try {
      const type = event.type as string;

      switch (type) {
        case "event": {
          const fingerprint = generateFingerprint(event);
          const level = toEventLevel(event.level);
          const message = typeof event.message === "string" ? event.message : JSON.stringify(event);
          const timestamp = toDate(event.timestamp);

          const group = await prisma.eventGroup.upsert({
            where: { projectId_fingerprint: { projectId: project.id, fingerprint } },
            create: {
              projectId: project.id,
              fingerprint,
              title: message.slice(0, 255),
              level,
              firstSeen: timestamp,
              lastSeen: timestamp,
              count: 1,
            },
            update: {
              lastSeen: timestamp,
              count: { increment: 1 },
              level,
            },
          });

          await prisma.event.create({
            data: {
              projectId: project.id,
              groupId: group.id,
              runId: typeof event.run_id === "string" ? event.run_id : null,
              fingerprint,
              level,
              message,
              stackTrace: typeof event.stack_trace === "string" ? event.stack_trace : null,
              tags: toJson(event.tags),
              context: toJson(event.context),
              timestamp,
            },
          });
          break;
        }

        case "run.start": {
          await prisma.agentRun.create({
            data: {
              id: typeof event.run_id === "string" ? event.run_id : undefined,
              projectId: project.id,
              agentName:
                typeof event.agent_name === "string" ? event.agent_name : "unknown",
              trigger: typeof event.trigger === "string" ? event.trigger : null,
              goal: typeof event.goal === "string" ? event.goal : null,
              model: typeof event.model === "string" ? event.model : null,
              status: RunStatus.running,
              startedAt: toDate(event.timestamp),
              metadata: toJson(event.metadata),
            },
          });
          break;
        }

        case "run.end": {
          if (typeof event.run_id !== "string") break;

          // Aggregate token/cost totals from llm_calls
          const llmAgg = await prisma.llmCall.aggregate({
            where: { runId: event.run_id },
            _sum: { totalTokens: true, cost: true },
          });

          const totalTokens = llmAgg._sum.totalTokens ?? 0;
          const totalCost = llmAgg._sum.cost ?? new Decimal(0);

          await prisma.agentRun.update({
            where: { id: event.run_id },
            data: {
              status: toRunStatus(event.status),
              finishedAt: toDate(event.timestamp),
              totalTokens,
              totalCost,
              errorType: typeof event.error_type === "string" ? event.error_type : null,
              errorMessage:
                typeof event.error_message === "string" ? event.error_message : null,
              metadata: toJson(event.metadata),
            },
          });
          break;
        }

        case "step.start": {
          await prisma.step.create({
            data: {
              id: typeof event.step_id === "string" ? event.step_id : undefined,
              runId: typeof event.run_id === "string" ? event.run_id : "",
              projectId: project.id,
              sequenceNumber: toInt(event.sequence_number),
              type: toStepType(event.step_type),
              content: typeof event.content === "string" ? event.content : "",
              startedAt: toDate(event.timestamp),
              metadata: toJson(event.metadata),
            },
          });
          break;
        }

        case "step.end": {
          if (typeof event.step_id !== "string") break;
          await prisma.step.update({
            where: { id: event.step_id },
            data: {
              finishedAt: toDate(event.timestamp),
              content: typeof event.content === "string" ? event.content : undefined,
              metadata: toJson(event.metadata),
            },
          });
          break;
        }

        case "tool_call.start": {
          await prisma.toolCall.create({
            data: {
              id: typeof event.tool_call_id === "string" ? event.tool_call_id : undefined,
              stepId: typeof event.step_id === "string" ? event.step_id : "",
              runId: typeof event.run_id === "string" ? event.run_id : "",
              projectId: project.id,
              toolName: typeof event.tool_name === "string" ? event.tool_name : "unknown",
              input: toJson(event.input),
              output: {},
              status: CallStatus.success,
              latencyMs: 0,
              startedAt: toDate(event.timestamp),
            },
          });
          break;
        }

        case "tool_call.end": {
          if (typeof event.tool_call_id !== "string") break;
          const toolCallStart = await prisma.toolCall.findUnique({
            where: { id: event.tool_call_id },
            select: { startedAt: true },
          });
          const endedAt = toDate(event.timestamp);
          const latencyMs = toolCallStart
            ? Math.max(0, endedAt.getTime() - toolCallStart.startedAt.getTime())
            : 0;

          await prisma.toolCall.update({
            where: { id: event.tool_call_id },
            data: {
              output: toJson(event.output),
              status: toCallStatus(event.status),
              latencyMs,
              errorMessage:
                typeof event.error_message === "string" ? event.error_message : null,
            },
          });
          break;
        }

        case "llm_call.start": {
          await prisma.llmCall.create({
            data: {
              id: typeof event.llm_call_id === "string" ? event.llm_call_id : undefined,
              stepId: typeof event.step_id === "string" ? event.step_id : "",
              runId: typeof event.run_id === "string" ? event.run_id : "",
              projectId: project.id,
              model: typeof event.model === "string" ? event.model : "unknown",
              provider: typeof event.provider === "string" ? event.provider : "unknown",
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              cost: new Decimal(0),
              latencyMs: 0,
              temperature: typeof event.temperature === "number" ? event.temperature : null,
              messages: event.messages ? toJson(event.messages) : null,
              startedAt: toDate(event.timestamp),
            },
          });
          break;
        }

        case "llm_call.end": {
          if (typeof event.llm_call_id !== "string") break;
          const llmCallStart = await prisma.llmCall.findUnique({
            where: { id: event.llm_call_id },
            select: { startedAt: true },
          });
          const endedAt = toDate(event.timestamp);
          const latencyMs = llmCallStart
            ? Math.max(0, endedAt.getTime() - llmCallStart.startedAt.getTime())
            : 0;

          await prisma.llmCall.update({
            where: { id: event.llm_call_id },
            data: {
              promptTokens: toInt(event.prompt_tokens),
              completionTokens: toInt(event.completion_tokens),
              totalTokens: toInt(event.total_tokens),
              cost: new Decimal(String(event.cost ?? 0)),
              latencyMs,
              response: event.response ? toJson(event.response) : null,
            },
          });
          break;
        }

        default:
          console.warn(`Unknown event type: ${type}`);
      }
    } catch (err) {
      console.error(`Failed to process event of type ${event.type}:`, err);
    }
  }
}
