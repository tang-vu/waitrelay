import { describe, expect, it } from "vitest";

import { buildDemoComparison } from "@/server/orchestrator/comparison-builder";

describe("split-screen causal comparison", () => {
  it("uses one scenario and produces traceable plan differences", () => {
    const comparison = buildDemoComparison();
    const [compact, discovery] = comparison.sides;

    expect(compact.plan.fixtureVersion).toBe(discovery.plan.fixtureVersion);
    expect(compact.plan.preferences).toEqual({ mobility: "less-walking", character: "reliable" });
    expect(discovery.plan.preferences).toEqual({ mobility: "more-discovery", character: "surprising" });
    expect(compact.plan.routeDistanceKm).not.toBe(discovery.plan.routeDistanceKm);
    expect(compact.plan.averageNovelty).not.toBe(discovery.plan.averageNovelty);
    expect(comparison.compactOnlyStops.length).toBeGreaterThan(0);
    expect(comparison.discoveryOnlyStops.length).toBeGreaterThan(0);
  });
});
