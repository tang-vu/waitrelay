"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  PublicEventSchema,
  type ChoiceAckEvent,
  type ChoiceRequest,
  type LifecycleStage,
  type ProviderMode,
  type RunCompleteEvent,
} from "@/shared/contracts/events";
import type { ContextCapsule } from "@/shared/contracts/context-capsule";
import type { CreateRunResponse, DemoScenario, RunStatus } from "./run-types";
import { CreateRunResponseSchema } from "./run-types";
import { shouldAcceptTransportEvent, shouldApplyPollingSnapshot } from "./transport-ordering";

type ConnectionState = "idle" | "connecting" | "live" | "polling" | "offline";

export interface CrossedPayload {
  direction: "host-to-flight" | "flight-to-host";
  capturedAt: string;
  payload: unknown;
}

export interface RunController {
  runId: string | null;
  status: RunStatus | "idle" | "unavailable";
  providerMode: ProviderMode | null;
  context: ContextCapsule | null;
  visualSeed: string | null;
  connection: ConnectionState;
  stage: LifecycleStage | null;
  activeChoice: ChoiceRequest | null;
  latestAck: ChoiceAckEvent | null;
  result: RunCompleteEvent | null;
  shouldShowActivity: boolean;
  activityDismissed: boolean;
  crossedPayloads: CrossedPayload[];
  error: string | null;
  transportEvidence: string | null;
  start: (prompt: string, options: StartOptions) => Promise<void>;
  choose: (request: ChoiceRequest, optionId: string, metadata?: { signalId: string; signalledAt: string }) => Promise<void>;
  skip: (request: ChoiceRequest) => void;
  dismissActivity: () => void;
  cancel: () => Promise<void>;
  recordFlightPayload: (direction: CrossedPayload["direction"], payload: unknown) => void;
}

export interface StartOptions {
  scenario: DemoScenario;
  seed: string;
  sensitive: boolean;
  interactionMode: "active" | "passive";
  forceDemo: boolean;
}

export interface RunControllerOptions {
  transportFault?: "polling" | "reconnect";
}

