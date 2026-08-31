import type {
  AgentAdapter,
  AgentHealth,
  AgentInput,
  AgentPlan,
  AgentResult,
  EvidenceBundle,
  InternalProgressEvent,
  SynthesisInput,
} from "./agent-adapter";
import { FixtureAdapter } from "./fixture-adapter";
import { configuredOpenAIAdapter } from "./openai-compatible-adapter";

export class HybridAdapter implements AgentAdapter {
  private active: AgentAdapter;
  private readonly fallback = new FixtureAdapter({ mode: "fallback" });

  constructor(private readonly primary: AgentAdapter, private readonly allowFallback: boolean) {
    this.active = primary;
  }

  get mode() { return this.active.mode; }

  private async withFallback<T>(operation: (adapter: AgentAdapter) => Promise<T>): Promise<T> {
    try {
      return await operation(this.active);
    } catch (error) {
      if (!this.allowFallback || this.active.mode !== "live") throw error;
      this.active = this.fallback;
      return operation(this.active);
    }
  }

  health(): Promise<AgentHealth> { return this.active.health(); }
  analyze(input: AgentInput, signal: AbortSignal): Promise<AgentPlan> {
    return this.withFallback((adapter) => adapter.analyze(input, signal));
  }
  gather(plan: AgentPlan, emit: (event: InternalProgressEvent) => void, signal: AbortSignal): Promise<EvidenceBundle> {
    return this.withFallback((adapter) => adapter.gather(plan, emit, signal));
  }
  synthesize(input: SynthesisInput, signal: AbortSignal): Promise<AgentResult> {
    return this.withFallback((adapter) => adapter.synthesize(input, signal));
  }
}

export function createAgentAdapter(forceDemo = false): AgentAdapter {
  if (forceDemo) return new FixtureAdapter();
  const live = configuredOpenAIAdapter();
  if (!live) return new FixtureAdapter();
  return new HybridAdapter(live, process.env.ALLOW_FIXTURE_FALLBACK === "1");
}
