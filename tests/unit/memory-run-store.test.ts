import { afterEach, describe, expect, it } from "vitest";

import { MemoryRunStore } from "@/server/stores/memory-run-store";
import { PROTOCOL_VERSION, type ChoiceRequest, type ChoiceSignal } from "@/shared/contracts/events";

const stores: MemoryRunStore[] = [];

afterEach(() => {
  for (const store of stores.splice(0)) store.dispose();
});

const context = {
  domain: "planning" as const,
  taskKind: "plan" as const,
  locale: "en" as const,
  risk: "low" as const,
  waitBand: "medium" as const,
  interactionMode: "active" as const,
  difficulty: "normal" as const,
};

function makeStore(now = Date.parse("2026-08-30T12:00:01.000Z")) {
  const store = new MemoryRunStore({ now: () => now, cleanupIntervalMs: 60_000 });
  stores.push(store);
  return store;
}

function request(runId: string, sequence = 0): ChoiceRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    runId,
    eventId: `${runId}-request-event`,
    sequence,
    timestamp: "2026-08-30T12:00:00.000Z",
    type: "choice.request",
    requestId: `${runId}-mobility`,
    axisId: "mobility",
    options: [
      { optionId: "less-walking", label: "Less Walking" },
      { optionId: "more-discovery", label: "More Discovery" },
    ],
    defaultOptionId: "more-discovery",
    decisionPoint: "venue-ranking",
    effectCategory: "route-and-discovery",
  };
}

function signal(
  runId: string,
  optionId = "less-walking",
  signalId = `${runId}-signal`,
): ChoiceSignal {
  return {
    protocolVersion: PROTOCOL_VERSION,
    runId,
    eventId: `${signalId}-event`,
    sequence: 1,
    timestamp: "2026-08-30T12:00:01.000Z",
    type: "choice.signal",
    requestId: `${runId}-mobility`,
    optionId,
    signalId,
    signalledAt: "2026-08-30T12:00:01.000Z",
  };
}

