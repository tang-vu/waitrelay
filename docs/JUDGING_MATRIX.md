# Judging Matrix

This matrix maps every official criterion to a public route, a checked-in capture where one is useful, and exact automated evidence. The public build uses recorded scenario evidence under the visible Demo Provider label.

## Waiting Experience, 30%

| Claim | Judge proof | Repository evidence |
| --- | --- | --- |
| Completion never blocks | In the [standard seeded run](https://waitrelay.tangvu.dev/demo?scenario=standard&seed=fork-flight-001), let completion arrive during a gate. The answer replaces activity immediately. | [`core-flow.spec.ts`](../tests/e2e/core-flow.spec.ts), tests for active-gate completion, focus recovery, and the sub-250 ms reveal |
| Duration adapts honestly | Use the 200 ms, 2 second, 8 second, and 30 second probes in [Fault Lab](https://waitrelay.tangvu.dev/fault-lab). The fastest case never mounts full flight. | [`core-flow.spec.ts`](../tests/e2e/core-flow.spec.ts), [`demo-smoke.spec.ts`](../tests/e2e/demo-smoke.spec.ts) |
| Long waits stay optional | The [long seeded run](https://waitrelay.tangvu.dev/demo?scenario=long&seed=long-wait-modules) cycles through ten-second scenery modules; Quiet Mode and completion remain independent. | [`long-wait.spec.ts`](../tests/e2e/long-wait.spec.ts), [`flight-scenery.test.ts`](../tests/unit/flight-scenery.test.ts), [desktop](../demo/long-wait-starfield-desktop.png) and [mobile](../demo/long-wait-starfield-mobile.png) captures from the public build with the decorative frame clock advanced by the test |
| Attention stays optional | Skip, dismiss activity, or enable Passive Mode. Normal task completion continues with defaults. | [`core-flow.spec.ts`](../tests/e2e/core-flow.spec.ts), [`mobile-and-modes.spec.ts`](../tests/e2e/mobile-and-modes.spec.ts) |
| Dismiss and cancel differ | Dismiss hides only the activity. Cancel creates a terminal cancelled run. | [Fault Lab](https://waitrelay.tangvu.dev/fault-lab), [`core-flow.spec.ts`](../tests/e2e/core-flow.spec.ts) |
| Fail open | Trigger renderer failure, SSE loss, polling fallback, provider failure, or temporary offline state. The host remains authoritative. | [Fault Lab capture](../demo/fault-lab-updated.png), [`core-flow.spec.ts`](../tests/e2e/core-flow.spec.ts), [`transport-ordering.test.ts`](../tests/unit/transport-ordering.test.ts) |

## Originality, 25%

| Claim | Judge proof | Repository evidence |
| --- | --- | --- |
| Latency becomes a second input channel | In the [standard seeded run](https://waitrelay.tangvu.dev/demo?scenario=standard&seed=fork-flight-001), the agent starts first and continues while the player supplies an unresolved preference. | [Active gate capture](../demo/active-gate-final.png), [`run-orchestrator.test.ts`](../tests/integration/run-orchestrator.test.ts) |
| Flight gates causally steer | Select Less Walking, wait for ACK, and inspect the changed structured route. | [`preferences-and-ranking.test.ts`](../tests/unit/preferences-and-ranking.test.ts), [`core-flow.spec.ts`](../tests/e2e/core-flow.spec.ts) |
| Impact Receipt proves effect | Expand compact and technical receipt views to show authoritative before state, after state, metrics, and ACK timestamps. | [Receipt capture](../demo/result-receipt-final.png), [`impact-builder.test.ts`](../tests/unit/impact-builder.test.ts), [`receipt-contract.test.ts`](../tests/unit/receipt-contract.test.ts) |
| The result is the finish line | Observe completion take over at the bird's current position without a level finish or celebration wait. | [`core-flow.spec.ts`](../tests/e2e/core-flow.spec.ts) |

## Fit, 20%

| Claim | Judge proof | Repository evidence |
| --- | --- | --- |
| Gates come from structured decisions | The Tokyo run exposes only the applicable mobility and character axes, with two allowlisted options each. | [`event-protocol.test.ts`](../tests/unit/event-protocol.test.ts), [`preference-reducer.test.ts`](../tests/unit/preference-reducer.test.ts) |
| ACK wording stays honest | Pending appears after a signal. Applied now appears only after `choice.ack`. A post-lock signal reads Too late and never enters the receipt. | [Dedicated late-choice run](https://waitrelay.tangvu.dev/demo?scenario=late&seed=late-001), [`core-flow.spec.ts`](../tests/e2e/core-flow.spec.ts) |
| Choices visibly change the answer | Open the [computed comparison](https://waitrelay.tangvu.dev/compare) to compare two preference paths through the same scenario. | [Comparison capture](../demo/compare-final.png), [`comparison-builder.test.ts`](../tests/unit/comparison-builder.test.ts), [`mobile-and-modes.spec.ts`](../tests/e2e/mobile-and-modes.spec.ts) |
| Public lifecycle drives ambience | Understanding, Gathering, Evaluating, Composing, and Verifying alter the world without exposing private reasoning. | [`event-protocol.test.ts`](../tests/unit/event-protocol.test.ts), [`game-boundary.test.ts`](../tests/privacy/game-boundary.test.ts) |

## Repeatability, 15%

| Claim | Judge proof | Repository evidence |
| --- | --- | --- |
| Wait length changes the module | Compare the [fast](https://waitrelay.tangvu.dev/demo?scenario=fast&seed=fork-flight-001), [standard](https://waitrelay.tangvu.dev/demo?scenario=standard&seed=fork-flight-001), and [long](https://waitrelay.tangvu.dev/demo?scenario=long&seed=fork-flight-001) seeded routes. | [`run-orchestrator.test.ts`](../tests/integration/run-orchestrator.test.ts), [`demo-smoke.spec.ts`](../tests/e2e/demo-smoke.spec.ts) |
| Different choices produce different plans | The [comparison route](https://waitrelay.tangvu.dev/compare) shows compact and discovery-oriented plans side by side from one scenario. | [Comparison capture](../demo/compare-final.png), [`comparison-builder.test.ts`](../tests/unit/comparison-builder.test.ts) |
| Cosmetic continuity remains private | The post-run Flight Card carries generic identity, applied-choice count, duration band, branding, and sanitized seed only. | [`flight-card.test.tsx`](../tests/privacy/flight-card.test.tsx), [`flight-engine.test.ts`](../tests/unit/flight-engine.test.ts) |
| Seed echo is deterministic | Reusing the public seed recreates timing and cosmetic route without replaying another player's task or output. | [`flight-engine.test.ts`](../tests/unit/flight-engine.test.ts), [`run-orchestrator.test.ts`](../tests/integration/run-orchestrator.test.ts) |

## Execution, 10%

| Claim | Judge proof | Repository evidence |
| --- | --- | --- |
| Complete vertical works | Submit, fly, receive ACK, see the changed result, and inspect its receipt in the [public demo](https://waitrelay.tangvu.dev/demo?scenario=standard&seed=fork-flight-001). | [Receipt capture](../demo/result-receipt-final.png), [`demo-smoke.spec.ts`](../tests/e2e/demo-smoke.spec.ts) |
| Credential-free path is deterministic | The public [health endpoint](https://waitrelay.tangvu.dev/api/health) and UI identify Demo Provider. Fixture opening evidence is labeled scenario data. | [`run-orchestrator.test.ts`](../tests/integration/run-orchestrator.test.ts), [`live-adapter.test.ts`](../tests/integration/live-adapter.test.ts) |
| Privacy boundary is inspectable | Expand Privacy Inspector in the completed run and inspect the actual enum-oriented messages sent into the sandbox. | [`game-boundary.test.ts`](../tests/privacy/game-boundary.test.ts), [`sanitize.test.ts`](../tests/privacy/sanitize.test.ts), [`core-flow.spec.ts`](../tests/e2e/core-flow.spec.ts) |
| Failure evidence is judge-accessible | [Fault Lab](https://waitrelay.tangvu.dev/fault-lab) marks cases as Interactive or Test-backed instead of simulating unsupported behavior. | [Fault Lab capture](../demo/fault-lab-updated.png), [`fault-lab.spec.ts`](../tests/e2e/fault-lab.spec.ts), [`choice-completion-interleavings.test.ts`](../tests/race/choice-completion-interleavings.test.ts) |
| Accessibility is verified | Exercise keyboard, touch, Passive Mode, Reduced Motion, and high contrast at desktop and mobile viewports. | [`accessibility.spec.ts`](../tests/e2e/accessibility.spec.ts), [`mobile-touch.spec.ts`](../tests/e2e/mobile-touch.spec.ts), [`mobile-and-modes.spec.ts`](../tests/e2e/mobile-and-modes.spec.ts) |

## Highest-value judge path

1. Submit the Tokyo task in the standard seeded demo.
2. Select Less Walking.
3. Point out that the state is pending until the server ACK.
4. Select Surprising.
5. Let completion interrupt the flight.
6. Expand the receipt and show computed plan changes.
7. Open Privacy Inspector and show the raw prompt is absent.
8. Open the comparison route to prove that accepted choices produce different plans.
9. Run the 200 ms Fault Lab probe to prove no overlay flicker.

The core claim is not that the flight fills time. It is that the flight carries validated user intent back into an already-running agent without blocking completion.
