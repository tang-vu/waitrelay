import { z } from "zod";

import { ContextCapsuleSchema } from "./context-capsule";

export const PROTOCOL_VERSION = "1.0" as const;

export const ProtocolVersionSchema = z.literal(PROTOCOL_VERSION);
export const OpaqueIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Expected an opaque identifier");
export const LifecycleStageSchema = z.enum([
  "understanding",
  "gathering",
  "evaluating",
  "composing",
  "verifying",
]);
export type LifecycleStage = z.infer<typeof LifecycleStageSchema>;

export const ProviderModeSchema = z.enum([
  "live",
  "demo",
  "fallback",
]);
export type ProviderMode = z.infer<typeof ProviderModeSchema>;

export const ChoiceAckStatusSchema = z.enum([
  "appliedNow",
  "tooLate",
  "rejected",
  "savedNext",
]);
export type ChoiceAckStatus = z.infer<typeof ChoiceAckStatusSchema>;

export const ChoiceOptionSchema = z
  .object({
    optionId: z.string().min(1).max(64),
    label: z.string().min(1).max(48),
    description: z.string().min(1).max(140).optional(),
  })
  .strict();
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;

const EventBaseSchema = z
  .object({
    protocolVersion: ProtocolVersionSchema,
    runId: OpaqueIdSchema,
    eventId: OpaqueIdSchema,
    sequence: z.number().int().nonnegative(),
    timestamp: z.string().datetime(),
  })
  .strict();

export const RunStartEventSchema = EventBaseSchema.extend({
  type: z.literal("run.start"),
  providerMode: ProviderModeSchema,
  context: ContextCapsuleSchema,
  visualSeed: OpaqueIdSchema,
}).strict();

export const RunProgressEventSchema = EventBaseSchema.extend({
  type: z.literal("run.progress"),
  stage: LifecycleStageSchema,
}).strict();

export const ProviderModeEventSchema = EventBaseSchema.extend({
  type: z.literal("provider.mode"),
  providerMode: ProviderModeSchema,
  reason: z.enum(["configured", "fallback"]),
}).strict();

export const ChoiceRequestSchema = EventBaseSchema.extend({
  type: z.literal("choice.request"),
  requestId: z.string().min(1).max(128),
  axisId: z.string().min(1).max(64),
  options: z.array(ChoiceOptionSchema).min(2).max(2),
  defaultOptionId: z.string().min(1).max(64),
  decisionPoint: z.string().min(1).max(80),
  expiresAt: z.string().datetime().optional(),
  effectCategory: z.string().min(1).max(80),
}).strict().superRefine((request, context) => {
  const optionIds = request.options.map((option) => option.optionId);
  if (new Set(optionIds).size !== optionIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choice option IDs must be unique",
      path: ["options"],
    });
  }
  if (!optionIds.includes(request.defaultOptionId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "The default option must be present in options",
      path: ["defaultOptionId"],
    });
  }
});

export const ChoiceSignalSchema = EventBaseSchema.extend({
  type: z.literal("choice.signal"),
  requestId: z.string().min(1).max(128),
  optionId: z.string().min(1).max(64),
  signalId: z.string().min(1).max(128),
  signalledAt: z.string().datetime(),
}).strict();

export const ChoiceAckEventSchema = EventBaseSchema.extend({
  type: z.literal("choice.ack"),
  requestId: z.string().min(1).max(128),
  optionId: z.string().min(1).max(64),
  signalId: z.string().min(1).max(128),
  status: ChoiceAckStatusSchema,
  reason: z
    .enum([
      "accepted",
      "decision-locked",
      "expired",
      "invalid-option",
      "unknown-request",
      "conflicting-signal",
      "terminal-run",
      "stale-run",
      "memory-disabled",
    ])
    .optional(),
}).strict();

export const RunCompleteEventSchema = EventBaseSchema.extend({
  type: z.literal("run.complete"),
  finalAnswer: z.string(),
  structuredResult: z.unknown(),
  impactReceipt: z.unknown(),
  providerMode: ProviderModeSchema,
}).strict();

export const RunCancelRequestEventSchema = EventBaseSchema.extend({
  type: z.literal("run.cancel.request"),
}).strict();

export const RunCancelAckEventSchema = EventBaseSchema.extend({
  type: z.literal("run.cancel.ack"),
  status: z.enum(["cancelled", "already-terminal"]),
}).strict();

export const RunErrorEventSchema = EventBaseSchema.extend({
  type: z.literal("run.error"),
  code: z.string().min(1).max(64),
  message: z.string().min(1).max(240),
  recoverable: z.boolean(),
}).strict();

export const PublicEventSchema = z.union([
  RunStartEventSchema,
  RunProgressEventSchema,
  ProviderModeEventSchema,
  ChoiceRequestSchema,
  ChoiceSignalSchema,
  ChoiceAckEventSchema,
  RunCompleteEventSchema,
  RunCancelRequestEventSchema,
  RunCancelAckEventSchema,
  RunErrorEventSchema,
]);

export type RunStartEvent = z.infer<typeof RunStartEventSchema>;
export type RunProgressEvent = z.infer<typeof RunProgressEventSchema>;
export type ProviderModeEvent = z.infer<typeof ProviderModeEventSchema>;
export type ChoiceRequest = z.infer<typeof ChoiceRequestSchema>;
export type ChoiceSignal = z.infer<typeof ChoiceSignalSchema>;
export type ChoiceAckEvent = z.infer<typeof ChoiceAckEventSchema>;
export type RunCompleteEvent = z.infer<typeof RunCompleteEventSchema>;
export type RunCancelRequestEvent = z.infer<
  typeof RunCancelRequestEventSchema
>;
export type RunCancelAckEvent = z.infer<typeof RunCancelAckEventSchema>;
export type RunErrorEvent = z.infer<typeof RunErrorEventSchema>;
export type PublicEvent = z.infer<typeof PublicEventSchema>;

export function parsePublicEvent(input: unknown): PublicEvent {
  return PublicEventSchema.parse(input);
}

export function isTerminalEvent(
  event: PublicEvent,
): event is RunCompleteEvent | RunCancelAckEvent | RunErrorEvent {
  return (
    event.type === "run.complete" ||
    event.type === "run.cancel.ack" ||
    event.type === "run.error"
  );
}