export function useRunController(options: RunControllerOptions = {}): RunController {
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus | "idle" | "unavailable">("idle");
  const [providerMode, setProviderMode] = useState<ProviderMode | null>(null);
  const [context, setContext] = useState<ContextCapsule | null>(null);
  const [visualSeed, setVisualSeed] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [stage, setStage] = useState<LifecycleStage | null>(null);
  const [activeChoice, setActiveChoice] = useState<ChoiceRequest | null>(null);
  const [latestAck, setLatestAck] = useState<ChoiceAckEvent | null>(null);
  const [result, setResult] = useState<RunCompleteEvent | null>(null);
  const [activityReady, setActivityReady] = useState(false);
  const [activityDismissed, setActivityDismissed] = useState(false);
  const [crossedPayloads, setCrossedPayloads] = useState<CrossedPayload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [transportEvidence, setTransportEvidence] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSequenceRef = useRef(-1);
  const seenEventIdsRef = useRef(new Set<string>());
  const currentRunRef = useRef<string | null>(null);
  const connectionOpensRef = useRef(0);
  const transportEpochRef = useRef(0);
  const pollEpochRef = useRef(0);
  const pollAbortRef = useRef<AbortController | null>(null);
  const startAbortRef = useRef<AbortController | null>(null);

  const recordFlightPayload = useCallback((direction: CrossedPayload["direction"], payload: unknown) => {
    setCrossedPayloads((current) => [...current.slice(-49), {
      direction,
      capturedAt: new Date().toISOString(),
      payload,
    }]);
  }, []);

  const stopPolling = useCallback(() => {
    pollEpochRef.current += 1;
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
  }, []);

  const clearTransport = useCallback(() => {
    transportEpochRef.current += 1;
    startAbortRef.current?.abort();
    startAbortRef.current = null;
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    stopPolling();
    if (mountTimerRef.current) clearTimeout(mountTimerRef.current);
    mountTimerRef.current = null;
  }, [stopPolling]);

  const acceptEvent = useCallback((input: unknown) => {
    const parsed = PublicEventSchema.safeParse(input);
    if (!parsed.success) return;
    const event = parsed.data;
    if (!shouldAcceptTransportEvent({
      expectedRunId: currentRunRef.current,
      eventRunId: event.runId,
      eventId: event.eventId,
      eventSequence: event.sequence,
      latestSequence: latestSequenceRef.current,
      seenEventIds: seenEventIdsRef.current,
    })) return;
    seenEventIdsRef.current.add(event.eventId);
    latestSequenceRef.current = event.sequence;
    if (event.type === "run.start") {
      setProviderMode(event.providerMode);
      setContext(event.context);
      setVisualSeed(event.visualSeed);
    }
    if (event.type === "run.progress") setStage(event.stage);
    if (event.type === "provider.mode") setProviderMode(event.providerMode);
    if (event.type === "choice.request") setActiveChoice(event);
    if (event.type === "choice.ack") {
      setLatestAck(event);
    }
    if (event.type === "run.complete") {
      performance.mark("waitrelay-run-complete-received");
      setResult(event);
      setStatus("completed");
      setConnection("idle");
      setProviderMode(event.providerMode);
      setActiveChoice(null);
      setActivityReady(false);
      clearTransport();
    }
    if (event.type === "run.cancel.ack") {
      setStatus("cancelled");
      setConnection("idle");
      setActiveChoice(null);
      setActivityReady(false);
      clearTransport();
    }
    if (event.type === "run.error") {
      setError(event.message);
      setStatus("failed");
      setConnection("idle");
      setActiveChoice(null);
      setActivityReady(false);
      clearTransport();
    }
  }, [clearTransport]);

  const beginPolling = useCallback((id: string) => {
    if (pollTimerRef.current) return;
    const epoch = transportEpochRef.current;
    const pollEpoch = pollEpochRef.current;
    const isCurrent = () => epoch === transportEpochRef.current && pollEpoch === pollEpochRef.current;
    let inFlight = false;
    setConnection(navigator.onLine ? "polling" : "offline");
    const poll = async () => {
      if (inFlight || !isCurrent()) return;
      inFlight = true;
      const abort = new AbortController();
      pollAbortRef.current = abort;
      const timeout = setTimeout(() => abort.abort(), 10_000);
      try {
        const response = await fetch(`/api/runs/${encodeURIComponent(id)}/snapshot`, { cache: "no-store", signal: abort.signal });
        if (!isCurrent()) return;
        if (response.status === 404 || response.status === 410) {
          clearTransport();
          setStatus("unavailable");
          setConnection("idle");
          setActiveChoice(null);
          setActivityReady(false);
          setError("The server no longer has this run. It may have expired or the service may have restarted. Your task is still in the composer.");
          return;
        }
        if (!response.ok) throw new Error("Snapshot unavailable");
        const snapshot = await response.json() as { runId: string; latestSequence: number; events: unknown[] };
        if (!isCurrent()) return;
        if (!shouldApplyPollingSnapshot({
          expectedRunId: currentRunRef.current,
          snapshotRunId: snapshot.runId,
          snapshotSequence: snapshot.latestSequence,
          latestSequence: latestSequenceRef.current,
        })) return;
        snapshot.events.forEach(acceptEvent);
        if (isCurrent()) setConnection("polling");
      } catch {
        if (isCurrent()) setConnection("offline");
      } finally {
        clearTimeout(timeout);
        if (pollAbortRef.current === abort) pollAbortRef.current = null;
        inFlight = false;
      }
    };
    void poll();
    pollTimerRef.current = setInterval(() => void poll(), 1_500);
  }, [acceptEvent, clearTransport]);

  const connect = useCallback((created: CreateRunResponse) => {
    const epoch = transportEpochRef.current;
    setConnection("connecting");
    if (options.transportFault === "polling") {
      setTransportEvidence("Fault Lab forced SSE unavailable. Validated snapshots are now authoritative.");
      beginPolling(created.runId);
      return;
    }
    const streamUrl = options.transportFault === "reconnect"
      ? `${created.streamUrl}?fault=reconnect-once`
      : created.streamUrl;
    let source: EventSource;
    try {
      source = new EventSource(streamUrl);
    } catch {
      beginPolling(created.runId);
      return;
    }
    eventSourceRef.current = source;
    source.onopen = () => {
      if (epoch !== transportEpochRef.current) return;
      connectionOpensRef.current += 1;
      stopPolling();
      setConnection("live");
      if (connectionOpensRef.current > 1) setTransportEvidence("SSE reconnected and replayed only events after Last-Event-ID.");
    };
    source.onmessage = (message) => {
      if (epoch !== transportEpochRef.current) return;
      try { acceptEvent(JSON.parse(message.data)); } catch { /* malformed events fail closed */ }
    };
    source.onerror = () => {
      if (epoch !== transportEpochRef.current) return;
      if (options.transportFault === "reconnect" && connectionOpensRef.current === 1) {
        setConnection("connecting");
        return;
      }
      beginPolling(created.runId);
    };
  }, [acceptEvent, beginPolling, options.transportFault, stopPolling]);

  const start = useCallback(async (prompt: string, options: StartOptions) => {
    clearTransport();
    const epoch = transportEpochRef.current;
    currentRunRef.current = null;
    setRunId(null);
    setProviderMode(null);
    performance.clearMarks("waitrelay-run-complete-received");
    performance.clearMarks("waitrelay-result-visible");
    performance.clearMeasures("waitrelay-completion-takeover");
    setStatus("running");
    setStage(null);
    setResult(null);
    setError(null);
    setTransportEvidence(null);
    setActiveChoice(null);
    setLatestAck(null);
    setContext(null);
    setVisualSeed(null);
    setActivityReady(false);
    setActivityDismissed(false);
    setCrossedPayloads([]);
    setConnection("connecting");
    latestSequenceRef.current = -1;
    seenEventIdsRef.current = new Set();
    connectionOpensRef.current = 0;
    // The wait starts at submission, not when a slow creation response arrives.
    mountTimerRef.current = setTimeout(() => setActivityReady(true), 850);
    const abort = new AbortController();
    startAbortRef.current = abort;
    const timeout = setTimeout(() => abort.abort(), 15_000);
    let failureMessage = "The start could not be confirmed. Check your connection and try again. Your task is still in the composer.";
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, ...options }),
        signal: abort.signal,
      });
      if (!response.ok) {
        if (response.status === 429) failureMessage = "The run service is busy. Wait a few seconds, then try again.";
        if (response.status === 400 || response.status === 413) failureMessage = "The task could not be accepted. Check your prompt and try again.";
        throw new Error("Start rejected");
      }
      const created = CreateRunResponseSchema.parse(await response.json());
      if (epoch !== transportEpochRef.current) return;
      currentRunRef.current = created.runId;
      setRunId(created.runId);
      setProviderMode(created.providerMode);
      connect(created);
    } catch {
      if (epoch !== transportEpochRef.current) return;
      clearTransport();
      setStatus("failed");
      setActivityReady(false);
      setConnection("offline");
      setError(failureMessage);
    } finally {
      clearTimeout(timeout);
      if (startAbortRef.current === abort) startAbortRef.current = null;
    }
  }, [clearTransport, connect]);

  const choose = useCallback(async (request: ChoiceRequest, optionId: string, metadata?: { signalId: string; signalledAt: string }) => {
    if (!runId || status !== "running" || request.runId !== runId) return;
    const epoch = transportEpochRef.current;
    const signalId = metadata?.signalId ?? crypto.randomUUID();
    const signalledAt = metadata?.signalledAt ?? new Date().toISOString();
    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/choices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.requestId, optionId, signalId, signalledAt }),
      });
      if (!response.ok) throw new Error("choice relay failed");
    } catch {
      if (epoch !== transportEpochRef.current) return;
      setTransportEvidence("Choice confirmation was interrupted. The agent is continuing, and the final Impact Receipt is authoritative.");
      setActiveChoice(null);
      setActivityDismissed(true);
    }
  }, [runId, status]);

  const skip = useCallback((request: ChoiceRequest) => {
    if (activeChoice?.requestId === request.requestId) setActiveChoice(null);
  }, [activeChoice]);

  const cancel = useCallback(async () => {
    if (!runId || status !== "running") return;
    const epoch = transportEpochRef.current;
    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" });
      if (!response.ok) throw new Error("cancel failed");
    } catch {
      if (epoch !== transportEpochRef.current) return;
      setTransportEvidence("Cancellation confirmation was interrupted. The next authoritative run event determines the terminal state.");
    }
  }, [runId, status]);

  useEffect(() => {
    const offline = () => { if (status === "running") setConnection("offline"); };
    const online = () => {
      if (status === "running" && currentRunRef.current) beginPolling(currentRunRef.current);
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [beginPolling, status]);

  useEffect(() => clearTransport, [clearTransport]);

  return useMemo(() => ({
    runId, status, providerMode, context, visualSeed, connection, stage, activeChoice, latestAck, result,
    shouldShowActivity: status === "running" && activityReady && !activityDismissed,
    activityDismissed, crossedPayloads, error, transportEvidence, start, choose, skip,
    dismissActivity: () => setActivityDismissed(true), cancel, recordFlightPayload,
  }), [runId, status, providerMode, context, visualSeed, connection, stage, activeChoice, latestAck, result,
    activityReady, activityDismissed, crossedPayloads, error, transportEvidence, start, choose, skip, cancel,
    recordFlightPayload]);
}
