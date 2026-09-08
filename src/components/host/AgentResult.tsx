"use client";

import { forwardRef, useState } from "react";
import type { RunCompleteEvent } from "@/shared/contracts/events";

export const AgentResult = forwardRef<HTMLElement, { result: RunCompleteEvent; sensitive?: boolean }>(function AgentResult({ result, sensitive = false }, ref) {
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const plan = result.structuredResult;
  const yen = (value: number) => `¥${value.toLocaleString("en-US")}`;
  const recorded = new Date(plan.fixtureRecordedAt).toLocaleString("en-US", {
    dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
  });

  async function copyItinerary() {
    setCopyState("copying");
    try {
      await navigator.clipboard.writeText(result.finalAnswer);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return <article className="result-surface" ref={ref} tabIndex={-1} aria-labelledby="result-title">
    <div className="result-portal" aria-hidden="true"><span /><i /></div>
    <div className="eyebrow">Relay complete</div>
    <h2 id="result-title">Your route is ready</h2>
    <dl className="route-summary" aria-label="Route summary">
      <div><dt>Estimated total for two</dt><dd>{yen(plan.totalCostYen)}</dd></div>
      <div><dt>Approximate route</dt><dd>{plan.routeDistanceKm.toLocaleString("en-US")} <span>km</span></dd></div>
      <div><dt>Your evening</dt><dd>{plan.stops.length} <span>stops</span></dd></div>
    </dl>
    <div className="route-evidence">
      <strong>Recorded scenario · not live availability</strong>
      <p>{plan.scenarioNotice} Confirm directly before leaving.</p>
      <small>Recorded <time dateTime={plan.fixtureRecordedAt}>{recorded} UTC</time></small>
    </div>
    <ol className="route-stops" aria-label="Planned stops">
      {plan.stops.map((stop, index) => <li key={stop.id}>
        <span className="route-stop-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <div className="route-stop-content">
          <div className="route-stop-heading"><span className="eyebrow">{stop.kind}</span><span className="route-stop-cost">{yen(stop.estimatedCostYen)}</span></div>
          <h3>{stop.name}</h3>
          <p className="route-location">{stop.approximateLocation}</p>
          <p>{stop.scenarioNote}</p>
          <p className="route-hours"><span>Scenario hours</span> {stop.openingInfo.hours}</p>
        </div>
      </li>)}
    </ol>
    <details className="route-full-answer" open={copyState === "failed" || undefined}>
      <summary>Read the full agent answer</summary>
      <div className="answer-copy">{result.finalAnswer}</div>
    </details>
    <div className="route-actions">
      {sensitive ? <p className="route-copy-status">Copying off in Sensitive mode.</p> : <>
        <button className="secondary-button" type="button" disabled={copyState === "copying"} onClick={() => void copyItinerary()}>
          {copyState === "copying" ? "Copying…" : copyState === "copied" ? "Copy again" : "Copy itinerary"}
        </button>
        <p className="route-copy-status" role="status">
          {copyState === "copied" ? "Itinerary copied." : copyState === "failed" ? "Clipboard unavailable. Select and copy the full answer above." : "Includes the recorded-data notice."}
        </p>
      </>}
    </div>
  </article>;
});
