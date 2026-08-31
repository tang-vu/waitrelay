import type { ContextCapsule } from "../../shared/contracts/context-capsule";
import type {
  ChoiceRequest,
  ChoiceSignal,
  PublicEvent,
} from "../../shared/contracts/events";
import type {
  ChoiceAckStatus,
  ChoiceAxisId,
  ChoiceOptionId,
  PreferenceState,
} from "../../shared/contracts/choices";

export type RunTerminalState = "active" | "completed" | "cancelled" | "failed";

export interface CreateRunInput {
  runId: string;
  context: ContextCapsule;
  initialPreferences?: PreferenceState;
  createdAt?: string;
}

export interface AcceptedChoiceState {
  requestId: string;
  axisId: ChoiceAxisId;
  optionId: ChoiceOptionId;
  defaultOptionId: ChoiceOptionId;
  signalId: string;
  signalledAt: string;
  acknowledgedAt: string;
  decisionPoint: string;
}

export interface ChoiceHandlingResult {
  runId: string;
  requestId: string;
  optionId: string;
  signalId: string;
  status: ChoiceAckStatus;
  reason:
    | "accepted"
    | "decision-locked"
    | "expired"
    | "invalid-option"
    | "unknown-request"
    | "conflicting-signal"
    | "terminal-run"
    | "stale-run"
    | "run-capacity";
  acknowledgedAt: string;
  duplicate: boolean;
  preferenceState?: PreferenceState;
}

export interface RunSnapshot {
  runId: string;
  context: ContextCapsule;
  state: RunTerminalState;
  createdAt: string;
  updatedAt: string;
  lastSequence: number;
  publicEvents: readonly PublicEvent[];
  preferences: PreferenceState;
  preferenceSnapshot?: PreferenceState;
  synthesisLockedAt?: string;
  acceptedChoices: readonly AcceptedChoiceState[];
}

export interface AppendEventResult {
  status: "appended" | "duplicate" | "stale" | "terminal" | "stale-run" | "capacity";
  snapshot?: RunSnapshot;
}

export interface TerminalTransitionResult {
  changed: boolean;
  state: RunTerminalState;
}

export interface RunStore {
  createRun(input: CreateRunInput): Promise<RunSnapshot>;
  getRun(runId: string): Promise<RunSnapshot | undefined>;
  appendPublicEvent(event: PublicEvent): Promise<AppendEventResult>;
  getPublicEvents(runId: string, afterSequence?: number): Promise<PublicEvent[]>;
  handleChoiceSignal(signal: ChoiceSignal): Promise<ChoiceHandlingResult>;
  snapshotPreferences(runId: string, lockedAt?: string): Promise<PreferenceState>;
  transitionTerminal(
    runId: string,
    state: Exclude<RunTerminalState, "active">,
  ): Promise<TerminalTransitionResult>;
  getAbortSignal(runId: string): AbortSignal | undefined;
  cleanupExpired(): number;
  dispose(): void;
}

export type StoredChoiceRequest = ChoiceRequest;

export class RunCapacityError extends Error {
  readonly code = "run-capacity";

  constructor(message = "The run service is at capacity") {
    super(message);
    this.name = "RunCapacityError";
  }
}
