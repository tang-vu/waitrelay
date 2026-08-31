import { z } from "zod";

import { baselineTokyoPlan, buildTokyoPlan } from "../../../demo/tokyo-scenario";
import { createAgentAdapter } from "../agents/hybrid-adapter";
import type { AgentAdapter, AgentInput } from "../agents/agent-adapter";
import { authoritativeTokyoAnswer } from "../agents/tokyo-itinerary";
import { buildImpactReceipt } from "./impact-builder";
import { resolveChoiceOption, TOKYO_CHOICE_DEFINITIONS, type ChoiceAxisId } from "../../shared/contracts/choices";
import { createContextCapsule, type ContextCapsule } from "../../shared/contracts/context-capsule";
import {
  PROTOCOL_VERSION,
  type ChoiceAckEvent,
  type ChoiceRequest,
  type ChoiceSignal,
  type LifecycleStage,
  type PublicEvent,
} from "../../shared/contracts/events";
import type { AppliedChoiceRecord } from "./preference-reducer";
import { MemoryRunStore } from "../stores/memory-run-store";
import type { RunSnapshot } from "../stores/run-store";

export const StartRunInputSchema = z.object({
  prompt: z.string().trim().min(1).max(2_000),
  scenario: z.enum(["fast", "two-second", "standard", "late", "long", "cancel", "error"]).default("standard"),
  seed: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._:-]+$/).default("fork-flight-001"),
  sensitive: z.boolean().default(false),
  interactionMode: z.enum(["active", "passive"]).default("active"),
  forceDemo: z.boolean().default(true),
}).strict();
export type StartRunInput = z.infer<typeof StartRunInputSchema>;

const ChoiceApiInputSchema = z.object({
  requestId: z.string().min(1).max(128),
  optionId: z.string().min(1).max(64),
  signalId: z.string().min(1).max(128),
  signalledAt: z.string().datetime(),
}).strict();

type ScenarioTiming = {
  firstGateMs: number | null;
  secondGateMs: number | null;
  lockMs: number;
  completeMs: number;
};

const TIMINGS: Record<StartRunInput["scenario"], ScenarioTiming> = {
  fast: { firstGateMs: null, secondGateMs: null, lockMs: 120, completeMs: 200 },
  "two-second": { firstGateMs: 650, secondGateMs: null, lockMs: 1_900, completeMs: 2_200 },
  standard: { firstGateMs: 1_350, secondGateMs: 5_000, lockMs: 7_500, completeMs: 8_700 },
  late: { firstGateMs: 1_350, secondGateMs: null, lockMs: 4_500, completeMs: 8_500 },
  long: { firstGateMs: 2_000, secondGateMs: 8_000, lockMs: 25_000, completeMs: 30_000 },
  cancel: { firstGateMs: 1_200, secondGateMs: 4_000, lockMs: 25_000, completeMs: 30_000 },
  error: { firstGateMs: 1_100, secondGateMs: null, lockMs: 1_800, completeMs: 2_200 },
};

type RuntimeRun = {
  runId: string;
  prompt: string;
  input: StartRunInput;
  adapter: AgentAdapter;
  startedAt: number;
  startedWithLive: boolean;
  publishedProviderMode: "live" | "demo" | "fallback";
};

type Listener = (event: PublicEvent) => void;

export interface ReplaySubscription {
  replay: PublicEvent[];
  activate(): void;
  unsubscribe(): void;
}

export interface RunOrchestratorOptions {
  adapterFactory?: (forceDemo: boolean) => AgentAdapter;
  store?: MemoryRunStore;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("The run was cancelled", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", aborted);
      resolve();
    }, ms);
    const aborted = () => {
      clearTimeout(timer);
      reject(new DOMException("The run was cancelled", "AbortError"));
    };
    signal.addEventListener("abort", aborted, { once: true });
  });
}

function capsule(input: StartRunInput): ContextCapsule {
  const waitBand = input.scenario === "fast" ? "instant"
    : input.scenario === "two-second" ? "short"
      : input.scenario === "long" || input.scenario === "cancel" ? "long" : "medium";
  return createContextCapsule({
    domain: "planning",
    taskKind: "plan",
    locale: "en",
    risk: "low",
    waitBand,
    interactionMode: input.interactionMode,
    difficulty: input.scenario === "long" ? "challenge" : "normal",
  }, { sensitive: input.sensitive });
}

export class RunOrchestrator {
  readonly store: MemoryRunStore;
  private readonly adapterFactory: (forceDemo: boolean) => AgentAdapter;
  private readonly runtime = new Map<string, RuntimeRun>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(options: RunOrchestratorOptions = {}) {
    this.store = options.store ?? new MemoryRunStore();
    this.adapterFactory = options.adapterFactory ?? createAgentAdapter;
  }

