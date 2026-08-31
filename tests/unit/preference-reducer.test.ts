import { describe, expect, it } from "vitest";

import {
  PreferenceReducer,
  reduceAppliedChoice,
  type AppliedChoiceRecord,
} from "@/server/orchestrator/preference-reducer";
import { DEFAULT_PREFERENCES } from "@/shared/contracts/choices";

const appliedChoice: AppliedChoiceRecord = {
  requestId: "request-mobility",
  axisId: "mobility",
  selectedOptionId: "less-walking",
  selectedOptionLabel: "Less Walking",
  defaultOptionId: "more-discovery",
  signalTimestamp: "2026-08-30T12:00:01.000Z",
  ackTimestamp: "2026-08-30T12:00:01.010Z",
  ackStatus: "appliedNow",
  pipelineNode: "venue-ranking",
};

describe("authoritative preference reducer", () => {
  it("changes state only for appliedNow", () => {
    expect(reduceAppliedChoice(DEFAULT_PREFERENCES, appliedChoice)).toEqual({
      state: { mobility: "less-walking", character: "reliable" },
      applied: true,
    });

    for (const ackStatus of ["tooLate", "rejected", "savedNext"] as const) {
      expect(
        reduceAppliedChoice(DEFAULT_PREFERENCES, { ...appliedChoice, ackStatus }),
      ).toEqual({ state: DEFAULT_PREFERENCES, applied: false });
    }
  });

  it("does not expose mutable internal state or records", () => {
    const reducer = new PreferenceReducer();
    reducer.apply(appliedChoice);

    const value = reducer.value();
    value.mobility = "more-discovery";
    const records = reducer.accepted() as AppliedChoiceRecord[];
    records[0]!.selectedOptionLabel = "tampered";

    expect(reducer.value().mobility).toBe("less-walking");
    expect(reducer.accepted()[0]?.selectedOptionLabel).toBe("Less Walking");
  });

  it("rejects an option that does not belong to the asserted axis", () => {
    expect(() =>
      reduceAppliedChoice(DEFAULT_PREFERENCES, {
        ...appliedChoice,
        selectedOptionId: "surprising",
      }),
    ).toThrow("Invalid option");
  });
});