describe("MemoryRunStore invariants", () => {
  it("suppresses duplicate event IDs and stale sequences", async () => {
    const store = makeStore();
    await store.createRun({ runId: "run-events", context });
    const choiceRequest = request("run-events", 2);

    expect((await store.appendPublicEvent(choiceRequest)).status).toBe("appended");
    expect((await store.appendPublicEvent(choiceRequest)).status).toBe("duplicate");
    expect(
      (
        await store.appendPublicEvent({
          protocolVersion: PROTOCOL_VERSION,
          runId: "run-events",
          eventId: "stale-progress",
          sequence: 1,
          timestamp: "2026-08-30T12:00:01.000Z",
          type: "run.progress",
          stage: "gathering",
        })
      ).status,
    ).toBe("stale");
    expect((await store.getRun("run-events"))?.lastSequence).toBe(2);
  });

  it("replays only events newer than a Last-Event-ID cursor", async () => {
    const store = makeStore();
    await store.createRun({ runId: "run-replay", context });
    await store.appendPublicEvent(request("run-replay", 0));
    await store.appendPublicEvent({
      protocolVersion: PROTOCOL_VERSION,
      runId: "run-replay",
      eventId: "run-replay-progress-1",
      sequence: 1,
      timestamp: "2026-08-30T12:00:01.000Z",
      type: "run.progress",
      stage: "gathering",
    });
    await store.appendPublicEvent({
      protocolVersion: PROTOCOL_VERSION,
      runId: "run-replay",
      eventId: "run-replay-progress-2",
      sequence: 2,
      timestamp: "2026-08-30T12:00:02.000Z",
      type: "run.progress",
      stage: "evaluating",
    });

    await expect(store.getPublicEvents("run-replay", 0)).resolves.toEqual([
      expect.objectContaining({ eventId: "run-replay-progress-1", sequence: 1 }),
      expect.objectContaining({ eventId: "run-replay-progress-2", sequence: 2 }),
    ]);
  });

  it("handles a signal idempotently", async () => {
    const store = makeStore();
    await store.createRun({ runId: "run-idempotent", context });
    await store.appendPublicEvent(request("run-idempotent"));

    const first = await store.handleChoiceSignal(signal("run-idempotent"));
    const duplicate = await store.handleChoiceSignal(signal("run-idempotent"));

    expect(first).toMatchObject({
      status: "appliedNow",
      reason: "accepted",
      duplicate: false,
      preferenceState: { mobility: "less-walking", character: "reliable" },
    });
    expect(duplicate).toMatchObject({
      status: "appliedNow",
      reason: "accepted",
      duplicate: true,
    });
    expect((await store.getRun("run-idempotent"))?.acceptedChoices).toHaveLength(1);
  });

  it("does not replay an applied ACK when a signal ID is reused for different input", async () => {
    const store = makeStore();
    await store.createRun({ runId: "run-reused-id", context });
    await store.appendPublicEvent(request("run-reused-id"));

    const first = await store.handleChoiceSignal(
      signal("run-reused-id", "less-walking", "shared-signal-id"),
    );
    const mismatched = await store.handleChoiceSignal(
      signal("run-reused-id", "more-discovery", "shared-signal-id"),
    );

    expect(first).toMatchObject({ status: "appliedNow", duplicate: false });
    expect(mismatched).toMatchObject({
      requestId: "run-reused-id-mobility",
      optionId: "more-discovery",
      signalId: "shared-signal-id",
      status: "rejected",
      reason: "conflicting-signal",
      duplicate: true,
    });
    expect((await store.getRun("run-reused-id"))?.acceptedChoices).toHaveLength(1);
  });

  it("rejects conflicting and arbitrary option signals", async () => {
    const store = makeStore();
    await store.createRun({ runId: "run-conflict", context });
    await store.appendPublicEvent(request("run-conflict"));

    expect((await store.handleChoiceSignal(signal("run-conflict"))).status).toBe(
      "appliedNow",
    );
    expect(
      await store.handleChoiceSignal(
        signal("run-conflict", "more-discovery", "conflicting-signal"),
      ),
    ).toMatchObject({ status: "rejected", reason: "conflicting-signal" });

    const other = makeStore();
    await other.createRun({ runId: "run-invalid", context });
    await other.appendPublicEvent(request("run-invalid"));
    expect(
      await other.handleChoiceSignal(
        signal("run-invalid", "surprising", "wrong-axis-signal"),
      ),
    ).toMatchObject({ status: "rejected", reason: "invalid-option" });
  });

  it("locks an immutable preference snapshot and rejects later choices", async () => {
    const store = makeStore();
    await store.createRun({ runId: "run-lock", context });
    await store.appendPublicEvent(request("run-lock"));

    const snapshot = await store.snapshotPreferences("run-lock");
    const late = await store.handleChoiceSignal(signal("run-lock"));
    snapshot.mobility = "less-walking";

    expect(late).toMatchObject({ status: "tooLate", reason: "decision-locked" });
    expect((await store.getRun("run-lock"))?.preferenceSnapshot?.mobility).toBe(
      "more-discovery",
    );
    expect((await store.getRun("run-lock"))?.acceptedChoices).toEqual([]);
  });

  it("makes terminal transitions monotonic and aborts active work", async () => {
    const store = makeStore();
    await store.createRun({ runId: "run-terminal", context });
    const abortSignal = store.getAbortSignal("run-terminal");

    expect(await store.transitionTerminal("run-terminal", "completed")).toEqual({
      changed: true,
      state: "completed",
    });
    expect(abortSignal?.aborted).toBe(true);
    expect(await store.transitionTerminal("run-terminal", "cancelled")).toEqual({
      changed: false,
      state: "completed",
    });
    expect((await store.getRun("run-terminal"))?.state).toBe("completed");
  });

  it("cannot accept a new game signal after completion", async () => {
    const store = makeStore();
    await store.createRun({ runId: "run-choice-after-terminal", context });
    await store.appendPublicEvent(request("run-choice-after-terminal"));
    await store.transitionTerminal("run-choice-after-terminal", "completed");

    expect(
      await store.handleChoiceSignal(signal("run-choice-after-terminal")),
    ).toMatchObject({ status: "tooLate", reason: "terminal-run" });
    expect((await store.getRun("run-choice-after-terminal"))?.acceptedChoices).toEqual(
      [],
    );
  });

  it("rejects later public events once a terminal event is logged", async () => {
    const store = makeStore();
    await store.createRun({ runId: "run-terminal-event", context });
    await store.appendPublicEvent(request("run-terminal-event", 0));
    expect(
      (
        await store.appendPublicEvent({
          protocolVersion: PROTOCOL_VERSION,
          runId: "run-terminal-event",
          eventId: "complete-event",
          sequence: 1,
          timestamp: "2026-08-30T12:00:01.000Z",
          type: "run.complete",
          finalAnswer: "The answer",
          structuredResult: {},
          impactReceipt: {},
          providerMode: "demo",
        })
      ).status,
    ).toBe("appended");
    expect(
      (
        await store.appendPublicEvent({
          protocolVersion: PROTOCOL_VERSION,
          runId: "run-terminal-event",
          eventId: "late-progress",
          sequence: 2,
          timestamp: "2026-08-30T12:00:02.000Z",
          type: "run.progress",
          stage: "verifying",
        })
      ).status,
    ).toBe("terminal");
    expect((await store.getRun("run-terminal-event"))?.lastSequence).toBe(1);
  });

  it("returns a stale-run rejection without creating state", async () => {
    const store = makeStore();
    expect(await store.handleChoiceSignal(signal("missing-run"))).toMatchObject({
      status: "rejected",
      reason: "stale-run",
    });
    expect(await store.getRun("missing-run")).toBeUndefined();
  });

  it("preserves active runs past the retention TTL", async () => {
    let now = Date.parse("2026-08-30T12:00:00.000Z");
    const store = new MemoryRunStore({
      ttlMs: 1_000,
      cleanupIntervalMs: 60_000,
      now: () => now,
    });
    stores.push(store);
    await store.createRun({ runId: "run-expiring", context });
    const abortSignal = store.getAbortSignal("run-expiring");
    now += 1_001;

    expect(store.cleanupExpired()).toBe(0);
    expect(abortSignal?.aborted).toBe(false);
    expect(await store.getRun("run-expiring")).toBeDefined();
  });

  it("cleans terminal runs after the retention TTL", async () => {
    let now = Date.parse("2026-08-30T12:00:00.000Z");
    const store = new MemoryRunStore({
      ttlMs: 1_000,
      cleanupIntervalMs: 60_000,
      now: () => now,
    });
    stores.push(store);
    await store.createRun({ runId: "run-expiring-terminal", context });
    const abortSignal = store.getAbortSignal("run-expiring-terminal");
    await store.transitionTerminal("run-expiring-terminal", "completed");
    now += 1_001;

    expect(store.cleanupExpired()).toBe(1);
    expect(abortSignal?.aborted).toBe(true);
    expect(await store.getRun("run-expiring-terminal")).toBeUndefined();
  });
});
