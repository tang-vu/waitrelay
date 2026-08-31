import { z } from "zod";

import type { LifecycleStage, ProviderMode } from "@/shared/contracts/events";

export const AgentHealthSchema = z.object({
  ok: z.boolean(),
  mode: z.enum(["live", "demo", "fallback"]),
  label: z.enum(["Live Provider", "Demo Provider", "Fallback Replay"]),
  detail: z.string().max(240).optional(),
}).strict();
export type AgentHealth = z.infer<typeof AgentHealthSchema>;

export const AgentPlanSchema = z.object({
  domain: z.literal("planning"),
  taskKind: z.literal("plan"),
  applicableAxisIds: z.array(z.enum(["mobility", "character"])).max(2),
  publicSummary: z.string().min(1).max(240),
}).strict();
export type AgentPlan = z.infer<typeof AgentPlanSchema>;

export const EvidenceBundleSchema = z.object({
  source: z.enum(["live", "fixture"]),
  recordedAt: z.string().datetime(),
  summary: z.string().min(1).max(500),
  evidenceItems: z.number().int().nonnegative(),
}).strict();
export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;

export const AgentResultSchema = z.object({
  answer: z.string().min(1).max(16_000),
}).strict();
export type AgentResult = z.infer<typeof AgentResultSchema>;

export interface AgentInput {
  prompt: string;
  scenario: "fast" | "two-second" | "standard" | "long" | "cancel" | "error";
  seed: string;
}

export interface SynthesisInput {
  prompt: string;
  evidence: EvidenceBundle;
  structuredPlan: unknown;
  scenarioLabel: string;
}

export interface InternalProgressEvent {
  stage: LifecycleStage;
}

export interface AgentAdapter {
  readonly mode: ProviderMode;
  health(): Promise<AgentHealth>;
  analyze(input: AgentInput, signal: AbortSignal): Promise<AgentPlan>;
  gather(
    plan: AgentPlan,
    emit: (event: InternalProgressEvent) => void,
    signal: AbortSignal,
  ): Promise<EvidenceBundle>;
  synthesize(input: SynthesisInput, signal: AbortSignal): Promise<AgentResult>;
}

export function providerLabel(mode: ProviderMode): AgentHealth["label"] {
  if (mode === "live") return "Live Provider";
  if (mode === "fallback") return "Fallback Replay";
  return "Demo Provider";
}
