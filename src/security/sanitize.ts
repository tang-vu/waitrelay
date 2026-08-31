import { z } from "zod";

import {
  ContextCapsuleSchema,
  sanitizeContextCapsule,
} from "../shared/contracts/context-capsule";
import { resolveChoiceAxis } from "../shared/contracts/choices";
import {
  ChoiceAckStatusSchema,
  ChoiceSignalSchema,
  LifecycleStageSchema,
  PROTOCOL_VERSION,
  PublicEventSchema,
  type ChoiceSignal,
} from "../shared/contracts/events";

const FlightBaseSchema = z
  .object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    runId: z.string().min(1).max(128),
    eventId: z.string().min(1).max(128),
    sequence: z.number().int().nonnegative(),
    timestamp: z.string().datetime(),
  })
  .strict();

export const FlightEventSchema = z.union([
  FlightBaseSchema.extend({
    type: z.literal("run.start"),
    context: ContextCapsuleSchema,
    visualSeed: z.string().min(1).max(128),
  }).strict(),
  FlightBaseSchema.extend({
    type: z.literal("run.progress"),
    stage: LifecycleStageSchema,
  }).strict(),
  FlightBaseSchema.extend({
    type: z.literal("choice.request"),
    requestId: z.string().min(1).max(128),
    axisId: z.string().min(1).max(64),
    options: z
      .array(
        z
          .object({
            optionId: z.string().min(1).max(64),
            label: z.string().min(1).max(48),
            description: z.string().min(1).max(140),
          })
          .strict(),
      )
      .length(2),
    defaultOptionId: z.string().min(1).max(64),
    decisionPoint: z.string().min(1).max(80),
    expiresAt: z.string().datetime().optional(),
    effectCategory: z.string().min(1).max(80),
  }).strict(),
  FlightBaseSchema.extend({
    type: z.literal("choice.signal"),
    requestId: z.string().min(1).max(128),
    optionId: z.string().min(1).max(64),
    signalId: z.string().min(1).max(128),
    signalledAt: z.string().datetime(),
  }).strict(),
  FlightBaseSchema.extend({
    type: z.literal("choice.ack"),
    requestId: z.string().min(1).max(128),
    optionId: z.string().min(1).max(64),
    signalId: z.string().min(1).max(128),
    status: ChoiceAckStatusSchema,
  }).strict(),
  FlightBaseSchema.extend({ type: z.literal("run.complete") }).strict(),
  FlightBaseSchema.extend({ type: z.literal("run.cancel.request") }).strict(),
  FlightBaseSchema.extend({
    type: z.literal("run.cancel.ack"),
    status: z.enum(["cancelled", "already-terminal"]),
  }).strict(),
  FlightBaseSchema.extend({
    type: z.literal("run.error"),
    code: z.literal("run-failed"),
    recoverable: z.boolean(),
  }).strict(),
]);
export type FlightEvent = z.infer<typeof FlightEventSchema>;

export interface FlightSanitizeOptions {
  sensitive?: boolean;
}

/**
 * Produces the exact enum-oriented payload permitted to cross into Fork Flight.
 * Final answers, prompt text, provider data, and error details have no output
 * field and therefore cannot survive this projection.
 */
export function sanitizeFlightEvent(
  input: unknown,
  options: FlightSanitizeOptions = {},
): FlightEvent {
  const event = PublicEventSchema.parse(input);
  const base = {
    protocolVersion: event.protocolVersion,
    runId: event.runId,
    eventId: event.eventId,
    sequence: event.sequence,
    timestamp: event.timestamp,
  } as const;

  switch (event.type) {
    case "run.start":
      return FlightEventSchema.parse({
        ...base,
        type: event.type,
        context: sanitizeContextCapsule(event.context, {
          sensitive: options.sensitive,
        }),
        visualSeed: event.visualSeed,
      });
    case "run.progress":
      return FlightEventSchema.parse({
        ...base,
        type: event.type,
        stage: event.stage,
      });
    case "provider.mode":
      throw new Error("Provider mode is host-only and cannot cross into Fork Flight");
    case "choice.request": {
      const definition = resolveChoiceAxis(event.axisId);
      if (!definition) {
        throw new Error("Choice axis is not allowlisted for Fork Flight");
      }
      const requestedIds = new Set(event.options.map((option) => option.optionId));
      const optionsFromRegistry = definition.options.filter((option) =>
        requestedIds.has(option.optionId),
      );
      if (
        optionsFromRegistry.length !== 2 ||
        !optionsFromRegistry.some(
          (option) => option.optionId === event.defaultOptionId,
        )
      ) {
        throw new Error("Choice request does not match its allowlisted axis");
      }
      return FlightEventSchema.parse({
        ...base,
        type: event.type,
        requestId: event.requestId,
        axisId: definition.axisId,
        options: optionsFromRegistry,
        defaultOptionId: event.defaultOptionId,
        decisionPoint: definition.decisionPoint,
        ...(event.expiresAt ? { expiresAt: event.expiresAt } : {}),
        effectCategory: definition.effectCategory,
      });
    }
    case "choice.signal":
      return FlightEventSchema.parse({
        ...base,
        type: event.type,
        requestId: event.requestId,
        optionId: event.optionId,
        signalId: event.signalId,
        signalledAt: event.signalledAt,
      });
    case "choice.ack":
      return FlightEventSchema.parse({
        ...base,
        type: event.type,
        requestId: event.requestId,
        optionId: event.optionId,
        signalId: event.signalId,
        status: event.status,
      });
    case "run.complete":
    case "run.cancel.request":
      return FlightEventSchema.parse({ ...base, type: event.type });
    case "run.cancel.ack":
      return FlightEventSchema.parse({
        ...base,
        type: event.type,
        status: event.status,
      });
    case "run.error":
      return FlightEventSchema.parse({
        ...base,
        type: event.type,
        code: "run-failed",
        recoverable: event.recoverable,
      });
  }
}

export function sanitizeChoiceSignalForHost(input: unknown): ChoiceSignal {
  const signal = ChoiceSignalSchema.parse(input);
  const resolved = resolveChoiceAxis(
    resolveChoiceAxisForOption(signal.optionId) ?? "",
  );
  if (!resolved) throw new Error("Choice option is not allowlisted");
  return signal;
}

function resolveChoiceAxisForOption(optionId: string): string | undefined {
  for (const axisId of ["mobility", "character"] as const) {
    if (
      resolveChoiceAxis(axisId)?.options.some(
        (option) => option.optionId === optionId,
      )
    ) {
      return axisId;
    }
  }
  return undefined;
}

/** Safe for host UI logs, never for forwarding private provider payloads. */
export function sanitizeProviderError(error: unknown): string {
  const generic = "The configured provider could not complete this run.";
  void error;
  return generic;
}