  async start(inputValue: unknown) {
    const input = StartRunInputSchema.parse(inputValue);
    const runId = crypto.randomUUID();
    const adapter = this.adapterFactory(input.forceDemo);
    const startedAt = Date.now();
    await this.store.createRun({ runId, context: capsule(input) });
    this.runtime.set(runId, {
      runId,
      prompt: input.prompt,
      input,
      adapter,
      startedAt,
      startedWithLive: adapter.mode === "live",
      publishedProviderMode: adapter.mode,
    });
    await this.append(runId, (sequence, now) => ({
      ...this.base(runId, sequence, now, "run.start"),
      type: "run.start" as const,
      providerMode: adapter.mode,
      context: capsule(input),
      visualSeed: input.sensitive ? "private-flight" : input.seed,
    }));
    void this.execute(runId);
    return {
      runId,
      providerMode: adapter.mode,
      streamUrl: `/api/runs/${runId}/events`,
      snapshotUrl: `/api/runs/${runId}/snapshot`,
    };
  }

  private base(runId: string, sequence: number, timestamp: string, type: string) {
    return {
      protocolVersion: PROTOCOL_VERSION,
      runId,
      eventId: `${runId}:${sequence}:${type}`,
      sequence,
      timestamp,
    };
  }

  private async serial<T>(runId: string, operation: () => Promise<T>): Promise<T> {
    const prior = this.locks.get(runId) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const next = new Promise<void>((resolve) => { release = resolve; });
    const chained = prior.then(() => next);
    this.locks.set(runId, chained);
    await prior;
    try { return await operation(); }
    finally {
      release();
      if (this.locks.get(runId) === chained) this.locks.delete(runId);
    }
  }

  private async append(
    runId: string,
    factory: (sequence: number, timestamp: string) => PublicEvent,
  ): Promise<PublicEvent | null> {
    return this.serial(runId, async () => {
      const snapshot = await this.store.getRun(runId);
      if (!snapshot) return null;
      const event = factory(snapshot.lastSequence + 1, new Date().toISOString());
      const result = await this.store.appendPublicEvent(event);
      if (result.status !== "appended") return null;
      this.listeners.get(runId)?.forEach((listener) => listener(event));
      return event;
    });
  }

  private progress(runId: string, stage: LifecycleStage) {
    return this.append(runId, (sequence, now) => ({
      ...this.base(runId, sequence, now, "run.progress"),
      type: "run.progress",
      stage,
    }));
  }

  private requestChoice(runId: string, axisId: ChoiceAxisId): Promise<PublicEvent | null> {
    const definition = TOKYO_CHOICE_DEFINITIONS.find((candidate) => candidate.axisId === axisId);
    if (!definition) return Promise.resolve(null);
    return this.append(runId, (sequence, now): ChoiceRequest => ({
      ...this.base(runId, sequence, now, "choice.request"),
      type: "choice.request",
      requestId: `${runId}:${definition.axisId}`,
      axisId: definition.axisId,
      options: definition.options.map((option) => ({ ...option })),
      defaultOptionId: definition.defaultOptionId,
      decisionPoint: definition.decisionPoint,
      effectCategory: definition.effectCategory,
    }));
  }

  private async delayFrom(runtime: RuntimeRun, targetMs: number): Promise<void> {
    const signal = this.store.getAbortSignal(runtime.runId);
    if (!signal) throw new Error("Run signal unavailable");
    if (runtime.startedWithLive) return;
    await wait(Math.max(0, runtime.startedAt + targetMs - Date.now()), signal);
  }

