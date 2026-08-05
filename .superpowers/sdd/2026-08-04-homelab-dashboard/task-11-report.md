# Task 11 Implementation Report

## Status

ROUND 1 PASS WITH DOCUMENTED BASELINE EXCEPTIONS.

All six Important findings and the Minor finding from review round 1 are fixed. Focused behavior
tests, all Homelab tests, the full test suite, both production builds, lint, targeted formatting,
diff checks, and loopback-only browser smoke checks pass. Repository-wide TypeScript and formatting
still report only the verified pre-existing diagnostics documented below. No live service or
infrastructure was contacted or changed.

## Commits

- Starting commit: `f2f66f5f0591dc2cad68daa2820585684f28336e`
- Task 11 implementation commit: `b9d59d8839976cd6c0a8fa8a726438fdf77c394c`
  (`feat: add cluster health and live logs`)
- Review round 1 is committed with this report using message
  `fix: harden cluster history and live logs`.

## Authorized scope expansion

The plan says the Cluster view consumes `ClusterSnapshot`, but that contract contains only
`PodSummary`. The existing gateway `GET /pods/:namespace/:pod` is the source of containers,
conditions, restart reasons, and `rawStatus`, and the dashboard had no server-side pod-detail
boundary. The user explicitly pre-authorized the minimal expansion required to add a validated,
read-only, same-origin/server-only pod-detail function and its schemas/tests.

The implementation uses a TanStack server function. Browser code calls only the application's
same-origin `/_serverFn/...` endpoint. `GATEWAY_URL` is resolved server-side, and the browser never
contacts the gateway directly.

Review round 1 explicitly pre-authorized the cross-layer production and test changes needed for
window-aware Prometheus history and cursor-aware log streaming. The implementation therefore adds
only the minimal read-only path through the dashboard server boundary, gateway, provider contract,
and Kubernetes log provider. Prometheus and Kubernetes/internal URLs remain server-only.

## Implemented scope

- Added the generated `/homelab/cluster` route and kept the existing Homelab tab/navigation system.
- Polls `ClusterSnapshot` every ten seconds through Task 9's no-overlap `useHomelabSnapshot` hook,
  retaining last-good data and rendering explicit loading, stale, partial, unavailable, and error
  states.
- Validates `namespace`, `pod`, and `container` URL search values, preserves valid deep links, and
  clears or corrects selections when namespaces, pods, or containers are no longer valid.
- Renders node readiness/conditions; namespace and workload summaries; current CPU, memory, and
  disk; timestamp-domain CPU/memory history for 1h, 6h, 24h, and 7d; and newest-first non-healthy
  Kubernetes events.
- Adds a searchable, namespace-filterable pod table with readiness, status, age, restart warnings,
  node, and image.
- Adds pod detail loading/error/empty states, container state and restart reasons, image identities
  and digests, pod conditions, plain-English current reason, and keyboard-operable raw evidence.
- Adds same-origin EventSource logs with validated and encoded identifiers, initial/open/
  reconnecting/paused states, Clear, Pause/Resume, auto-scroll, 1/2/4/8/15-second capped reconnect,
  stale-source cleanup, unmount timer cleanup, React text escaping, and a strict 2,000-line cap.
- Keeps log auto-scroll inside the log viewport so incoming lines never move the document itself.
- Uses existing semantic tokens, dark card/table conventions, explicit text status, practical
  control targets, semantic landmarks/headings/table controls, and reduced-motion fallbacks.
- Shows an explicit unavailable/retrying state when the first Cluster read fails, then recovers on
  the existing ten-second non-overlapping poll.
- Loads only the selected bounded `1h`, `6h`, `24h`, or `7d` Prometheus range through validated
  server-only boundaries, aborts superseded browser reads, and preserves the last successful range.
- Refreshes selected pod detail with each successful Cluster snapshot, aborts superseded detail
  reads, ignores late results, preserves last-good detail on failure, and labels it stale.
- Treats HTTP EventSource open as transport-only; only the gateway's custom Kubernetes `ready`
  event marks logs Live and resets the `1/2/4/8/15` reconnect backoff.
