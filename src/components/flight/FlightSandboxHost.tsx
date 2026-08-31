"use client";

import { useCallback, useEffect, useRef } from "react";

import type { ContextCapsule } from "../../shared/contracts/context-capsule";
import {
  FLIGHT_BRIDGE_VERSION,
  connectFlightHost,
  makeBridgeEnvelope,
  type FlightHostBridge,
  type FlightToHostMessage,
  type SafeFlightAck,
  type SafeFlightGate,
} from "../../features/flight/bridge";
import type { FlightChoiceSelection } from "./FlightFrame";
import styles from "./flight.module.css";

export type FlightSandboxHostProps = {
  src?: string;
  runId: string;
  nonce: string;
  context: ContextCapsule;
  visualSeed: string;
  stage: "understanding" | "gathering" | "evaluating" | "composing" | "verifying";
  gate?: SafeFlightGate | null;
  acknowledgement?: SafeFlightAck | null;
  terminal?: "completed" | "cancelled" | "failed" | null;
  mode?: "active" | "passive";
  sensitive?: boolean;
  onSignal: (selection: FlightChoiceSelection) => void;
  onSkip?: (requestId: string) => void;
  onDismiss?: () => void;
  onModeChange?: (mode: "active" | "passive") => void;
  onCrossBoundary?: (direction: "host-to-flight" | "flight-to-host", payload: unknown) => void;
  onFailure?: () => void;
};

export function FlightSandboxHost({
  src = "/flight",
  runId,
  nonce,
  context,
  visualSeed,
  stage,
  gate,
  acknowledgement,
  terminal = null,
  mode = "active",
  sensitive = false,
  onSignal,
  onSkip,
  onDismiss,
  onModeChange,
  onCrossBoundary,
  onFailure,
}: FlightSandboxHostProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<FlightHostBridge | undefined>(undefined);
  const readyRef = useRef(false);
  const connectTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const failureTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbackRef = useRef({ onSignal, onSkip, onDismiss, onModeChange, onCrossBoundary, onFailure });
  useEffect(() => {
    callbackRef.current = { onSignal, onSkip, onDismiss, onModeChange, onCrossBoundary, onFailure };
  }, [onCrossBoundary, onDismiss, onFailure, onModeChange, onSignal, onSkip]);

  const handleFlightMessage = useCallback((message: FlightToHostMessage) => {
    if (message.type === "flight.ready") {
      readyRef.current = true;
      connectTimersRef.current.forEach(clearTimeout);
      connectTimersRef.current = [];
      if (failureTimerRef.current) clearTimeout(failureTimerRef.current);
      failureTimerRef.current = undefined;
    } else if (message.type === "choice.signal") {
      callbackRef.current.onSignal({
        requestId: message.requestId,
        optionId: message.optionId,
        signalId: message.signalId,
        signalledAt: message.signalledAt,
      });
    } else if (message.type === "choice.skip") {
      callbackRef.current.onSkip?.(message.requestId);
    } else if (message.type === "flight.dismiss") {
      callbackRef.current.onDismiss?.();
    } else if (message.type === "flight.mode.change") {
      callbackRef.current.onModeChange?.(message.mode);
    } else if (message.type === "flight.failure") {
      callbackRef.current.onFailure?.();
    }
  }, []);

  const openChannel = useCallback(() => {
    if (readyRef.current) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    bridgeRef.current?.destroy();
    bridgeRef.current = connectFlightHost({
      iframe,
      connect: {
        type: "flight.port.connect",
        bridgeVersion: FLIGHT_BRIDGE_VERSION,
        runId,
        nonce,
        context,
        stage,
        visualSeed,
        sensitive,
      },
      onMessage: handleFlightMessage,
      onCrossBoundary: (direction, payload) => callbackRef.current.onCrossBoundary?.(direction, payload),
    });
    const bridge = bridgeRef.current;
    bridge.send(makeBridgeEnvelope({ runId, nonce }, { type: "run.progress", stage }));
    bridge.send(makeBridgeEnvelope({ runId, nonce }, { type: "flight.mode", mode }));
    if (gate) bridge.send(makeBridgeEnvelope({ runId, nonce }, { type: "choice.request", gate }));
    if (acknowledgement) {
      bridge.send(makeBridgeEnvelope({ runId, nonce }, { type: "choice.ack", acknowledgement }));
    }
    if (terminal) bridge.send(makeBridgeEnvelope({ runId, nonce }, { type: "run.terminal", status: terminal }));
  }, [acknowledgement, context, gate, handleFlightMessage, mode, nonce, runId, sensitive, stage, terminal, visualSeed]);

  const beginHandshake = useCallback(() => {
    readyRef.current = false;
    connectTimersRef.current.forEach(clearTimeout);
    connectTimersRef.current = [];
    if (failureTimerRef.current) clearTimeout(failureTimerRef.current);
    openChannel();
    connectTimersRef.current = [100, 300, 700].map((delay) => setTimeout(openChannel, delay));
    failureTimerRef.current = setTimeout(() => {
      connectTimersRef.current.forEach(clearTimeout);
      connectTimersRef.current = [];
      bridgeRef.current?.destroy();
      bridgeRef.current = undefined;
      callbackRef.current.onFailure?.();
    }, 2_500);
  }, [openChannel]);

  useEffect(() => () => {
    connectTimersRef.current.forEach(clearTimeout);
    if (failureTimerRef.current) clearTimeout(failureTimerRef.current);
    bridgeRef.current?.destroy();
  }, []);
  useEffect(() => {
    bridgeRef.current?.send(makeBridgeEnvelope({ runId, nonce }, { type: "run.progress", stage }));
  }, [nonce, runId, stage]);
  useEffect(() => {
    if (gate) {
      bridgeRef.current?.send(makeBridgeEnvelope({ runId, nonce }, { type: "choice.request", gate }));
    }
  }, [gate, nonce, runId]);
  useEffect(() => {
    if (acknowledgement) {
      bridgeRef.current?.send(makeBridgeEnvelope({ runId, nonce }, { type: "choice.ack", acknowledgement }));
    }
  }, [acknowledgement, nonce, runId]);
  useEffect(() => {
    if (terminal) {
      bridgeRef.current?.send(makeBridgeEnvelope({ runId, nonce }, { type: "run.terminal", status: terminal }));
    }
  }, [nonce, runId, terminal]);
  useEffect(() => {
    bridgeRef.current?.send(makeBridgeEnvelope({ runId, nonce }, { type: "flight.mode", mode }));
  }, [mode, nonce, runId]);

  return (
    <iframe
      key={runId}
      ref={iframeRef}
      className={`${styles.sandbox} ${terminal ? styles.terminal : ""}`}
      src={src}
      title="WaitRelay Fork Flight"
      // Keep the document at an opaque origin. Next static modules opt into
      // cross-origin loading, while the run-scoped MessageChannel is the only
      // application data path into the frame.
      sandbox="allow-scripts"
      allow="accelerometer 'none'; autoplay 'none'; camera 'none'; clipboard-read 'none'; clipboard-write 'none'; geolocation 'none'; microphone 'none'; payment 'none'"
      referrerPolicy="no-referrer"
      tabIndex={terminal ? -1 : 0}
      aria-hidden={terminal ? "true" : undefined}
      onLoad={beginHandshake}
      onError={onFailure}
    />
  );
}
