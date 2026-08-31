import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AgentAdapter,
  AgentPlan,
  EvidenceBundle,
} from "@/server/agents/agent-adapter";
import { RunOrchestrator } from "@/server/orchestrator/run-orchestrator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function liveAdapter(
  evidence: Promise<EvidenceBundle>,
  axes: AgentPlan["applicableAxisIds"] = ["mobility", "character"],
): AgentAdapter {
  return {
    mode: "live",
    health: async () => ({ ok: true, mode: "live", label: "Live Provider" }),
    analyze: async () => ({
      domain: "planning",
      taskKind: "plan",
      applicableAxisIds: axes,
      publicSummary: "Live planning test",
    }),
    gather: async (_plan, emit) => {
      emit({ stage: "gathering" });
      return evidence;
    },
    synthesize: async () => ({ answer: "Live adapter answer" }),
  };
}

const input = {
  prompt: "Plan a rain-safe vegetarian date in Tokyo.",
  scenario: "standard" as const,
  seed: "live-window-001",
  sensitive: false,
  interactionMode: "active" as const,
  forceDemo: false,
};

describe("live non-blocking orchestration", () => {
  const orchestrators: RunOrchestrator[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T12:00:00.000Z"));
  });

  afterEach(() => {
    for (const orchestrator of orchestrators.splice(0)) {
      orchestrator.store.dispose();
    }
    vi.useRealTimers();
  });

  it("opens an allowlisted steering window while live gathering continues", async () => {
    const evidence = deferred<EvidenceBundle>();
    const orchestrator = new RunOrchestrator({
      adapterFactory: () => liveAdapter(evidence.promise, ["mobility"]),
    });
    orchestrators.push(orchestrator);
    const created = await orchestrator.start(input);

    await vi.advanceTimersByTimeAsync(249);
    expect((await orchestrator.getEvents(created.runId)).some(
      (event) => event.type === "choice.request",
    )).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const request = (await orchestrator.getEvents(created.runId)).find(
      (event) => event.type === "choice.request",
    );
    if (!request || request.type !== "choice.request") throw new Error("gate unavailable");
    expect(request.axisId).toBe("mobility");

    await expect(orchestrator.handleChoice(created.runId, {
      requestId: request.requestId,
      optionId: "less-walking",
      signalId: "live-choice-before-lock",
      signalledAt: new Date().toISOString(),
    })).resolves.toMatchObject({ status: "appliedNow" });

    evidence.resolve({
      source: "live",
      recordedAt: new Date().toISOString(),
      summary: "Live evidence completed",
      evidenceItems: 4,
    });
    await vi.advanceTimersByTimeAsync(0);

    const complete = (await orchestrator.getEvents(created.runId)).find(
      (event) => event.type === "run.complete",
    );
    expect(complete).toMatchObject({ type: "run.complete", providerMode: "live" });
    if (complete?.type === "run.complete") {
      expect((complete.structuredResult as { preferences: { mobility: string } })
        .preferences.mobility).toBe("less-walking");
    }
  });

  it("never delays a fast live result merely to display a gate", async () => {
    const evidence = deferred<EvidenceBundle>();
    const orchestrator = new RunOrchestrator({
      adapterFactory: () => liveAdapter(evidence.promise, ["mobility"]),
    });
    orchestrators.push(orchestrator);
    const created = await orchestrator.start(input);
    evidence.resolve({
      source: "live",
      recordedAt: new Date().toISOString(),
      summary: "Immediate evidence",
      evidenceItems: 2,
    });
    await vi.advanceTimersByTimeAsync(0);

    const events = await orchestrator.getEvents(created.runId);
    expect(events.some((event) => event.type === "choice.request")).toBe(false);
    expect(events.at(-1)?.type).toBe("run.complete");
  });

  it("uses only the axes returned by live analysis and rejects a post-lock signal", async () => {
    const evidence = deferred<EvidenceBundle>();
    const orchestrator = new RunOrchestrator({
      adapterFactory: () => liveAdapter(evidence.promise, ["character"]),
    });
    orchestrators.push(orchestrator);
    const created = await orchestrator.start(input);
    await vi.advanceTimersByTimeAsync(250);
    const request = (await orchestrator.getEvents(created.runId)).find(
      (event) => event.type === "choice.request",
    );
    if (!request || request.type !== "choice.request") throw new Error("gate unavailable");
    expect(request.axisId).toBe("character");

    evidence.resolve({
      source: "live",
      recordedAt: new Date().toISOString(),
      summary: "Live evidence completed",
      evidenceItems: 3,
    });
    await vi.advanceTimersByTimeAsync(0);
    await expect(orchestrator.handleChoice(created.runId, {
      requestId: request.requestId,
      optionId: "surprising",
      signalId: "live-choice-after-lock",
      signalledAt: new Date().toISOString(),
    })).resolves.toMatchObject({ status: "tooLate", reason: "terminal-run" });
  });

  it("publishes fallback mode before completion when a live adapter changes mode", async () => {
    let mode: "live" | "fallback" = "live";
    const adapter: AgentAdapter = {
      get mode() { return mode; },
      health: async () => ({ ok: true, mode, label: mode === "live" ? "Live Provider" : "Fallback Replay" }),
      analyze: async () => {
        mode = "fallback";
        return {
          domain: "planning",
          taskKind: "plan",
          applicableAxisIds: [],
          publicSummary: "Fallback analysis",
        };
      },
      gather: async () => ({
        source: "fixture",
        recordedAt: new Date().toISOString(),
        summary: "Fallback evidence",
        evidenceItems: 3,
      }),
      synthesize: async () => ({ answer: "Fallback answer" }),
    };
    const orchestrator = new RunOrchestrator({ adapterFactory: () => adapter });
    orchestrators.push(orchestrator);
    const created = await orchestrator.start(input);
    await vi.advanceTimersByTimeAsync(0);

    const events = await orchestrator.getEvents(created.runId);
    expect(events.find((event) => event.type === "run.start"))
      .toMatchObject({ providerMode: "live" });
    const modeEventIndex = events.findIndex((event) => event.type === "provider.mode");
    const completeIndex = events.findIndex((event) => event.type === "run.complete");
    expect(modeEventIndex).toBeGreaterThan(0);
    expect(modeEventIndex).toBeLessThan(completeIndex);
    expect(events[modeEventIndex]).toMatchObject({ providerMode: "fallback", reason: "fallback" });
    expect(events[completeIndex]).toMatchObject({ providerMode: "fallback" });
  });

  it("keeps cancellation terminal when it arrives during synthesis", async () => {
    const synthesis = deferred<{ answer: string }>();
    let synthesisStarted = false;
    const adapter: AgentAdapter = {
      mode: "live",
      health: async () => ({ ok: true, mode: "live", label: "Live Provider" }),
      analyze: async () => ({
        domain: "planning",
        taskKind: "plan",
        applicableAxisIds: [],
        publicSummary: "Immediate analysis",
      }),
      gather: async () => ({
        source: "live",
        recordedAt: new Date().toISOString(),
        summary: "Evidence ready",
        evidenceItems: 2,
      }),
      synthesize: async () => {
        synthesisStarted = true;
        return synthesis.promise;
      },
    };
    const orchestrator = new RunOrchestrator({ adapterFactory: () => adapter });
    orchestrators.push(orchestrator);
    const created = await orchestrator.start(input);
    await vi.advanceTimersByTimeAsync(0);
    expect(synthesisStarted).toBe(true);

    await expect(orchestrator.cancel(created.runId)).resolves.toBe("cancelled");
    synthesis.resolve({ answer: "Late synthesis result" });
    await vi.advanceTimersByTimeAsync(0);

    const snapshot = await orchestrator.getSnapshot(created.runId);
    expect(snapshot?.state).toBe("cancelled");
    expect(snapshot?.publicEvents.some((event) => event.type === "run.complete")).toBe(false);
  });
});