- Resumes logs from a validated leading RFC3339 timestamp cursor. Inclusive replay is suppressed by
  exact `(cursor, full line)` identity while genuinely new same-timestamp text remains renderable;
  cursor and de-duplication memory are bounded with the 2,000-line display.
- Validates each Kubernetes DNS label at 63 characters or fewer, validates returned pod/container
  identifiers, and requires returned pod name and namespace to exactly match the request.

### Review round 1 implementation files

- `gateway/src/-app.test.ts`
- `gateway/src/-runtime.test.ts`
- `gateway/src/app.ts`
- `gateway/src/providers/-kubernetes.test.ts`
- `gateway/src/providers/-prometheus.test.ts`
- `gateway/src/providers/kubernetes.ts`
- `gateway/src/providers/prometheus.ts`
- `gateway/src/providers/provider.ts`
- `shared/homelab/-log-cursor.test.ts`
- `shared/homelab/contracts.ts`
- `shared/homelab/log-cursor.ts`
- `src/homelab/-homelab.functions.test.ts`
- `src/homelab/-useHomelabSnapshot.test.tsx`
- `src/homelab/homelab.functions.ts`
- `src/homelab/useHomelabSnapshot.ts`
- `src/routes/_layout/homelab/-ClusterSummary.tsx`
- `src/routes/_layout/homelab/-ClusterView.test.tsx`
- `src/routes/_layout/homelab/-HomelabBentoCard.tsx`
- `src/routes/_layout/homelab/-LiveLogPanel.test.tsx`
- `src/routes/_layout/homelab/-LiveLogPanel.tsx`
- `src/routes/_layout/homelab/-PodDetail.tsx`
- `src/routes/_layout/homelab/cluster.tsx`
- `src/routes/_layout/homelab/index.tsx`
- `src/routes/api/homelab/-logs.test.ts`
- `src/routes/api/homelab/logs.$namespace.$pod.ts`

## Exact implementation files

- `src/homelab/-homelab.functions.test.ts`
- `src/homelab/homelab.functions.ts`
- `src/routeTree.gen.ts` (authorized generated file)
- `src/routes/_layout/homelab/-ClusterSummary.tsx`
- `src/routes/_layout/homelab/-ClusterView.test.tsx`
- `src/routes/_layout/homelab/-LiveLogPanel.test.tsx`
- `src/routes/_layout/homelab/-LiveLogPanel.tsx`
- `src/routes/_layout/homelab/-PodDetail.tsx`
- `src/routes/_layout/homelab/-PodTable.tsx`
- `src/routes/_layout/homelab/cluster.tsx`

Reporting artifact:

- `.superpowers/sdd/2026-08-04-homelab-dashboard/task-11-report.md`

## TDD and RED evidence

### Review round 1: initial recovery and pod-detail refresh RED

The round-1 behavior tests were added and run before changing production code:

```text
bunx vitest run src/routes/_layout/homelab/-ClusterView.test.tsx -t "unavailable retry state|refreshes selected pod details|aborts superseded pod-detail"
```

Exact relevant output:

```text
src/routes/_layout/homelab/-ClusterView.test.tsx (12 tests | 3 failed | 9 skipped)
× shows an unavailable retry state after the initial load fails and recovers automatically
  → Unable to find an accessible element with the role "alert"
× refreshes selected pod details with cluster snapshots, preserves last-good data, and recovers
  → expected "spy" to be called 2 times, but got 1 times
× aborts superseded pod-detail reads and ignores a late result after the pod disappears
  → expected "spy" to be called 2 times, but got 1 times
Test Files  1 failed (1)
Tests       3 failed | 9 skipped (12)
```

This proved both root causes: a null snapshot ignored the hook's fixed retry error and remained the
loading skeleton, while pod detail had no dependency on the cluster snapshot cycle and therefore
never made the second read.

### Review round 1: pod identity and DNS-label validation RED

The schema and identity tests were added before production validation changed:

