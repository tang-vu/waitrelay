"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

export function LandingExperience({ scenario = "standard", seed = "fork-flight-001", forceDemo = false, fault }: LandingExperienceProps) {
  const controller = useRunController({
    transportFault: fault === "sse-failure" ? "polling" : fault === "sse-reconnect" ? "reconnect" : undefined,
  });
  const [sensitive, setSensitive] = useState(fault === "sensitive");
  const [mode, setMode] = useState<"active" | "passive">(fault === "passive" ? "passive" : "active");
  const [reducedMotion, setReducedMotion] = useState(fault === "reduced-motion");
  const [gameFailed, setGameFailed] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
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

  useEffect(() => {
    if (controller.status !== "completed") return;
    const frame = requestAnimationFrame(() => {
      resultRef.current?.focus();
      performance.mark("waitrelay-result-visible");
      if (performance.getEntriesByName("waitrelay-run-complete-received", "mark").length > 0) {
        performance.measure("waitrelay-completion-takeover", "waitrelay-run-complete-received", "waitrelay-result-visible");
      }
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

  return <main>
    <header className="site-header">
      <Link className="brand" href="/" aria-label="WaitRelay home"><span className="brand-mark" aria-hidden="true"><i /></span><span>WaitRelay <small>Fork Flight</small></span></Link>
      <nav aria-label="Primary navigation"><Link href="/demo?scenario=standard&seed=fork-flight-001">Seeded demo</Link><Link href="/compare">Compare</Link><Link href="/fault-lab">Fault Lab</Link><a href="#privacy">Privacy</a></nav>
    </header>

    <section className={`hero ${controller.status !== "idle" ? "hero-running" : ""}`}>
      <div className="hero-copy">
        <div className="eyebrow">A decision relay for agent latency</div>
        <h1>The wait is the <span>second half</span> of your prompt.</h1>
        <p className="hero-lede">Fly through useful choices while the agent keeps working. The gates do not predict the answer. They change it.</p>
        <div className="judge-line"><span aria-hidden="true">↗</span> The bird game where the gates really change the AI answer.</div>
      </div>
      {controller.status === "idle" && <div className="bird-orbit" aria-hidden="true"><div className="orbit-line" /><div className="hero-bird"><span /></div><i className="star star-a" /><i className="star star-b" /><i className="star star-c" /></div>}
    </section>

    <section className="workspace" aria-label="WaitRelay workspace">
      <div className="workspace-head">
        <div><span className="step-label">01 · TASK</span><h2>Plan something worth steering</h2></div>
        <ConnectionBadge connection={controller.connection} providerMode={controller.providerMode} />
      </div>
      <PromptComposer busy={controller.status === "running"} onSubmit={(prompt) => {
        setGameFailed(false);
        void controller.start(prompt, { scenario, seed, sensitive, interactionMode: mode, forceDemo });
      }} />
      <div className="run-settings" aria-label="Run preferences">
        <label className="toggle"><input type="checkbox" checked={sensitive} onChange={(event) => setSensitive(event.target.checked)} disabled={controller.status === "running"} /><span />Sensitive mode <small>generic capsule</small></label>
        <label className="toggle"><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /><span />Reduced motion <small>node selection</small></label>
        <label className="toggle"><input type="checkbox" checked={mode === "passive"} onChange={(event) => setMode(event.target.checked ? "passive" : "active")} disabled={controller.status === "running"} /><span />Passive mode <small>no play required</small></label>
      </div>
    </section>

    {controller.status === "running" && <section className="run-shell" aria-label="Active agent run">
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
              const authoritativeOption = sensitive && baseGate
                ? baseGate.options[selection.optionId === "practical" ? 0 : 1].optionId
                : selection.optionId;
              void controller.choose(controller.activeChoice, authoritativeOption, selection);
            }
          }}
          onSkip={(requestId) => {
            if (controller.activeChoice?.requestId === requestId) controller.skip(controller.activeChoice);
          }}
          onDismiss={controller.dismissActivity}
          onModeChange={setMode}
          onCrossBoundary={controller.recordFlightPayload}
          onFailure={() => setGameFailed(true)}
        /> : controller.activityDismissed || gameFailed ? <div className="activity-fallback" role="status"><span className="mini-wing" aria-hidden="true" /><div><strong>{gameFailed ? "Flight unavailable" : "Activity dismissed"}</strong><p>The agent is still working. The answer is not blocked.</p></div></div> : <div className="inline-flight" role="status"><span className="mini-wing" aria-hidden="true" /> Agent work began immediately.</div>}
      </div>
    </section>}

    {controller.status === "cancelled" && <section className="terminal-message" tabIndex={-1}><span className="eyebrow">Run cancelled</span><h2>The flight and agent stopped.</h2><p>Dismiss activity would have kept the agent running. Cancel AI run ended it.</p></section>}
    {controller.status === "failed" && <section className="terminal-message error-message" role="alert"><span className="eyebrow">Safe exit</span><h2>The provider did not complete this run.</h2><p>{controller.error}</p><p>The game closed without trapping the result surface or exposing provider details.</p></section>}

    {controller.result && <div className="result-stack">
      <AgentResult result={controller.result} ref={resultRef} />
      <ImpactReceipt receipt={controller.result.impactReceipt} />
      <div className="post-run-grid"><FlightCard appliedChoices={appliedChoices} durationBand={controller.context?.waitBand} sensitive={sensitive} seed={seed} scenario={scenario} /><FlightPack sensitive={sensitive} /></div>
    </div>}

    <section id="privacy" className="proof-section">
      <div className="proof-copy"><span className="step-label">03 · PRIVACY PROOF</span><h2>The game never receives your raw prompt.</h2><p>The host may send the prompt to a configured provider. Fork Flight receives only a small enum capsule, allowlisted gates, lifecycle stages, and safe ACK status.</p></div>
      <PrivacyInspector payloads={controller.crossedPayloads} />
    </section>
  </main>;
}
