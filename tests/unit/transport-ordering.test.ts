import { describe, expect, it } from "vitest";

import { shouldAcceptTransportEvent, shouldApplyPollingSnapshot } from "@/components/host/transport-ordering";

describe("host transport ordering", () => {
  it("rejects duplicate, out-of-order, and cross-run events", () => {
    const common = {
      expectedRunId: "run-current",
      eventRunId: "run-current",
      eventId: "event-8",
      eventSequence: 8,
      latestSequence: 7,
      seenEventIds: new Set<string>(),
    };

    expect(shouldAcceptTransportEvent(common)).toBe(true);
    expect(shouldAcceptTransportEvent({ ...common, seenEventIds: new Set(["event-8"]) })).toBe(false);
    expect(shouldAcceptTransportEvent({ ...common, eventSequence: 7 })).toBe(false);
    expect(shouldAcceptTransportEvent({ ...common, eventRunId: "run-stale" })).toBe(false);
  });

  it("never lets a stale or cross-run polling snapshot overwrite newer SSE state", () => {
    const common = {
      expectedRunId: "run-current",
      snapshotRunId: "run-current",
      snapshotSequence: 11,
      latestSequence: 10,
    };

    expect(shouldApplyPollingSnapshot(common)).toBe(true);
    expect(shouldApplyPollingSnapshot({ ...common, snapshotSequence: 10 })).toBe(false);
    expect(shouldApplyPollingSnapshot({ ...common, snapshotSequence: 9 })).toBe(false);
    expect(shouldApplyPollingSnapshot({ ...common, snapshotRunId: "run-stale" })).toBe(false);
  });

  it("suppresses duplicate and late ACK events after a newer sequence", () => {
    const seen = new Set(["ack-event-12"]);
    expect(shouldAcceptTransportEvent({
      expectedRunId: "run-current",
      eventRunId: "run-current",
      eventId: "ack-event-12",
      eventSequence: 12,
      latestSequence: 12,
      seenEventIds: seen,
    })).toBe(false);
    expect(shouldAcceptTransportEvent({
      expectedRunId: "run-current",
      eventRunId: "run-current",
      eventId: "late-ack-event-9",
      eventSequence: 9,
      latestSequence: 12,
      seenEventIds: seen,
    })).toBe(false);
  });
});
