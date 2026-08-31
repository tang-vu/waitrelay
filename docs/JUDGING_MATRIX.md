# Judging Matrix

This matrix maps the official criteria to inspectable product behavior. Test and implementation references should be kept current as the repository evolves.

## Waiting Experience, 30%

| Evidence | What to demonstrate |
| --- | --- |
| Completion never blocked | Trigger completion during an active gate. The answer replaces the activity immediately while portal motion remains decorative. |
| Adaptive duration | Run the 200 ms, 2 second, 8 second, and 30 second scenarios. The fast case never flashes a full-screen overlay. |
| Optional attention | Skip a gate, enable Passive Mode, and dismiss activity. Each run still completes with default preferences. |
| Separate semantics | Dismiss activity and show the result. In another run, use Cancel AI run and show the cancelled terminal state. |
| No failure loop | There are no lives, mandatory restarts, blocking obstacles, or result penalties. |
| Fail open | Break the iframe or disconnect SSE in Fault Lab. The host still reveals the answer. |

## Originality, 25%

| Evidence | What to demonstrate |
| --- | --- |
| Latency as second input channel | The agent continues gathering while the player supplies a preference omitted from the original prompt. |
| Causal flight gates | Select Less Walking and show the trusted server mapping, authoritative ACK, reranking, and changed itinerary. |
| Impact Receipt | Expand before and after weights, route distance, substitutions, and ACK timestamps generated from structured state. |
| Result as finish line | `run.complete` opens the answer surface immediately at the bird's current position. |

## Fit, 20%

| Evidence | What to demonstrate |
| --- | --- |
| Agent-originated decisions | Gates are selected from allowlisted axes applicable to the structured planning task. |
| Honest ACK protocol | Pending appears after signal. Applied now appears only after `choice.ack`. A post-lock signal reads Too late. |
| Result changes | Compare the same seeded prompt under defaults and accepted choices. Candidate ranking and route metrics visibly differ. |
| Lifecycle-driven world | Understanding, Gathering, Evaluating, Composing, and Verifying alter ambience without exposing private reasoning. |

## Repeatability, 15%

| Evidence | What to demonstrate |
| --- | --- |
| Varying gates | Fast, short, and standard waits expose zero, one, or two meaningful gates while seeded cosmetic routes vary. |
| Persistent bird | Cosmetic identity can persist locally without storing prompt or output. |
| Flight Cards | The card contains only generic identity, applied-choice count, duration band, branding, and a sanitized seed link. |
| Seed echo | The same seed recreates timing, visual route, and a cosmetic echo without replaying private task data or another player. |

## Execution, 10%

| Evidence | What to demonstrate |
| --- | --- |
| Working vertical | Submit task, fly gate, receive ACK, see changed result and receipt. |
| Deterministic fallback | Run the seeded demo offline with no secret and show the Demo Provider label. |
| Privacy boundary | Open the live Privacy Inspector and show only transmitted enums and allowlisted events. |
| Fault Lab | Run interactive completion, late-choice, reconnection, provider, renderer, and cancellation probes; open exact automated-test references for protocol-only cases. |
| Automated verification | Run lint, typecheck, unit, integration, race, privacy, build, end-to-end, accessibility, and repeated preflight checks. |

## Highest-value judge path

1. Submit the Tokyo task in the standard seeded demo.
2. Select Less Walking.
3. Point out that the state is pending until the server ACK.
4. Select Surprising if the scenario exposes the second gate.
5. Let completion interrupt the flight.
6. Expand the receipt and show computed plan changes.
7. Open Privacy Inspector and show the raw prompt is absent.
8. Run the 200 ms scenario to prove no overlay flicker.

The core claim is not that the flight fills time. It is that the flight carries validated user intent back into an already-running agent without blocking completion.
