import { z } from "zod";

import {
  AgentHealthSchema,
  AgentPlanSchema,
  AgentResultSchema,
  EvidenceBundleSchema,
  type AgentAdapter,
  type AgentHealth,
  type AgentInput,
  type AgentPlan,
  type AgentResult,
  type EvidenceBundle,
  type InternalProgressEvent,
  type SynthesisInput,
} from "./agent-adapter";

const ChatResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
}).passthrough();

export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

function cleanProviderError(error: unknown): Error {
  if (error instanceof DOMException && error.name === "AbortError") return error;
  return new Error("The live provider request failed. No provider response details were exposed.");
}

export class OpenAICompatibleAdapter implements AgentAdapter {
  readonly mode = "live" as const;
  private readonly timeoutMs: number;

  constructor(private readonly config: OpenAICompatibleConfig) {
    this.timeoutMs = config.timeoutMs ?? 12_000;
  }

  private async requestJson<T>(
    system: string,
    input: unknown,
    schema: z.ZodType<T>,
    signal: AbortSignal,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
      const combined = AbortSignal.any([signal, timeoutSignal]);
      try {
        const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.config.model,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: system },
              { role: "user", content: JSON.stringify(input) },
            ],
          }),
          signal: combined,
        });
        if (!response.ok) throw new Error(`provider-status-${response.status}`);
        const envelope = ChatResponseSchema.parse(await response.json());
        return schema.parse(JSON.parse(envelope.choices[0].message.content));
      } catch (error) {
        lastError = error;
        if (signal.aborted || attempt === 1) throw cleanProviderError(error);
      }
    }
    throw cleanProviderError(lastError);
  }

  async health(): Promise<AgentHealth> {
    try {
      const signal = AbortSignal.timeout(Math.min(this.timeoutMs, 4_000));
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal,
      });
      return AgentHealthSchema.parse({
        ok: response.ok,
        mode: "live",
        label: "Live Provider",
        detail: response.ok ? `Model ${this.config.model} is reachable` : "Provider preflight failed",
      });
    } catch {
      return { ok: false, mode: "live", label: "Live Provider", detail: "Provider preflight failed" };
    }
  }

  analyze(input: AgentInput, signal: AbortSignal): Promise<AgentPlan> {
    return this.requestJson(
      "Return JSON only. Classify this Tokyo planning task. Never reveal chain-of-thought. applicableAxisIds may contain only mobility and character.",
      { prompt: input.prompt },
      AgentPlanSchema,
      signal,
    );
  }

  async gather(
    plan: AgentPlan,
    emit: (event: InternalProgressEvent) => void,
    signal: AbortSignal,
  ): Promise<EvidenceBundle> {
    emit({ stage: "gathering" });
    const result = await this.requestJson(
      "Return JSON only with source=live, an ISO recordedAt, a short factual summary, and an integer evidenceItems. Do not include private reasoning.",
      plan,
      EvidenceBundleSchema,
      signal,
    );
    emit({ stage: "evaluating" });
    return result;
  }

  synthesize(input: SynthesisInput, signal: AbortSignal): Promise<AgentResult> {
    return this.requestJson(
      "Return JSON only with an answer field. Present the supplied structured itinerary faithfully. Do not invent metrics, venues, opening hours, or causal effects.",
      input,
      AgentResultSchema,
      signal,
    );
  }
}

export function configuredOpenAIAdapter(): OpenAICompatibleAdapter | null {
  const baseUrl = process.env.AGENT_BASE_URL;
  const apiKey = process.env.AGENT_API_KEY;
  const model = process.env.AGENT_MODEL;
  if (!baseUrl || !apiKey || !model) return null;
  return new OpenAICompatibleAdapter({ baseUrl, apiKey, model });
}
