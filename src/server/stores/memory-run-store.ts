import {
  DEFAULT_PREFERENCES,
  PreferenceStateSchema,
  applyTrustedOption,
  resolveChoiceAxis,
  resolveChoiceOption,
  type PreferenceState,
} from "../../shared/contracts/choices";
import {
  ChoiceSignalSchema,
  PublicEventSchema,
  type ChoiceRequest,
  type ChoiceSignal,
  type PublicEvent,
} from "../../shared/contracts/events";
import {
  ContextCapsuleSchema,
  type ContextCapsule,
} from "../../shared/contracts/context-capsule";
import { RunCapacityError } from "./run-store";
import type {
  AcceptedChoiceState,
  AppendEventResult,
  ChoiceHandlingResult,
  CreateRunInput,
  RunSnapshot,
  RunStore,
  RunTerminalState,
  TerminalTransitionResult,
} from "./run-store";

interface InternalRun {
  runId: string;
  context: ContextCapsule;
  state: RunTerminalState;
  createdAt: string;
  updatedAt: string;
  lastSequence: number;
  events: PublicEvent[];
  eventIds: Set<string>;
  requests: Map<string, ChoiceRequest>;
  signalResults: Map<string, ChoiceHandlingResult>;
  acceptedByRequest: Map<string, AcceptedChoiceState>;
  preferences: PreferenceState;
  preferenceSnapshot?: PreferenceState;
  synthesisLockedAt?: string;
  terminalEventLogged: boolean;
  abortController: AbortController;
}

export interface MemoryRunStoreOptions {
  ttlMs?: number;
  cleanupIntervalMs?: number;
  maxRuns?: number;
  maxActiveRuns?: number;
  maxEventsPerRun?: number;
  now?: () => number;
}