```text
bunx vitest run src/homelab/-homelab.functions.test.ts -t "individual DNS label|identity does not match|invalid returned"
```

Exact relevant output:

```text
src/homelab/-homelab.functions.test.ts (18 tests | 6 failed | 12 skipped)
× rejects a pod input whose individual DNS label exceeds 63 characters
  → expected "spy" to not be called at all, but actually been called 1 times
× rejects a valid-looking pod detail response whose identity does not match the request
  → expected returned detail to match the fixed unavailable error
× rejects an invalid returned pod name with the fixed safe error
× rejects an invalid returned namespace with the fixed safe error
× rejects an invalid returned container name with the fixed safe error
× rejects an invalid returned container image name with the fixed safe error
Test Files  1 failed (1)
Tests       6 failed | 12 skipped (18)
```

The overlong label reached `fetch`, and every invalid or mismatched response crossed the schema
boundary unchanged, directly confirming the review finding.

### Review round 1: bounded production history path RED

Tests were added at the provider, gateway, production-runtime, dashboard server-function, polling
hook, and Cluster UI layers before production wiring changed:

```text
bunx vitest run gateway/src/providers/-prometheus.test.ts gateway/src/-app.test.ts gateway/src/-runtime.test.ts src/homelab/-homelab.functions.test.ts src/homelab/-useHomelabSnapshot.test.tsx src/routes/_layout/homelab/-ClusterView.test.tsx -t "bounded selected history|history window|keyed refresh|loads selected history windows"
```

Exact relevant output (the runtime case was immediately rerun with its existing `collect` method
stubbed so RED did not wait on a real network timeout):

```text
gateway/src/providers/-prometheus.test.ts
× collects a bounded selected history window for a cluster request
  → provider.collectForWindow is not a function

gateway/src/-app.test.ts
× passes the validated 1h/6h/24h/7d history window only to window-aware cluster providers
  → expected "collectForWindow" to be called; Number of calls: 0
× rejects unsupported cluster history window 30d/7D/empty/1h,7d before provider access
  → expected 200 to be 400

gateway/src/-runtime.test.ts
× wires a selected history window through the production Prometheus provider
  → expected "collectForWindow" to be called with ["7d", Any<AbortSignal>]; calls: 0

src/homelab/-homelab.functions.test.ts
× requests only the validated 1h/6h/24h/7d cluster history window through the server boundary
  → getClusterSnapshotForWindow is not a function

src/homelab/-useHomelabSnapshot.test.tsx
× cancels an in-flight keyed refresh, ignores its late result, and preserves last-good data
  → expected fetcher to be called 1 times, but got 0 times

src/routes/_layout/homelab/-ClusterView.test.tsx
× loads selected history windows server-side, cancels superseded reads, and keeps last-good history
  → expected fetcher to be called with ["7d", Any<AbortSignal>]; calls: 0
```

This localized the defect to missing cross-layer window propagation; Prometheus's existing bounded
range implementation alone was unreachable from the production Cluster UI.

### Review round 1: readiness, cursor replay, and stale-source cleanup RED

The cursor parser and behavior tests were added before log production code changed:

```text
bunx vitest run shared/homelab/-log-cursor.test.ts src/routes/_layout/homelab/-LiveLogPanel.test.tsx src/routes/api/homelab/-logs.test.ts gateway/src/providers/-kubernetes.test.ts -t "pod log cursor|initial 200|reconnects after|resets reconnect|inclusive replay|stale sources|resume cursor|log cursor|frames ready|validated RFC3339"
bunx vitest run gateway/src/providers/-kubernetes.test.ts -t "resumes from a validated timestamp cursor"
```

Exact relevant output:

