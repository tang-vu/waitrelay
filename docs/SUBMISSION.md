# Submission Copy

## Project title

WaitRelay: Fork Flight

## Tagline

The wait is the second half of your prompt.

## One-sentence pitch

WaitRelay turns unresolved agent decisions into short flight gates, so optional play can meaningfully steer an already-running AI result without ever delaying completion.

## 50-word description

WaitRelay turns AI waiting time into a second input channel. Fly a luminous courier through useful decision gates while the agent keeps working. Server-acknowledged choices alter a structured result, completion always wins, and an Impact Receipt proves exactly what changed without exposing prompts or private reasoning to the flight itself.

## 150-word description

WaitRelay: Fork Flight is a playable decision relay for AI agents. Instead of filling latency with a detached minigame, it turns unresolved preferences into flight gates. In the Tokyo planner, the agent gathers rain-safe vegetarian venues while the player chooses priorities such as Less Walking or More Discovery and Reliable or Surprising. The browser sends an allowlisted option ID. The host validates it, atomically accepts it before synthesis, and acknowledges whether it was applied or too late. Only an authoritative ACK can display Applied now. Accepted preferences rerank a structured plan, and an Impact Receipt compares the baseline and selected result. Completion replaces gameplay during a gate, and skipping, dismissing, disconnecting, or crashing the game never blocks the answer. A sandboxed, enum-only bridge keeps the raw prompt out of Fork Flight. Deterministic fixtures, seeded timing, a Privacy Inspector, and a Fault Lab make the judge path reliable without external credentials.

## Full description

AI agents often need time to gather evidence and synthesize an answer. Existing waiting experiences either ask users to stare at a spinner or distract them with activity unrelated to the work. WaitRelay treats that latency as a second input channel.

While an agent continues with sensible defaults, WaitRelay can expose a small number of useful unresolved preferences. The user flies a luminous origami-like courier bird through one of two aurora currents. That action sends a structured `choice.signal` containing an allowlisted option identifier. The host maps it to a trusted preference patch, accepts it only before the synthesis lock, and emits an authoritative ACK. The game shows Applied now only after that ACK.

The flagship workflow plans a rain-safe vegetarian surprise date in Tokyo under ¥12,000. Candidate evidence is normalized and ranked using explicit constraints and weights. Less Walking can increase the route-distance weight. Surprising can increase novelty while preserving hard suitability and availability rules. Accepted choices recalculate the structured plan. An Impact Receipt compares the baseline and selected plans to report computed changes such as walking weight, distance, substitutions, novelty, and source-confidence values.

The result never waits for the bird. `run.complete` disables the gate and reveals the answer immediately. A missed gate keeps the default. Dismiss activity hides the game without cancelling work. Cancel AI run is a separate control. Passive and Reduced Motion modes keep the experience optional and accessible.

Fork Flight runs behind a typed, sandboxed boundary and never receives the raw prompt, model output, tool results, credentials, or personal entities. The Privacy Inspector shows the exact messages sent across that boundary. The deterministic Demo Provider uses versioned fixture evidence and seeded timing, visibly labeled as scenario data. A Fault Lab combines interactive failure probes with exact automated-test references for completion races, late choices, duplicate signals, reconnection, polling fallback, provider failure, renderer failure, cancellation, privacy, and motion modes.

WaitRelay demonstrates a larger opportunity: an embeddable waiting layer for research, coding, planning, and creative agents, where latency can carry lightweight human intent instead of wasting attention.

## Problem

Waiting for an AI agent wastes attention, while the original prompt often leaves useful preferences unspecified. Blocking follow-up questions slow the task. Detached minigames may entertain, but they do not improve the answer.

## Solution

Let the agent keep working with defaults and offer optional, allowlisted decisions during latency. Relay accepted choices back before synthesis, use them in a deterministic structured pipeline, and prove their effect in an Impact Receipt.

## What was built

- A responsive prompt and result host
- A lightweight original flight experience
- Two causal Tokyo planning axes
- Runtime-validated versioned events
- Idempotent choice signaling and authoritative ACKs
- Atomic synthesis lock and preference snapshot
- Structured candidate ranking and receipt comparison
- SSE with snapshot polling fallback
- Sandboxed, enum-only game boundary and Privacy Inspector
- Demo, live-compatible, and labeled fallback provider modes
- Passive, Reduced Motion, dismiss, skip, and cancel behavior
- Fault Lab and automated unit, integration, race, privacy, end-to-end, and accessibility verification
- Computed split-screen comparison, sanitized Flight Card, seed echo, and post-run Flight Pack preview

