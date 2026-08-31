export function shouldAcceptTransportEvent(input: {
  expectedRunId: string | null;
  eventRunId: string;
  eventId: string;
  eventSequence: number;
  latestSequence: number;
  seenEventIds: ReadonlySet<string>;
}): boolean {
  return input.eventRunId === input.expectedRunId
    && !input.seenEventIds.has(input.eventId)
    && input.eventSequence > input.latestSequence;
}

export function shouldApplyPollingSnapshot(input: {
  expectedRunId: string | null;
  snapshotRunId: string;
  snapshotSequence: number;
  latestSequence: number;
}): boolean {
  return input.snapshotRunId === input.expectedRunId
    && input.snapshotSequence > input.latestSequence;
}
