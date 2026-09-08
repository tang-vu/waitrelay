"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePrefersReducedMotion } from "../../features/flight/accessibility/use-reduced-motion";
import type { SafeFlightAck, SafeFlightGate } from "../../features/flight/bridge";
import {
  createFlightEngine,
  setFlightIntent,
  setFlightTerminal,
  updateFlightEngine,
  type FlightEngineState,
} from "../../features/flight/engine/flight-engine";
import { useFlightInput } from "../../features/flight/input/use-flight-input";
import { flightSceneryAt } from "../../features/flight/engine/flight-scenery";
import { renderFlight, type FlightRenderStage } from "../../features/flight/renderer/canvas-renderer";
import { PassiveExperience } from "./PassiveExperience";
import { ReducedMotionExperience } from "./ReducedMotionExperience";
import styles from "./flight.module.css";

export type FlightChoiceSelection = {
  requestId: string;
  optionId: SafeFlightGate["options"][number]["optionId"];
  signalId: string;
  signalledAt: string;
};

export type FlightFrameProps = {
  visualSeed: string;
  waitBand: "instant" | "short" | "medium" | "long";
  stage: FlightRenderStage;
  gate?: SafeFlightGate | null;
  acknowledgement?: SafeFlightAck | null;
  mode?: "active" | "passive";
  terminal?: "completed" | "cancelled" | "failed" | null;
  forceReducedMotion?: boolean;
  sensitive?: boolean;
  onSignal: (selection: FlightChoiceSelection) => void;
  onSkip?: (requestId: string) => void;
  onModeChange?: (mode: "active" | "passive") => void;
  onDismiss?: () => void;
  className?: string;
};

function createSignalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `signal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function stageLabel(stage: FlightRenderStage): string {
  return `${stage.charAt(0).toUpperCase()}${stage.slice(1)}`;
}

function ackLabel(acknowledgement?: SafeFlightAck | null): string | undefined {
  if (!acknowledgement) return undefined;
  if (acknowledgement.status === "appliedNow") return "Applied now";
  if (acknowledgement.status === "tooLate") return "Too late for this run";
  if (acknowledgement.status === "savedNext") return "Saved for next time";
  return "Choice not applied";
}

const optionDescriptions: Readonly<Record<string, string>> = {
  "less-walking": "Keep the route compact.",
  "more-discovery": "Travel farther for distinctive stops.",
  reliable: "Favor stronger source confidence.",
  surprising: "Favor novelty with adequate evidence.",
  practical: "Prioritize immediately useful choices.",
  creative: "Explore a less expected direction.",
  breadth: "Cover more viable possibilities.",
  depth: "Investigate fewer options more deeply.",
  concise: "Keep the final response focused.",
  detailed: "Include more supporting detail.",
  speed: "Use the evidence already available.",
  confidence: "Require additional verification.",
};

export function FlightFrame({
  visualSeed,
  waitBand,
  stage,
  gate,
  acknowledgement,
  mode = "active",
  terminal = null,
  forceReducedMotion = false,
  sensitive = false,
  onSignal,
  onSkip,
  onModeChange,
  onDismiss,
  className,
}: FlightFrameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FlightEngineState>(createFlightEngine(visualSeed));
  const [modeOverride, setModeOverride] = useState<{
    source: "active" | "passive";
    value: "active" | "passive";
  }>();
  const [selection, setSelection] = useState<{
    requestId: string;
    optionId: SafeFlightGate["options"][number]["optionId"];
    signalId: string;
  }>();
  const systemReducedMotion = usePrefersReducedMotion();
  const reducedMotion = forceReducedMotion || systemReducedMotion;
  const isTerminal = terminal !== null;
  const localMode = modeOverride?.source === mode ? modeOverride.value : mode;
  const currentSelection = selection?.requestId === gate?.requestId ? selection : undefined;
  const selectedOptionId = currentSelection?.optionId;
  const selectedSignalId = currentSelection?.signalId;

  useEffect(() => {
    engineRef.current = createFlightEngine(visualSeed);
  }, [visualSeed]);
  useEffect(() => {
    setFlightIntent(engineRef.current, "neutral");
  }, [gate?.requestId]);
  useEffect(() => setFlightTerminal(engineRef.current, isTerminal), [isTerminal]);

  const choose = useCallback((optionId: SafeFlightGate["options"][number]["optionId"]) => {
    if (!gate || selectedOptionId || isTerminal) return;
    const optionIndex = gate.options.findIndex((option) => option.optionId === optionId);
    if (optionIndex < 0) return;
    const signalId = createSignalId();
    setSelection({ requestId: gate.requestId, optionId, signalId });
    setFlightIntent(engineRef.current, optionIndex === 0 ? "upper" : "lower");
    onSignal({
      requestId: gate.requestId,
      optionId,
      signalId,
      signalledAt: new Date().toISOString(),
    });
  }, [gate, isTerminal, onSignal, selectedOptionId]);

  const skip = useCallback(() => {
    if (!gate || isTerminal) return;
    onSkip?.(gate.requestId);
  }, [gate, isTerminal, onSkip]);

  const chooseUpper = useCallback(() => {
    if (gate) choose(gate.options[0].optionId);
  }, [choose, gate]);
  const chooseLower = useCallback(() => {
    if (gate) choose(gate.options[1].optionId);
  }, [choose, gate]);

  useFlightInput({
    chooseUpper,
    chooseLower,
    skip,
    enabled: Boolean(gate) && !selectedOptionId && !isTerminal && localMode === "active" && !reducedMotion,
  });

  const selectedLane = useMemo(() => {
    if (!gate || !selectedOptionId) return undefined;
    return gate.options[0].optionId === selectedOptionId ? "upper" as const : "lower" as const;
  }, [gate, selectedOptionId]);
  const acknowledgementForSelection = acknowledgement && acknowledgement.requestId === gate?.requestId
    && acknowledgement.signalId === selectedSignalId
    ? acknowledgement
    : undefined;
  const renderOptionsRef = useRef({
    stage,
    gateVisible: Boolean(gate),
    selectedLane,
    acknowledged: acknowledgementForSelection?.status === "appliedNow",
    terminal: isTerminal,
    ghostVisible: !sensitive,
    modular: waitBand === "long",
  });

  useEffect(() => {
    renderOptionsRef.current = {
      stage,
      gateVisible: Boolean(gate),
      selectedLane,
      acknowledged: acknowledgementForSelection?.status === "appliedNow",
      terminal: isTerminal,
      ghostVisible: !sensitive,
      modular: waitBand === "long",
    };
  }, [acknowledgementForSelection?.status, gate, isTerminal, selectedLane, sensitive, stage, waitBand]);

  useEffect(() => {
    if (reducedMotion || localMode !== "active" || waitBand === "instant") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    let frame = 0;
    let previous = performance.now();
    let width = 1;
    let height = 1;
    const resize = () => {
      const rectangle = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rectangle.width);
      height = Math.max(1, rectangle.height);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = (now: number) => {
      engineRef.current = updateFlightEngine(engineRef.current, (now - previous) / 1_000);
      previous = now;
      if (renderOptionsRef.current.modular) {
        const scenery = flightSceneryAt(engineRef.current.sceneryElapsed);
        if (canvas.dataset.flightLoop !== String(scenery.loop)) {
          canvas.dataset.flightLoop = String(scenery.loop);
          canvas.dataset.flightScenery = scenery.name;
        }
      }
      renderFlight(context, width, height, engineRef.current, renderOptionsRef.current);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [localMode, reducedMotion, waitBand]);

  const switchMode = useCallback((nextMode: "active" | "passive") => {
    setModeOverride({ source: mode, value: nextMode });
    onModeChange?.(nextMode);
  }, [mode, onModeChange]);

  if (isTerminal && (waitBand === "instant" || localMode === "passive" || reducedMotion)) {
    return (
      <div className={`${styles.instant} ${styles.terminal}`} aria-hidden="true" data-flight-terminal={terminal}>
        <div className={styles.passiveCopy}>
          <span className={styles.miniBird} />
          <p className={styles.stage}>{terminal === "completed" ? "Answer ready" : "Flight ended"}</p>
        </div>
      </div>
    );
  }

  if (waitBand === "instant") {
    return <PassiveExperience stage={stage} compact />;
  }

  if (localMode === "passive") {
    return (
      <PassiveExperience
        stage={stage}
        onResume={() => switchMode("active")}
        onDismiss={onDismiss}
      />
    );
  }

  if (reducedMotion) {
    return (
      <ReducedMotionExperience
        stage={stageLabel(stage)}
        gate={gate}
        selectedOptionId={selectedOptionId}
        acknowledgement={acknowledgementForSelection}
        terminal={isTerminal}
        onChoose={choose}
        onSkip={skip}
        onPassive={() => switchMode("passive")}
        onDismiss={() => onDismiss?.()}
      />
    );
  }

  const feedback = ackLabel(acknowledgementForSelection);
  const priorFeedback = !acknowledgementForSelection ? ackLabel(acknowledgement) : undefined;
  return (
    <section
      className={`${styles.shell} ${isTerminal ? styles.terminal : ""} ${className ?? ""}`}
      aria-label="WaitRelay Fork Flight"
      data-flight-sensitive={sensitive ? "true" : "false"}
      data-flight-terminal={terminal ?? "active"}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />
      {priorFeedback && !isTerminal && <p className={styles.ackToast} role="status" aria-live="polite"><span aria-hidden="true">{acknowledgement?.status === "appliedNow" ? "✓" : "·"}</span>{priorFeedback}</p>}
      {!isTerminal && (
        <div className={styles.topbar}>
          <div className={styles.stageGroup}>
            <span className={styles.stageMark} aria-hidden="true" />
            <div>
              <p className={styles.eyebrow}>{sensitive ? "Private flight" : "Agent in flight"}</p>
              <p className={styles.stage} aria-live="polite">{stageLabel(stage)}</p>
            </div>
          </div>
          <div className={styles.controls}>
            <button type="button" className={styles.quietButton} onClick={() => switchMode("passive")}>Quiet mode</button>
            <button type="button" className={styles.dismissButton} onClick={onDismiss} aria-label="Dismiss activity">×</button>
          </div>
        </div>
      )}

      {gate && !isTerminal && (
        <div className={styles.gatePanel}>
          <p className={styles.gateHeading}>Choose a current</p>
          <div className={styles.options} role="group" aria-label="Steer the agent result">
            {gate.options.map((option, index) => {
              const selected = option.optionId === selectedOptionId;
              return (
                <button
                  key={option.optionId}
                  type="button"
                  className={`${styles.option} ${selected ? styles.optionSelected : ""} ${selectedOptionId && !selected ? styles.optionDimmed : ""}`}
                  onClick={() => choose(option.optionId)}
                  disabled={Boolean(selectedOptionId)}
                  aria-pressed={selected}
                  aria-keyshortcuts={index === 0 ? "ArrowUp W" : "ArrowDown S"}
                >
                  <span className={styles.optionLabel}>{option.label}</span>
                  <span className={styles.optionDescription}>{optionDescriptions[option.optionId]}</span>
                </button>
              );
            })}
          </div>
          <div className={styles.feedbackRow}>
            <p
              className={`${styles.feedback} ${acknowledgementForSelection && acknowledgementForSelection.status !== "appliedNow" ? styles.feedbackLate : ""}`}
              role="status"
              aria-live="polite"
            >
              {selectedOptionId && !feedback && <><span className={styles.pendingDot} aria-hidden="true" />Waiting for agent confirmation</>}
              {feedback && <><span className={styles.ackMark} aria-hidden="true">{acknowledgementForSelection?.status === "appliedNow" ? "✓" : "·"}</span>{feedback}</>}
            </p>
            <button type="button" className={styles.skipButton} onClick={skip}>Skip choice</button>
          </div>
        </div>
      )}

      {!gate && !isTerminal && <p className={styles.flightHint}>Arrow keys or W / S when a current appears</p>}
      {isTerminal && <p className={styles.terminalNotice} aria-live="polite">{terminal === "completed" ? "Answer ready" : terminal === "cancelled" ? "Run cancelled" : "Flight ended safely"}</p>}
    </section>
  );
}
