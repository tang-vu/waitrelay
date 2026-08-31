import { describe, expect, it } from "vitest";

import {
  ChoiceRequestSchema,
  ChoiceSignalSchema,
  PROTOCOL_VERSION,
  PublicEventSchema,
  parsePublicEvent,
} from "@/shared/contracts/events";

const base = {
  protocolVersion: PROTOCOL_VERSION,
  runId: "run-protocol-1",
  eventId: "event-1",
  sequence: 1,
  timestamp: "2026-08-30T12:00:00.000Z",
};

describe("versioned public event protocol", () => {
  it("parses a strict lifecycle event", () => {
    expect(
      parsePublicEvent({
        ...base,
        type: "run.progress",
        stage: "gathering",
      }),
    ).toMatchObject({
      protocolVersion: "1.0",
      type: "run.progress",
      stage: "gathering",
    });
  });

  it("rejects a fabricated lifecycle stage and protocol version", () => {
    expect(
      PublicEventSchema.safeParse({
        ...base,
        protocolVersion: "2.0",
        type: "run.progress",
        stage: "thinking-harder",
      }).success,
    ).toBe(false);
  });

  it("requires two unique options and an allowlisted default", () => {
    const request = {
      ...base,
      type: "choice.request" as const,
      requestId: "request-mobility",
      axisId: "mobility",
      options: [
        { optionId: "less-walking", label: "Less Walking" },
        { optionId: "more-discovery", label: "More Discovery" },
      ],
      defaultOptionId: "more-discovery",
      decisionPoint: "venue-ranking",
      effectCategory: "route-and-discovery",
    };

    expect(ChoiceRequestSchema.safeParse(request).success).toBe(true);
    expect(
      ChoiceRequestSchema.safeParse({
        ...request,
        defaultOptionId: "teleport",
      }).success,
    ).toBe(false);
    expect(
      ChoiceRequestSchema.safeParse({
        ...request,
        options: [request.options[0], request.options[0]],
      }).success,
    ).toBe(false);
  });

  it("validates signal identity and rejects unknown payload fields", () => {
    const signal = {
      ...base,
      type: "choice.signal" as const,
      requestId: "request-mobility",
      optionId: "less-walking",
      signalId: "signal-1",
      signalledAt: "2026-08-30T12:00:00.100Z",
    };

    expect(ChoiceSignalSchema.safeParse(signal).success).toBe(true);
    expect(
      ChoiceSignalSchema.safeParse({ ...signal, preferencePatch: { walkingWeight: 1 } })
        .success,
    ).toBe(false);
    expect(ChoiceSignalSchema.safeParse({ ...signal, signalledAt: "soon" }).success).toBe(
      false,
    );
  });

  it("accepts only the documented ACK statuses", () => {
    const acknowledgement = {
      ...base,
      type: "choice.ack",
      requestId: "request-mobility",
      optionId: "less-walking",
      signalId: "signal-1",
      status: "appliedNow",
      reason: "accepted",
    };

    expect(PublicEventSchema.safeParse(acknowledgement).success).toBe(true);
    expect(
      PublicEventSchema.safeParse({ ...acknowledgement, status: "probably-applied" })
        .success,
    ).toBe(false);
  });
});
