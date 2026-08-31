import Link from "next/link";

import { LandingExperience } from "@/components/host/LandingExperience";
import type { DemoScenario } from "@/components/host/run-types";

type Probe = {
  slug: string;
  name: string;
  scenario: DemoScenario;
  expected: string;
  evidence: "Interactive" | "Test-backed";
  fault?: string;
  instructions: string;
  testRef?: string;
};

const probes: readonly Probe[] = [
  { slug: "fast-200", name: "200 ms completion", scenario: "fast", expected: "No full-screen mount", evidence: "Interactive", instructions: "Start the relay. The answer appears without mounting the flight iframe." },
  { slug: "two-second", name: "2-second completion", scenario: "two-second", expected: "One useful gate at most", evidence: "Interactive", instructions: "Start the relay and either choose or ignore the single compact gate." },
  { slug: "standard", name: "8-second completion", scenario: "standard", expected: "Two causal gates and receipt", evidence: "Interactive", instructions: "Choose both gates and inspect their authoritative receipt entries." },
  { slug: "long", name: "30-second completion", scenario: "long", expected: "Modular flight and late-choice lock", evidence: "Interactive", instructions: "Let the modular flight continue or dismiss it; neither action blocks the agent." },
  { slug: "completion-gate", name: "Completion during gate", scenario: "two-second", expected: "Completion wins", evidence: "Interactive", instructions: "Leave the gate active. The result takes focus as soon as completion arrives." },
  { slug: "choice-before", name: "Choice before lock", scenario: "standard", expected: "Authoritative appliedNow ACK", evidence: "Interactive", instructions: "Choose a current before Composing. Applied now appears only after the host ACK." },
  { slug: "choice-late", name: "Choice after lock", scenario: "standard", expected: "Honest tooLate ACK", evidence: "Interactive", fault: "auto-late-choice", instructions: "The runner automatically signals the active non-default choice when Composing locks preferences." },
  { slug: "duplicate", name: "Duplicate signal", scenario: "standard", expected: "Idempotent server result", evidence: "Test-backed", instructions: "The same signal identity and payload returns its original ACK exactly once.", testRef: "tests/unit/memory-run-store.test.ts and tests/race/choice-completion-interleavings.test.ts" },
  { slug: "conflict", name: "Conflicting signal", scenario: "standard", expected: "Second signal rejected", evidence: "Test-backed", instructions: "Atomic choice handling accepts one option per request and rejects the conflicting option.", testRef: "tests/race/choice-completion-interleavings.test.ts" },
  { slug: "out-of-order", name: "Out-of-order event", scenario: "standard", expected: "Stale sequence ignored", evidence: "Test-backed", instructions: "Transport ordering rejects lower sequences and duplicate event IDs.", testRef: "tests/unit/transport-ordering.test.ts" },
  { slug: "stale-run", name: "Stale run", scenario: "standard", expected: "Run ID rejected", evidence: "Test-backed", instructions: "Cross-run events and unknown run IDs are rejected before UI or state mutation.", testRef: "tests/unit/transport-ordering.test.ts and tests/unit/memory-run-store.test.ts" },
  { slug: "sse-reconnect", name: "SSE reconnection", scenario: "standard", expected: "Last-Event-ID replay", evidence: "Interactive", fault: "sse-reconnect", instructions: "The server closes the first SSE stream once. Native EventSource reconnects with Last-Event-ID and the runner reports the observed replay." },
  { slug: "polling", name: "Polling fallback", scenario: "two-second", expected: "Newer sequence wins", evidence: "Interactive", fault: "sse-failure", instructions: "SSE is intentionally bypassed. Validated snapshots complete the run without stale overwrite." },
  { slug: "provider-failure", name: "Provider failure", scenario: "error", expected: "Safe terminal surface", evidence: "Interactive", instructions: "Start the controlled error scenario and inspect the sanitized safe-exit copy." },
  { slug: "offline", name: "Temporary offline", scenario: "two-second", expected: "Agent remains independent", evidence: "Test-backed", instructions: "Browser-offline automation confirms server work completes and is recovered on reconnect.", testRef: "tests/e2e/core-flow.spec.ts" },
  { slug: "iframe", name: "Game renderer failure", scenario: "standard", expected: "Answer remains unblocked", evidence: "Interactive", fault: "iframe-failure", instructions: "A contained renderer exception emits a safe enum failure, Flight unavailable appears, and the normal answer still completes." },
  { slug: "dismiss", name: "Dismiss activity", scenario: "standard", expected: "Agent continues", evidence: "Interactive", fault: "auto-dismiss", instructions: "The runner dismisses the activity automatically after it mounts. The agent continues to completion." },
  { slug: "cancel", name: "Cancel AI", scenario: "cancel", expected: "Monotonic cancelled state", evidence: "Interactive", instructions: "Start the run, then press Cancel AI run. No completed result may appear afterward." },
  { slug: "sensitive", name: "Sensitive mode", scenario: "standard", expected: "Generic capsule and gates", evidence: "Interactive", fault: "sensitive", instructions: "Sensitive Mode is preselected. Inspect generic gates, the private seed, and sharing-off Flight Card." },
  { slug: "passive", name: "Passive mode", scenario: "two-second", expected: "No interaction required", evidence: "Interactive", fault: "passive", instructions: "Passive Mode is preselected. Start and let the run complete without play." },
  { slug: "reduced", name: "Reduced Motion Mode", scenario: "standard", expected: "Calm node selection", evidence: "Interactive", fault: "reduced-motion", instructions: "Reduced Motion is preselected. Use calm constellation buttons for the same causal choice." },
] as const;

export default async function FaultLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const selectedProbe = probes.find((probe) => probe.slug === query.probe) ?? probes[0];
  return <>
    <section className="fault-header">
      <Link href="/" className="back-link">← Back to WaitRelay</Link>
      <span className="eyebrow">Judge-accessible evidence</span>
      <h1>Fault Lab</h1>
      <p>Every probe protects the same invariant: the answer is never held hostage by the flight.</p>
      <p className="fault-evidence">Interactive cards configure the deterministic runner. Test-backed cards show the exact executable evidence instead of pretending to inject a browser fault.</p>
    </section>
    <section className="probe-grid" aria-label="Fault coverage">{probes.map((probe) => {
      const selected = probe.slug === selectedProbe.slug;
      const queryString = new URLSearchParams({ probe: probe.slug, scenario: probe.scenario, ...(probe.fault ? { fault: probe.fault } : {}) });
      return <a key={probe.slug} className={`probe-card ${selected ? "probe-selected" : ""}`} aria-current={selected ? "true" : undefined} href={`/fault-lab?${queryString.toString()}#probe-runner`}>
        <span className="probe-status">{probe.evidence}</span><strong>{probe.name}</strong><small>{probe.expected}</small>
      </a>;
    })}</section>
    <section className="probe-instructions" aria-labelledby="probe-title">
      <div><span className="eyebrow">Selected probe</span><h2 id="probe-title">{selectedProbe.name}</h2><p>{selectedProbe.instructions}</p></div>
      <span className={`probe-kind probe-kind-${selectedProbe.evidence === "Interactive" ? "interactive" : "test"}`}>{selectedProbe.evidence}</span>
      {selectedProbe.testRef && <p className="probe-test-ref"><strong>Executable evidence:</strong> <code>{selectedProbe.testRef}</code></p>}
    </section>
    <div id="probe-runner">
      <LandingExperience scenario={selectedProbe.scenario} seed={`fault-${selectedProbe.slug}`} fault={selectedProbe.fault} forceDemo />
    </div>
  </>;
}
