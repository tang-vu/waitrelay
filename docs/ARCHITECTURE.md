# Architecture

## Overview

WaitRelay is a portable Next.js application with a strict host and game boundary. The host orchestrates work, owns private data, validates all events, maps option identifiers to trusted patches, and renders the final answer. Fork Flight is a low-privilege presentation client that receives only enum-oriented public context.

```text
Browser host                         Server
------------                         ------
Prompt composer -- POST /runs ----> Run orchestrator
Result surface <--- SSE/snapshot --- Public event log
      |
      +-- sandboxed Fork Flight      Agent adapter
             ^      |                     |
             |      + choice.signal ----> | gather in parallel
             + context + gate + ACK <-----|
                                           v
                              atomic preference snapshot
                                           |
                                           v
                          rank + synthesize + impact receipt
```

## Main boundaries

### Host UI

The host UI owns the prompt, transport lifecycle, completion takeover, final answer, receipt, connection state, cancel semantics, and Privacy Inspector. It rejects duplicate event IDs and stale sequences before applying state.

### Fork Flight

The preferred deployment runs the flight route in `<iframe sandbox="allow-scripts">`. It receives an initialized `MessagePort`, a run-scoped nonce, a validated Context Capsule, allowlisted gate descriptors, public lifecycle stage, safe ACK state, and visual seed. It receives no raw prompt or answer.

Because a sandboxed iframe without `allow-same-origin` has an opaque origin, the bridge checks `event.source` during initialization, transfers a dedicated channel, requires the run nonce on subsequent envelopes, and validates every message. It does not rely on origin alone.

The flight document uses a restrictive Content Security Policy, including `connect-src 'none'`. Network transport remains in the host.

### Run orchestrator

The orchestrator performs these steps without pausing for gameplay:

1. Classify the task and choose applicable allowlisted gates.
2. Start evidence gathering with a default preference state.
3. Emit public progress stages.
4. Accept idempotent signals while gathering continues.
5. Atomically lock and snapshot accepted preferences.
6. Reject later signals as `tooLate`.
7. Compute baseline and selected structured plans.
8. Synthesize presentation from the selected plan.
9. Build the receipt from authoritative comparisons.
10. Commit a monotonic terminal event.

### Agent adapters

The adapter contract separates analysis, gathering, and synthesis:

```ts
interface AgentAdapter {
  health(): Promise<AgentHealth>;
  analyze(input: AgentInput, signal: AbortSignal): Promise<AgentPlan>;
  gather(
    plan: AgentPlan,
    emit: (event: InternalProgressEvent) => void,
    signal: AbortSignal,
  ): Promise<EvidenceBundle>;
  synthesize(input: SynthesisInput, signal: AbortSignal): Promise<AgentResult>;
}
```

The OpenAI-compatible adapter uses server-only variables, explicit timeouts, one bounded retry, structured validation, cancellation, and sanitized errors. The fixture adapter uses versioned evidence and seeded timing. The hybrid adapter falls back only when explicitly enabled and changes the provider label to Fallback Replay.

### Run store

`RunStore` abstracts process state. `MemoryRunStore` provides:

- TTL cleanup
- Append-only public events
- Idempotent choice handling
- Atomic preference snapshot and synthesis lock
- One AbortController per active run
- Monotonic terminal transition
- Cleanup for completed runs

This store is sufficient for one application instance. A durable implementation would be required for horizontally scaled deployment.

## Protocol

The versioned discriminated union includes:

- `run.start`
- `run.progress`
- `provider.mode` (host-only, never forwarded to Fork Flight)
- `choice.request`
- `choice.signal`
- `choice.ack`
- `run.complete`
- `run.cancel.request`
- `run.cancel.ack`
- `run.error`

Every event includes `protocolVersion`, `runId`, `eventId`, `sequence`, `timestamp`, and `type`. Required invariants:

- Signal IDs are idempotency keys.
- One choice request accepts one option.
- A conflicting second option is rejected.
- Duplicate ACKs do not change state.
- Lower or equal sequences cannot overwrite newer UI state.
- Stale run IDs are rejected.
- A terminal run cannot return to active.
- Completion and cancellation races resolve through one atomic terminal transition.
- The game can signal, skip, dismiss, or request a mode change, but cannot create a gate or ACK.

## Transport and reconnection

Server-Sent Events are primary. The endpoint supports `Last-Event-ID`, replays missing public events, and may emit comment heartbeats. On connection failure, native EventSource reconnection remains available while the host can poll validated snapshots. When SSE reopens it stops polling. Both paths share sequence suppression, so an older polling response cannot overwrite a newer SSE update.

The answer surface is driven by authoritative host state, not animation state. On `run.complete`, active gate controls are disabled synchronously and focus moves to the result heading. Decorative rendering may be cleaned up asynchronously.

## Structured Tokyo pipeline

The judged Tokyo pipeline normalizes versioned fixture candidates into a common schema. The ranker uses explicit weights and constraints, including budget, indoor suitability, vegetarian suitability, availability evidence, confidence, novelty, and route distance. Option identifiers map to versioned trusted patches. The optional live adapter validates external analysis, evidence-summary, and presentation calls, but does not yet translate provider venue records into the ranker. A live model therefore presents the versioned Tokyo scenario plan and is not represented as live venue verification.

The impact builder compares the same baseline and selected plan schemas. Current computed effects include walking-weight changes, route distance, candidate substitutions, novelty, source-confidence threshold, and average source confidence. The presentation model receives structured metrics and cannot author new causal values.

## Failure handling

| Failure | Behavior |
| --- | --- |
| Flight renderer or iframe fails | Host continues and shows result. |
| SSE disconnects | Native reconnect uses the last event ID while validated polling fails open; a reopened stream stops polling. |
| Duplicate or stale event | Suppressed. |
| Provider fails | Honest error, or labeled fallback if enabled. |
| User dismisses activity | Flight unmounts; agent continues. |
| User cancels | Host aborts work and resolves terminal race atomically. |
| Payment adapter fails | Post-run preview may fail; agent result is unaffected. |

## Deployment notes

The application does not assume a Commons waiting-layer SDK or private Commons endpoint. Integration points are the adapter interfaces and versioned protocol. Production multi-instance operation would require a durable event log, distributed atomic operations, and shared cancellation state.
