# Commons Integration

## Current status

WaitRelay does not assume a Commons waiting-layer SDK, agent-state API, payment API, authentication protocol, token-spend API, or private internal endpoint.

The hackathon page and user-provided rules establish the event context and judging criteria, but they do not establish a public technical runtime contract for this repository. No Commons integration is claimed as implemented unless an official contract is later supplied and verified.

## Portable boundary

The application is designed to integrate through documented adapters:

- `AgentAdapter` for analysis, gathering, and synthesis
- `RunStore` for event and run state
- `PaymentAdapter` for optional post-run cosmetic checkout
- Versioned host to game event contracts

The judged vertical works with the deterministic Demo Provider and can use a configured OpenAI-compatible Live Provider. Neither requires a Commons-specific endpoint.

## What would be needed for an official adapter

Before implementing `CommonsAgentAdapter`, the project requires official documentation for:

1. Authentication and secret handling
2. Run creation and cancellation
3. Public lifecycle events
4. Decision request and acknowledgement semantics
5. Event ordering, replay, and terminal-state rules
6. Rate limits and error contracts
7. Data handling and retention
8. Supported browser and server transport

Before enabling `PAYMENTS_MODE=commons`, the project requires official documentation for:

1. Checkout creation
2. User and entitlement identity
3. Webhook or verification signatures
4. Currency, settlement, refund, and failure behavior
5. Sandbox environment
6. Security and compliance requirements

## Integration policy

- Do not reverse-engineer an authenticated dashboard or private endpoint into a production dependency.
- Do not present fixture events as Commons events.
- Do not present Demo Provider output as live verification.
- Keep unverified Commons modes disabled.
- Validate every external response before translating it into internal state.
- Preserve the same ACK honesty, completion priority, privacy boundary, and fail-open behavior for any future adapter.

## Deadline note

The user-provided official rules list September 17, 2026 as the closing date, while an authenticated dashboard has displayed September 18. The project treats September 17 as the operational deadline unless Commons publishes an exact timestamp and timezone, with stable readiness targeted at least 24 hours earlier.

The documented public deployment URL was verified against the running Cloudflare Tunnel. No repository, video, partner, or submission URL is fabricated.
