# Privacy

## Precise claim

**The Fork Flight game never receives the raw prompt.**

This claim concerns the game trust boundary. It does not mean that the raw prompt never leaves the user's device. The WaitRelay host and a configured model provider may require the prompt to perform the requested work.

## Data boundaries

The host keeps:

- Raw prompt
- Agent messages
- Tool and provider results
- Final answer
- Provider credentials
- Internal ranking data
- Private logs

Fork Flight may receive only:

- Enum-oriented Context Capsule fields
- Allowlisted axis, option, and display identifiers
- Allowlisted display labels
- Public lifecycle stage
- Safe ACK status
- Generic visual seed
- Run-scoped protocol identifiers needed by the bridge

The Context Capsule fields are:

| Field | Allowed values |
| --- | --- |
| domain | research, coding, planning, writing, creative, general |
| taskKind | compare, plan, generate, debug, analyze, other |
| locale | en, vi, ja, other, unknown |
| risk | low, medium, high |
| waitBand | instant, short, medium, long |
| interactionMode | active, passive |
| difficulty | calm, normal, challenge |

Fork Flight must not receive:

- Raw prompt or complete output
- Agent or tool output
- Chain-of-thought or private reasoning
- Personal names, email addresses, wallet addresses, or exact user location
- Authentication tokens or model keys
- Model-generated HTML
- Sensitive free text

## Technical controls

### Sandboxed document

The preferred route is an iframe with `sandbox="allow-scripts"`. Its Content Security Policy includes `connect-src 'none'`, preventing the game from opening its own network connections. The host owns SSE and polling.

### Typed bridge

Initialization validates `event.source`, transfers a dedicated `MessageChannel`, and establishes a run-scoped nonce. Subsequent envelopes are accepted only on the transferred port, carry the correct nonce, use an allowlisted type, and pass strict runtime validation. Origin is not the only check because a sandboxed iframe may have an opaque origin.

### Sanitization

The host constructs game payloads from known enums and identifiers rather than deleting unsafe fields from a rich object. A final strict sanitizer provides defense in depth. Provider errors are reduced to safe, generic codes before becoming public events.

### Inspector

The Privacy Inspector records and displays the exact sanitized outbound game messages. It is not a mock payload. The inspector remains in the host, where it can compare sent envelopes without exposing private inputs to the game.

### Storage

Raw prompts are not written to localStorage, sessionStorage, IndexedDB, Flight Cards, URLs, analytics, game messages, or public error payloads. Preference memory is disabled by default. Cosmetic identity may be stored locally, but must remain unrelated to prompts and answers.

The process-local run store keeps active private state only as required to complete a run and cleans it by TTL. Raw prompts are not persisted to a database by the MVP.

## Sensitive Mode

Sensitive Mode:

- Uses generic visual context and generic gates
- Disables sharing by default
- Avoids storage and telemetry
- Keeps personal entities out of game payloads
- Does not change the host's need to process the task

## Sharing

The implemented Flight Card contains a generic bird identity, applied-choice count, duration band, brand, and sanitized seed link. It cannot contain raw prompt, final answer, user identity, personal entities, sensitive metadata, or exact duration. Sensitive Mode disables its sharing link.

## Verification

The browser privacy test injects a unique canary into the prompt and checks that it is absent from:

- Iframe DOM
- Actual bridge payloads shown by Privacy Inspector
- Flight network requests
- URLs
- Console output
- Analytics payloads
- localStorage, sessionStorage, and IndexedDB
- Flight Cards

Separate sanitizer tests inject the same canary into completion, provider-error, and malformed game payloads. They verify that public errors are generic and strict schemas reject unknown fields.

Schema tests also reject free text and unknown keys in Context Capsules and choice messages.

## Provider responsibility

Live Provider requests are governed by the configured provider's terms and deployment settings. Operators must evaluate retention and regional requirements for their provider. The deterministic Demo Provider makes no external model request.
