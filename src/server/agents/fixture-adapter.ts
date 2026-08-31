import { TOKYO_SCENARIO, type TokyoPlan } from "../../../demo/tokyo-scenario";
import {
  AgentPlanSchema,
  AgentResultSchema,
  EvidenceBundleSchema,
  type AgentAdapter,
  type AgentInput,
  type AgentPlan,
  type AgentResult,
  type EvidenceBundle,
  type InternalProgressEvent,
  type SynthesisInput,
} from "./agent-adapter";
import { renderTokyoItinerary } from "./tokyo-itinerary";

export interface FixtureAdapterOptions {
  mode?: "demo" | "fallback";
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("The run was cancelled", "AbortError");
}

export class FixtureAdapter implements AgentAdapter {
  readonly mode: "demo" | "fallback";

  constructor(options: FixtureAdapterOptions = {}) {
    this.mode = options.mode ?? "demo";
  }

  async health() {
    return {
      ok: true,
      mode: this.mode,
      label: this.mode === "fallback" ? "Fallback Replay" as const : "Demo Provider" as const,
      detail: `Deterministic ${TOKYO_SCENARIO.fixtureVersion} scenario data`,
    };
  }

  async analyze(input: AgentInput, signal: AbortSignal): Promise<AgentPlan> {
    throwIfAborted(signal);
    return AgentPlanSchema.parse({
      domain: "planning",
      taskKind: "plan",
      applicableAxisIds: input.scenario === "fast" ? [] : ["mobility", "character"],
      publicSummary: "Building a rain-safe route from versioned Tokyo scenario evidence.",
    });
  }

  async gather(
    _plan: AgentPlan,
    emit: (event: InternalProgressEvent) => void,
    signal: AbortSignal,
  ): Promise<EvidenceBundle> {
    throwIfAborted(signal);
    emit({ stage: "gathering" });
    await Promise.resolve();
    throwIfAborted(signal);
    emit({ stage: "evaluating" });
    return EvidenceBundleSchema.parse({
      source: "fixture",
      recordedAt: TOKYO_SCENARIO.recordedAt,
      summary: TOKYO_SCENARIO.notice,
      evidenceItems: TOKYO_SCENARIO.candidates.length,
    });
  }

  async synthesize(input: SynthesisInput, signal: AbortSignal): Promise<AgentResult> {
    throwIfAborted(signal);
    return AgentResultSchema.parse({ answer: renderTokyoItinerary(input.structuredPlan as TokyoPlan) });
  }
}
