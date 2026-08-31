import { describe, expect, it } from "vitest";

import {
  FLIGHT_CONTENT_SECURITY_POLICY,
  FLIGHT_IFRAME_SANDBOX,
} from "@/security/csp";
import {
  FlightEventSchema,
  sanitizeFlightEvent,
  sanitizeProviderError,
} from "@/security/sanitize";
import { PROTOCOL_VERSION } from "@/shared/contracts/events";
import { buildImpactReceipt } from "@/server/orchestrator/impact-builder";
import { baselineTokyoPlan } from "../../demo/tokyo-scenario";

const CANARY = "RAW_PROMPT_CANARY_8f79c58d7e";
const base = {
  protocolVersion: PROTOCOL_VERSION,
  runId: "run-sanitize-1",
  eventId: "event-sanitize-1",
  sequence: 4,
  timestamp: "2026-08-30T12:00:04.000Z",
};

describe("host to flight sanitizer", () => {
  it("removes the complete result, answer, and receipt from completion", () => {
    const plan = baselineTokyoPlan();
    const impactReceipt = buildImpactReceipt({
      runId: base.runId,
      baseline: plan,
      selected: plan,
      acceptedChoices: [],
      generatedAt: base.timestamp,
    });
    const output = sanitizeFlightEvent({
      ...base,
      type: "run.complete",
      finalAnswer: `Private answer ${CANARY}`,
      structuredResult: {
        ...plan,
        stops: plan.stops.map((stop, index) => index === 0
          ? { ...stop, scenarioNote: CANARY }
          : stop),
      },
      impactReceipt: { ...impactReceipt, summary: CANARY },
      providerMode: "demo",
    });

    expect(output).toEqual({ ...base, type: "run.complete" });
    expect(JSON.stringify(output)).not.toContain(CANARY);
  });

  it("replaces browser-supplied gate copy with registry copy", () => {
    const output = sanitizeFlightEvent({
      ...base,
      type: "choice.request",
      requestId: "request-mobility",
      axisId: "mobility",
      options: [
        { optionId: "less-walking", label: CANARY, description: CANARY },
        { optionId: "more-discovery", label: CANARY, description: CANARY },
      ],
      defaultOptionId: "more-discovery",
      decisionPoint: CANARY,
      effectCategory: CANARY,
    });

    expect(JSON.stringify(output)).not.toContain(CANARY);
    expect(output).toMatchObject({
      type: "choice.request",
      axisId: "mobility",
      decisionPoint: "venue-ranking",
      effectCategory: "route-and-discovery",
    });
  });

  it("reduces a provider failure to a generic public game event", () => {
    const output = sanitizeFlightEvent({
      ...base,
      type: "run.error",
      code: "provider-secret-error",
      message: `Provider echoed ${CANARY}`,
      recoverable: false,
    });

    expect(output).toMatchObject({
      type: "run.error",
      code: "run-failed",
      recoverable: false,
    });
    expect(JSON.stringify(output)).not.toContain(CANARY);
  });

  it("rejects unknown data on the flight event schema", () => {
    expect(
      FlightEventSchema.safeParse({
        ...base,
        type: "run.complete",
        rawPrompt: CANARY,
      }).success,
    ).toBe(false);
  });

  it("uses a script-only iframe sandbox and disables flight connections", () => {
    expect(FLIGHT_IFRAME_SANDBOX).toBe("allow-scripts");
    expect(FLIGHT_IFRAME_SANDBOX).not.toContain("allow-same-origin");
    expect(FLIGHT_CONTENT_SECURITY_POLICY).toContain("connect-src 'none'");
    expect(FLIGHT_CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
  });

  it("redacts credentials and provider URLs from public error copy", () => {
    const safe = sanitizeProviderError(
      new Error("Authorization: Bearer secret123 at https://provider.example/v1"),
    );
    expect(safe).not.toContain("secret123");
    expect(safe).not.toContain("provider.example");
    expect(sanitizeProviderError(new Error(CANARY))).not.toContain(CANARY);
  });
});
