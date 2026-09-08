// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRunController, type StartOptions } from "@/components/host/use-run-controller";

const options: StartOptions = {
  scenario: "standard", seed: "test-seed", sensitive: false,
  interactionMode: "active", forceDemo: true,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function created(runId: string) {
  return { ok: true, json: async () => ({
    runId, providerMode: "demo", streamUrl: `/api/runs/${runId}/events`,
    snapshotUrl: `/api/runs/${runId}/snapshot`,
  }) };
}

class Stream {
  static instances: Stream[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  close = vi.fn();
  constructor(readonly url: string) { Stream.instances.push(this); }
}

describe("run controller lifecycle isolation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Stream.instances = [];
    vi.stubGlobal("EventSource", Stream);
    for (const name of ["clearMarks", "clearMeasures", "mark"] as const) {
      vi.spyOn(performance, name).mockImplementation(() => undefined as never);
    }
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the latest start when creation responses arrive in reverse order", async () => {
    const old = deferred<ReturnType<typeof created>>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(created("new")));
    const { result } = renderHook(() => useRunController());
    let first!: Promise<void>;
    act(() => { first = result.current.start("old", options); });
    await act(async () => { await result.current.start("new", options); });
    await act(async () => { old.resolve(created("old")); await first; });
    expect(result.current.runId).toBe("new");
    expect(Stream.instances.map((stream) => stream.url)).toEqual(["/api/runs/new/events"]);
    expect(Stream.instances[0].close).not.toHaveBeenCalled();
  });

  it("counts creation latency toward the activity delay", async () => {
    const response = deferred<ReturnType<typeof created>>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(response.promise));
    const { result } = renderHook(() => useRunController());
    let pending!: Promise<void>;
    act(() => { pending = result.current.start("task", options); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });
    await act(async () => { response.resolve(created("slow-start")); await pending; });
    expect(result.current.shouldShowActivity).toBe(true);
  });

  it("ignores an old start failure after a new run starts", async () => {
    const old = deferred<never>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(created("new")));
    const { result } = renderHook(() => useRunController());
    let first!: Promise<void>;
    act(() => { first = result.current.start("old", options); });
    await act(async () => { await result.current.start("new", options); });
    await act(async () => { old.reject(new Error("old failure")); await first; });
    expect(result.current.status).toBe("running");
    expect(result.current.error).toBeNull();
  });

  it("does not open a stream when creation resolves after unmount", async () => {
    const response = deferred<ReturnType<typeof created>>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(response.promise));
    const { result, unmount } = renderHook(() => useRunController());
    let pending!: Promise<void>;
    act(() => { pending = result.current.start("task", options); });
    unmount();
    await act(async () => { response.resolve(created("old")); await pending; });
    expect(Stream.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores queued callbacks from a closed stream", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(created("old")).mockResolvedValueOnce(created("new"));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useRunController());
    await act(async () => { await result.current.start("old", options); });
    const old = Stream.instances[0];
    await act(async () => { await result.current.start("new", options); });
    act(() => { old.onopen?.(); old.onerror?.(); });
    expect(result.current.connection).toBe("connecting");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not overlap slow polls or let their failure overwrite a newer run", async () => {
    const snapshot = deferred<never>();
    const fetch = vi.fn().mockResolvedValueOnce(created("old"))
      .mockReturnValueOnce(snapshot.promise).mockResolvedValueOnce(created("new"));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useRunController());
    await act(async () => { await result.current.start("old", options); });
    act(() => { Stream.instances[0].onerror?.(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(4_500); });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => { await result.current.start("new", options); });
    act(() => { Stream.instances[1].onopen?.(); });
    await act(async () => { snapshot.reject(new Error("old offline request")); });
    expect(result.current.connection).toBe("live");
    expect(result.current.runId).toBe("new");
  });

  it("falls back to snapshots if EventSource cannot be constructed", async () => {
    vi.stubGlobal("EventSource", undefined);
    const fetch = vi.fn().mockResolvedValueOnce(created("run"))
      .mockResolvedValue({ ok: true, json: async () => ({ runId: "run", latestSequence: 0, events: [] }) });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useRunController());
    await act(async () => { await result.current.start("task", options); });
    expect(result.current.status).toBe("running");
    expect(result.current.connection).toBe("polling");
    expect(fetch.mock.calls[1][0]).toBe("/api/runs/run/snapshot");
  });

  it("ends unavailable polling without claiming the server cancelled or failed", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(created("gone"))
      .mockResolvedValueOnce({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useRunController({ transportFault: "polling" }));
    await act(async () => { await result.current.start("task", options); });
    expect(result.current.status).toBe("unavailable");
    expect(result.current.connection).toBe("idle");
    expect(result.current.shouldShowActivity).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("ignores an old missing-run response after a newer stream connects", async () => {
    const snapshot = deferred<{ ok: false; status: number }>();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(created("old"))
      .mockReturnValueOnce(snapshot.promise).mockResolvedValueOnce(created("new")));
    const { result } = renderHook(() => useRunController());
    await act(async () => { await result.current.start("old", options); });
    act(() => { Stream.instances[0].onerror?.(); });
    await act(async () => { await result.current.start("new", options); });
    act(() => { Stream.instances[1].onopen?.(); });
    await act(async () => { snapshot.resolve({ ok: false, status: 404 }); });
    expect(result.current.status).toBe("running");
    expect(result.current.connection).toBe("live");
  });

  it("does not let a poll overwrite the stream after reconnection", async () => {
    const snapshot = deferred<never>();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(created("run")).mockReturnValueOnce(snapshot.promise));
    const { result } = renderHook(() => useRunController());
    await act(async () => { await result.current.start("task", options); });
    act(() => { Stream.instances[0].onerror?.(); Stream.instances[0].onopen?.(); });
    await act(async () => { snapshot.reject(new Error("stale failure")); });
    expect(result.current.connection).toBe("live");
  });

  it("rejects transport URLs outside the created run without leaking response details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      runId: "run", providerMode: "demo", streamUrl: "https://external.invalid/PRIVATE_CANARY",
      snapshotUrl: "/api/runs/run/snapshot",
    }) }));
    const { result } = renderHook(() => useRunController());
    await act(async () => { await result.current.start("task", options); });
    expect(Stream.instances).toHaveLength(0);
    expect(result.current.status).toBe("failed");
    expect(result.current.error).not.toContain("PRIVATE_CANARY");
    expect(result.current.runId).toBeNull();
  });

  it("bounds a stalled start request and allows a later retry", async () => {
    const fetch = vi.fn().mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })).mockResolvedValueOnce(created("retry"));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useRunController());
    let pending!: Promise<void>;
    act(() => { pending = result.current.start("task", options); });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); await pending; });
    expect(result.current.status).toBe("failed");
    expect(result.current.error).toContain("could not be confirmed");
    await act(async () => { await result.current.start("task", options); });
    expect(result.current.runId).toBe("retry");
    expect(result.current.status).toBe("running");
  });

  it("retries a transient snapshot failure instead of declaring the run lost", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(created("run"))
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: "run", latestSequence: 0, events: [] }) });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useRunController({ transportFault: "polling" }));
    await act(async () => { await result.current.start("task", options); });
    expect(result.current.status).toBe("running");
    expect(result.current.connection).toBe("offline");
    await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });
    expect(result.current.connection).toBe("polling");
  });

  it("aborts a stalled snapshot so the next polling attempt can recover", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(created("run"))
      .mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: "run", latestSequence: 0, events: [] }) });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useRunController({ transportFault: "polling" }));
    await act(async () => { await result.current.start("task", options); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("running");
    expect(result.current.connection).toBe("offline");
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.current.connection).toBe("polling");
  });
});
