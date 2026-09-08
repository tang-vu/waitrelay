# Product Specification

## Product

**Name:** WaitRelay: Fork Flight

**Tagline:** The wait is the second half of your prompt.

**Judge line:** The bird game where the gates really change the AI answer.

WaitRelay is a playable decision relay for AI waiting time. While an agent continues working, it can expose a small number of useful unresolved preferences as flight gates. The user flies a luminous courier bird through a current, the host validates that selection, and an accepted preference changes the structured result before synthesis.

The product is not a generic minigame, prediction game, loading animation, or chain-of-thought viewer. Its gameplay loses its meaning when disconnected from the agent decision pipeline.

## User problem

Agent latency currently asks users either to watch an inert indicator or leave. At the same time, many prompts omit preferences that could improve the result. Asking a follow-up question blocks the agent. Guessing silently loses user intent.

WaitRelay keeps the agent moving with sensible defaults while offering useful, optional steering during otherwise idle time.

## Flagship scenario

Prompt:

> Plan a rain-safe surprise date in Tokyo tonight under ¥12,000. We are vegetarian. Verify that every place is open.

Primary gates:

1. Less Walking or More Discovery
2. Reliable or Surprising

The planning pipeline normalizes venue location, estimated cost, indoor suitability, vegetarian suitability, opening evidence, evidence timestamp, source confidence, novelty, and route distance. It computes a baseline with default weights, snapshots accepted preferences at the synthesis lock, reranks candidates, selects a structured itinerary, and compares that itinerary with the baseline.

## Core loop

1. The user submits a task.
2. The host starts work immediately.
3. Fork Flight appears only when the wait duration warrants it.
4. The host emits public lifecycle stages.
5. The host requests an allowlisted choice.
6. The player selects a current or skips it.
7. Fork Flight emits an option identifier, never a preference patch.
8. The host validates and atomically accepts or rejects the signal.
9. The host emits an authoritative ACK.
10. Accepted preferences are snapshotted before synthesis.
11. The structured plan changes according to trusted server mappings.
12. `run.complete` reveals the answer immediately.
13. The Impact Receipt describes computed before and after effects.

The agent never pauses for a player. No interaction, a missed gate, a dismissed game, a bridge failure, or a disconnected stream must degrade normal completion.

## Product principles

### Completion wins

When completion arrives, active gates are disabled and the answer takes visual priority. Portal animation may continue as decoration, but cannot delay the result.

### ACK honesty

The UI can display "Applied now" only after the host acknowledges `appliedNow`. Signals that miss the synthesis lock are `tooLate` or `rejected`. A decorative animation is never treated as confirmation.

### Measured causality

Impact Receipts are generated from the authoritative baseline, accepted preference patch, selected plan, and event timestamps. A language model may present an already structured itinerary, but cannot invent ranking effects or receipt metrics.

### Fail open

The agent and result surface remain independent of the flight renderer, animation loop, iframe bridge, SSE connection, polling fallback, telemetry, and payment adapter.

### Useful brevity

Each gate should be understood in about two seconds. There are no lives, death loops, mandatory restarts, blocking obstacles, or latency rewards.

## Latency adaptation

| Observed wait | Experience |
| --- | --- |
| Under 1 second | No full-screen game. At most a subtle inline bird. |
| 1 to 5 seconds | Short flight with at most one useful gate. |
| 5 to 20 seconds | One to three gates. |
| 20 to 60 seconds | Replayable 8 to 12 second modules, with at most three decisions. |
| Over 60 seconds | Optional modular flight or Quiet Mode. No fabricated countdown. |

Public lifecycle stages such as Understanding, Gathering, Evaluating, Composing, and Verifying alter ambience without implying percentage progress or revealing private reasoning.

Long waits cycle through Aurora Drift, Cloud Passage, and Starfield scenery in
ten-second modules, with a 1.5-second crossfade. These are decorative loops,
independent of the agent's stage and decision requests. Quiet Mode remains
available throughout; returning to flight resumes its scenery clock. Completion
removes the activity immediately, including during a transition. Scenery catches
up after a suspended browser frame while bird physics remains bounded.

## Interaction modes

- **Active Mode:** Continuous abstract flight with keyboard, pointer, touch, and accessible button controls.
- **Passive Mode:** Decorative world with no action required.
- **Reduced Motion Mode:** Calm constellation node selection without continuous travel.
- **Sensitive Mode:** Generic visuals, generic gates, sharing off, telemetry avoided, and no personal entities in game messages.
- **Dismiss activity:** Hides the activity. Agent work continues.
- **Cancel AI run:** Requests cancellation through the host protocol.

Sound and haptics are off by default.

## Event behavior

All public events are runtime validated and contain a protocol version, run ID, event ID, monotonic sequence, timestamp, and discriminated type. Choice signals are idempotent by signal ID. The store rejects stale runs, conflicting selections, and post-terminal mutation. Duplicate and out-of-order events do not regress the UI.

Terminal states are completed, cancelled, and failed. Terminal transitions are monotonic.

## Impact Receipt requirements

For every `appliedNow` choice, the host records:

- Request, axis, selected option, and default option
- Signal and ACK timestamps
- ACK status
- Pipeline node affected
- Before and after state
- Effect metrics
- A human-readable summary derived from those metrics

The compact receipt is user-facing. An expandable judge view exposes the technical comparison without exposing private model reasoning. Non-applied choices never appear as applied effects. If a preference causes no measurable plan change, the receipt says so.

## Provider modes

- **Live Provider:** Makes configured external analysis, evidence-summary, and presentation requests. In this prototype, it presents the versioned Tokyo scenario plan and is not live venue verification.
- **Demo Provider:** Uses deterministic versioned fixtures and seeded event timing. Fixture availability is labeled scenario data with a recorded timestamp.
- **Fallback Replay:** Uses fixtures only when the live provider is unavailable and explicit fallback is enabled. The visible provider label changes.

## Scope

P0 includes prompt submission, agent lifecycle, two causal gates, signal and ACK protocol, structured reranking, receipt, immediate takeover, skip, dismiss, cancel, deterministic demo, and responsive use.

P1 includes the sandboxed privacy boundary, inspector, reduced motion, Fault Lab, race and privacy verification, live adapter, and judge documentation.

P2 includes a sanitized Flight Card, persistent cosmetics, Flight Pack preview, and split-screen comparison.

Live multiplayer, chat, PvP, a marketplace, user-generated worlds, AI companions, voice, crypto rewards, multiple games, free-text gates, complex accounts, and a universal public SDK are outside the MVP.

## Success conditions

The vertical product is successful when an optional flight choice is authoritatively accepted before a lock, causes a deterministic structured change, is proven in a receipt, and never delays the underlying answer. The same run must also complete normally when the player does nothing or the game fails.
