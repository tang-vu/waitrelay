"use client";

import { forwardRef } from "react";
import type { RunCompleteEvent } from "@/shared/contracts/events";

export const AgentResult = forwardRef<HTMLElement, { result: RunCompleteEvent }>(function AgentResult({ result }, ref) {
  return <article className="result-surface" ref={ref} tabIndex={-1} aria-labelledby="result-title">
    <div className="result-portal" aria-hidden="true"><span /><i /></div>
    <div className="eyebrow">Relay complete</div>
    <h2 id="result-title">Your route is ready</h2>
    <div className="answer-copy">{result.finalAnswer}</div>
  </article>;
});