```text
shared/homelab/-log-cursor.test.ts
FAIL: Cannot find module './log-cursor'

src/routes/_layout/homelab/-LiveLogPanel.test.tsx
× HTTP open stays Connecting until ready
  → expected "Live" to contain "Connecting"
× reconnects after 1, 2, 4, 8, and capped 15 seconds across open→error attempts
  → expected "Live" not to contain "Live"
× closes stale sources on selection changes
  → expected old line listener count 0, received 1
× suppresses inclusive replay on resume and reconnect
  → expected resume cursor, received null

src/routes/api/homelab/-logs.test.ts
× forwards a validated RFC3339 resume cursor
  → expected cursor, received null
× rejects malformed resume cursors before gateway access
  → expected 400, received 502

gateway/src/providers/-kubernetes.test.ts
× resumes from a validated timestamp cursor without replaying a fresh 200-line tail
  → expected sinceTime cursor, received null
× rejects malformed direct and gateway cursor inputs
× emits cursor metadata for timestamped SSE lines
× passes the validated cursor to streamPodLogs

Test Files  4 failed (4)
Tests       14 failed | 2 passed | 42 skipped (58)
```

The failures confirmed all three causes: `onopen` incorrectly meant Live/reset, reconnects always
requested a new 200-line tail with no cursor, and closed EventSource listeners stayed attached.

### Review round 1 self-review: impossible calendar cursor RED

Final self-review found that JavaScript `Date.parse` normalizes impossible dates such as February
31 instead of rejecting them. The malformed-input cases were added before tightening production
validation:

```text
bunx vitest run shared/homelab/-log-cursor.test.ts -t "rejects malformed cursor"
```

Exact relevant output:

```text
shared/homelab/-log-cursor.test.ts (12 tests | 2 failed | 4 skipped)
× rejects malformed cursor 2026-02-29T12:00:00Z
  → expected '2026-02-29T12:00:00Z' to be null
× rejects malformed cursor 2026-02-31T12:00:00Z
  → expected '2026-02-31T12:00:00Z' to be null
Test Files  1 failed (1)
Tests       2 failed | 6 passed | 4 skipped (12)
```

The parser now validates leap years, days per month, clock fields, offsets, syntax, and total
length before accepting a cursor. The completed parser suite passes 13/13, including a valid 2028
leap day.

### Initial Cluster and live-log RED

Command run before production component implementation:

```text
bunx vitest run src/routes/_layout/homelab/-ClusterView.test.tsx src/routes/_layout/homelab/-LiveLogPanel.test.tsx
```

Relevant output:

```text
FAIL |components| src/routes/_layout/homelab/-ClusterView.test.tsx
Error: Failed to resolve import "./-ClusterSummary"

FAIL |components| src/routes/_layout/homelab/-LiveLogPanel.test.tsx
Error: Failed to resolve import "./-LiveLogPanel"

Test Files  2 failed (2)
Tests       no tests
```

This was the expected failure: the Task 11 components and route did not exist.

### Server-only pod-detail RED

Command run before the server function and schemas were implemented:

```text
bunx vitest run src/homelab/-homelab.functions.test.ts
```

Relevant output:

```text
src/homelab/-homelab.functions.test.ts (12 tests | 3 failed)
TypeError: getPodDetail is not a function
Test Files  1 failed (1)
Tests       3 failed | 9 passed (12)
```

This established the missing authorized dashboard-side boundary.

### Namespace-health summary RED

The staged requirements review found that namespace count and pod count were visible, but namespace
health was not explicit. A behavior assertion was added before the production change:

```text
bunx vitest run src/routes/_layout/homelab/-ClusterView.test.tsx -t "renders node conditions"
```

Exact relevant output:

```text
Cluster summary > renders node conditions, health summaries, and current CPU, memory, and disk values
Unable to find an element with the text: Healthy namespaces: 1/2 · 3 pods.
Test Files  1 failed (1)
Tests       1 failed | 8 skipped (9)
```

The Inventory summary now reports healthy namespaces alongside total namespaces and pods. The same
focused command then passed.

### Stale log-selection RED

Command run after adding a regression test for container changes:

```text
bunx vitest run src/routes/_layout/homelab/-LiveLogPanel.test.tsx -t "closes stale sources"
```

The test failed because `old container output` remained rendered after changing the selected
container. Production was changed to clear bounded log state whenever the validated stream URL
changes. The focused suite then passed.

### Viewport-confined auto-scroll RED

