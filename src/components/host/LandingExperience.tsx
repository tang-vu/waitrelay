"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { FlightSandboxHost } from "@/components/flight";
import { SafeFlightAckSchema, SafeFlightGateSchema, toSafeFlightAck, toSafeFlightGate } from "@/features/flight/bridge";
import { AgentResult } from "./AgentResult";
import { ConnectionBadge } from "./ConnectionBadge";
import { FlightCard } from "./FlightCard";
import { FlightPack } from "./FlightPack";
import { ImpactReceipt } from "./ImpactReceipt";
import { PrivacyInspector } from "./PrivacyInspector";
import { PromptComposer } from "./PromptComposer";
import type { DemoScenario } from "./run-types";
import { useRunController } from "./use-run-controller";

export interface LandingExperienceProps {
  scenario?: DemoScenario;
  seed?: string;
  forceDemo?: boolean;
  fault?: string;
}

const stages = ["understanding", "gathering", "evaluating", "composing", "verifying"] as const;

interface RelaySignalState {
  requestId: string;
  optionId: string;
  signalId: string;
  optionLabel: string;
}

function readableToken(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((token) => `${token[0]?.toUpperCase() ?? ""}${token.slice(1)}`)
    .join(" ");
}

function acknowledgementLabel(status: "appliedNow" | "tooLate" | "rejected" | "savedNext"): string {
  if (status === "appliedNow") return "Applied now";
  if (status === "tooLate") return "Too late";
  if (status === "savedNext") return "Saved next";
  return "Rejected";
}

function scrollIntoViewImmediately(element: HTMLElement | null): void {
  if (!element) return;
  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  element.scrollIntoView({ block: "start", behavior: "auto" });
  root.style.scrollBehavior = previousBehavior;
}

