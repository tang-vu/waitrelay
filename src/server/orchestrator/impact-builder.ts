import {
  buildTokyoPlan,
  type TokyoPlan,
} from "../../../demo/tokyo-scenario";
import {
  applyTrustedOption,
  resolveChoiceOption,
} from "../../shared/contracts/choices";
import {
  ImpactReceiptSchema,
  type EffectMetric,
  type ImpactReceipt,
  type ImpactReceiptEntry,
} from "../../shared/contracts/receipts";
import type { AppliedChoiceRecord } from "./preference-reducer";

export interface ImpactBuilderInput {
  runId: string;
  baseline: TokyoPlan;
  selected: TokyoPlan;
  acceptedChoices: readonly AppliedChoiceRecord[];
  generatedAt?: string;
}

function changedStops(baseline: TokyoPlan, selected: TokyoPlan): number {
  return selected.stops.reduce(
    (count, stop, index) =>
      count + (baseline.stops[index]?.id === stop.id ? 0 : 1),
    0,
  );
}

function metric(
  metricId: string,
  label: string,
  before: string | number | boolean | null,
  after: string | number | boolean | null,
  unit?: string,
): EffectMetric {
  return {
    metricId,
    label,
    before,
    after,
    ...(unit ? { unit } : {}),
    material: before !== after,
  };
}

function buildEntry(
  choice: AppliedChoiceRecord,
  baseline: TokyoPlan,
  selected: TokyoPlan,
): ImpactReceiptEntry {
  const resolved = resolveChoiceOption(choice.selectedOptionId);
  if (!resolved || resolved.definition.axisId !== choice.axisId) {
    throw new Error("Cannot build receipt for an invalid choice option");
  }
  if (choice.ackStatus !== "appliedNow") {
    throw new Error("Cannot build receipt for a choice that was not appliedNow");
  }

  const replacements = changedStops(baseline, selected);
  let beforeState: Record<string, string | number | boolean | null>;
  let afterState: Record<string, string | number | boolean | null>;
  let effectMetrics: EffectMetric[];
  let summary: string;

  if (choice.axisId === "mobility") {
    beforeState = {
      walkingWeight: baseline.rankingWeights.walkingWeight,
      mobility: baseline.preferences.mobility,
    };
    afterState = {
      walkingWeight: selected.rankingWeights.walkingWeight,
      mobility: selected.preferences.mobility,
    };
    effectMetrics = [
      metric(
        "walking-weight",
        "Walking weight",
        baseline.rankingWeights.walkingWeight,
        selected.rankingWeights.walkingWeight,
      ),
      metric(
        "route-distance",
        "Approximate route distance",
        baseline.routeDistanceKm,
        selected.routeDistanceKm,
        "km",
      ),
      metric("venue-replacements", "Venues replaced", 0, replacements),
    ];
    summary = effectMetrics.some((item) => item.material)
      ? `Approximate route distance changed from ${baseline.routeDistanceKm} km to ${selected.routeDistanceKm} km. ${replacements} of 3 stops changed.`
      : "The accepted route preference caused no material plan change.";
  } else {
    beforeState = {
      minimumConfidence: baseline.rankingWeights.minimumConfidence,
      character: baseline.preferences.character,
    };
    afterState = {
      minimumConfidence: selected.rankingWeights.minimumConfidence,
      character: selected.preferences.character,
    };
    effectMetrics = [
      metric(
        "confidence-threshold",
        "Source-confidence threshold",
        baseline.rankingWeights.minimumConfidence,
        selected.rankingWeights.minimumConfidence,
      ),
      metric(
        "average-novelty",
        "Average novelty",
        baseline.averageNovelty,
        selected.averageNovelty,
      ),
      metric(
        "average-source-confidence",
        "Average source confidence",
        baseline.averageSourceConfidence,
        selected.averageSourceConfidence,
      ),
      metric("venue-replacements", "Venues replaced", 0, replacements),
    ];
    summary = effectMetrics.some((item) => item.material)
      ? `Average novelty changed from ${baseline.averageNovelty} to ${selected.averageNovelty}. The confidence threshold changed from ${baseline.rankingWeights.minimumConfidence} to ${selected.rankingWeights.minimumConfidence}.`
      : "The accepted mood preference caused no material plan change.";
  }

  return {
    requestId: choice.requestId,
    axisId: choice.axisId,
    selectedOptionId: choice.selectedOptionId,
    selectedOptionLabel: choice.selectedOptionLabel,
    defaultOptionId: choice.defaultOptionId,
    signalTimestamp: choice.signalTimestamp,
    ackTimestamp: choice.ackTimestamp,
    ackStatus: "appliedNow",
    pipelineNode: choice.pipelineNode,
    beforeState,
    afterState,
    effectMetrics,
    summary,
  };
}

/** Builds causal copy exclusively from authoritative structured plan state. */
export function buildImpactReceipt(input: ImpactBuilderInput): ImpactReceipt {
  let precedingPlan = input.baseline;
  const entries = input.acceptedChoices
    .filter((choice) => choice.ackStatus === "appliedNow")
    .map((choice) => {
      const preferencesAfterChoice = applyTrustedOption(
        precedingPlan.preferences,
        choice.axisId,
        choice.selectedOptionId,
      );
      const planAfterChoice = buildTokyoPlan(preferencesAfterChoice);
      const entry = buildEntry(choice, precedingPlan, planAfterChoice);
      precedingPlan = planAfterChoice;
      return entry;
    });
  if (entries.length > 0 && precedingPlan.planId !== input.selected.planId) {
    throw new Error(
      "The acknowledged choices do not match the selected structured plan",
    );
  }
  const materialChange = entries.some((entry) =>
    entry.effectMetrics.some((item) => item.material),
  );
  const summary =
    entries.length === 0
      ? "No choices were applied to this run. The default plan was used."
      : materialChange
        ? `${entries.length} accepted ${entries.length === 1 ? "choice changed" : "choices changed"} the structured plan.`
        : `${entries.length} accepted ${entries.length === 1 ? "choice was" : "choices were"} applied, with no material plan change.`;

  return ImpactReceiptSchema.parse({
    protocolVersion: "1.0",
    runId: input.runId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    baselinePlanId: input.baseline.planId,
    selectedPlanId: input.selected.planId,
    entries,
    materialChange,
    summary,
  });
}