The real mobile browser check showed that `scrollIntoView` moved the whole document to the selected
pod's log panel. A behavior assertion was added before the production fix:

```text
bunx vitest run src/routes/_layout/homelab/-LiveLogPanel.test.tsx -t "pauses, resumes, clears"
```

Exact relevant output:

```text
LiveLogPanel > pauses, resumes, clears, and lets auto-scroll be disabled
Unable to find an accessible element with the role "region" and name "Live pod log output"
Test Files  1 failed (1)
Tests       1 failed | 5 skipped (6)
```

Production now gives the scrollable log viewport that accessible region and updates its own
`scrollTop`; it never invokes document-moving `scrollIntoView`. The focused test passed 6/6, and the
rebuilt mobile page stayed at `window.scrollY === 0` while live lines arrived.

## Baseline before Task 11

Before Task 11 changes, `bunx vitest run` passed 407/407 tests in 31 files. The run emitted the
pre-existing Node `ExperimentalWarning` about unavailable localStorage in some component workers.

## GREEN and regression verification

### Original Task 11 verification

All results below were captured from the final Task 11 source tree:

- Focused Task 11 tests: PASS, 3 files and 27 tests.
- Full Homelab tests: PASS, 8 files and 59 tests.
- Full suite (`bunx vitest run`): PASS, 33 files and 425 tests. Only the known non-fatal Node
  localStorage `ExperimentalWarning` appeared.
- Application build (`bun run build`): PASS. Client, SSR, and Nitro server output completed. The
  build retained existing non-fatal dependency/tooling warnings: Node `DEP0205`, generated CSS
  `[bg:var(...)]`, unused TanStack SSR dependency imports, and ignored dependency-level
  `"use client"` directives.
- Gateway build (`bun run build:gateway`): PASS, 1,053 modules bundled and
  `gateway/dist/index.js` produced (3.78 MB).
- Lint (`bun run lint`): PASS, 0 warnings and 0 errors across 109 files and 93 rules.
- Targeted `bunx oxfmt --check` over every Task 11 source/test file and the generated route tree:
  PASS; all matched files use the correct format.
- `git diff --check`: PASS, no whitespace errors.
- Generated route inspection: PASS; the route tree imports the Cluster route and registers
  `/homelab/cluster` beneath the Homelab parent.
- Public bundle boundary scan for `GATEWAY_URL`, `gateway.internal`, the test-only gateway token,
  Supabase secret names, and Google client secret names: no matches.
- Task 11 UI scan for raw hex/RGB/OKLCH colors, direct `fetch`, gateway URLs, or absolute HTTP URLs:
  no matches.

One pre-final full-suite run timed out only in the deliberate 2,000-rendered-line stress test at
5.266 seconds while all other 424 tests passed. The same test consistently passed alone in roughly
2.8 seconds; concurrent full-suite DOM load crossed Vitest's five-second default. Its behavior and
assertions were unchanged, and that one stress test received an explicit ten-second budget. The
subsequent full-suite run passed 425/425, with the stress test completing in 4.349 seconds.

### Review round 1 final verification

All results below were rerun from the final round-1 source tree after the last cursor-validation
change:

- Focused RED-to-GREEN commands: PASS for initial recovery, window switching/cancellation,
  pod-detail refresh/recovery/disappearance, pod identity/DNS limits, readiness/backoff, cursor
  replay, same-origin forwarding, Kubernetes resume, stale-source cleanup, and impossible calendar
  cursors.
- Full Homelab plus gateway behavior matrix: PASS, 14 files and 239 tests.
- Full suite (`bunx vitest run`): PASS, 34 files and 476 tests. Only the known non-fatal Node
  localStorage `ExperimentalWarning` appeared.
- Application build (`bun run build`): PASS for client, SSR, and Nitro output. The same documented
  non-fatal generated CSS and dependency warnings remain.
- Gateway build (`bun run build:gateway`): PASS, 1,055 modules bundled and
  `gateway/dist/index.js` produced (3.79 MB).