  private async liveGateDue(runId: string, delayMs: number, evidencePromise: Promise<unknown>): Promise<boolean> {
    const signal = this.store.getAbortSignal(runId);
    if (!signal) throw new Error("Run signal unavailable");
    return new Promise<boolean>((resolve, reject) => {
      let settled = false;
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", aborted);
        resolve(result);
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", aborted);
        reject(error);
      };
      const aborted = () => fail(new DOMException("The run was cancelled", "AbortError"));
      const timer = setTimeout(() => finish(true), delayMs);
      signal.addEventListener("abort", aborted, { once: true });
      evidencePromise.then(() => finish(false), fail);
    });
  }

  private async publishProviderModeIfChanged(runtime: RuntimeRun): Promise<void> {
    if (runtime.adapter.mode === runtime.publishedProviderMode) return;
    runtime.publishedProviderMode = runtime.adapter.mode;
    await this.append(runtime.runId, (sequence, now) => ({
      ...this.base(runtime.runId, sequence, now, "provider.mode"),
      type: "provider.mode",
      providerMode: runtime.adapter.mode,
      reason: runtime.adapter.mode === "fallback" ? "fallback" : "configured",
    }));
  }

  private async execute(runId: string): Promise<void> {
    const runtime = this.runtime.get(runId);
    const signal = this.store.getAbortSignal(runId);
    if (!runtime || !signal) return;
    const timing = TIMINGS[runtime.input.scenario];
    try {
      await this.progress(runId, "understanding");
      const agentInput: AgentInput = {
        prompt: runtime.prompt,
        scenario: runtime.input.scenario,
        seed: runtime.input.seed,
      };
      const plan = await runtime.adapter.analyze(agentInput, signal);
      await this.publishProviderModeIfChanged(runtime);
      const evidencePromise = runtime.adapter.gather(plan, (event) => void this.progress(runId, event.stage), signal);
      const applicableAxes = plan.applicableAxisIds.slice(0, 2);

      if (runtime.startedWithLive) {
        // These delays are relative to post-analysis gathering, not run start.
        // A slow provider can therefore never collapse both gates into one frame.
        const liveDelays = [250, 2_000];
        for (const [index, axisId] of applicableAxes.entries()) {
          if (!await this.liveGateDue(runId, liveDelays[index], evidencePromise)) break;
          await this.requestChoice(runId, axisId);
        }
      } else {
        const fixtureTargets = [timing.firstGateMs, timing.secondGateMs];
        for (const [index, axisId] of applicableAxes.entries()) {
          const target = fixtureTargets[index];
          if (target === null) break;
          await this.delayFrom(runtime, target);
          await this.requestChoice(runId, axisId);
        }
      }
      const evidence = await evidencePromise;
      await this.publishProviderModeIfChanged(runtime);
      await this.delayFrom(runtime, timing.lockMs);
      const preferences = await this.store.snapshotPreferences(runId);
      await this.progress(runId, "composing");
      const baseline = baselineTokyoPlan();
      const selected = buildTokyoPlan(preferences);
      if (runtime.input.scenario === "error") throw new Error("controlled-provider-failure");
      const generated = await runtime.adapter.synthesize({
        prompt: runtime.prompt,
        evidence,
        structuredPlan: selected,
        scenarioLabel: runtime.adapter.mode === "live"
          ? "Live provider presentation over versioned Tokyo scenario data"
          : "Versioned scenario replay",
      }, signal);
      await this.publishProviderModeIfChanged(runtime);
      const finalAnswer = runtime.adapter.mode === "live"
        ? authoritativeTokyoAnswer(generated.answer, selected)
        : generated.answer;
      await this.progress(runId, "verifying");
      await this.delayFrom(runtime, timing.completeMs);
      const snapshot = await this.store.getRun(runId);
      if (!snapshot || snapshot.state !== "active") return;
      const acceptedChoices: AppliedChoiceRecord[] = snapshot.acceptedChoices.map((choice) => ({
        requestId: choice.requestId,
        axisId: choice.axisId,
        selectedOptionId: choice.optionId,
        selectedOptionLabel: resolveChoiceOption(choice.optionId)?.option.label ?? choice.optionId,
        defaultOptionId: choice.defaultOptionId,
        signalTimestamp: choice.signalledAt,
        ackTimestamp: choice.acknowledgedAt,
        ackStatus: "appliedNow",
        pipelineNode: choice.decisionPoint,
      }));
      const receipt = buildImpactReceipt({ runId, baseline, selected, acceptedChoices });
      await this.serial(runId, async () => {
        const before = await this.store.getRun(runId);
        if (!before || before.state !== "active") return;
        const transition = await this.store.transitionTerminal(runId, "completed");
        if (!transition.changed) return;
        const now = new Date().toISOString();
        const event: PublicEvent = {
          ...this.base(runId, before.lastSequence + 1, now, "run.complete"),
          type: "run.complete",
          finalAnswer,
          structuredResult: selected,
          impactReceipt: receipt,
          providerMode: runtime.adapter.mode,
        };
        const appended = await this.store.appendPublicEvent(event);
        if (appended.status === "appended") this.listeners.get(runId)?.forEach((listener) => listener(event));
      });
    } catch (error) {
      if (signal.aborted) return;
      await this.serial(runId, async () => {
        const before = await this.store.getRun(runId);
        if (!before || before.state !== "active") return;
        const transition = await this.store.transitionTerminal(runId, "failed");
        if (!transition.changed) return;
        const now = new Date().toISOString();
        const event: PublicEvent = {
          ...this.base(runId, before.lastSequence + 1, now, "run.error"),
          type: "run.error",
          code: "run-failed",
          message: "The configured provider could not complete this run. The activity closed safely.",
          recoverable: false,
        };
        const appended = await this.store.appendPublicEvent(event);
        if (appended.status === "appended") this.listeners.get(runId)?.forEach((listener) => listener(event));
      });
      void error;
    } finally {
      this.runtime.delete(runId);
    }
  }

  async handleChoice(runId: string, input: unknown): Promise<ChoiceAckEvent> {
    const submitted = ChoiceApiInputSchema.parse(input);
    return this.serial(runId, async () => {
      const before = await this.store.getRun(runId);
      const sequence = (before?.lastSequence ?? -1) + 1;
      const now = new Date().toISOString();
      const signal: ChoiceSignal = {
        ...this.base(runId, sequence, now, "choice.signal"),
        type: "choice.signal",
        ...submitted,
      };
      const handled = await this.store.handleChoiceSignal(signal);
      const logChoice = handled.reason !== "run-capacity";
      if (logChoice && !handled.duplicate && before?.state === "active") {
        const appendedSignal = await this.store.appendPublicEvent(signal);
        if (appendedSignal.status === "appended") this.listeners.get(runId)?.forEach((listener) => listener(signal));
      }
      const afterSignal = await this.store.getRun(runId);
      const ackSequence = (afterSignal?.lastSequence ?? sequence) + 1;
      const ack: ChoiceAckEvent = {
        ...this.base(runId, ackSequence, handled.acknowledgedAt, "choice.ack"),
        type: "choice.ack",
        requestId: handled.requestId,
        optionId: handled.optionId,
        signalId: handled.signalId,
        status: handled.status,
        reason: handled.reason,
      };
      if (logChoice && !handled.duplicate && afterSignal?.state === "active") {
        const appendedAck = await this.store.appendPublicEvent(ack);
        if (appendedAck.status === "appended") this.listeners.get(runId)?.forEach((listener) => listener(ack));
      }
      return ack;
    });
  }

  async cancel(runId: string): Promise<"cancelled" | "already-terminal" | "stale-run"> {
    return this.serial(runId, async () => {
      const snapshot = await this.store.getRun(runId);
      if (!snapshot) return "stale-run";
      if (snapshot.state !== "active") return "already-terminal";
      const requestTime = new Date().toISOString();
      const request: PublicEvent = {
        ...this.base(runId, snapshot.lastSequence + 1, requestTime, "run.cancel.request"),
        type: "run.cancel.request",
      };
      await this.store.appendPublicEvent(request);
      this.listeners.get(runId)?.forEach((listener) => listener(request));
      await this.store.transitionTerminal(runId, "cancelled");
      const ackTime = new Date().toISOString();
      const ack: PublicEvent = {
        ...this.base(runId, request.sequence + 1, ackTime, "run.cancel.ack"),
        type: "run.cancel.ack",
        status: "cancelled",
      };
      await this.store.appendPublicEvent(ack);
      this.listeners.get(runId)?.forEach((listener) => listener(ack));
      this.runtime.delete(runId);
      return "cancelled";
    });
  }

  getSnapshot(runId: string): Promise<RunSnapshot | undefined> { return this.store.getRun(runId); }
  getEvents(runId: string, afterSequence = -1) { return this.store.getPublicEvents(runId, afterSequence); }
  subscribe(runId: string, listener: Listener): () => void {
    const listeners = this.listeners.get(runId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(runId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(runId);
    };
  }

  async subscribeWithReplay(runId: string, afterSequence: number, listener: Listener): Promise<ReplaySubscription | undefined> {
    return this.serial(runId, async () => {
      if (!await this.store.getRun(runId)) return undefined;
      let active = false;
      let closed = false;
      let buffered: PublicEvent[] = [];
      const wrapped: Listener = (event) => {
        if (closed) return;
        if (active) listener(event);
        else buffered.push(event);
      };
      const listeners = this.listeners.get(runId) ?? new Set<Listener>();
      listeners.add(wrapped);
      this.listeners.set(runId, listeners);
      const replay = await this.store.getPublicEvents(runId, afterSequence);
      const replayMax = replay.at(-1)?.sequence ?? afterSequence;
      const unsubscribe = () => {
        if (closed) return;
        closed = true;
        listeners.delete(wrapped);
        if (listeners.size === 0) this.listeners.delete(runId);
        buffered = [];
      };
      return {
        replay,
        activate() {
          if (closed || active) return;
          active = true;
          const pending = buffered
            .filter((event) => event.sequence > replayMax)
            .sort((left, right) => left.sequence - right.sequence);
          buffered = [];
          pending.forEach(listener);
        },
        unsubscribe,
      };
    });
  }

  async health(forceDemo: boolean) {
    const adapter = createAgentAdapter(forceDemo);
    return adapter.health();
  }
}

declare global { var __waitRelayOrchestrator: RunOrchestrator | undefined; }
export const runOrchestrator = globalThis.__waitRelayOrchestrator ?? new RunOrchestrator();
if (process.env.NODE_ENV !== "production") globalThis.__waitRelayOrchestrator = runOrchestrator;
