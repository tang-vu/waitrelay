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

function makeRequest(runId: string): ChoiceRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    runId,
    eventId: `${runId}-request-event`,
    sequence: 0,
    timestamp: "2026-08-30T12:00:00.000Z",
    type: "choice.request",
    requestId: `${runId}-request`,
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

function makeSignal(
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
    requestId: `${runId}-request`,
    optionId,
    signalId,
    signalledAt: "2026-08-30T12:00:01.000Z",
  };
}

async function preparedStore(runId: string): Promise<MemoryRunStore> {
  const store = new MemoryRunStore({
    cleanupIntervalMs: 60_000,
    now: () => Date.parse("2026-08-30T12:00:01.000Z"),
  });
  stores.push(store);
  await store.createRun({ runId, context });
  await store.appendPublicEvent(makeRequest(runId));
  return store;
}

describe("controlled choice versus completion races", () => {
  it("resolves at least 100 before-lock and after-lock interleavings honestly", async () => {
    const iterations = 120;
    for (let index = 0; index < iterations; index += 1) {
      const runId = `run-interleaving-${index}`;
      const store = await preparedStore(runId);

      if (index % 2 === 0) {
        const acknowledgement = await store.handleChoiceSignal(makeSignal(runId));
        const snapshot = await store.snapshotPreferences(runId);
        expect(acknowledgement.status).toBe("appliedNow");
        expect(snapshot.mobility).toBe("less-walking");
      } else {
        const snapshot = await store.snapshotPreferences(runId);
        const acknowledgement = await store.handleChoiceSignal(makeSignal(runId));
        expect(snapshot.mobility).toBe("more-discovery");
        expect(acknowledgement).toMatchObject({
          status: "tooLate",
          reason: "decision-locked",
        });
      }

      await store.transitionTerminal(runId, "completed");
      const terminalSnapshot = await store.getRun(runId);
      expect(terminalSnapshot?.state).toBe("completed");
      expect(terminalSnapshot?.preferenceSnapshot?.mobility).toBe(
        index % 2 === 0 ? "less-walking" : "more-discovery",
      );
    }
  });

  it("accepts exactly one of two conflicting signals", async () => {
    for (let index = 0; index < 40; index += 1) {
      const runId = `run-conflicting-race-${index}`;
      const store = await preparedStore(runId);
      const lessWalking = makeSignal(runId, "less-walking", `${runId}-less`);
      const moreDiscovery = makeSignal(
        runId,
        "more-discovery",
        `${runId}-discovery`,
      );
      const ordered = index % 2 === 0
        ? [lessWalking, moreDiscovery]
        : [moreDiscovery, lessWalking];

      const results = await Promise.all(
        ordered.map((choiceSignal) => store.handleChoiceSignal(choiceSignal)),
      );
      expect(results.filter((result) => result.status === "appliedNow")).toHaveLength(1);
      expect(
        results.filter(
          (result) =>
            result.status === "rejected" && result.reason === "conflicting-signal",
        ),
      ).toHaveLength(1);
      expect((await store.getRun(runId))?.acceptedChoices).toHaveLength(1);
    }
  });

  it("keeps the first terminal outcome across cancel and complete races", async () => {
    for (let index = 0; index < 40; index += 1) {
      const runId = `run-terminal-race-${index}`;
      const store = await preparedStore(runId);
      const order = index % 2 === 0
        ? (["completed", "cancelled"] as const)
        : (["cancelled", "completed"] as const);

      const results = await Promise.all(
        order.map((state) => store.transitionTerminal(runId, state)),
      );
      expect(results[0]).toEqual({ changed: true, state: order[0] });
      expect(results[1]).toEqual({ changed: false, state: order[0] });
      expect((await store.getRun(runId))?.state).toBe(order[0]);
    }
  });

  it("returns the original ACK for duplicate signal IDs even after completion", async () => {
    const runId = "run-duplicate-after-completion";
    const store = await preparedStore(runId);
    const choiceSignal = makeSignal(runId);
    const first = await store.handleChoiceSignal(choiceSignal);
    await store.snapshotPreferences(runId);
    await store.transitionTerminal(runId, "completed");
    const replay = await store.handleChoiceSignal(choiceSignal);

    expect(first).toMatchObject({ status: "appliedNow", duplicate: false });
    expect(replay).toMatchObject({ status: "appliedNow", duplicate: true });
    expect((await store.getRun(runId))?.acceptedChoices).toHaveLength(1);
  });

  it("resolves 100 direct signal-versus-completion interleavings monotonically", async () => {
    for (let index = 0; index < 100; index += 1) {
      const runId = `run-signal-complete-${index}`;
      const store = await preparedStore(runId);

      if (index % 2 === 0) {
        const acknowledgement = await store.handleChoiceSignal(makeSignal(runId));
        const terminal = await store.transitionTerminal(runId, "completed");
        expect(acknowledgement.status).toBe("appliedNow");
        expect(terminal).toEqual({ changed: true, state: "completed" });
      } else {
        const terminal = await store.transitionTerminal(runId, "completed");
        const acknowledgement = await store.handleChoiceSignal(makeSignal(runId));
        expect(terminal).toEqual({ changed: true, state: "completed" });
        expect(acknowledgement).toMatchObject({
          status: "tooLate",
          reason: "terminal-run",
        });
      }

      const snapshot = await store.getRun(runId);
      expect(snapshot?.state).toBe("completed");
      expect(snapshot?.acceptedChoices).toHaveLength(index % 2 === 0 ? 1 : 0);
      await expect(store.transitionTerminal(runId, "cancelled")).resolves.toEqual({
        changed: false,
        state: "completed",
      });
    }
  });
});
