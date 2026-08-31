"use client";

import { Component, type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import {
  acceptFlightClient,
  type FlightClientConnection,
  type HostToFlightMessage,
  type SafeFlightAck,
  type SafeFlightGate,
} from "../../features/flight/bridge";
import type { ContextCapsule } from "../../shared/contracts/context-capsule";
import { FlightFrame, type FlightChoiceSelection } from "./FlightFrame";
import { PassiveExperience } from "./PassiveExperience";

type EmbeddedState = {
  context: ContextCapsule;
  visualSeed: string;
  stage: "understanding" | "gathering" | "evaluating" | "composing" | "verifying";
  sensitive: boolean;
  gate?: SafeFlightGate;
  acknowledgement?: SafeFlightAck;
  terminal?: "completed" | "cancelled" | "failed";
  mode: "active" | "passive";
};

export type EmbeddedFlightFrameProps = {
  forceReducedMotion?: boolean;
  forceRendererFailure?: boolean;
  onCrossBoundary?: (direction: "host-to-flight" | "flight-to-host", payload: unknown) => void;
};

class FlightRendererBoundary extends Component<{
  children: ReactNode;
  onFailure: () => void;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  render() {
    if (this.state.failed) return <PassiveExperience stage="Renderer stopped" compact />;
    return this.props.children;
  }
}

function RendererFault({ active, children }: { active: boolean; children: ReactNode }) {
  if (active) throw new Error("Controlled Fault Lab renderer failure");
  return children;
}

export function EmbeddedFlightFrame({ forceReducedMotion, forceRendererFailure = false, onCrossBoundary }: EmbeddedFlightFrameProps) {
  const connectionRef = useRef<FlightClientConnection | undefined>(undefined);
  const inspectorRef = useRef(onCrossBoundary);
  const [state, setState] = useState<EmbeddedState>();

  useEffect(() => {
    inspectorRef.current = onCrossBoundary;
  }, [onCrossBoundary]);

  useEffect(() => {
    const dispose = acceptFlightClient({
      onConnect(connection) {
        connectionRef.current?.destroy();
        connectionRef.current = connection;
        setState({
          context: connection.connect.context,
          visualSeed: connection.connect.visualSeed,
          stage: connection.connect.stage,
          sensitive: connection.connect.sensitive,
          mode: connection.connect.context.interactionMode,
        });
      },
      onMessage(message: HostToFlightMessage) {
        setState((current) => {
          if (!current) return current;
          if (message.type === "run.progress") return { ...current, stage: message.stage };
          if (message.type === "choice.request") return { ...current, gate: message.gate, acknowledgement: undefined };
          if (message.type === "choice.clear") {
            return current.gate?.requestId === message.requestId
              ? { ...current, gate: undefined, acknowledgement: undefined }
              : current;
          }
          if (message.type === "choice.ack") return { ...current, acknowledgement: message.acknowledgement };
          if (message.type === "run.terminal") return { ...current, gate: undefined, terminal: message.status };
          if (message.type === "flight.mode") return { ...current, mode: message.mode };
          return current;
        });
      },
      onCrossBoundary(direction, payload) {
        inspectorRef.current?.(direction, payload);
      },
    });
    return () => {
      dispose();
      connectionRef.current = undefined;
    };
  }, []);

  const sendSignal = useCallback((selection: FlightChoiceSelection) => {
    connectionRef.current?.send({ type: "choice.signal", ...selection });
  }, []);
  const sendSkip = useCallback((requestId: string) => {
    connectionRef.current?.send({ type: "choice.skip", requestId });
  }, []);
  const sendMode = useCallback((mode: "active" | "passive") => {
    connectionRef.current?.send({ type: "flight.mode.change", mode });
  }, []);
  const dismiss = useCallback(() => {
    connectionRef.current?.send({ type: "flight.dismiss" });
  }, []);
  const reportRendererFailure = useCallback(() => {
    connectionRef.current?.send({ type: "flight.failure", code: "renderer-error" });
  }, []);

  if (!state) return <PassiveExperience stage="Connecting flight" compact />;

  return (
    <FlightRendererBoundary onFailure={reportRendererFailure}>
      <RendererFault active={forceRendererFailure}>
        <FlightFrame
          visualSeed={state.visualSeed}
          waitBand={state.context.waitBand}
          stage={state.stage}
          gate={state.gate}
          acknowledgement={state.acknowledgement}
          mode={state.mode}
          terminal={state.terminal}
          forceReducedMotion={forceReducedMotion}
          sensitive={state.sensitive}
          onSignal={sendSignal}
          onSkip={sendSkip}
          onModeChange={sendMode}
          onDismiss={dismiss}
        />
      </RendererFault>
    </FlightRendererBoundary>
  );
}