The final repository status and test report are authoritative for which optional items are implemented.

## Originality

The flight is not a separate reward for waiting. It is a user interface for unresolved agent decisions. The choice, ACK, synthesis lock, structured reranking, and receipt form one causal chain. The result itself is the finish line.

## Agent fit

Gates originate from real structured decision axes. The agent continues gathering in parallel, applies accepted preferences at synthesis, and rejects late signals honestly. Public lifecycle stages drive atmosphere without exposing chain-of-thought.

## Waiting experience

The interface adapts to duration. Fast runs avoid overlay flicker. Longer waits offer at most three useful gates and optional cosmetic flight. There are no lives, death loops, forced restarts, fake percentages, or completion gates. Skip, Passive Mode, and dismiss preserve normal completion.

## Repeatability

The flagship wait scenarios expose zero, one, or two allowlisted gates. Cosmetic bird identity, visual routes, sanitized Flight Cards, and a deterministic seed echo create continuity without storing the prompt or answer. The echo is cosmetic, not another player's replay. Shared constellations and group flocks remain roadmap ideas.

## Privacy

The host may process and send the prompt to a configured provider, but Fork Flight never receives it. The game gets only a Context Capsule, public stage, allowlisted gate data, safe ACK, and visual seed. The iframe uses a restrictive sandbox and CSP. Browser and sanitizer canary tests cover the bridge inspector, DOM, flight network, URLs, console, storage, Flight Card, and public error projection.

## Architecture

Next.js hosts the UI and API. A provider-independent orchestrator writes a validated append-only public event log to an in-memory RunStore. SSE streams events with Last-Event-ID replay, while sequence-checked snapshots provide fallback. Agent, store, and payment adapters preserve portable integration boundaries. The fixture adapter keeps the judge path deterministic and offline-capable.

## Revenue model

The complete steering experience remains free. The post-run "Forge a Flight Pack" surface previews cosmetic bird bodies, sky palettes, trails, and portals now, and could later sell optional cosmetics. There is no better output, pay-to-win steering, or purchase during waiting. Future business options include cosmetic packs, creator themes, group constellations, and B2B pricing per completed wait session. No revenue or transaction is claimed.

## Demo instructions

1. Open `https://waitrelay.tangvu.dev/demo?scenario=standard&seed=fork-flight-001`.
2. Confirm the Demo Provider badge and recorded scenario-data notice.
3. Submit the prefilled Tokyo task.
4. Select Less Walking and observe Pending before Applied now.
5. Select Surprising if presented.
6. Let completion replace the active flight.
7. Expand Impact Receipt and Privacy Inspector.
8. Open `/fault-lab` and run the 200 ms completion case.

See `docs/DEMO_SCRIPT.md` for exact voiceover and preflight steps.

## Known limitations

- The in-memory store supports a single application instance.
- The deterministic demo is scenario data, not live venue verification.
- The Live Provider validates external analysis and presentation, but does not yet normalize live venue records into the structured ranker. It is not live venue verification.
- No Commons-specific adapter or payment mode is enabled without an official public contract.
- The MVP is optimized around one excellent planning scenario.
- Optional P2 features are present only where confirmed by the final implementation status.

## Roadmap

- Durable multi-instance RunStore
- Documented adapters for research, coding, and creative agents
- Creator-made cosmetic themes
- Group constellations and shared, privacy-safe waits
- Official Commons adapter if a public contract becomes available
- Privacy-preserving preference memory with explicit opt-in and reset

## Links

- Repository: `https://github.com/tang-vu/waitrelay`
- Public deployment: `https://waitrelay.tangvu.dev`
- Demo video: `[VIDEO_URL]` (local 90-second recording ready at `artifacts/demo/waitrelay-demo.mp4`; not yet published)
- Hackathon page: `https://commonsmade.com/hackathons`

Replace the remaining placeholders only with verified public URLs. Do not fabricate links.
