import { z } from "zod";

import { ContextCapsuleSchema } from "../../../shared/contracts/context-capsule";

export const FLIGHT_BRIDGE_VERSION = "1.0" as const;

const IdentifierSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9._:-]+$/);
export const SafeFlightOptionIdSchema = z.enum([
  "less-walking",
  "more-discovery",
  "reliable",
  "surprising",
  "practical",
  "creative",
  "breadth",
  "depth",
  "concise",
  "detailed",
  "speed",
  "confidence",
]);
const SafeFlightAxisIdSchema = z.enum(["mobility", "character", "approach", "scope", "detail", "tempo"]);
const SafeEffectCategorySchema = z.enum([
  "route-and-discovery",
  "confidence-and-novelty",
  "approach",
  "source-selection",
  "response-detail",
  "verification-depth",
]);
const safeLabels: Record<z.infer<typeof SafeFlightOptionIdSchema>, string> = {
  "less-walking": "Less Walking",
  "more-discovery": "More Discovery",
  reliable: "Reliable",
  surprising: "Surprising",
  practical: "Practical",
  creative: "Creative",
  breadth: "Breadth",
  depth: "Depth",
  concise: "Concise",
  detailed: "Detailed",
  speed: "Speed",
  confidence: "Confidence",
};

export const SafeFlightOptionSchema = z
  .object({
    optionId: SafeFlightOptionIdSchema,
    label: z.enum([
      "Less Walking",
      "More Discovery",
      "Reliable",
      "Surprising",
      "Practical",
      "Creative",
      "Breadth",
      "Depth",
      "Concise",
      "Detailed",
      "Speed",
      "Confidence",
    ]),
  })
  .strict()
  .superRefine((option, context) => {
    if (safeLabels[option.optionId] !== option.label) {
      context.addIssue({ code: "custom", message: "Option label does not match its allowlisted ID", path: ["label"] });
    }
  });

export const SafeFlightGateSchema = z
  .object({
    requestId: IdentifierSchema,
    axisId: SafeFlightAxisIdSchema,
    options: z.tuple([SafeFlightOptionSchema, SafeFlightOptionSchema]),
    defaultOptionId: SafeFlightOptionIdSchema,
    effectCategory: SafeEffectCategorySchema,
    expiresAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((gate, context) => {
    const optionIds = gate.options.map((option) => option.optionId);
    if (new Set(optionIds).size !== optionIds.length) {
      context.addIssue({ code: "custom", message: "Option IDs must be unique", path: ["options"] });
    }
    if (!optionIds.includes(gate.defaultOptionId)) {
      context.addIssue({ code: "custom", message: "Default option is not allowlisted", path: ["defaultOptionId"] });
    }
  });

export const SafeFlightAckSchema = z
  .object({
    requestId: IdentifierSchema,
    optionId: SafeFlightOptionIdSchema,
    signalId: IdentifierSchema,
    status: z.enum(["appliedNow", "tooLate", "rejected", "savedNext"]),
  })
  .strict();

const BridgeBaseSchema = z
  .object({
    bridgeVersion: z.literal(FLIGHT_BRIDGE_VERSION),
    runId: IdentifierSchema,
    nonce: IdentifierSchema,
  })
  .strict();

export const FlightPortConnectSchema = BridgeBaseSchema.extend({
  type: z.literal("flight.port.connect"),
  context: ContextCapsuleSchema,
  stage: z.enum(["understanding", "gathering", "evaluating", "composing", "verifying"]),
  visualSeed: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_:-]+$/),
  sensitive: z.boolean(),
}).strict();

export const HostToFlightMessageSchema = z.discriminatedUnion("type", [
  BridgeBaseSchema.extend({
    type: z.literal("run.progress"),
    stage: z.enum(["understanding", "gathering", "evaluating", "composing", "verifying"]),
  }).strict(),
  BridgeBaseSchema.extend({
    type: z.literal("choice.request"),
    gate: SafeFlightGateSchema,
  }).strict(),
  BridgeBaseSchema.extend({
    type: z.literal("choice.clear"),
    requestId: IdentifierSchema,
  }).strict(),
  BridgeBaseSchema.extend({
    type: z.literal("choice.ack"),
    acknowledgement: SafeFlightAckSchema,
  }).strict(),
  BridgeBaseSchema.extend({
    type: z.literal("run.terminal"),
    status: z.enum(["completed", "cancelled", "failed"]),
  }).strict(),
  BridgeBaseSchema.extend({
    type: z.literal("flight.mode"),
    mode: z.enum(["active", "passive"]),
  }).strict(),
]);

export const FlightToHostMessageSchema = z.discriminatedUnion("type", [
  BridgeBaseSchema.extend({
    type: z.literal("flight.ready"),
  }).strict(),
  BridgeBaseSchema.extend({
    type: z.literal("choice.signal"),
    requestId: IdentifierSchema,
    optionId: SafeFlightOptionIdSchema,
    signalId: IdentifierSchema,
    signalledAt: z.string().datetime(),
  }).strict(),
  BridgeBaseSchema.extend({
    type: z.literal("choice.skip"),
    requestId: IdentifierSchema,
  }).strict(),
  BridgeBaseSchema.extend({
    type: z.literal("flight.dismiss"),
  }).strict(),
  BridgeBaseSchema.extend({
    type: z.literal("flight.mode.change"),
    mode: z.enum(["active", "passive"]),
  }).strict(),
  BridgeBaseSchema.extend({
    type: z.literal("flight.failure"),
    code: z.literal("renderer-error"),
  }).strict(),
]);

export type FlightPortConnect = z.infer<typeof FlightPortConnectSchema>;
export type HostToFlightMessage = z.infer<typeof HostToFlightMessageSchema>;
export type FlightToHostMessage = z.infer<typeof FlightToHostMessageSchema>;
export type SafeFlightGate = z.infer<typeof SafeFlightGateSchema>;
export type SafeFlightAck = z.infer<typeof SafeFlightAckSchema>;

const FlightGateSourceSchema = z.object({
  requestId: IdentifierSchema,
  axisId: z.string(),
  options: z.array(z.object({ optionId: z.string(), label: z.string() })).length(2),
  defaultOptionId: z.string(),
  effectCategory: z.string(),
  expiresAt: z.string().datetime().optional(),
});

/** Projects a host choice event onto the only fields the game is allowed to see. */
export function toSafeFlightGate(input: unknown): SafeFlightGate {
  const source = FlightGateSourceSchema.parse(input);
  return SafeFlightGateSchema.parse({
    requestId: source.requestId,
    axisId: source.axisId,
    options: source.options.map((option) => ({ optionId: option.optionId, label: option.label })),
    defaultOptionId: source.defaultOptionId,
    effectCategory: source.effectCategory,
    expiresAt: source.expiresAt,
  });
}

const FlightAckSourceSchema = z.object({
  requestId: IdentifierSchema,
  optionId: z.string(),
  signalId: IdentifierSchema,
  status: z.string(),
});

/** Removes timestamps, reasons, metrics, and other host-only ACK metadata. */
export function toSafeFlightAck(input: unknown): SafeFlightAck {
  const source = FlightAckSourceSchema.parse(input);
  return SafeFlightAckSchema.parse(source);
}

export function makeBridgeEnvelope<T extends object>(
  identity: Pick<FlightPortConnect, "runId" | "nonce">,
  message: T,
): T & Pick<FlightPortConnect, "bridgeVersion" | "runId" | "nonce"> {
  return {
    bridgeVersion: FLIGHT_BRIDGE_VERSION,
    runId: identity.runId,
    nonce: identity.nonce,
    ...message,
  };
}
