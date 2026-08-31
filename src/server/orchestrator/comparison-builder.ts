import { z } from "zod";

import { FLAGSHIP_TASK, TOKYO_SCENARIO, TokyoPlanSchema, buildTokyoPlan } from "../../../demo/tokyo-scenario";
import { PreferenceStateSchema } from "../../shared/contracts/choices";

const ComparisonSideSchema = z.object({
  sideId: z.enum(["compact", "discovery"]),
  label: z.string().min(1),
  choices: z.array(z.string().min(1)).length(2),
  plan: TokyoPlanSchema,
}).strict();

const ComparisonMetricSchema = z.object({
  metricId: z.string().min(1),
  label: z.string().min(1),
  compact: z.number(),
  discovery: z.number(),
  unit: z.string().optional(),
}).strict();

export const DemoComparisonSchema = z.object({
  prompt: z.string().min(1),
  fixtureVersion: z.string().min(1),
  recordedAt: z.string().datetime(),
  scenarioNotice: z.string().min(1),
  sides: z.tuple([ComparisonSideSchema, ComparisonSideSchema]),
  metrics: z.array(ComparisonMetricSchema).min(1),
  compactOnlyStops: z.array(z.string()),
  discoveryOnlyStops: z.array(z.string()),
}).strict();
export type DemoComparison = z.infer<typeof DemoComparisonSchema>;

/** Builds both sides from the same fixture and ranking code, with no LLM-authored effects. */
export function buildDemoComparison(): DemoComparison {
  const compactPreferences = PreferenceStateSchema.parse({ mobility: "less-walking", character: "reliable" });
  const discoveryPreferences = PreferenceStateSchema.parse({ mobility: "more-discovery", character: "surprising" });
  const compact = buildTokyoPlan(compactPreferences);
  const discovery = buildTokyoPlan(discoveryPreferences);
  const compactIds = new Set(compact.stops.map((stop) => stop.id));
  const discoveryIds = new Set(discovery.stops.map((stop) => stop.id));

  return DemoComparisonSchema.parse({
    prompt: FLAGSHIP_TASK,
    fixtureVersion: TOKYO_SCENARIO.fixtureVersion,
    recordedAt: TOKYO_SCENARIO.recordedAt,
    scenarioNotice: TOKYO_SCENARIO.notice,
    sides: [
      { sideId: "compact", label: "Compact and reliable", choices: ["Less Walking", "Reliable"], plan: compact },
      { sideId: "discovery", label: "Discovery and surprise", choices: ["More Discovery", "Surprising"], plan: discovery },
    ],
    metrics: [
      { metricId: "route-distance", label: "Approximate route", compact: compact.routeDistanceKm, discovery: discovery.routeDistanceKm, unit: "km" },
      { metricId: "estimated-cost", label: "Estimated cost", compact: compact.totalCostYen, discovery: discovery.totalCostYen, unit: "JPY" },
      { metricId: "average-novelty", label: "Average novelty", compact: compact.averageNovelty, discovery: discovery.averageNovelty },
      { metricId: "average-confidence", label: "Average source confidence", compact: compact.averageSourceConfidence, discovery: discovery.averageSourceConfidence },
      { metricId: "confidence-threshold", label: "Confidence threshold", compact: compact.rankingWeights.minimumConfidence, discovery: discovery.rankingWeights.minimumConfidence },
    ],
    compactOnlyStops: compact.stops.filter((stop) => !discoveryIds.has(stop.id)).map((stop) => stop.name),
    discoveryOnlyStops: discovery.stops.filter((stop) => !compactIds.has(stop.id)).map((stop) => stop.name),
  });
}
