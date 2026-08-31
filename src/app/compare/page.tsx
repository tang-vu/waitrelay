import Link from "next/link";

import { buildDemoComparison } from "@/server/orchestrator/comparison-builder";

function formatMetric(value: number, unit?: string): string {
  if (unit === "JPY") return `¥${value.toLocaleString("en-US")}`;
  return `${value}${unit ? ` ${unit}` : ""}`;
}

export default function ComparePage() {
  const comparison = buildDemoComparison();
  return <main>
    <header className="site-header">
      <Link className="brand" href="/" aria-label="WaitRelay home"><span className="brand-mark" aria-hidden="true"><i /></span><span>WaitRelay <small>Fork Flight</small></span></Link>
      <nav aria-label="Comparison navigation"><Link href="/demo?scenario=standard&seed=fork-flight-001">Fly the demo</Link><Link href="/fault-lab">Fault Lab</Link></nav>
    </header>

    <section className="compare-hero">
      <span className="eyebrow">Same prompt, different human input</span>
      <h1>Two flights. Two traceable routes.</h1>
      <p>{comparison.prompt}</p>
      <div className="scenario-banner"><strong>Scenario data</strong><span>{comparison.fixtureVersion} · recorded {new Date(comparison.recordedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</span></div>
    </section>

    <section className="comparison-grid" aria-label="Choice comparison">
      {comparison.sides.map((side) => <article key={side.sideId} className={`comparison-side comparison-${side.sideId}`}>
        <span className="eyebrow">{side.sideId === "compact" ? "Flight A" : "Flight B"}</span>
        <h2>{side.label}</h2>
        <div className="choice-pills" aria-label="Accepted choices">{side.choices.map((choice) => <span key={choice}>{choice}</span>)}</div>
        <ol>{side.plan.stops.map((stop) => <li key={stop.id}><strong>{stop.name}</strong><span>{stop.approximateLocation} · {stop.kind}</span></li>)}</ol>
      </article>)}
    </section>

    <section className="comparison-proof" aria-labelledby="comparison-proof-title">
      <div className="section-heading"><div><span className="eyebrow">Computed from structured plans</span><h2 id="comparison-proof-title">What the gates changed</h2></div><span className="material-pill changed">Causal comparison</span></div>
      <p className="comparison-scroll-hint" id="comparison-scroll-hint">Swipe or use arrow keys to compare both routes.</p>
      <div className="comparison-table-wrap" role="region" aria-label="Scrollable comparison metrics" aria-describedby="comparison-scroll-hint" tabIndex={0}><table><thead><tr><th scope="col">Metric</th><th scope="col">Compact</th><th scope="col">Discovery</th></tr></thead><tbody>{comparison.metrics.map((metric) => <tr key={metric.metricId}><th scope="row">{metric.label}</th><td>{formatMetric(metric.compact, metric.unit)}</td><td>{formatMetric(metric.discovery, metric.unit)}</td></tr>)}</tbody></table></div>
      <div className="substitution-grid">
        <div><strong>Only in the compact route</strong><p>{comparison.compactOnlyStops.join(", ") || "No unique stops"}</p></div>
        <div><strong>Only in the discovery route</strong><p>{comparison.discoveryOnlyStops.join(", ") || "No unique stops"}</p></div>
      </div>
      <p className="scenario-note">{comparison.scenarioNotice} These differences are calculated by the deterministic ranker, not written by a language model.</p>
      <Link className="primary-button compare-cta" href="/demo?scenario=standard&seed=fork-flight-001">Fly this seed</Link>
    </section>
  </main>;
}
