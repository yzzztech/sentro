import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
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

function toJson(val: unknown): Prisma.InputJsonValue {
  if (val && typeof val === "object") return val as Prisma.InputJsonValue;
  return {};
}

function toJsonOrNull(val: unknown): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  if (val && typeof val === "object") return val as Prisma.InputJsonValue;
  return Prisma.JsonNull;
}

// Helper to read a field that may be camelCase or snake_case
function str(event: IngestEvent, ...keys: string[]): string | null {
  for (const k of keys) {
    if (typeof event[k] === "string") return event[k] as string;
  }
  return null;
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
      const runId = str(event, "runId", "run_id");
      const stepId = str(event, "stepId", "step_id");
      const toolCallId = str(event, "toolCallId", "tool_call_id");
      const llmCallId = str(event, "llmCallId", "llm_call_id");

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
              runId,
              fingerprint,
              level,
              message,
              stackTrace: str(event, "stackTrace", "stack_trace"),
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
              id: runId ?? undefined,
              projectId: project.id,
              agentName: str(event, "agent", "agentName", "agent_name") ?? "unknown",
              trigger: str(event, "trigger"),
              goal: str(event, "goal"),
              model: str(event, "model"),
              status: RunStatus.running,
              startedAt: toDate(event.timestamp),
              metadata: toJson(event.metadata),
            },
          });
          break;
        }

        case "run.end": {
          if (!runId) break;

          const llmAgg = await prisma.llmCall.aggregate({
            where: { runId },
            _sum: { totalTokens: true, cost: true },
          });

          await prisma.agentRun.update({
            where: { id: runId },
            data: {
              status: toRunStatus(event.status),
              finishedAt: toDate(event.timestamp),
              totalTokens: llmAgg._sum.totalTokens ?? 0,
              totalCost: llmAgg._sum.cost ?? new Decimal(0),
              errorType: str(event, "errorType", "error_type"),
              errorMessage: str(event, "errorMessage", "error_message"),
            },
          });
          break;
        }

        case "step.start": {
          await prisma.step.create({
            data: {
              id: stepId ?? undefined,
              runId: runId ?? "",
              projectId: project.id,
              sequenceNumber: toInt(event.sequenceNumber ?? event.sequence_number),
              type: toStepType(event.stepType ?? event.step_type),
              content: typeof event.content === "string" ? event.content : "",
              startedAt: toDate(event.timestamp),
              metadata: toJson(event.metadata),
            },
          });
          break;
        }

        case "step.end": {
          if (!stepId) break;
          await prisma.step.update({
            where: { id: stepId },
            data: { finishedAt: toDate(event.timestamp) },
          });
          break;
        }

        case "tool_call.start": {
          await prisma.toolCall.create({
            data: {
              id: toolCallId ?? undefined,
              stepId: stepId ?? "",
              runId: runId ?? "",
              projectId: project.id,
              toolName: str(event, "toolName", "tool_name") ?? "unknown",
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
          if (!toolCallId) break;
          const toolStart = await prisma.toolCall.findUnique({
            where: { id: toolCallId },
            select: { startedAt: true },
          });
          const toolEndedAt = toDate(event.timestamp);
          const toolLatency = toolStart
            ? Math.max(0, toolEndedAt.getTime() - toolStart.startedAt.getTime())
            : 0;

          await prisma.toolCall.update({
            where: { id: toolCallId },
            data: {
              output: toJson(event.output),
              status: toCallStatus(event.status),
              latencyMs: toolLatency,
              errorMessage: str(event, "errorMessage", "error_message"),
            },
          });
          break;
        }

        case "llm_call.start": {
          await prisma.llmCall.create({
            data: {
              id: llmCallId ?? undefined,
              stepId: stepId ?? "",
              runId: runId ?? "",
              projectId: project.id,
              model: str(event, "model") ?? "unknown",
              provider: str(event, "provider") ?? "unknown",
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              cost: new Decimal(0),
              latencyMs: 0,
              temperature: typeof event.temperature === "number" ? event.temperature : null,
              messages: toJsonOrNull(event.messages),
              startedAt: toDate(event.timestamp),
            },
          });
          break;
        }

        case "llm_call.end": {
          if (!llmCallId) break;
          const llmStart = await prisma.llmCall.findUnique({
            where: { id: llmCallId },
            select: { startedAt: true },
          });
          const llmEndedAt = toDate(event.timestamp);
          const llmLatency = llmStart
            ? Math.max(0, llmEndedAt.getTime() - llmStart.startedAt.getTime())
            : 0;

          await prisma.llmCall.update({
            where: { id: llmCallId },
            data: {
              promptTokens: toInt(event.promptTokens ?? event.prompt_tokens),
              completionTokens: toInt(event.completionTokens ?? event.completion_tokens),
              totalTokens: toInt(event.totalTokens ?? event.total_tokens),
              cost: new Decimal(String(event.cost ?? 0)),
              latencyMs: llmLatency,
              response: toJsonOrNull(event.response),
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
