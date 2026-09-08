# Implementation Status

Last updated: 2026-09-09

## September 9 CI and completion-latency verification

- Added automatic GitHub Actions verification on Linux and isolated deployment
  rollback checks on Windows. Node 24.20.0 is pinned in `.node-version`; the
  declared Node engine range now matches the installed development dependencies.
- [The release CI run](https://github.com/tang-vu/waitrelay/actions/runs/34263379948)
  passed frozen installation, lint, all 114 Vitest tests, production build,
  TypeScript, all 54 browser tests, three consecutive seeded smoke runs, and
  all three Windows deployment cases. Browser retries were disabled.
- The first clean-run audit found a mobile status row that could overflow with
  the longer live-adapter label. Badges now wrap. Direct checks at 320 and 390
  pixels with an unavailable-adapter response found no horizontal overflow.
  Both desktop and mobile accessibility checks pass after the correction.
- The same audit exposed a test that measured changing gate buttons through
  separate asynchronous calls. Control dimensions are now captured atomically
  from one rendered state, retaining the 44-pixel assertions.
- A public completion measurement exceeded 250 ms. Browser profiling isolated
  approximately 171 ms of scheduler delay before the result update. Only the
  authoritative completion event now commits synchronously, and its layout
  effect focuses and frames the answer before paint. Six focused browser checks
  passed across three repetitions; three separate local measurements were
  62.6, 60.7, and 67.7 ms. The public causal-flow timing assertion also passed.
- Application commit `d473112` was deployed through the verified rollback path.
  The active production build is `ei0ql_JL8DnNZ8DAnBQxv`; hosting preflight and
  the four affected public desktop/mobile checks passed after deployment.
  Three consecutive public seeded smoke runs also passed without console errors.
- The production dependency audit reported no known vulnerabilities. Local
  diagnostic captures and measurements remain under ignored `artifacts/`.
- See [Verification and release gates](VERIFICATION.md) for the scope of each
  check. The remaining latency-adaptation audit is tracked under Next work.

## September 9 local demo recording

- Created the 90-second 1920 x 1080 MP4 with English synthetic narration and captions using `pnpm demo:record`. The source is the actual public build.
- The continuous main run includes two acknowledged choices and its computed receipt. Comparison, fast completion, and mobile touch footage are labeled as separate scenes.
- Recording assertions passed without browser console or page errors. The output is H.264/AAC, 5,653,767 bytes; every narration segment fits its allotted scene. Sampled frames were visually reviewed, and full audio/video decoding passed.
- Local artifacts, transcript, captions, and capture evidence are in `artifacts/demo/`, excluded from Git. Publication and hackathon submission remain pending explicit authorization.

## September 9 production rollout

- Production was updated through `pnpm deploy:local`; that rollout used build ID
  `sndG0diTg0Zr9vlfIYhSl`. Previous builds remain under `.release-backups`.
- The rollout now has a deployment lock, bounded health checks, and rollback
  after build/startup/preflight failure. `pnpm test:ops` passed three isolated
  scenarios: success, build failure, and preflight failure, including restored
  build content, process commands, caller environment, and released lock.
- Initial public smoke runs exposed stale iframe-handshake state and latency
  during run creation. The host now retains candidate ports until readiness,
  resends current state, retries through the handshake budget, and measures the
  activity delay from submission instead of adding it after a slow response.
- The integrated local suite passed 54 browser tests and the unit/integration/
  race/privacy suite reached 114 tests. After the final timing adjustment,
  nine focused browser checks passed across three repetitions of slow iframe
  initialization, 200 ms completion, and the seeded judge path. The affected
  hook and handshake suites also passed all 16 cases.
- The final production build, TypeScript compilation, lint checks, and hosting
  preflight passed. The client bundle scan found none of the provider-key name
  or private prompt/provider canaries used by the tests.
- On the final public build, all three consecutive seeded smoke runs passed.
  The 23 desktop/mobile surface checks passed, as did the additional slow
  iframe-initialization and raw-prompt privacy canary checks: 28 public browser
  checks in total. The hosting preflight also passed after the final restart.
- `pnpm demo:capture` refreshed the submission images from the public build
  without console or page errors. Structured desktop/mobile result captures
  were also refreshed from the passing public browser tests.
- The existing GitHub repository was verified as public and nonempty, and its
  real URL now replaces the repository placeholder in submission copy.

The historical local-only notices below describe earlier passes; this rollout
supersedes them for the deployed application.

## September 9 recovery verification

- Added a branded 404 with working workspace/demo links and verified 404 status,
  accessibility, and narrow-screen layout.
- Failed, cancelled, and unavailable runs now receive keyboard focus and offer
  an explicit return to the unchanged prompt for a new attempt.
- Creation responses are runtime validated, including same-run transport URLs.
  Busy and invalid requests get fixed, safe messages; raw response and parsing
  errors are never projected into the start-failure UI.
- Start requests have a 15-second timeout, snapshot requests a 10-second timeout.
  Obsolete requests are aborted and their callbacks ignored. A browser without
  EventSource can complete normally through snapshots.
- A snapshot 404/410 ends browser waiting as `unavailable`, without inventing a
  server cancellation or failure. Transient failures continue to retry.
- The final isolated production build and full lint passed. All 53 browser
  tests passed, including eight new desktop/mobile recovery checks. Manual
  visual inspection covered the mobile 404 and busy-service recovery screen.
- The hook regression suite now has 13 passing cases, including timeouts,
  lost runs, malformed transport URLs, unavailable SSE, and reconnection races.
- Final `pnpm test`: 20 files, 111 tests passed. `pnpm typecheck` also passed.
- Public production has not been updated by this local verification pass.

## September 9 result experience verification

- `WAITRELAY_TEST_BUILD=1 pnpm build`: isolated production build passed.
- `NODE_DISABLE_COMPILE_CACHE=1 pnpm lint`: passed with zero warnings.
- `pnpm typecheck`: passed.
- `pnpm test`: 20 files, 103 tests passed.
- `WAITRELAY_TEST_BUILD=1 pnpm test:e2e`: 45 browser tests passed, including
  six new desktop/mobile result checks for authoritative data, clipboard
  success and rejection, Sensitive Mode, blocked cosmetic storage, focus
  recovery, overflow, and completed-state accessibility.
- The initial result accessibility checks found a prohibited ARIA label on
  the existing Flight Pack swatches. It was corrected before the final run.
- Visually inspected the structured result on desktop and mobile. Captures
  are `demo/structured-result-desktop.png` and
  `demo/structured-result-mobile.png`. Recreate their source images with
  `playwright test tests/e2e/result-experience.spec.ts` against an isolated
  production build; each project's test output includes `structured-result.png`.
- This is local verification. The public production deployment and older
  public screenshots have not been replaced by this pass.

## September 8 reliability pass

- Isolated each browser transport lifecycle so delayed creation responses,
  closed-stream callbacks, and failed choice/cancel requests cannot overwrite a
  newer run or update the controller after unmount.
- Reset run identity immediately on a new start and prevent overlapping slow
  snapshot polls. Transport cleanup now follows unmount rather than each status
  change, preserving streams opened by an immediately resolved start request.
- Added five hook-level regression tests covering reverse-order creation,
  stale creation failures, unmount during creation, closed-stream callbacks,
  and slow polling across a restart.
- Limited Vitest to two workers after the unrestricted baseline run timed out
  in two orchestration tests. The normal `pnpm test` command now passes all
  103 tests across 20 files on this machine.
- Added `WAITRELAY_TEST_BUILD=1` for an isolated `.next-test` build while the
  local production server remains running. See the local hosting guide.
- Verified the isolated production build, TypeScript, and all 39 Playwright
  tests, including desktop/mobile accessibility, privacy canaries, completion
  timing, real browser offline recovery, polling, and SSE reconnection.
- ESLint passed with zero warnings with `NODE_DISABLE_COMPILE_CACHE=1`.
  Earlier concurrent lint processes remained stalled; they were stopped after
  the successful full lint run. No dependency or global cache was modified.
- These changes are local; the existing public deployment has not been updated
  by this pass. Historical public-host checks below remain dated August 31.

## Completed work

- Structured result cards show the authoritative route total, distance, stop
  order, venue details, and recorded-data notice, with the full provider answer
  available in an expandable section.
- Explicit itinerary copying includes the full answer and data notice. Clipboard
  rejection exposes selectable text with an honest failure message; Sensitive
  Mode removes copying.
- Optional cosmetic storage now fails open when browser storage is blocked,
  and Flight Pack reports whether the preview was saved or kept for the session.
- Completed-state accessibility coverage now includes the Flight Pack palette,
  which has a named image role for assistive technology.

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

The revised application is published at `https://waitrelay.tangvu.dev` from a
single local production process through a named Cloudflare Tunnel. PM2 manages
the Next.js server, origin proxy, and tunnel connector. The source release is
maintained in the public GitHub repository linked in the submission document.
The demo video is recorded locally. No video publication, purchase, or hackathon submission has been performed.

## Next work

1. Complete the latency-adaptation audit: the specification calls for 8-12 second
   repeatable modules on long waits. The current renderer has continuous seeded
   scenery and Quiet Mode, but a distinct module cadence and the over-60-second
   behavior have not yet been established by direct verification.
2. Review the local video and obtain explicit authorization before publication.
3. Replace the remaining video placeholder only after a real public video URL exists.
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
