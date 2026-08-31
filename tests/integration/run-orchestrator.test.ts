import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RunOrchestrator } from "@/server/orchestrator/run-orchestrator";

const input = {
  prompt: "Plan a rain-safe vegetarian date in Tokyo.",
  scenario: "standard" as const,
  seed: "integration-001",
  sensitive: false,
  interactionMode: "active" as const,
  forceDemo: true,
};

describe("RunOrchestrator", () => {
  let orchestrator: RunOrchestrator;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T12:00:00.000Z"));
    orchestrator = new RunOrchestrator();
  });

  afterEach(() => {
    orchestrator.store.dispose();
    vi.useRealTimers();
  });

  it("starts, accepts a gate, changes the plan, and completes with a receipt", async () => {
    const created = await orchestrator.start(input);
    await vi.advanceTimersByTimeAsync(1_400);
    const request = (await orchestrator.getEvents(created.runId)).find((event) => event.type === "choice.request");
    expect(request?.type).toBe("choice.request");
    if (!request || request.type !== "choice.request") throw new Error("gate unavailable");
    const ack = await orchestrator.handleChoice(created.runId, {
      requestId: request.requestId,
      optionId: "less-walking",
      signalId: "signal-integration-1",
      signalledAt: new Date().toISOString(),
    });
    expect(ack.status).toBe("appliedNow");
    await vi.advanceTimersByTimeAsync(8_000);
    const complete = (await orchestrator.getEvents(created.runId)).find((event) => event.type === "run.complete");
    expect(complete?.type).toBe("run.complete");
    if (!complete || complete.type !== "run.complete") throw new Error("run incomplete");
    expect((complete.structuredResult as { preferences: { mobility: string } }).preferences.mobility).toBe("less-walking");
    expect((complete.impactReceipt as { entries: unknown[] }).entries).toHaveLength(1);
  });

  it("completes fast without mounting a choice request", async () => {
    const created = await orchestrator.start({ ...input, scenario: "fast" as const });
    await vi.advanceTimersByTimeAsync(250);
    const events = await orchestrator.getEvents(created.runId);
    expect(events.some((event) => event.type === "choice.request")).toBe(false);
    expect(events.at(-1)?.type).toBe("run.complete");
  });

  it("returns tooLate after the synthesis snapshot", async () => {
    const created = await orchestrator.start({ ...input, scenario: "late" as const });
    await vi.advanceTimersByTimeAsync(4_600);
    const request = (await orchestrator.getEvents(created.runId)).find((event) => event.type === "choice.request");
    if (!request || request.type !== "choice.request") throw new Error("gate unavailable");
    const ack = await orchestrator.handleChoice(created.runId, {
      requestId: request.requestId,
      optionId: "less-walking",
      signalId: "signal-too-late",
      signalledAt: new Date().toISOString(),
    });
    expect(ack.status).toBe("tooLate");
    expect(ack.reason).toBe("decision-locked");
  });

  it("keeps cancellation terminal when completion races", async () => {
    const created = await orchestrator.start(input);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(await orchestrator.cancel(created.runId)).toBe("cancelled");
    await vi.advanceTimersByTimeAsync(10_000);
    const snapshot = await orchestrator.getSnapshot(created.runId);
    expect(snapshot?.state).toBe("cancelled");
    expect(snapshot?.publicEvents.some((event) => event.type === "run.complete")).toBe(false);
  });

  it("fails safely with a generic provider error", async () => {
    const created = await orchestrator.start({ ...input, scenario: "error" as const });
    await vi.advanceTimersByTimeAsync(2_300);
    const event = (await orchestrator.getEvents(created.runId)).at(-1);
    expect(event?.type).toBe("run.error");
    if (event?.type === "run.error") expect(event.message).not.toContain("controlled-provider-failure");
  });

  it("buffers events created after replay capture until the SSE subscriber activates", async () => {
    const created = await orchestrator.start(input);
    await vi.advanceTimersByTimeAsync(1_400);
    const events = await orchestrator.getEvents(created.runId);
    const request = events.find((event) => event.type === "choice.request");
    if (!request || request.type !== "choice.request") throw new Error("gate unavailable");
    const received: string[] = [];
    const subscription = await orchestrator.subscribeWithReplay(
      created.runId,
      events.at(-1)?.sequence ?? -1,
      (event) => received.push(event.eventId),
    );
    expect(subscription).toBeDefined();

    await orchestrator.handleChoice(created.runId, {
      requestId: request.requestId,
      optionId: "less-walking",
      signalId: "signal-replay-gap",
      signalledAt: new Date().toISOString(),
    });
    expect(received).toEqual([]);

    subscription?.activate();
    expect(received).toHaveLength(2);
    expect(received[0]).toContain("choice.signal");
    expect(received[1]).toContain("choice.ack");
    subscription?.unsubscribe();
  });

  it("returns an authoritative rejection when a signal ID is reused with another option", async () => {
    const created = await orchestrator.start(input);
    await vi.advanceTimersByTimeAsync(1_400);
    const request = (await orchestrator.getEvents(created.runId)).find(
      (event) => event.type === "choice.request",
    );
    if (!request || request.type !== "choice.request") throw new Error("gate unavailable");
    const shared = {
      requestId: request.requestId,
      signalId: "reused-api-signal",
      signalledAt: new Date().toISOString(),
    };

    await expect(orchestrator.handleChoice(created.runId, {
      ...shared,
      optionId: "less-walking",
    })).resolves.toMatchObject({ status: "appliedNow", optionId: "less-walking" });
    await expect(orchestrator.handleChoice(created.runId, {
      ...shared,
      optionId: "more-discovery",
    })).resolves.toMatchObject({
      status: "rejected",
      reason: "conflicting-signal",
      optionId: "more-discovery",
    });
  });

  it("replays an identical seeded public timeline and structured result", async () => {
    const second = new RunOrchestrator();
    try {
      const firstRun = await orchestrator.start({ ...input, seed: "determinism-001" });
      const secondRun = await second.start({ ...input, seed: "determinism-001" });
      await vi.advanceTimersByTimeAsync(1_400);
      for (const [instance, runId, signalId] of [
        [orchestrator, firstRun.runId, "deterministic-first"],
        [second, secondRun.runId, "deterministic-second"],
      ] as const) {
        const request = (await instance.getEvents(runId)).find(
          (event) => event.type === "choice.request" && event.axisId === "mobility",
        );
        if (!request || request.type !== "choice.request") throw new Error("gate unavailable");
        await instance.handleChoice(runId, {
          requestId: request.requestId,
          optionId: "less-walking",
          signalId,
          signalledAt: "2026-08-30T12:00:01.400Z",
        });
      }
      await vi.advanceTimersByTimeAsync(8_000);
      const firstEvents = await orchestrator.getEvents(firstRun.runId);
      const secondEvents = await second.getEvents(secondRun.runId);
      const normalizeTimeline = (events: typeof firstEvents) => events.map((event) => {
        if (event.type === "run.progress") return `${event.type}:${event.stage}`;
        if (event.type === "choice.request") return `${event.type}:${event.axisId}`;
        if (event.type === "choice.ack") return `${event.type}:${event.status}`;
        return event.type;
      });
      expect(normalizeTimeline(firstEvents)).toEqual(normalizeTimeline(secondEvents));
      const firstComplete = firstEvents.find((event) => event.type === "run.complete");
      const secondComplete = secondEvents.find((event) => event.type === "run.complete");
      expect(firstComplete?.type).toBe("run.complete");
      expect(secondComplete?.type).toBe("run.complete");
      if (firstComplete?.type === "run.complete" && secondComplete?.type === "run.complete") {
        expect(firstComplete.structuredResult).toEqual(secondComplete.structuredResult);
        const effectShape = (receipt: unknown) => (receipt as {
          entries: Array<{ selectedOptionId: string; effectMetrics: unknown[] }>;
        }).entries.map((entry) => ({
          optionId: entry.selectedOptionId,
          metrics: entry.effectMetrics,
        }));
        expect(effectShape(firstComplete.impactReceipt)).toEqual(effectShape(secondComplete.impactReceipt));
      }
    } finally {
      second.store.dispose();
    }
  });
});