export function LandingExperience({ scenario = "standard", seed = "fork-flight-001", forceDemo = false, fault }: LandingExperienceProps) {
  const controller = useRunController({
    transportFault: fault === "sse-failure" ? "polling" : fault === "sse-reconnect" ? "reconnect" : undefined,
  });
  const [sensitive, setSensitive] = useState(fault === "sensitive");
  const [mode, setMode] = useState<"active" | "passive">(fault === "passive" ? "passive" : "active");
  const [reducedMotion, setReducedMotion] = useState(fault === "reduced-motion");
  const [gameFailed, setGameFailed] = useState(false);
  const [relaySignal, setRelaySignal] = useState<RelaySignalState | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  const terminalRef = useRef<HTMLElement>(null);
  const runShellRef = useRef<HTMLElement>(null);
  const autoScrolledRunRef = useRef<string | null>(null);
  const automatedProbeRef = useRef<string | null>(null);
  const nonce = useMemo(() => controller.runId ? `nonce-${controller.runId}` : "nonce-pending", [controller.runId]);
  const baseGate = useMemo(() => {
    if (!controller.activeChoice) return null;
    return toSafeFlightGate(controller.activeChoice);
  }, [controller.activeChoice]);
  const gate = useMemo(() => {
    if (!baseGate || !sensitive) return baseGate;
    return SafeFlightGateSchema.parse({
      requestId: baseGate.requestId,
      axisId: "approach",
      options: [
        { optionId: "practical", label: "Practical" },
        { optionId: "creative", label: "Creative" },
      ],
      defaultOptionId: baseGate.defaultOptionId === baseGate.options[0].optionId ? "practical" : "creative",
      effectCategory: "approach",
    });
  }, [baseGate, sensitive]);
  const acknowledgement = useMemo(() => {
    if (!controller.latestAck) return null;
    const safeAck = toSafeFlightAck(controller.latestAck);
    if (!sensitive || !baseGate) return safeAck;
    return SafeFlightAckSchema.parse({
      ...safeAck,
      optionId: safeAck.optionId === baseGate.options[0].optionId ? "practical" : "creative",
    });
  }, [baseGate, controller.latestAck, sensitive]);

  const currentRelaySignal = relaySignal;
  const relaySignalMatchesGate = Boolean(relaySignal && gate && relaySignal.requestId === gate.requestId);
  const matchingRelayAck = currentRelaySignal && acknowledgement
    && acknowledgement.requestId === currentRelaySignal.requestId
    && acknowledgement.optionId === currentRelaySignal.optionId
    && acknowledgement.signalId === currentRelaySignal.signalId
    ? acknowledgement
    : null;

  useEffect(() => {
    if (!controller.shouldShowActivity || !controller.runId || controller.activityDismissed) return;
    if (autoScrolledRunRef.current === controller.runId) return;
    autoScrolledRunRef.current = controller.runId;
    const frame = requestAnimationFrame(() => {
      scrollIntoViewImmediately(runShellRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [controller.activityDismissed, controller.runId, controller.shouldShowActivity]);

  useLayoutEffect(() => {
    if (controller.status !== "completed") return;
    // Frame and focus the committed answer before the next paint. A passive
    // effect followed by another animation frame leaves a visible extra wait.
    resultRef.current?.focus({ preventScroll: true });
    scrollIntoViewImmediately(resultRef.current);
    performance.mark("waitrelay-result-visible");
    if (performance.getEntriesByName("waitrelay-run-complete-received", "mark").length > 0) {
      performance.measure("waitrelay-completion-takeover", "waitrelay-run-complete-received", "waitrelay-result-visible");
    }
  }, [controller.status]);

  useEffect(() => {
    if (!["failed", "cancelled", "unavailable"].includes(controller.status)) return;
    const frame = requestAnimationFrame(() => {
      terminalRef.current?.focus({ preventScroll: true });
      scrollIntoViewImmediately(terminalRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [controller.status]);

  useEffect(() => {
    if (fault === "auto-dismiss" && controller.shouldShowActivity && automatedProbeRef.current !== controller.runId) {
      automatedProbeRef.current = controller.runId;
      controller.dismissActivity();
    }
    if (fault === "auto-late-choice" && (controller.stage === "composing" || controller.stage === "verifying") && controller.activeChoice && automatedProbeRef.current !== controller.runId) {
      automatedProbeRef.current = controller.runId;
      const lateOption = controller.activeChoice.options.find((option) => option.optionId !== controller.activeChoice?.defaultOptionId)
        ?? controller.activeChoice.options[0];
      void controller.choose(controller.activeChoice, lateOption.optionId);
    }
  }, [controller, fault]);

  const appliedChoices = controller.result
    ? (controller.result.impactReceipt as { entries?: unknown[] })?.entries?.length ?? 0
    : 0;
  const experienceActive = controller.status !== "idle";
  const experienceComplete = controller.status === "completed";

  return <main>
    <header className="site-header">
      <Link className="brand" href="/" aria-label="WaitRelay home"><span className="brand-mark" aria-hidden="true"><i /></span><span>WaitRelay <small>Fork Flight</small></span></Link>
      <nav aria-label="Primary navigation"><Link href="/demo?scenario=standard&seed=fork-flight-001">Seeded demo</Link><Link href="/compare">Compare</Link><Link href="/fault-lab">Fault Lab</Link><a href="#privacy">Privacy</a></nav>
    </header>

    <section className={`hero ${experienceActive ? "hero-running" : ""} ${experienceComplete ? "hero-complete" : ""}`}>
      <div className="hero-copy">
        <div className="eyebrow">A decision relay for agent latency</div>
        <h1>The wait is the <span>second half</span> of your prompt.</h1>
        <p className="hero-lede">Fly through useful choices while the agent keeps working. The gates do not predict the answer. They change it.</p>
        <div className="judge-line"><span aria-hidden="true">↗</span> The bird game where the gates really change the AI answer.</div>
      </div>
      {controller.status === "idle" && <div className="bird-orbit" aria-hidden="true"><div className="orbit-line" /><div className="hero-bird"><span /></div><i className="star star-a" /><i className="star star-b" /><i className="star star-c" /></div>}
    </section>

    <section className={`workspace ${experienceActive ? "workspace-compact" : ""} ${controller.status === "running" ? "workspace-running" : ""} ${experienceComplete ? "workspace-complete" : ""}`} aria-label="WaitRelay workspace">
      <div className="workspace-head">
        <div><span className="step-label">01 · TASK</span><h2>Plan something worth steering</h2></div>
        <ConnectionBadge connection={controller.connection} providerMode={controller.providerMode} />
      </div>
      <PromptComposer busy={controller.status === "running"} onSubmit={(prompt) => {
        setGameFailed(false);
        setRelaySignal(null);
        autoScrolledRunRef.current = null;
        void controller.start(prompt, { scenario, seed, sensitive, interactionMode: mode, forceDemo });
      }} />
      <div className="run-settings" aria-label="Run preferences">
        <label className="toggle"><input type="checkbox" checked={sensitive} onChange={(event) => setSensitive(event.target.checked)} disabled={controller.status === "running"} /><span />Sensitive mode <small>generic capsule</small></label>
        <label className="toggle"><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /><span />Reduced motion <small>node selection</small></label>
        <label className="toggle"><input type="checkbox" checked={mode === "passive"} onChange={(event) => setMode(event.target.checked ? "passive" : "active")} disabled={controller.status === "running"} /><span />Passive mode <small>no play required</small></label>
      </div>
    </section>

    {controller.status === "running" && <section className="run-shell" aria-label="Active agent run" ref={runShellRef}>
      <div className="run-rail">
        <div><span className="step-label">02 · AGENT RUN</span><h2>{controller.stage ? `${controller.stage[0].toUpperCase()}${controller.stage.slice(1)}` : "Starting"}</h2></div>
        <ol className="stage-list" aria-label="Public lifecycle stages">{stages.map((item) => <li key={item} className={controller.stage === item ? "active" : ""}>{item}</li>)}</ol>
        <div className="run-actions">
          <button className="text-button" type="button" onClick={controller.dismissActivity}>Dismiss activity</button>
          <button className="danger-button" type="button" onClick={() => void controller.cancel()}>Cancel AI run</button>
        </div>
        <p className="semantics-note">Dismissing hides the flight. Cancelling stops the agent.</p>
        {controller.transportEvidence && <p className="transport-evidence" role="status">{controller.transportEvidence}</p>}
      </div>
      {(gate || currentRelaySignal) && <section className="relay-strip" aria-label="Authoritative choice relay">
        <div className="relay-strip-heading">
          <span>Authoritative relay</span>
          <small>Only a matching host ACK can claim impact.</small>
        </div>
        <ol>
          <li className={gate ? "relay-step relay-step-complete" : "relay-step"}>
            <span className="relay-step-index" aria-hidden="true">1</span>
            <div><small>Choice request</small><strong>{gate ? `${readableToken(gate.axisId)} gate open` : "Gate closed"}</strong><p>{gate ? `Affects ${readableToken(gate.effectCategory).toLowerCase()}` : "Request received"}</p></div>
          </li>
          <li className={currentRelaySignal ? "relay-step relay-step-complete" : "relay-step"}>
            <span className="relay-step-index" aria-hidden="true">2</span>
            <div><small>{relaySignalMatchesGate ? "Choice signal" : currentRelaySignal ? "Latest signal" : "Choice signal"}</small><strong>{currentRelaySignal ? `${currentRelaySignal.optionLabel} relayed` : "Awaiting selection"}</strong><p>{matchingRelayAck ? "Host validation received" : currentRelaySignal ? "Pending host validation" : "The agent keeps working"}</p></div>
          </li>
          <li className={matchingRelayAck ? `relay-step relay-step-${matchingRelayAck.status}` : "relay-step"}>
            <span className="relay-step-index" aria-hidden="true">3</span>
            <div><small>Host ACK</small><strong role="status">{matchingRelayAck ? acknowledgementLabel(matchingRelayAck.status) : currentRelaySignal ? "Validation pending" : "No claim yet"}</strong><p>{matchingRelayAck?.status === "appliedNow" ? "Accepted before synthesis lock" : matchingRelayAck ? "Current result unchanged" : "Waiting for authoritative state"}</p></div>
          </li>
        </ol>
      </section>}
      <div className="activity-stage">
        {controller.shouldShowActivity && controller.runId && controller.context && controller.visualSeed && !gameFailed ? <FlightSandboxHost
          src={fault === "iframe-failure" ? "/flight?crash=1" : reducedMotion ? "/flight?reduced=1" : "/flight"}
          runId={controller.runId}
          nonce={nonce}
          context={controller.context}
          visualSeed={controller.visualSeed}
          stage={controller.stage ?? "understanding"}
          gate={gate}
          acknowledgement={acknowledgement}
          mode={mode}
          sensitive={sensitive}
          onSignal={(selection) => {
            if (controller.activeChoice?.requestId === selection.requestId) {
              const optionLabel = gate?.options.find((option) => option.optionId === selection.optionId)?.label
                ?? readableToken(selection.optionId);
              setRelaySignal({
                requestId: selection.requestId,
                optionId: selection.optionId,
                signalId: selection.signalId,
                optionLabel,
              });
              const authoritativeOption = sensitive && baseGate
                ? baseGate.options[selection.optionId === "practical" ? 0 : 1].optionId
                : selection.optionId;
              void controller.choose(controller.activeChoice, authoritativeOption, selection);
            }
          }}
          onSkip={(requestId) => {
            if (controller.activeChoice?.requestId === requestId) {
              if (relaySignal?.requestId === requestId) setRelaySignal(null);
              controller.skip(controller.activeChoice);
            }
          }}
          onDismiss={controller.dismissActivity}
          onModeChange={setMode}
          onCrossBoundary={controller.recordFlightPayload}
          onFailure={() => setGameFailed(true)}
        /> : controller.activityDismissed || gameFailed ? <div className="activity-fallback" role="status"><span className="mini-wing" aria-hidden="true" /><div><strong>{gameFailed ? "Flight unavailable" : "Activity dismissed"}</strong><p>The agent is still working. The answer is not blocked.</p></div></div> : <div className="inline-flight" role="status"><span className="mini-wing" aria-hidden="true" /> Agent work began immediately.</div>}
      </div>
    </section>}

    {["cancelled", "failed", "unavailable"].includes(controller.status) && <section
      className={`terminal-message ${controller.status === "failed" ? "error-message" : ""}`}
      ref={terminalRef} tabIndex={-1} aria-labelledby="terminal-title"
    >
      <span className="eyebrow">{controller.status === "cancelled" ? "Run cancelled" : controller.status === "unavailable" ? "Run unavailable" : "Unable to continue"}</span>
      <h2 id="terminal-title">{controller.status === "cancelled" ? "The flight and agent stopped." : controller.status === "unavailable" ? "This run is no longer available." : controller.runId ? "The provider did not complete this run." : "The run could not be started."}</h2>
      <p>{controller.status === "cancelled" ? "Your task is still in the composer. You can edit it or start a new run whenever you are ready." : controller.error}</p>
      <button className="secondary-button" type="button" onClick={() => {
        const prompt = document.getElementById("task-prompt");
        prompt?.focus({ preventScroll: true });
        scrollIntoViewImmediately(prompt);
      }}>Edit task and try again</button>
    </section>}

    {controller.result && <div className="result-stack">
      <AgentResult key={controller.result.runId} result={controller.result} sensitive={sensitive} ref={resultRef} />
      <ImpactReceipt receipt={controller.result.impactReceipt} />
      <div className="post-run-grid"><FlightCard appliedChoices={appliedChoices} durationBand={controller.context?.waitBand} sensitive={sensitive} seed={seed} scenario={scenario} /><FlightPack sensitive={sensitive} /></div>
    </div>}

    <section id="privacy" className="proof-section">
      <div className="proof-copy"><span className="step-label">03 · PRIVACY PROOF</span><h2>The game never receives your raw prompt.</h2><p>The host may send the prompt to a configured provider. Fork Flight receives only a small enum capsule, allowlisted gates, lifecycle stages, and safe ACK status.</p></div>
      <PrivacyInspector payloads={controller.crossedPayloads} />
    </section>
  </main>;
}
