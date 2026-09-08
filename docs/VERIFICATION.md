# Verification and release gates

## Continuous integration

The [Verify workflow](../.github/workflows/verify.yml) runs on pushes to `main`,
pull requests, and manual dispatch. Follow the current results in
[GitHub Actions](https://github.com/tang-vu/waitrelay/actions/workflows/verify.yml).

The application job uses a clean Ubuntu runner, the Node version in
[.node-version](../.node-version), and the pnpm version in
[package.json](../package.json). It installs the frozen lockfile, runs lint and
the complete Vitest suite, builds production assets, checks TypeScript, installs
Chromium with its OS dependencies, runs every configured Playwright project,
and repeats the seeded judge path three times. Browser retries are disabled in
this gate. CI uses one browser worker so the completion timing assertion does
not compete with another browser's accessibility scan on the shared runner.
Failure traces and reports are retained for seven days.

A separate Windows job exercises deployment success, failed build rollback,
and failed preflight rollback with isolated command doubles. It does not access
the production machine or require provider credentials.

Actions are pinned to commit IDs. The workflow has read-only repository
permissions and does not deploy or publish the demo recording. Browser setup
follows the [Playwright CI guide](https://playwright.dev/docs/ci).

## What each gate establishes

| Requirement | Direct evidence | Scope and limit |
| --- | --- | --- |
| Reproducible source checkout | Frozen install, production build, lint, TypeScript in CI | Validates the pinned toolchain on Ubuntu; does not upgrade the local production runtime. |
| Causal steering and honest ACK | Orchestrator, ranking, reducer, receipt, race tests; full browser flow | Accepted choices alter structured plans before the lock; rejected or late choices do not become applied receipt effects. |
| Completion and optional interaction | Browser tests for fast completion, active gate takeover, skip, dismissal, cancellation, Passive Mode, and renderer failure | Includes a measured completion reveal below 250 ms. |
| Transport and recovery | Controller unit tests and browser SSE, polling, offline, stale response, unavailable run, and error cases | The backing store remains process-local; a lost run is reported honestly. |
| Privacy boundary | Schema and sanitizer tests, sandbox tests, browser canary and Sensitive Mode checks | Proves the game boundary; the host and configured provider still process the prompt. |
| Accessible result and controls | Desktop/mobile axe, touch, keyboard, focus, reduced-motion, clipboard-denial, and storage-denial browser checks | Automated checks supplement the reviewed screenshots; they do not claim universal accessibility certification. |
| Safe local rollout | Isolated Windows deployment tests and `pnpm host:preflight` after a real rollout | CI tests rollback logic; the hosting preflight checks the actual PM2/origin/tunnel path. |
| Public judge path | `pnpm demo:preflight` with external base URL and web-server startup disabled | Must be run against the deployed build; local CI alone cannot establish public uptime. |
| Reviewable recording | `pnpm demo:record`, capture receipt, MP4 decode and visual review | Local artifact only until publication is explicitly authorized. |

The detailed feature-to-test mapping is in [Judging Matrix](JUDGING_MATRIX.md).
Date-specific results and remaining work are in [Implementation Status](STATUS.md).
Operational commands and rollback behavior are in [Local Hosting](../ops/LOCAL_HOSTING.md).

## Release sequence

1. Wait for both CI jobs to pass for the application commit being released.
2. Review visible changes and refresh affected screenshots.
3. Use `pnpm deploy:local` on the production machine.
4. Confirm `pnpm host:preflight` and three public seeded smoke runs pass.
5. Refresh the recording when its demonstrated flow changes and inspect the output.
6. Publish the recording or submit the project only after explicit authorization.
