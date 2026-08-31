import {
  DEFAULT_PREFERENCES,
  PreferenceStateSchema,
  applyTrustedOption,
  type ChoiceAxisId,
  type ChoiceOptionId,
  type PreferenceState,
} from "../../shared/contracts/choices";
import type { ChoiceAckStatus } from "../../shared/contracts/events";

export interface AppliedChoiceRecord {
  requestId: string;
  axisId: ChoiceAxisId;
  selectedOptionId: ChoiceOptionId;
  selectedOptionLabel: string;
  defaultOptionId: ChoiceOptionId;
  signalTimestamp: string;
  ackTimestamp: string;
  ackStatus: ChoiceAckStatus;
  pipelineNode: string;
}

export interface PreferenceReduction {
  state: PreferenceState;
  applied: boolean;
}

/**
 * Pure reducer used after an authoritative ACK. Non-applied ACKs are retained by
 * the event log but can never alter the synthesis preference snapshot.
 */
export function reduceAppliedChoice(
  state: PreferenceState,
  choice: AppliedChoiceRecord,
): PreferenceReduction {
  const current = PreferenceStateSchema.parse(state);
  if (choice.ackStatus !== "appliedNow") {
    return { state: current, applied: false };
  }

  return {
    state: applyTrustedOption(
      current,
      choice.axisId,
      choice.selectedOptionId,
    ),
    applied: true,
  };
}

export class PreferenceReducer {
  private state: PreferenceState;
  private readonly appliedChoices: AppliedChoiceRecord[] = [];

  constructor(initial: PreferenceState = DEFAULT_PREFERENCES) {
    this.state = PreferenceStateSchema.parse(initial);
  }

  apply(choice: AppliedChoiceRecord): PreferenceReduction {
    const reduction = reduceAppliedChoice(this.state, choice);
    this.state = reduction.state;
    if (reduction.applied) {
      this.appliedChoices.push({ ...choice });
    }
    return { state: { ...this.state }, applied: reduction.applied };
  }

  value(): PreferenceState {
    return { ...this.state };
  }

  accepted(): readonly AppliedChoiceRecord[] {
    return this.appliedChoices.map((choice) => ({ ...choice }));
  }
}
