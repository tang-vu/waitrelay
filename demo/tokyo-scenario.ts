import { z } from "zod";

import fixtureJson from "../fixtures/tokyo-evidence.json";
import {
  DEFAULT_PREFERENCES,
  PreferenceStateSchema,
  deriveRankingWeights,
  type PreferenceState,
} from "../src/shared/contracts/choices";
import {
  TokyoCandidateSchema,
  TokyoPlanSchema,
  type TokyoCandidate,
  type TokyoPlan,
} from "../src/shared/contracts/tokyo-plan";

export {
  TokyoCandidateSchema,
  TokyoPlanSchema,
  type TokyoCandidate,
  type TokyoPlan,
} from "../src/shared/contracts/tokyo-plan";

export const FLAGSHIP_TASK =
  "Plan a rain-safe surprise date in Tokyo tonight under ¥12,000. We are vegetarian. Verify that every place is open.";

const TokyoFixtureSchema = z
  .object({
    fixtureVersion: z.string().min(1),
    recordedAt: z.string().datetime(),
    currency: z.literal("JPY"),
    notice: z.string().min(1),
    candidates: z.array(TokyoCandidateSchema).min(3),
  })
  .strict();

const fixture = TokyoFixtureSchema.parse(fixtureJson);

export const TOKYO_SCENARIO = Object.freeze({
  id: "tokyo-rain-date-v1",
  fixtureVersion: fixture.fixtureVersion,
  recordedAt: fixture.recordedAt,
  notice: fixture.notice,
  budgetYen: 12_000,
  candidates: Object.freeze(fixture.candidates),
});

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function candidateScore(
  candidate: TokyoCandidate,
  preferences: PreferenceState,
): number {
  const weights = deriveRankingWeights(preferences);
  const walkingScore = Math.max(0, 1 - candidate.routeDistanceKm / 3.5);
  const weighted =
    walkingScore * weights.walkingWeight +
    candidate.novelty * weights.noveltyWeight +
    candidate.sourceConfidence * weights.confidenceWeight +
    candidate.indoorSuitability * weights.indoorWeight +
    candidate.vegetarianSuitability * weights.vegetarianWeight;
  const weightTotal =
    weights.walkingWeight +
    weights.noveltyWeight +
    weights.confidenceWeight +
    weights.indoorWeight +
    weights.vegetarianWeight;
  return weighted / weightTotal;
}

/** Deterministic structured ranking. Natural-language generation happens later. */
export function buildTokyoPlan(
  input: PreferenceState = DEFAULT_PREFERENCES,
): TokyoPlan {
  const preferences = PreferenceStateSchema.parse(input);
  const rankingWeights = deriveRankingWeights(preferences);
  const eligible = fixture.candidates.filter(
    (candidate) =>
      candidate.openingInfo.scenarioOpen &&
      candidate.indoorSuitability >= 0.9 &&
      candidate.vegetarianSuitability >= 0.9 &&
      candidate.sourceConfidence >= rankingWeights.minimumConfidence,
  );
  const categories = ["dinner", "activity", "dessert"] as const;
  const candidatesByCategory = categories.map((kind) =>
    eligible.filter((candidate) => candidate.kind === kind),
  );

  if (candidatesByCategory.some((candidates) => candidates.length === 0)) {
    throw new Error("The scenario does not contain an eligible complete plan");
  }

  const combinations = candidatesByCategory[0].flatMap((dinner) =>
    candidatesByCategory[1].flatMap((activity) =>
      candidatesByCategory[2].map((dessert) => [
        dinner,
        activity,
        dessert,
      ] as const),
    ),
  );
  const withinBudget = combinations.filter(
    (combination) =>
      combination.reduce((sum, candidate) => sum + candidate.estimatedCostYen, 0) <=
      TOKYO_SCENARIO.budgetYen,
  );
  const ranked = withinBudget
    .map((stops) => ({
      stops,
      score:
        stops.reduce(
          (sum, candidate) => sum + candidateScore(candidate, preferences),
          0,
        ) / stops.length,
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.stops.map((stop) => stop.id).join("|").localeCompare(
          right.stops.map((stop) => stop.id).join("|"),
        ),
    );
  const selected = ranked[0];
  if (!selected) {
    throw new Error("The scenario does not contain a plan within budget");
  }

  const stops = [...selected.stops];
  const totalCostYen = stops.reduce(
    (sum, candidate) => sum + candidate.estimatedCostYen,
    0,
  );
  const routeDistanceKm = round(
    stops.reduce((sum, candidate) => sum + candidate.routeDistanceKm, 0),
  );
  const averageNovelty = round(
    stops.reduce((sum, candidate) => sum + candidate.novelty, 0) /
      stops.length,
  );
  const averageSourceConfidence = round(
    stops.reduce((sum, candidate) => sum + candidate.sourceConfidence, 0) /
      stops.length,
  );
  const selectedIds = new Set(stops.map((candidate) => candidate.id));

  return TokyoPlanSchema.parse({
    planId: `tokyo:${preferences.mobility}:${preferences.character}:${stops
      .map((candidate) => candidate.id)
      .join("+")}`,
    fixtureVersion: fixture.fixtureVersion,
    fixtureRecordedAt: fixture.recordedAt,
    scenarioNotice: fixture.notice,
    preferences,
    rankingWeights,
    stops,
    totalCostYen,
    routeDistanceKm,
    averageNovelty,
    averageSourceConfidence,
    verifiedEvidenceItems: stops.length,
    excludedCandidateIds: fixture.candidates
      .filter((candidate) => !selectedIds.has(candidate.id))
      .map((candidate) => candidate.id),
  });
}

export function baselineTokyoPlan(): TokyoPlan {
  return buildTokyoPlan(DEFAULT_PREFERENCES);
}
