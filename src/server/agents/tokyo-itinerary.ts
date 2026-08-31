import { TokyoPlanSchema, type TokyoPlan } from "../../shared/contracts/tokyo-plan";

/** Host-owned presentation used by fixtures and as the safe live-provider fallback. */
export function renderTokyoItinerary(input: TokyoPlan): string {
  const plan = TokyoPlanSchema.parse(input);
  const stops = plan.stops.map((stop, index) => {
    const time = ["18:30", "20:00", "21:30"][index];
    return `${index + 1}. ${time} - ${stop.name}, ${stop.approximateLocation}\n${stop.scenarioNote} Scenario hours: ${stop.openingInfo.hours}. Estimated cost: ¥${stop.estimatedCostYen.toLocaleString("en-US")}.`;
  });
  return [
    ...stops.flatMap((stop) => [stop, ""]),
    `Estimated total: ¥${plan.totalCostYen.toLocaleString("en-US")} for two. Approximate route: ${plan.routeDistanceKm} km.`,
    "",
    `Scenario data notice: ${plan.scenarioNotice} Recorded ${new Date(plan.fixtureRecordedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC. Confirm directly before leaving.`,
  ].join("\n");
}

/**
 * A live model may improve wording, but it cannot replace or contradict the
 * authoritative plan. Missing any core plan fact triggers deterministic copy.
 */
export function isTokyoItineraryConsistent(answer: string, input: TokyoPlan): boolean {
  const plan = TokyoPlanSchema.parse(input);
  const normalizedAnswer = answer.normalize("NFKC");
  const totalVariants = [
    String(plan.totalCostYen),
    plan.totalCostYen.toLocaleString("en-US"),
  ];
  return plan.stops.every((stop) => normalizedAnswer.includes(stop.name.normalize("NFKC")))
    && totalVariants.some((total) => normalizedAnswer.includes(total))
    && normalizedAnswer.includes(String(plan.routeDistanceKm))
    && normalizedAnswer.includes(plan.scenarioNotice.normalize("NFKC"));
}

export function authoritativeTokyoAnswer(providerAnswer: string, plan: TokyoPlan): string {
  return isTokyoItineraryConsistent(providerAnswer, plan)
    ? providerAnswer
    : renderTokyoItinerary(plan);
}
