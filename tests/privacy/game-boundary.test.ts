import { describe, expect, it } from "vitest";

import {
  FlightPortConnectSchema,
  FlightToHostMessageSchema,
  HostToFlightMessageSchema,
  SafeFlightGateSchema,
} from "@/features/flight/bridge/contracts";
import { sanitizeContextCapsule } from "@/shared/contracts/context-capsule";

const CANARY = "RAW_PROMPT_CANARY_8f79c58d7e";

const identity = {
  bridgeVersion: "1.0" as const,
  runId: "run-privacy-1",
  nonce: "nonce-privacy-1",
};

const context = sanitizeContextCapsule({
  domain: "planning",
  taskKind: "plan",
  locale: "en",
  risk: "low",
  waitBand: "medium",
  interactionMode: "active",
  difficulty: "normal",
});

const gate = {
  requestId: "request-mobility",
  axisId: "mobility",
  options: [
    {
      optionId: "less-walking",
      label: "Less Walking",
    },
    {
      optionId: "more-discovery",
      label: "More Discovery",
    },
  ],
  defaultOptionId: "more-discovery",
  effectCategory: "route-and-discovery",
} as const;

describe("Fork Flight privacy boundary", () => {
  it("serializes only the enum-oriented initialization capsule", () => {
    const message = FlightPortConnectSchema.parse({
      ...identity,
      type: "flight.port.connect",
      context,
      stage: "understanding",
      visualSeed: "fork-flight-001",
      sensitive: false,
    });

    expect(JSON.stringify(message)).not.toContain(CANARY);
    expect(Object.keys(message.context).sort()).toEqual(
      [
        "difficulty",
        "domain",
        "interactionMode",
        "locale",
        "risk",
        "taskKind",
        "waitBand",
      ].sort(),
    );
  });

  it.each(["rawPrompt", "finalAnswer", "toolOutput", "providerKey", "email"])(
    "rejects a %s field in host messages",
    (field) => {
      const unsafe = {
        ...identity,
        type: "run.progress",
        stage: "gathering",
        [field]: CANARY,
      };
      expect(HostToFlightMessageSchema.safeParse(unsafe).success).toBe(false);
    },
  );

  it("accepts allowlisted gate presentation and rejects hidden preference patches", () => {
    expect(SafeFlightGateSchema.safeParse(gate).success).toBe(true);
    expect(
      SafeFlightGateSchema.safeParse({
        ...gate,
        preferencePatch: { walkingWeight: 1 },
      }).success,
    ).toBe(false);
  });

  it("lets the game send an option ID but not create an ACK", () => {
    expect(
      FlightToHostMessageSchema.safeParse({
        ...identity,
        type: "choice.signal",
        requestId: "request-mobility",
        optionId: "less-walking",
        signalId: "signal-privacy-1",
        signalledAt: "2026-08-30T12:00:01.000Z",
      }).success,
    ).toBe(true);

    expect(
      FlightToHostMessageSchema.safeParse({
        ...identity,
        type: "choice.ack",
        requestId: "request-mobility",
        optionId: "less-walking",
        signalId: "signal-privacy-1",
        status: "appliedNow",
      }).success,
    ).toBe(false);
  });

  it("reports renderer failure with an enum and rejects error details", () => {
    expect(FlightToHostMessageSchema.safeParse({
      ...identity,
      type: "flight.failure",
      code: "renderer-error",
    }).success).toBe(true);
    expect(FlightToHostMessageSchema.safeParse({
      ...identity,
      type: "flight.failure",
      code: "renderer-error",
      message: CANARY,
    }).success).toBe(false);
  });

  it("makes Sensitive Mode generic", () => {
    const sensitive = sanitizeContextCapsule(context, { sensitive: true });
    expect(sensitive).toMatchObject({
      domain: "general",
      taskKind: "other",
      locale: "unknown",
      risk: "high",
      difficulty: "calm",
    });
    expect(JSON.stringify(sensitive)).not.toContain(CANARY);
  });
});
