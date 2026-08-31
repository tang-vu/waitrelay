# Threat Model

## Scope

This document covers the WaitRelay host, Fork Flight iframe and bridge, run APIs, event transport, provider adapter, process-local run store, demo fixtures, Flight Cards, and post-run Flight Pack preview.

The principal assets are raw prompts, provider credentials, private provider output, trusted preference mappings, run integrity, ACK truthfulness, terminal state, and receipt accuracy.

## Trust boundaries

1. Browser to host API
2. Host document to sandboxed flight document
3. Server orchestrator to external provider
4. API routes to process-local store
5. Public event transport to browser state
6. Post-run UI to optional payment adapter

Fork Flight is treated as low privilege and potentially compromised. Browser input is untrusted. Provider responses and fixture files are validated before use.

## Threats and mitigations

| Threat | Impact | Mitigation | Verification |
| --- | --- | --- | --- |
| Raw prompt crosses game boundary | Privacy breach | Construct enum-only Context Capsule, strict schemas, sandbox, inspector | Canary privacy test |
| Browser sends arbitrary ranking patch | Result manipulation | Accept only allowlisted option ID; map to server patch | Invalid-option unit test |
| Game fabricates `appliedNow` | False causality claim | ACK events originate only in host store and use server sequence | Bridge direction and ACK tests |
| Duplicate signal is applied twice | Corrupt preferences or receipt | Idempotency by `signalId`; one accepted selection per request | Duplicate-signal race test |
| Conflicting signals race | Nondeterministic result | Atomic choice transition; first accepted signal wins | Controlled interleavings |
| Late signal changes result | ACK and receipt disagreement | Atomic synthesis lock; return `tooLate`; immutable snapshot | Late-choice integration test |
| Completion and cancel race | Multiple terminal states | Monotonic compare-and-set terminal transition | Race test |
| Stale poll overwrites SSE | UI regression or hidden completion | Compare run ID and sequence across both transports | Poll fallback test |
| Replayed event mutates UI | Repeated ACK or stale gate | Event ID dedupe and monotonic sequence reducer | Protocol unit test |
| Cross-run event injection | Wrong result or ACK | Run-scoped IDs and nonce; reject stale run ID | Stale-run test |
| Wildcard `postMessage` consumer | Cross-frame injection | Check `event.source`, transfer port, validate nonce and schema | Typed bridge tests and code review |
| Iframe exfiltrates data | Privacy breach | No private data, sandbox, CSP `connect-src 'none'` | CSP and network test |
| Provider key reaches browser | Credential theft | Server-only environment variables; no public prefix | Build and bundle review |
| Provider error leaks request | Privacy breach | Sanitize to safe public error code | Error-payload test |
| Model-generated HTML executes | XSS | Render answer as plain text or trusted components; never send HTML to game | Component code review |
| SSE resource leak | Server exhaustion | Abort on disconnect, heartbeat cleanup, terminal stream close, TTL cleanup | Reconnection tests and route code review |
| Oversized or malformed payload | Denial of service | Strict field bounds, payload validation, and TTL-bounded terminal state | Schema boundary tests |
| Fixture presented as live | Misleading judge or user | Visible immutable provider label and evidence timestamp | Demo mode test |
| Payment failure blocks result | Product failure | Payment surface is post-run and separate adapter | Adapter safety tests and architecture separation |
| Fake Commons integration | Credibility and security risk | Keep Commons mode disabled pending official contract | Documentation review |
| Sensitive share payload | Privacy breach | Allowlist Flight Card fields; sharing disabled in Sensitive Mode | Share-payload test |

## Security invariants

- Terminal state is immutable.
- Preference snapshot is immutable after synthesis lock.
- ACK status and receipt inclusion derive from the same authoritative choice record.
- Only `appliedNow` records can generate applied effects.
- The browser never supplies trusted effect metrics.
- The flight document never fetches from the network.
- Completion is independent from the game and payment adapters.
- Provider credentials remain server-side.
- Public errors contain no prompt or provider response body.

## Availability and fail-open behavior

The run remains useful when the player never interacts. Dismissing the activity unmounts it without cancelling. A renderer exception is contained by the host. SSE can reconnect with Last-Event-ID and fall back to sequence-checked polling. Provider failure yields an honest failure or, only when configured, a visibly labeled fixture replay. Payment errors never alter run state.

## Residual risks

- `MemoryRunStore` cannot coordinate multiple server instances.
- Process memory may contain an active prompt until the run expires or cleanup executes.
- Live evidence quality depends on the configured provider and source availability.
- Browser extensions and a compromised host origin are outside the iframe isolation guarantee.
- A production launch would require formal abuse limits, durable coordination, operational monitoring, and provider-specific privacy review.

## Security release checks

- Exercise malformed events and unknown fields.
- Run at least 100 controlled signal and terminal interleavings.
- Confirm no prompt canary in game boundary, storage, URLs, logs, or share payload.
- Inspect production CSP and iframe sandbox attributes.
- Confirm the production client artifacts contain no configured provider key before deployment.
- Confirm public errors are sanitized.
- Confirm result completion succeeds with the game and payments disabled.
