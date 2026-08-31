"use client";

import { ImpactReceiptSchema } from "@/shared/contracts/receipts";

function value(value: unknown, unit?: string): string {
  const rendered = typeof value === "number" ? value.toLocaleString("en-US") : String(value);
  return unit ? `${rendered} ${unit}` : rendered;
}

export function ImpactReceipt({ receipt: input }: { receipt: unknown }) {
  const parsed = ImpactReceiptSchema.safeParse(input);
  if (!parsed.success) return null;
  const receipt = parsed.data;
  return <section className="receipt" aria-labelledby="receipt-title">
    <div className="section-heading">
      <div><span className="eyebrow">Authoritative evidence</span><h2 id="receipt-title">Impact Receipt</h2></div>
      <span className={`material-pill ${receipt.materialChange ? "changed" : "unchanged"}`}>{receipt.materialChange ? "Plan changed" : "No material change"}</span>
    </div>
    <p>{receipt.summary}</p>
    {receipt.entries.length === 0 ? <p className="muted">Defaults carried the run. The agent never waited for a choice.</p> : receipt.entries.map((entry) => <article className="receipt-entry" key={entry.requestId}>
      <div className="receipt-choice"><span>Choice</span><strong>{entry.selectedOptionLabel}</strong><span className="ack-mark">Applied now</span></div>
      <p>{entry.summary}</p>
      <div className="metric-grid">{entry.effectMetrics.filter((metric) => metric.material).map((metric) => <div key={metric.metricId} className="metric">
        <span>{metric.label}</span><strong>{value(metric.before, metric.unit)} <span aria-hidden="true">→</span><span className="sr-only">to</span> {value(metric.after, metric.unit)}</strong>
      </div>)}</div>
      <details><summary>Technical judge view</summary><dl>
        <div><dt>Request</dt><dd>{entry.requestId}</dd></div>
        <div><dt>Pipeline node</dt><dd>{entry.pipelineNode}</dd></div>
        <div><dt>Signal</dt><dd>{entry.signalTimestamp}</dd></div>
        <div><dt>ACK</dt><dd>{entry.ackTimestamp}</dd></div>
        <div><dt>Before</dt><dd><code>{JSON.stringify(entry.beforeState)}</code></dd></div>
        <div><dt>After</dt><dd><code>{JSON.stringify(entry.afterState)}</code></dd></div>
      </dl></details>
    </article>)}
  </section>;
}