- Lint (`bun run lint`): PASS, 0 warnings and 0 errors across 111 files and 93 rules.
- Targeted formatting: PASS across all 25 changed source/test files.
- `git diff --check`: PASS.
- Generated route inspection: PASS; `/homelab/cluster` remains registered exactly beneath the
  Homelab route and both production builds resolve it.
- Public bundle boundary scan: PASS; no `GATEWAY_URL`, `PROMETHEUS_URL`, Kubernetes configuration,
  fixture address, or Prometheus test URL appeared in `.output/public`.
- Changed-client scan: PASS; no direct `fetch`, absolute HTTP URL, gateway environment reference,
  or hardcoded raw color was introduced.
- Diff secret scan: PASS; no token, bearer credential, password, client secret, or private key
  pattern was added.

## Required TypeScript diagnostics

`bunx tsc --noEmit` still exits with exactly the two known baseline diagnostics and no Task 11
diagnostics:

```text
src/lib/secret-vault.ts(46,26): error TS2322: Type 'Uint8Array<ArrayBufferLike>' is not assignable to type 'BufferSource'.
src/routes/_layout/todos/-PrioritySection.tsx(59,68): error TS2322: ... SyntheticListenerMap | undefined ...
```

Both files are outside Task 11 and were unchanged.

## Required repository-wide formatting diagnostics

`bun run fmt:check` checks 135 files and still exits 1 only for the same three pre-existing
documentation files:

```text
docs/superpowers/plans/2026-08-04-homelab-dashboard.md
docs/superpowers/plans/2026-08-04-task-7b-deployment-correlation-correctness.md
docs/superpowers/specs/2026-08-04-homelab-dashboard-design.md
```

Those files were not modified. Targeted Task 11 formatting passes.

## Browser smoke-check evidence

A production build was run against a temporary loopback-only fixture gateway at `127.0.0.1`; no
live service or infrastructure endpoint was contacted.

- Inspected `/homelab/cluster` at 1440 x 1000 and 390 x 844. The existing dense dark visual system
  remained coherent; desktop uses the intended status-first grid and mobile stacks cleanly with
  reachable tabs and controls.
- Verified node conditions, workload summaries, current resource values, charts/range controls,
  warning events, searchable/filterable pod table, restart warning, and explicit no-selection
  state.
- Selected `yootoob-mp3-api-7c9d8`; the URL became
  `?namespace=yootoob-mp3&pod=yootoob-mp3-api-7c9d8&container=api` and detail rendered
  `CrashLoopBackOff`, both containers, image digests, conditions, and expandable raw JSON.
- Changed the log container to `diagnostics`; the URL updated, the previous source closed, old
  output cleared, and new fixture lines rendered.
- Exercised Pause, Resume, Clear, and auto-scroll. The accessibility tree exposed `Paused`, `Live`,
  and the empty `Waiting for log output` state as expected.
- Network inspection showed logs only through
  `/api/homelab/logs/yootoob-mp3/yootoob-mp3-api-7c9d8?container=...` on the application origin.
  Pod detail used only the application's same-origin server-function endpoint.
- After the auto-scroll fix, desktop and mobile selected-pod loads remained at `window.scrollY = 0`;
  the composed application exposed exactly one `main` landmark.
- Emulated `prefers-reduced-motion: reduce`; the media query matched, the page reloaded normally,
  and the browser console remained at 0 errors and 0 warnings.
- All fixture/application/browser processes were stopped, and generated browser artifacts and the
  temporary fixture file were moved to Trash after inspection.

### Review round 1 browser smoke

The rebuilt production application was tested again through a temporary loopback-only fixture; no
live service or infrastructure endpoint was contacted.

- At 1440 x 1000, selecting `7d` changed the accessible chart names to “CPU usage over 7 days” and
  “Memory usage over 7 days”; fixture traffic confirmed `GET /cluster?window=7d` on the server-side
  boundary.
- A direct selected-pod URL rendered current reason, container state, digest, conditions, raw
  evidence control, and Live logs. Subsequent ten-second Cluster reads were each followed by the
  selected read-only pod-detail request, proving the production refresh wiring.
