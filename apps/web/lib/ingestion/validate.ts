import { z } from "zod";

const MAX_EVENT_KEYS = 50;

const ingestEventSchema = z
  .object({
    type: z.enum([
      "event",
      "run.start",
      "run.end",
      "step.start",
      "step.end",
      "tool_call.start",
      "tool_call.end",
      "llm_call.start",
      "llm_call.end",
    ]),
    timestamp: z.string().datetime(),
  })
  .passthrough()
  .refine((obj) => Object.keys(obj).length <= MAX_EVENT_KEYS, {
    message: `Event objects may have at most ${MAX_EVENT_KEYS} fields`,
  });

const ingestPayloadSchema = z.object({
  dsn: z.string().min(1),
  batch: z.array(ingestEventSchema).min(1).max(1000),
});

export type ValidatedPayload = z.infer<typeof ingestPayloadSchema>;

export function validatePayload(
  data: unknown
): { success: true; data: ValidatedPayload } | { success: false; error: string } {
  const result = ingestPayloadSchema.safeParse(data);
  if (!result.success) return { success: false, error: result.error.message };
  return { success: true, data: result.data };
}
