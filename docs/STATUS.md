# Implementation Status

Last updated: 2026-08-31

## Completed work

- End-to-end Tokyo vertical: submit, start, flight, gate request, option signal, authoritative ACK, trusted preference patch, synthesis lock, structured reranking, completion takeover, result, and computed Impact Receipt.
- Two causal axes: Less Walking or More Discovery, and Reliable or Surprising.
- Versioned runtime event schemas, identity-safe idempotent choice handling, append-only public log, atomic snapshot, monotonic terminal transitions, cancellation, gap-free SSE replay subscription, and sequence-safe polling fallback.
- Deterministic fast, two-second, standard, late-choice, long, cancel, and error scenarios with visible provider labels.
- Native Canvas flight, pointer, touch, keyboard, button controls, Passive Mode, Reduced Motion Mode, skip, dismiss, and separate cancellation.
- Opaque-origin flight iframe with `sandbox="allow-scripts"`, restrictive CSP, run nonce, transferred MessageChannel, strict schemas, and exact-payload Privacy Inspector.
- Sensitive Mode with generic context, generic gates, fixed private visual seed, sharing disabled, and no sensitive storage.
- Versioned Tokyo fixture evidence, explicit ranking weights, structured venue selection, and sequential computed receipt effects.
- Optional OpenAI-compatible adapter with server-only configuration, bounded timeout, one retry, abort propagation, structured validation, and sanitized errors.
- Disabled and sandbox-preview payment adapters. No real checkout or transaction path is enabled.
- Judge-facing Fault Lab, computed split-screen comparison, sanitized Flight Card, deterministic seed echo, persisted generic card identity, non-transactional Flight Pack preview, real screenshots, and the full submission document set.
- Judge-facing evidence links, a 60-second evaluator path, and a causal-first 90-second recording script with explicit recorded-scenario language.
- Host-side causal relay strip that makes choice request, pending signal, and matching authoritative ACK legible without trusting the game frame.
- Compact running layout, immediate activity and result framing, richer native Canvas depth, and a computed three-step proof path in Impact Receipt.
- Strict completion payloads, host-owned live-output consistency fallback, spaced live gates, bounded public request/run capacity, and distinct host and flight security policies.
- One-command hosting preflight for PM2, origin, tunnel, CSP, HSTS, no-transform, and analytics-injection checks.

## Current work

The repository contents are tracked. The competition build is release-gated and published at `https://waitrelay.tangvu.dev` from a single local production process through a named Cloudflare Tunnel. PM2 manages the Next.js server, final origin proxy, and tunnel connector. No video recording, purchase, repository publication, or hackathon submission has been performed.

## Next work

1. Record the 80 to 90 second demo using the checked-in script and seeded URL.
2. Refresh final captures if the visible UI changes before recording.
3. Replace repository and video placeholders only with real URLs.
4. Submit before the September 17 operational deadline after explicit authorization.

## Risks and honest limitations

| Risk or limitation | Current response |
| --- | --- |
| No verified public Commons runtime or payment contract | No Commons adapter is implemented or claimed. The portable adapter boundary remains available. |
| Process-local store | Suitable for a single-instance demo only. Multi-instance deployment needs a durable atomic store. |
| Local-machine availability | The public build depends on this Windows machine, PM2 resurrection, network connectivity, and the Cloudflare connector. |
| Demo availability evidence is not current verification | Every fixture result displays its version, recorded timestamp, and scenario-data notice. |
| Live adapter does not normalize provider venue records into the ranker | Live mode can perform validated analysis and presentation over the versioned Tokyo plan, but is not described as live venue verification. |
| Fault Lab protocol cards are not all runtime fault injectors | Each card says either Interactive or Test-backed. Automated evidence covers the protocol-only cases. |
| No external credentials in the repository | The full judge path runs without them. Exact optional variables are in `.env.example`. |
| Single flagship domain | Tokyo planning proves the causal architecture; a universal waiting SDK is roadmap only. |
| Seed replay scope | The product implements a deterministic cosmetic seed echo, not a replay of a prior player's private route. |

## Feature classification

### Implemented