- HTTP-open remained Connecting until the fixture's custom `ready` event. Pause/Resume forwarded
  `since=<last RFC3339 cursor>` through the same-origin endpoint. The fixture inclusively replayed
  the last line and sent one new line; the browser retained exactly three unique lines rather than
  four.
- A literal `<script>fixture stays text</script>` log line remained text in the accessibility tree
  and rendered log viewport.
- The resumed SSE connection remained healthy through a twelve-second poll/keepalive interval; the
  desktop console reported 0 errors and 0 warnings.
- At 390 x 844, the route stacked cleanly through pod detail and Live logs. The document and body
  widths both remained exactly 390 pixels, so the log line did not introduce page-level horizontal
  overflow. The mobile console also reported 0 errors and 0 warnings.
- Both browsers, the application server, and the fixture server were stopped. The temporary fixture
  was deleted and generated browser artifacts were moved to Trash.

## Self-review

- **Secrets and boundaries:** no credentials, private gateway URL, or server-only environment names
  enter the browser bundle. Pod-detail and log identifiers are per-label length/grammar validated
  before use, returned pod identity must exactly match the request, values are encoded into
  path/query components, and errors are replaced with fixed safe messages.
- **Read-only scope:** Task 11 introduces only GET reads and EventSource streaming. There are no
  Kubernetes mutation, exec, attach, port-forward, delete, restart, or rollout controls.
- **Memory and lifecycle:** rendered logs are capped at 2,000 lines; EventSource and reconnect timer
  cleanup runs on pause, selection changes, and unmount; both custom listeners and property handlers
  are removed; stale/queued source events are ignored; reconnect timers cannot survive unmount. The
  replay identity set is independently capped at 2,000 entries.
- **Cursor semantics:** only a bounded, calendar-valid leading RFC3339 timestamp emitted by the
  gateway is accepted. Resume uses Kubernetes `sinceTime`; exact inclusive replay is identified by
  `(cursor, full line)`, malformed/cursorless lines render without advancing the cursor, and the
  greatest parsed timestamp remains the resume point. Equal-millisecond nanosecond timestamps keep
  arrival order; exact duplicate lines are suppressed while different text remains distinct.
- **Selection lifecycle:** invalid search values are dropped; vanished namespace/pod state is
  removed; invalid/removed containers resolve to a current container; old detail promises are
  ignored and old logs are cleared.
- **Accessibility:** headings and regions are named, the pod inventory is a real table, controls have
  unique labels and practical targets, raw evidence uses native `details`/`summary`, and health/
  freshness/reconnect state is always text—not color alone.
- **React/data flow:** polling remains centralized in the Task 9 no-overlap hook; derived values are
  computed from snapshots; a keyed range change aborts the superseded browser request and ignores
  late settlement; selected detail follows snapshot `observedAt` with its own abort/sequence guard;
  effects are limited to async/detail lifecycle, selection recovery, and streaming resource
  lifecycle.
- **Bounded history:** every accepted range maps to a fixed server-side duration and step (`60s`,
  `120s`, `300s`, or `1800s`), Prometheus requests retain the existing five-second timeout and
  ten-second bounded cache/coalescing, and unsupported windows are rejected before provider access.
- **Visual system:** no hardcoded raw colors or new visual language were introduced. Existing
  semantic health/chart/background/border tokens and Homelab density are preserved.
- **Generated route:** the generated tree contains the new child exactly once under Homelab and the
  production build resolves `/homelab/cluster` successfully.

## Concerns and follow-up boundaries

- Repository-wide TypeScript and formatting remain red only for the documented pre-existing files.
- The application build retains the documented non-fatal existing tooling/dependency warnings.
- Pod detail now refreshes only when selected and in lockstep with successful ten-second Cluster
  snapshots; it deliberately has no separate faster polling loop. Persistent log storage and log
  analytics remain intentionally out of scope.
- Review round 1 began from the supplied independent findings. The completed diff then received a
  manual security, URL, timer/memory, stale-subscription, accessibility, visual, cursor, and
  generated-route review plus automated and browser regression coverage.
