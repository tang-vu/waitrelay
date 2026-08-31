"use client";

import type { CrossedPayload } from "./use-run-controller";

export function PrivacyInspector({ payloads }: { payloads: CrossedPayload[] }) {
  return <details className="privacy-inspector">
    <summary><span><span className="eyebrow">Proof, not a promise</span> Privacy Inspector</span><span>{payloads.length} payloads</span></summary>
    <div className="privacy-body">
      <p>The exact allowlisted payloads below crossed the Fork Flight boundary. The raw prompt and answer are held by the host.</p>
      {payloads.length === 0 ? <p className="muted">No game payloads have crossed yet.</p> : <ol>{payloads.map((item, index) => <li key={`${item.capturedAt}-${index}`}>
        <div><strong>{item.direction === "host-to-flight" ? "Host → flight" : "Flight → host"}</strong><time>{item.capturedAt}</time></div>
        <pre>{JSON.stringify(item.payload, null, 2)}</pre>
      </li>)}</ol>}
    </div>
  </details>;
}