- P0 causal steering loop and immediate completion takeover
- Two meaningful Tokyo gates and default no-interaction behavior
- Structured ranking, synthesis lock, and authoritative Impact Receipt
- Demo, Live, and explicit Fallback Replay provider modes
- SSE, Last-Event-ID replay, polling fallback, and transport cleanup
- Sandboxed game boundary, Privacy Inspector, Sensitive Mode, and canary tests
- Canvas flight, Passive Mode, Reduced Motion Mode, responsive controls, and focus recovery
- Fault Lab, computed split-screen comparison, Flight Card, persisted generic card identity, cosmetic seed echo, and Flight Pack preview
- Required application, API, test, and documentation surfaces

### Simulated

- Demo and Fallback opening evidence is versioned scenario data recorded in the fixture, not live availability.
- Demo payment mode is a visibly labeled sandbox preview and creates no transaction.
- Seed timing, visual routes, and the seed echo are deterministic cosmetic data. They do not claim to replay another player.

### Adapter-ready

- OpenAI-compatible server adapter
- Durable `RunStore` replacement
- Future documented host integration
- Future payment provider behind `PaymentAdapter`

### Roadmap only

- Commons-specific integration without a verified public contract
- Universal external waiting-layer SDK
- Live provider venue normalization and first-party availability tooling
- Creator marketplace, group flocks, shared constellations, and multiplayer
- Complex accounts and cross-device preference memory

## Verification evidence

The results below are from the integrated competition-polish gate on 2026-08-31:

- `pnpm install --frozen-lockfile`: passed, lockfile already current.
- `pnpm lint`: passed with zero warnings.
- `pnpm typecheck`: passed with zero TypeScript errors.
- `pnpm test:unit`: 11 files, 51 tests passed.
- `pnpm test:integration`: 4 files, 24 tests passed.
- `pnpm test:race`: 1 file, 5 tests passed, exercising 300 controlled interleavings plus duplicate-signal replay.
- `pnpm test:privacy`: 3 files, 18 tests passed.
- `pnpm build`: passed using Next.js 16.3.3 production build.
- `pnpm test:e2e`: 39 browser tests passed across desktop and mobile projects, including a measured completion-to-result assertion below 250 ms.
- `pnpm test:a11y`: 8 accessibility tests passed at 1440 by 900 and 390 by 844, including host, iframe, reduced-motion, comparison, and high-contrast coverage with no serious or critical axe findings.
- `pnpm demo:preflight`: 3 consecutive production smoke runs passed.
- `pnpm test`: 19 Vitest files, 98 tests passed across unit, integration, race, and privacy suites.
- Browser assertions reported no console errors or page errors on the judge path.
- The privacy canary was absent from the iframe DOM, bridge inspector, URL, localStorage, sessionStorage, IndexedDB names, and sanitized share surface.
- The production client artifact scan found no `AGENT_API_KEY`, server secret marker, or raw-prompt canary.
- Snapshot polling completed after a forced SSE connection failure.
- Native SSE reconnect resumed from `Last-Event-ID` without stale overwrite.
- A local OpenAI-compatible browser probe kept Live Provider visibly labeled on success and changed the UI to Fallback Replay after a controlled live-provider failure.
- A temporary offline browser did not stop server-side completion.
- No skipped critical tests were found.
- The public Cloudflare path returned health 200, preserved the flight CSP, and completed three consecutive seeded browser smoke runs with no console errors.
- The public privacy canary test passed through the tunnel, origin proxy, SSE transport, and sandboxed flight boundary.
- The dedicated public late-choice proof showed an authoritative tooLate ACK before completion, and the public causal-strip proof preserved the matching ACK while the next gate opened.
- `pnpm host:preflight` passed all PM2, local/public health, CSP, HSTS, no-transform, and analytics-injection checks.
- Four public desktop accessibility checks passed, including active flight, reduced motion, comparison, and high contrast, with no serious or critical axe findings.
- Cloudflare analytics injection is prevented with a final `Cache-Control: no-transform` HTML policy; the host and flight HTML contain no injected beacon.

Visual inspection covered the empty state, mobile composer, active Canvas gate, pending and applied ACK states, two-choice result takeover, expanded technical Impact Receipt, actual Privacy Inspector payloads, Reduced Motion Mode, late choice, fast completion, Fault Lab, provider failure, Flight Pack preview, computed comparison, and desktop and mobile layouts. Fresh captures from the public build are stored in `demo/` and can be regenerated with `pnpm demo:capture`.