function timestampFrom(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

function eventTerminalState(event: PublicEvent): RunTerminalState | undefined {
  if (event.type === "run.complete") return "completed";
  if (event.type === "run.cancel.ack" && event.status === "cancelled") {
    return "cancelled";
  }
  if (event.type === "run.error" && !event.recoverable) return "failed";
  return undefined;
}

function cloneChoiceResult(
  result: ChoiceHandlingResult,
  duplicate: boolean,
): ChoiceHandlingResult {
  return {
    ...result,
    duplicate,
    ...(result.preferenceState
      ? { preferenceState: { ...result.preferenceState } }
      : {}),
  };
}

export class MemoryRunStore implements RunStore {
  private readonly runs = new Map<string, InternalRun>();
  private readonly ttlMs: number;
  private readonly maxRuns: number;
  private readonly maxActiveRuns: number;
  private readonly maxEventsPerRun: number;
  private readonly now: () => number;
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor(options: MemoryRunStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? 30 * 60 * 1_000;
    this.maxRuns = options.maxRuns ?? 512;
    this.maxActiveRuns = options.maxActiveRuns ?? 64;
    this.maxEventsPerRun = options.maxEventsPerRun ?? 128;
    if (this.maxRuns < 1 || this.maxActiveRuns < 1 || this.maxEventsPerRun < 16) {
      throw new Error("MemoryRunStore capacity limits are invalid");
    }
    this.now = options.now ?? Date.now;
    const intervalMs =
      options.cleanupIntervalMs ?? Math.min(this.ttlMs, 60_000);
    this.cleanupTimer = setInterval(
      () => this.cleanupExpired(),
      Math.max(100, intervalMs),
    );
    const timerWithUnref = this.cleanupTimer as unknown as {
      unref?: () => void;
    };
    timerWithUnref.unref?.();
  }

  async createRun(input: CreateRunInput): Promise<RunSnapshot> {
    this.cleanupExpired();
    if (this.runs.has(input.runId)) {
      throw new Error("A run with this ID already exists");
    }
    if (!input.runId || input.runId.length > 128) {
      throw new Error("Invalid run ID");
    }
    const activeRuns = [...this.runs.values()].filter((run) => run.state === "active").length;
    if (activeRuns >= this.maxActiveRuns) {
      throw new RunCapacityError("Too many active runs");
    }
    while (this.runs.size >= this.maxRuns && this.evictOldestTerminal()) {
      // Prefer bounded early cleanup over rejecting a new run.
    }
    if (this.runs.size >= this.maxRuns) {
      throw new RunCapacityError("The retained run limit was reached");
    }

    const context = ContextCapsuleSchema.parse(input.context);
    const preferences = PreferenceStateSchema.parse(
      input.initialPreferences ?? DEFAULT_PREFERENCES,
    );
    const createdAt = input.createdAt ?? timestampFrom(this.now());
    if (!Number.isFinite(new Date(createdAt).getTime())) {
      throw new Error("Invalid run creation timestamp");
    }
    const run: InternalRun = {
      runId: input.runId,
      context,
      state: "active",
      createdAt,
      updatedAt: createdAt,
      lastSequence: -1,
      events: [],
      eventIds: new Set(),
      requests: new Map(),
      signalResults: new Map(),
      acceptedByRequest: new Map(),
      preferences,
      terminalEventLogged: false,
      abortController: new AbortController(),
    };
    this.runs.set(input.runId, run);
    return this.toSnapshot(run);
  }

  async getRun(runId: string): Promise<RunSnapshot | undefined> {
    this.cleanupExpired();
    const run = this.runs.get(runId);
    return run ? this.toSnapshot(run) : undefined;
  }

  async appendPublicEvent(eventInput: PublicEvent): Promise<AppendEventResult> {
    this.cleanupExpired();
    const event = PublicEventSchema.parse(eventInput);
    const run = this.runs.get(event.runId);
    if (!run) return { status: "stale-run" };
    if (run.eventIds.has(event.eventId)) {
      return { status: "duplicate", snapshot: this.toSnapshot(run) };
    }
    if (event.sequence <= run.lastSequence) {
      return { status: "stale", snapshot: this.toSnapshot(run) };
    }
    if (run.events.length >= this.maxEventsPerRun) {
      return { status: "capacity", snapshot: this.toSnapshot(run) };
    }

    const nextTerminalState = eventTerminalState(event);
    if (run.state !== "active") {
      if (
        !nextTerminalState ||
        nextTerminalState !== run.state ||
        run.terminalEventLogged
      ) {
        return { status: "terminal", snapshot: this.toSnapshot(run) };
      }
    }

    run.events.push(event);
    run.eventIds.add(event.eventId);
    run.lastSequence = event.sequence;
    run.updatedAt = event.timestamp;
    if (event.type === "choice.request") {
      run.requests.set(event.requestId, event);
    }
    if (nextTerminalState) {
      run.state = nextTerminalState;
      run.terminalEventLogged = true;
      run.abortController.abort(nextTerminalState);
    }
    return { status: "appended", snapshot: this.toSnapshot(run) };
  }

  async getPublicEvents(
    runId: string,
    afterSequence = -1,
  ): Promise<PublicEvent[]> {
    this.cleanupExpired();
    const run = this.runs.get(runId);
    if (!run) return [];
    return run.events
      .filter((event) => event.sequence > afterSequence)
      .map((event) => PublicEventSchema.parse(event));
  }

  async handleChoiceSignal(
    signalInput: ChoiceSignal,
  ): Promise<ChoiceHandlingResult> {
    this.cleanupExpired();
    const signal = ChoiceSignalSchema.parse(signalInput);
    const acknowledgedAt = timestampFrom(this.now());
    const run = this.runs.get(signal.runId);
    if (!run) {
      return {
        runId: signal.runId,
        requestId: signal.requestId,
        optionId: signal.optionId,
        signalId: signal.signalId,
        status: "rejected",
        reason: "stale-run",
        acknowledgedAt,
        duplicate: false,
      };
    }

    const previous = run.signalResults.get(signal.signalId);
    if (previous) {
      if (previous.requestId === signal.requestId && previous.optionId === signal.optionId) {
        return cloneChoiceResult(previous, true);
      }
      return {
        runId: signal.runId,
        requestId: signal.requestId,
        optionId: signal.optionId,
        signalId: signal.signalId,
        status: "rejected",
        reason: "conflicting-signal",
        acknowledgedAt,
        duplicate: true,
      };
    }

    // Preserve one slot for the terminal event. Rejected overload signals are
    // returned directly by the API and never mutate preferences or the log.
    if (run.events.length + 2 > this.maxEventsPerRun - 1) {
      return {
        runId: signal.runId,
        requestId: signal.requestId,
        optionId: signal.optionId,
        signalId: signal.signalId,
        status: "rejected",
        reason: "run-capacity",
        acknowledgedAt,
        duplicate: false,
      };
    }

    let result: ChoiceHandlingResult;
    const common = {
      runId: signal.runId,
      requestId: signal.requestId,
      optionId: signal.optionId,
      signalId: signal.signalId,
      acknowledgedAt,
      duplicate: false,
    } as const;
    const request = run.requests.get(signal.requestId);

    if (run.state !== "active") {
      result = { ...common, status: "tooLate", reason: "terminal-run" };
    } else if (run.preferenceSnapshot) {
      result = { ...common, status: "tooLate", reason: "decision-locked" };
    } else if (!request) {
      result = { ...common, status: "rejected", reason: "unknown-request" };
    } else if (
      request.expiresAt &&
      this.now() > new Date(request.expiresAt).getTime()
    ) {
      result = { ...common, status: "tooLate", reason: "expired" };
    } else {
      const definition = resolveChoiceAxis(request.axisId);
      const selected = resolveChoiceOption(signal.optionId);
      const resolvedDefault = resolveChoiceOption(request.defaultOptionId);
      const optionIsOnRequest = request.options.some(
        (option) => option.optionId === signal.optionId,
      );
      const requestOptionIds = new Set(
        request.options.map((option) => option.optionId),
      );
      const requestMatchesDefinition = definition?.options.every((option) =>
        requestOptionIds.has(option.optionId),
      );
      const valid =
        definition &&
        selected &&
        selected.definition.axisId === definition.axisId &&
        resolvedDefault &&
        resolvedDefault.definition.axisId === definition.axisId &&
        optionIsOnRequest &&
        requestMatchesDefinition;
      const accepted = run.acceptedByRequest.get(request.requestId);

      if (!valid) {
        result = { ...common, status: "rejected", reason: "invalid-option" };
      } else if (accepted) {
        result = {
          ...common,
          status: "rejected",
          reason: "conflicting-signal",
        };
      } else {
        const preferences = applyTrustedOption(
          run.preferences,
          request.axisId,
          signal.optionId,
        );
        const acceptedChoice: AcceptedChoiceState = {
          requestId: request.requestId,
          axisId: definition.axisId,
          optionId: selected.option.optionId,
          defaultOptionId: resolvedDefault.option.optionId,
          signalId: signal.signalId,
          signalledAt: signal.signalledAt,
          acknowledgedAt,
          decisionPoint: request.decisionPoint,
        };
        run.preferences = preferences;
        run.acceptedByRequest.set(request.requestId, acceptedChoice);
        run.updatedAt = acknowledgedAt;
        result = {
          ...common,
          status: "appliedNow",
          reason: "accepted",
          preferenceState: { ...preferences },
        };
      }
    }

    run.signalResults.set(signal.signalId, result);
    return cloneChoiceResult(result, false);
  }

  async snapshotPreferences(
    runId: string,
    lockedAt = timestampFrom(this.now()),
  ): Promise<PreferenceState> {
    this.cleanupExpired();
    const run = this.runs.get(runId);
    if (!run) throw new Error("Unknown or stale run ID");
    if (!run.preferenceSnapshot) {
      run.preferenceSnapshot = PreferenceStateSchema.parse(run.preferences);
      run.synthesisLockedAt = lockedAt;
      run.updatedAt = lockedAt;
    }
    return { ...run.preferenceSnapshot };
  }

  async transitionTerminal(
    runId: string,
    state: Exclude<RunTerminalState, "active">,
  ): Promise<TerminalTransitionResult> {
    this.cleanupExpired();
    const run = this.runs.get(runId);
    if (!run) return { changed: false, state };
    if (run.state !== "active") {
      return { changed: false, state: run.state };
    }
    run.state = state;
    run.updatedAt = timestampFrom(this.now());
    run.abortController.abort(state);
    return { changed: true, state };
  }

  getAbortSignal(runId: string): AbortSignal | undefined {
    return this.runs.get(runId)?.abortController.signal;
  }

  cleanupExpired(): number {
    const cutoff = this.now() - this.ttlMs;
    let removed = 0;
    for (const [runId, run] of this.runs) {
      if (new Date(run.updatedAt).getTime() > cutoff) continue;
      if (run.state === "active") continue;
      if (!run.abortController.signal.aborted) {
        run.abortController.abort("ttl-expired");
      }
      this.runs.delete(runId);
      removed += 1;
    }
    return removed;
  }

  private evictOldestTerminal(): boolean {
    const candidate = [...this.runs.values()]
      .filter((run) => run.state !== "active")
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))[0];
    if (!candidate) return false;
    if (!candidate.abortController.signal.aborted) {
      candidate.abortController.abort("capacity-evicted");
    }
    return this.runs.delete(candidate.runId);
  }

  dispose(): void {
    clearInterval(this.cleanupTimer);
    for (const run of this.runs.values()) {
      if (!run.abortController.signal.aborted) {
        run.abortController.abort("store-disposed");
      }
    }
    this.runs.clear();
  }

  private toSnapshot(run: InternalRun): RunSnapshot {
    return {
      runId: run.runId,
      context: { ...run.context },
      state: run.state,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      lastSequence: run.lastSequence,
      publicEvents: run.events.map((event) => PublicEventSchema.parse(event)),
      preferences: { ...run.preferences },
      ...(run.preferenceSnapshot
        ? { preferenceSnapshot: { ...run.preferenceSnapshot } }
        : {}),
      ...(run.synthesisLockedAt
        ? { synthesisLockedAt: run.synthesisLockedAt }
        : {}),
      acceptedChoices: [...run.acceptedByRequest.values()].map((choice) => ({
        ...choice,
      })),
    };
  }
}
