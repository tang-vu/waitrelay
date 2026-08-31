import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAICompatibleAdapter } from "@/server/agents/openai-compatible-adapter";
import { HybridAdapter } from "@/server/agents/hybrid-adapter";
import type { AgentAdapter } from "@/server/agents/agent-adapter";

describe("OpenAICompatibleAdapter contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("validates structured analyze output and keeps credentials server-side", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        domain: "planning",
        taskKind: "plan",
        applicableAxisIds: ["mobility"],
        publicSummary: "A public planning summary.",
      }) } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new OpenAICompatibleAdapter({ baseUrl: "https://provider.invalid/v1", apiKey: "server-secret", model: "demo-model" });
    const plan = await adapter.analyze({ prompt: "task", scenario: "standard", seed: "seed" }, new AbortController().signal);
    expect(plan.applicableAxisIds).toEqual(["mobility"]);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect((request.headers as Record<string, string>).Authorization).toBe("Bearer server-secret");
  });

  it("changes the authoritative mode to Fallback Replay only when fallback is enabled", async () => {
    const primary: AgentAdapter = {
      mode: "live",
      health: async () => ({ ok: false, mode: "live", label: "Live Provider" }),
      analyze: async () => { throw new Error("provider unavailable"); },
      gather: async () => { throw new Error("not reached"); },
      synthesize: async () => { throw new Error("not reached"); },
    };
    const adapter = new HybridAdapter(primary, true);

    const plan = await adapter.analyze({ prompt: "task", scenario: "standard", seed: "seed" }, new AbortController().signal);

    expect(plan.applicableAxisIds).toEqual(["mobility", "character"]);
    expect(adapter.mode).toBe("fallback");
    await expect(adapter.health()).resolves.toMatchObject({ label: "Fallback Replay", mode: "fallback" });
  });

  it("does not fall back when explicit permission is disabled", async () => {
    const primary: AgentAdapter = {
      mode: "live",
      health: async () => ({ ok: false, mode: "live", label: "Live Provider" }),
      analyze: async () => { throw new Error("provider unavailable"); },
      gather: async () => { throw new Error("not reached"); },
      synthesize: async () => { throw new Error("not reached"); },
    };
    const adapter = new HybridAdapter(primary, false);

    await expect(adapter.analyze(
      { prompt: "task", scenario: "standard", seed: "seed" },
      new AbortController().signal,
    )).rejects.toThrow("provider unavailable");
    expect(adapter.mode).toBe("live");
  });

  it("validates gather and synthesis responses and emits only public stages", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          source: "live",
          recordedAt: "2026-08-30T12:00:00.000Z",
          summary: "Four source records were reviewed.",
          evidenceItems: 4,
        }) } }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ answer: "Structured answer" }) } }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new OpenAICompatibleAdapter({
      baseUrl: "https://provider.invalid/v1",
      apiKey: "server-secret",
      model: "demo-model",
    });
    const stages: string[] = [];
    const signal = new AbortController().signal;
    const plan = {
      domain: "planning" as const,
      taskKind: "plan" as const,
      applicableAxisIds: ["mobility" as const],
      publicSummary: "Planning",
    };

    await expect(adapter.gather(plan, (event) => stages.push(event.stage), signal))
      .resolves.toMatchObject({ source: "live", evidenceItems: 4 });
    await expect(adapter.synthesize({
      prompt: "task",
      evidence: {
        source: "live",
        recordedAt: "2026-08-30T12:00:00.000Z",
        summary: "Evidence",
        evidenceItems: 4,
      },
      structuredPlan: { planId: "trusted-plan" },
      scenarioLabel: "Live provider presentation",
    }, signal)).resolves.toEqual({ answer: "Structured answer" });
    expect(stages).toEqual(["gathering", "evaluating"]);
  });

  it("performs one bounded retry and sanitizes a malformed provider response", async () => {
    const valid = new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        domain: "planning",
        taskKind: "plan",
        applicableAxisIds: [],
        publicSummary: "Planning",
      }) } }],
    }), { status: 200 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(valid);
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new OpenAICompatibleAdapter({
      baseUrl: "https://provider.invalid/v1",
      apiKey: "server-secret",
      model: "demo-model",
    });
    await expect(adapter.analyze(
      { prompt: "task", scenario: "standard", seed: "seed" },
      new AbortController().signal,
    )).resolves.toMatchObject({ applicableAxisIds: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "not-json-secret-provider-body" } }],
    }), { status: 200 }));
    await expect(adapter.analyze(
      { prompt: "task", scenario: "standard", seed: "seed" },
      new AbortController().signal,
    )).rejects.toThrow("No provider response details were exposed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propagates caller cancellation without exposing provider details", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", vi.fn(async (_url, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException("cancelled-secret", "AbortError");
      throw new Error("unexpected");
    }));
    const adapter = new OpenAICompatibleAdapter({
      baseUrl: "https://provider.invalid/v1",
      apiKey: "server-secret",
      model: "demo-model",
    });

    await expect(adapter.analyze(
      { prompt: "task", scenario: "standard", seed: "seed" },
      controller.signal,
    )).rejects.toMatchObject({ name: "AbortError" });
  });

  it("enforces the configured timeout with one bounded retry", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new OpenAICompatibleAdapter({
      baseUrl: "https://provider.invalid/v1",
      apiKey: "server-secret",
      model: "demo-model",
      timeoutMs: 50,
    });
    const request = adapter.analyze(
      { prompt: "task", scenario: "standard", seed: "seed" },
      new AbortController().signal,
    );
    const expectation = expect(request).rejects.toThrow("No provider response details were exposed");
    await vi.advanceTimersByTimeAsync(101);
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
