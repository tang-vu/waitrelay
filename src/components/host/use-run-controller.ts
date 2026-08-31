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
import { shouldAcceptTransportEvent, shouldApplyPollingSnapshot } from "./transport-ordering";

type ConnectionState = "idle" | "connecting" | "live" | "polling" | "offline";

export interface CrossedPayload {
  direction: "host-to-flight" | "flight-to-host";
  capturedAt: string;
  payload: unknown;
}

export interface RunController {
  runId: string | null;
  status: RunStatus | "idle";
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
  const [status, setStatus] = useState<RunStatus | "idle">("idle");
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

  const recordFlightPayload = useCallback((direction: CrossedPayload["direction"], payload: unknown) => {
    setCrossedPayloads((current) => [...current.slice(-49), {
      direction,
      capturedAt: new Date().toISOString(),
      payload,
    }]);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
  }, []);

  const clearTransport = useCallback(() => {
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
      setProviderMode(event.providerMode);
      setActiveChoice(null);
      setActivityReady(false);
      clearTransport();
    }
    if (event.type === "run.cancel.ack") {
      setStatus("cancelled");
      setActiveChoice(null);
      setActivityReady(false);
      clearTransport();
    }
    if (event.type === "run.error") {
      setError(event.message);
      setStatus("failed");
      setActiveChoice(null);
      setActivityReady(false);
      clearTransport();
    }
  }, [clearTransport]);

  const beginPolling = useCallback((id: string) => {
    if (pollTimerRef.current) return;
    setConnection(navigator.onLine ? "polling" : "offline");
    const poll = async () => {
      try {
        const response = await fetch(`/api/runs/${encodeURIComponent(id)}/snapshot`, { cache: "no-store" });
        if (!response.ok) return;
        const snapshot = await response.json() as { runId: string; latestSequence: number; events: unknown[] };
        if (!shouldApplyPollingSnapshot({
          expectedRunId: currentRunRef.current,
          snapshotRunId: snapshot.runId,
          snapshotSequence: snapshot.latestSequence,
          latestSequence: latestSequenceRef.current,
        })) return;
        snapshot.events.forEach(acceptEvent);
        setConnection("polling");
      } catch {
        setConnection("offline");
      }
    };
    void poll();
    pollTimerRef.current = setInterval(() => void poll(), 1_500);
  }, [acceptEvent]);

  const connect = useCallback((created: CreateRunResponse) => {
    setConnection("connecting");
    if (options.transportFault === "polling") {
      setTransportEvidence("Fault Lab forced SSE unavailable. Validated snapshots are now authoritative.");
      beginPolling(created.runId);
      return;
    }
    const streamUrl = options.transportFault === "reconnect"
      ? `${created.streamUrl}?fault=reconnect-once`
      : created.streamUrl;
    const source = new EventSource(streamUrl);
    eventSourceRef.current = source;
    source.onopen = () => {
      connectionOpensRef.current += 1;
      stopPolling();
      setConnection("live");
      if (connectionOpensRef.current > 1) setTransportEvidence("SSE reconnected and replayed only events after Last-Event-ID.");
    };
    source.onmessage = (message) => {
      try { acceptEvent(JSON.parse(message.data)); } catch { /* malformed events fail closed */ }
    };
    source.onerror = () => {
      if (options.transportFault === "reconnect" && connectionOpensRef.current === 1) {
        setConnection("connecting");
        return;
      }
      beginPolling(created.runId);
    };
  }, [acceptEvent, beginPolling, options.transportFault, stopPolling]);

  const start = useCallback(async (prompt: string, options: StartOptions) => {
    clearTransport();
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
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, ...options }),
      });
      if (!response.ok) throw new Error("The run could not be started.");
      const created = await response.json() as CreateRunResponse;
      currentRunRef.current = created.runId;
      setRunId(created.runId);
      setProviderMode(created.providerMode);
      connect(created);
      mountTimerRef.current = setTimeout(() => setActivityReady(true), 850);
    } catch (startError) {
      setStatus("failed");
      setConnection("offline");
      setError(startError instanceof Error ? startError.message : "The run could not be started.");
    }
  }, [clearTransport, connect]);

  const choose = useCallback(async (request: ChoiceRequest, optionId: string, metadata?: { signalId: string; signalledAt: string }) => {
    if (!runId || status !== "running") return;
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
      setTransportEvidence("Choice was not confirmed. The flight closed and the run is continuing with defaults.");
      setActiveChoice(null);
      setActivityDismissed(true);
    }
  }, [runId, status]);

  const skip = useCallback((request: ChoiceRequest) => {
    if (activeChoice?.requestId === request.requestId) setActiveChoice(null);
  }, [activeChoice]);

  const cancel = useCallback(async () => {
    if (!runId || status !== "running") return;
    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" });
      if (!response.ok) throw new Error("cancel failed");
    } catch {
      setTransportEvidence("Cancellation was not confirmed. The agent run remains active.");
    }
  }, [runId, status]);

  useEffect(() => {
    const offline = () => setConnection("offline");
    const online = () => { if (status === "running") setConnection("polling"); };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      clearTransport();
    };
  }, [clearTransport, status]);

  return useMemo(() => ({
    runId, status, providerMode, context, visualSeed, connection, stage, activeChoice, latestAck, result,
    shouldShowActivity: status === "running" && activityReady && !activityDismissed,
    activityDismissed, crossedPayloads, error, transportEvidence, start, choose, skip,
    dismissActivity: () => setActivityDismissed(true), cancel, recordFlightPayload,
  }), [runId, status, providerMode, context, visualSeed, connection, stage, activeChoice, latestAck, result,
    activityReady, activityDismissed, crossedPayloads, error, transportEvidence, start, choose, skip, cancel,
    recordFlightPayload]);
}
