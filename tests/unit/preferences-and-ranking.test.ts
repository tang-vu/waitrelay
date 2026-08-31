import { describe, expect, it } from "vitest";

import { baselineTokyoPlan, buildTokyoPlan } from "../../demo/tokyo-scenario";
import {
  DEFAULT_PREFERENCES,
  applyTrustedOption,
  deriveRankingWeights,
  resolveChoiceOption,
} from "@/shared/contracts/choices";

describe("trusted preferences and deterministic Tokyo ranking", () => {
  it("rejects options that are unknown or belong to another axis", () => {
    expect(resolveChoiceOption("less-walking")?.definition.axisId).toBe("mobility");
    expect(resolveChoiceOption("inject-weight")).toBeUndefined();
    expect(() =>
      applyTrustedOption(DEFAULT_PREFERENCES, "mobility", "surprising"),
    ).toThrow("Invalid option");
    expect(() =>
      applyTrustedOption(DEFAULT_PREFERENCES, "mobility", "walkingWeight=1"),
    ).toThrow("Invalid option");
  });

  it("derives weights from a complete snapshot, independent of signal order", () => {
    const mobilityFirst = applyTrustedOption(
      applyTrustedOption(DEFAULT_PREFERENCES, "mobility", "less-walking"),
      "character",
      "surprising",
    );
    const characterFirst = applyTrustedOption(
      applyTrustedOption(DEFAULT_PREFERENCES, "character", "surprising"),
      "mobility",
      "less-walking",
    );

    expect(mobilityFirst).toEqual(characterFirst);
    expect(deriveRankingWeights(mobilityFirst)).toEqual(
      deriveRankingWeights(characterFirst),
    );
  });

  it("keeps the default plan deterministic when the player does nothing", () => {
    expect(buildTokyoPlan()).toEqual(baselineTokyoPlan());
  });

  it("causally changes the structured plan for Less Walking", () => {
    const baseline = baselineTokyoPlan();
    const selected = buildTokyoPlan({
      mobility: "less-walking",
      character: "reliable",
    });

    expect(selected.rankingWeights.walkingWeight).toBeGreaterThan(
      baseline.rankingWeights.walkingWeight,
    );
    expect(selected.routeDistanceKm).toBeLessThan(baseline.routeDistanceKm);
    expect(selected.stops.map((stop) => stop.id)).not.toEqual(
      baseline.stops.map((stop) => stop.id),
    );
  });

  it("admits lower-confidence novelty only for Surprising", () => {
    const baseline = baselineTokyoPlan();
    const selected = buildTokyoPlan({
      mobility: "more-discovery",
      character: "surprising",
    });

    expect(selected.rankingWeights.minimumConfidence).toBeLessThan(
      baseline.rankingWeights.minimumConfidence,
    );
    expect(selected.averageNovelty).toBeGreaterThan(baseline.averageNovelty);
    expect(selected.stops.map((stop) => stop.id)).not.toEqual(
      baseline.stops.map((stop) => stop.id),
    );
  });

  it("always returns a complete, indoor, vegetarian, within-budget plan", () => {
    const variants = [
      buildTokyoPlan(),
      buildTokyoPlan({ mobility: "less-walking", character: "reliable" }),
      buildTokyoPlan({ mobility: "more-discovery", character: "surprising" }),
      buildTokyoPlan({ mobility: "less-walking", character: "surprising" }),
    ];

    for (const plan of variants) {
      expect(plan.stops).toHaveLength(3);
      expect(plan.totalCostYen).toBeLessThanOrEqual(12_000);
      expect(plan.stops.every((stop) => stop.openingInfo.scenarioOpen)).toBe(true);
      expect(plan.stops.every((stop) => stop.indoorSuitability >= 0.9)).toBe(true);
      expect(plan.stops.every((stop) => stop.vegetarianSuitability >= 0.9)).toBe(
        true,
      );
    }
  });
});
