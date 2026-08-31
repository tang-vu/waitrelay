import { describe, expect, it } from "vitest";

import { baselineTokyoPlan, buildTokyoPlan } from "../../demo/tokyo-scenario";
import { buildImpactReceipt } from "@/server/orchestrator/impact-builder";
import type { AppliedChoiceRecord } from "@/server/orchestrator/preference-reducer";

const mobilityChoice: AppliedChoiceRecord = {
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

describe("computed Impact Receipt", () => {
  it("derives every metric from authoritative plans", () => {
    const baseline = baselineTokyoPlan();
    const selected = buildTokyoPlan({
      mobility: "less-walking",
      character: "reliable",
    });
    const receipt = buildImpactReceipt({
      runId: "run-impact-1",
      baseline,
      selected,
      acceptedChoices: [mobilityChoice],
      generatedAt: "2026-08-30T12:00:08.000Z",
    });

    const entry = receipt.entries[0];
    expect(entry?.ackStatus).toBe("appliedNow");
    expect(entry?.beforeState.walkingWeight).toBe(
      baseline.rankingWeights.walkingWeight,
    );
    expect(entry?.afterState.walkingWeight).toBe(
      selected.rankingWeights.walkingWeight,
    );
    expect(entry?.effectMetrics).toContainEqual({
      metricId: "route-distance",
      label: "Approximate route distance",
      before: baseline.routeDistanceKm,
      after: selected.routeDistanceKm,
      unit: "km",
      material: baseline.routeDistanceKm !== selected.routeDistanceKm,
    });
    expect(entry?.summary).toContain(`${baseline.routeDistanceKm} km`);
    expect(entry?.summary).toContain(`${selected.routeDistanceKm} km`);
    expect(receipt.materialChange).toBe(true);
  });

  it("cannot report late or rejected choices as applied", () => {
    const baseline = baselineTokyoPlan();
    const selected = buildTokyoPlan({
      mobility: "less-walking",
      character: "reliable",
    });

    for (const ackStatus of ["tooLate", "rejected", "savedNext"] as const) {
      const receipt = buildImpactReceipt({
        runId: `run-impact-${ackStatus}`,
        baseline,
        selected,
        acceptedChoices: [{ ...mobilityChoice, ackStatus }],
        generatedAt: "2026-08-30T12:00:08.000Z",
      });
      expect(receipt.entries).toEqual([]);
      expect(receipt.materialChange).toBe(false);
      expect(receipt.summary).toContain("No choices were applied");
    }
  });

  it("honestly reports an applied preference with no material plan effect", () => {
    const baseline = baselineTokyoPlan();
    const receipt = buildImpactReceipt({
      runId: "run-impact-no-change",
      baseline,
      selected: baseline,
      acceptedChoices: [
        {
          ...mobilityChoice,
          selectedOptionId: "more-discovery",
          selectedOptionLabel: "More Discovery",
        },
      ],
      generatedAt: "2026-08-30T12:00:08.000Z",
    });

    expect(receipt.entries).toHaveLength(1);
    expect(receipt.materialChange).toBe(false);
    expect(receipt.entries[0]?.summary).toContain("no material plan change");
  });

  it("builds the mood receipt from novelty and confidence data", () => {
    const baseline = baselineTokyoPlan();
    const selected = buildTokyoPlan({
      mobility: "more-discovery",
      character: "surprising",
    });
    const receipt = buildImpactReceipt({
      runId: "run-impact-mood",
      baseline,
      selected,
      acceptedChoices: [
        {
          ...mobilityChoice,
          requestId: "request-character",
          axisId: "character",
          selectedOptionId: "surprising",
          selectedOptionLabel: "Surprising",
          defaultOptionId: "reliable",
          pipelineNode: "evidence-threshold",
        },
      ],
      generatedAt: "2026-08-30T12:00:08.000Z",
    });

    expect(receipt.entries[0]?.effectMetrics).toContainEqual(
      expect.objectContaining({
        metricId: "confidence-threshold",
        before: baseline.rankingWeights.minimumConfidence,
        after: selected.rankingWeights.minimumConfidence,
      }),
    );
    expect(receipt.entries[0]?.effectMetrics).toContainEqual(
      expect.objectContaining({
        metricId: "average-novelty",
        before: baseline.averageNovelty,
        after: selected.averageNovelty,
      }),
    );
  });

  it("attributes two accepted choices to their own sequential plan changes", () => {
    const baseline = baselineTokyoPlan();
    const afterMobility = buildTokyoPlan({
      mobility: "less-walking",
      character: "reliable",
    });
    const selected = buildTokyoPlan({
      mobility: "less-walking",
      character: "surprising",
    });
    const characterChoice: AppliedChoiceRecord = {
      ...mobilityChoice,
      requestId: "request-character",
      axisId: "character",
      selectedOptionId: "surprising",
      selectedOptionLabel: "Surprising",
      defaultOptionId: "reliable",
      signalTimestamp: "2026-08-30T12:00:02.000Z",
      ackTimestamp: "2026-08-30T12:00:02.010Z",
      pipelineNode: "evidence-threshold",
    };

    const receipt = buildImpactReceipt({
      runId: "run-impact-two-choices",
      baseline,
      selected,
      acceptedChoices: [mobilityChoice, characterChoice],
      generatedAt: "2026-08-30T12:00:08.000Z",
    });

    expect(receipt.entries).toHaveLength(2);
    const mobilityDistance = receipt.entries[0]?.effectMetrics.find(
      (metric) => metric.metricId === "route-distance",
    );
    expect(mobilityDistance).toMatchObject({
      before: baseline.routeDistanceKm,
      after: afterMobility.routeDistanceKm,
    });
    expect(mobilityDistance?.after).not.toBe(selected.routeDistanceKm);

    const characterConfidence = receipt.entries[1]?.effectMetrics.find(
      (metric) => metric.metricId === "confidence-threshold",
    );
    expect(characterConfidence).toMatchObject({
      before: afterMobility.rankingWeights.minimumConfidence,
      after: selected.rankingWeights.minimumConfidence,
    });
    expect(receipt.entries[1]?.beforeState.character).toBe("reliable");
    expect(receipt.entries[1]?.afterState.character).toBe("surprising");
  });
});
