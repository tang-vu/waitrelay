import { describe, expect, it } from "vitest";

import { ImpactReceiptSchema } from "@/shared/contracts/receipts";

const entry = {
  requestId: "request-mobility",
  axisId: "mobility",
  selectedOptionId: "less-walking",
  selectedOptionLabel: "Less Walking",
  defaultOptionId: "more-discovery",
  signalTimestamp: "2026-08-30T12:00:01.000Z",
  ackTimestamp: "2026-08-30T12:00:01.020Z",
  ackStatus: "appliedNow" as const,
  pipelineNode: "venue-ranking",
  beforeState: { walkingWeight: 0.14 },
  afterState: { walkingWeight: 0.42 },
  effectMetrics: [
    {
      metricId: "route-distance",
      label: "Route distance",
      before: 3.8,
      after: 1.4,
      unit: "km",
      material: true,
    },
  ],
  summary: "Route distance changed from 3.8 km to 1.4 km.",
};

function receiptWith(override: Record<string, unknown> = {}) {
  return {
    protocolVersion: "1.0",
    runId: "run-receipt-1",
    generatedAt: "2026-08-30T12:00:08.000Z",
    baselinePlanId: "baseline-plan",
    selectedPlanId: "selected-plan",
    entries: [entry],
    materialChange: true,
    summary: "One accepted choice materially changed the plan.",
    ...override,
  };
}

describe("Impact Receipt contract", () => {
  it("accepts structured before and after evidence", () => {
    expect(ImpactReceiptSchema.parse(receiptWith()).entries[0]).toEqual(entry);
  });

  it.each(["tooLate", "rejected", "savedNext"])(
    "forbids %s choices from appearing as applied effects",
    (ackStatus) => {
      expect(
        ImpactReceiptSchema.safeParse(
          receiptWith({ entries: [{ ...entry, ackStatus }] }),
        ).success,
      ).toBe(false);
    },
  );

  it("rejects invented rich objects as effect metric values", () => {
    expect(
      ImpactReceiptSchema.safeParse(
        receiptWith({
          entries: [
            {
              ...entry,
              beforeState: { hiddenReasoning: { explanation: "private" } },
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });
});
