# Task 7 Report: CI/CD Deployment Correlation

## Status

DONE

Requested commit message: `feat: correlate cicd deployment state`

## Summary

- Added a read-only `GitHubProvider` for the fixed production repository `Isolumi/youtube-mp3` and branch `main`.
- Added a read-only `ArgoProvider` that reads the `yootoob-mp3-dumachine` Application custom resource from namespace `argocd` through the Kubernetes Custom Objects API.
- Added deterministic deployment correlation for `yootoob-mp3-api` and `yootoob-mp3-frontend` in namespace `yootoob-mp3`.
- Kept Git commit SHA, expected image tag, expected digest, live image tag, and live pod digests as separate normalized evidence.
- Added the exact approved matrix: matching state Healthy; failed latest workflow with an available prior deployment Warning; OutOfSync with available workloads Warning; Argo Degraded Critical; tag or digest mismatch Warning; zero available replicas Critical.
- Added deployment-specific snapshot composition so GitHub, Argo CD, and Kubernetes retain independent source states and partial failures cannot crash startup, health, pod detail, or log routes.
- Wired production `/deployments` collection to GitHub, Argo CD, and the existing Kubernetes provider while preserving the existing cluster and pod provider wiring.
- Extended shared deployment contracts and Kubernetes pod summaries minimally so the future dashboard deployment view receives separate tag/digest evidence.
- Preserved nullable `HealthIssue.source`; cross-source revision/image mismatches deliberately use `null`, while single-source findings identify `github`, `argocd`, or `kubernetes`.

## Strict TDD Evidence

### Focused provider/correlation RED

The first repository edits created only these tests and fixtures:

- `gateway/src/providers/-github.test.ts`
- `gateway/src/providers/-argocd.test.ts`
- `gateway/src/-deployment-correlation.test.ts`
- `gateway/src/providers/fixtures/github.json`
- `gateway/src/providers/fixtures/argocd.json`

Command:

`bunx vitest run gateway/src/providers/-github.test.ts gateway/src/providers/-argocd.test.ts gateway/src/-deployment-correlation.test.ts`

Result: exit 1. All three suites failed for the expected reason: Vitest could not resolve the not-yet-created `./github`, `./argocd`, and `./deployment-correlation` modules. No production Task 7 file existed when this RED run was captured.

Relevant output:

```text
FAIL  |unit| gateway/src/-deployment-correlation.test.ts
Error: Cannot find module './deployment-correlation'
FAIL  |unit| gateway/src/providers/-argocd.test.ts
Error: Cannot find module './argocd'
FAIL  |unit| gateway/src/providers/-github.test.ts
Error: Cannot find module './github'
Test Files  3 failed (3)
```

### Runtime/snapshot integration RED

After the three focused suites were green, integration tests were added before existing production integration files changed.

Command:

`bunx vitest run gateway/src/-snapshot.test.ts gateway/src/-runtime.test.ts gateway/src/providers/-kubernetes.test.ts`

Result: exit 1 with four expected failures: `collectDeploymentSnapshot` did not exist, the production dependency graph had no `deployments` providers, and Kubernetes pod summaries did not yet expose separate `imageTag` and `imageDigest` fields.

### GREEN

- Focused provider/correlation GREEN: exact focused command above — exit 0; 3 files and 10 tests passed.
- Integration GREEN: `bunx vitest run gateway/src/-snapshot.test.ts gateway/src/-runtime.test.ts gateway/src/providers/-kubernetes.test.ts` — exit 0; 3 files and 39 tests passed.
- Final focused Task 7 plus affected suites: `bunx vitest run gateway/src/providers/-github.test.ts gateway/src/providers/-argocd.test.ts gateway/src/-deployment-correlation.test.ts gateway/src/-snapshot.test.ts gateway/src/-runtime.test.ts gateway/src/-app.test.ts gateway/src/providers/-kubernetes.test.ts shared/homelab/-health-rules.test.ts` — exit 0; 8 files and 77 tests passed.

## Verification Evidence

- Required focused Task 7 tests: exit 0; 3 files and 10 tests passed.
- All gateway/shared regressions: `bunx vitest run gateway shared` — exit 0; 9 files and 100 tests passed.
- Full project regression suite: `bun run test` — exit 0; 21 files and 181 tests passed.
- Gateway build: `bun run build:gateway` — exit 0; 968 modules bundled into `gateway/dist/index.js`.
- Application build: `bun run build` — exit 0; client, SSR, and Nitro production builds completed.
- Lint: `bun run lint` — exit 0; 0 warnings and 0 errors across 79 files.
- Scoped formatting: `bunx oxfmt --check` over the 17 Task 7 TypeScript/JSON files — exit 0; every file matched OXC formatting.
- Working-tree validation: `git diff --check` — exit 0.
- TypeScript: `bunx tsc --noEmit` exits 2 only for the two known unrelated pre-existing app errors in `src/lib/secret-vault.ts:46` and `src/routes/_layout/todos/-PrioritySection.tsx:59`; no Task 7 diagnostic was emitted.

## Provider and Correlation Coverage

`gateway/src/providers/-github.test.ts` verifies:

- `GET /repos/Isolumi/youtube-mp3/actions/runs?branch=main&per_page=1` and commit metadata reads only.
- Exact `Authorization: Bearer ...`, `Accept`, and `X-GitHub-Api-Version: 2022-11-28` headers.
- Normalized workflow and commit HTML URLs, timestamps, author, message, SHA, conclusion, and duration.
- Missing credentials and upstream failures use fixed safe errors without exposing the token, upstream stack, or filesystem path.

`gateway/src/providers/-argocd.test.ts` verifies:

- The only API operation is `getNamespacedCustomObject` for group `argoproj.io`, version `v1alpha1`, namespace `argocd`, plural `applications`, and name `yootoob-mp3-dumachine`.
- Sync status/revision, health, operation state/result, resource sync/health, and image evidence are normalized.
- Invalid or failed custom-object responses use fixed safe errors without exposing upstream details.
- No Argo token or direct Argo API client is present.

`gateway/src/-deployment-correlation.test.ts` verifies all six exact outcomes independently and proves API/frontend workloads remain separate in the result.

`gateway/src/-snapshot.test.ts`, `gateway/src/-runtime.test.ts`, and the Kubernetes mapper test verify:

- Missing `GITHUB_READ_TOKEN` does not throw during dependency construction or gateway startup.
- A failed GitHub source yields an Unknown/stale source while successful Argo/Kubernetes data remains in a valid deployment snapshot.
- Production deployments use provider order GitHub, Argo CD, Kubernetes.
- Pod image tags and runtime digests remain distinct without changing the existing `PodSummary.image` behavior used by Tasks 1-6.

## Files Changed

Created:

- `gateway/src/providers/github.ts`
- `gateway/src/providers/argocd.ts`
- `gateway/src/deployment-correlation.ts`
- `gateway/src/providers/-github.test.ts`
- `gateway/src/providers/-argocd.test.ts`
- `gateway/src/-deployment-correlation.test.ts`
- `gateway/src/providers/fixtures/github.json`
- `gateway/src/providers/fixtures/argocd.json`
- `.superpowers/sdd/2026-08-04-homelab-dashboard/task-7-report.md`

Modified for actual runtime integration:

- `gateway/src/config.ts`
- `gateway/src/snapshot.ts`
- `gateway/src/runtime.ts`
- `gateway/src/app.ts`
- `gateway/src/-snapshot.test.ts`
- `gateway/src/-runtime.test.ts`
- `gateway/src/providers/kubernetes-mappers.ts`
- `gateway/src/providers/-kubernetes.test.ts`
- `shared/homelab/contracts.ts`

## Self-Review

- Confirmed no create, update, patch, delete, exec, attach, port-forward, rollout, or other mutation API is called or exposed.
- Confirmed GitHub requests are GET-only and the read token is used only in a server-side provider request header.
- Confirmed errors and snapshots never include the GitHub token, raw upstream errors, stacks, or paths.
- Confirmed Argo CD uses only the Application custom resource through the existing Kubernetes configuration path; no Argo token was added.
- Confirmed API and frontend image/tag/digest/replica evidence is correlated independently before application roll-up.
- Confirmed Critical and Warning outcomes outrank Unknown in the same way as the existing health model.
- Confirmed optional-source failure does not affect `/healthz`, Kubernetes pod detail, or pod-log routing.
- Confirmed the existing `PodSummary.image` field and all Task 1-6 tests remain unchanged/green; new tag/digest fields are additive.
- Confirmed no live network call occurs in tests; every HTTP and Kubernetes API boundary is injected with deterministic fixtures.
- Confirmed no Kubernetes manifest, deployment action, browser environment access, or unrelated application source was modified.

## Concerns

- No live GitHub, Argo CD, or Kubernetes endpoint was contacted in this task. Provider contracts, headers, CR mapping, correlation, and partial-failure behavior are covered through recorded fixtures and injected boundaries.
- Argo `status.summary.images` supplies the expected image references. Digest equality is enforced when a digest is present; when Argo reports only a tag, the live digest is still retained as evidence and tag equality remains enforceable.
- The successful application build continues to emit existing generated-CSS and third-party bundler warnings outside Task 7.
- Full-project TypeScript remains blocked only by the two known unrelated errors listed above.

## Fix Round 1 (2026-08-04)

### Status

DONE — all six Important findings and the one Minor finding from review of commit `5534254` are addressed with tests-first evidence.

### Review Finding Resolution

1. GitHub collection now defaults to `development` and reads only `GET /repos/Isolumi/youtube-mp3/actions/workflows/build-images.yml/runs?branch=development&per_page=1`, followed by the read-only commit metadata request. Repository components, workflow path, branch query, commit SHA, and run ID are validated or encoded before use. The provider test asserts the exact request URL.
2. Correlation and production-shaped Argo fixtures now use `ghcr.io/isolumi/yootoob-mp3-api` and `ghcr.io/isolumi/yootoob-mp3-frontend`.
3. The workflow source SHA is correlated to each expected image tag. It is no longer compared to the separate Argo GitOps revision. `argoRevision` remains explicit application evidence, and the healthy test uses source SHA `1829d6ba3b55e66a2134ae64161b9e48ad39a197` with distinct Argo revision `feedfacefeedfacefeedfacefeedfacefeedface`.
4. Every pod/container now retains `{ name, repository, reference, tag, digest }`. Correlation selects containers by exact target repository and passes the sidecar-first regression. Legacy pod-level image fields are populated only for a truthful single-container pod and are `null` for multi-container pods.
5. Missing expected Argo image/tag, pod, live tag, or live digest creates an explicit Unknown issue. Tag/digest mismatch is emitted only when both sides are comparable. Unknown evidence cannot roll up as Healthy, while zero available replicas remains Critical.
6. Upstream GitHub `html_url` values are ignored. Browser evidence is constructed as canonical `https://github.com/Isolumi/youtube-mp3/actions/runs/{numericId}` and `/commit/{validatedSha}` URLs. The fixture contains malicious upstream URLs and proves they are not propagated.
7. Snapshot collection uses runtime guards for `WorkflowRun` and `ArgoApplicationState`; no unknown casts remain at these boundaries. A malformed successful provider result becomes an Unknown/stale source failure and a partial deployment snapshot without crashing or producing false Healthy state.

Read-only APIs, provider cancellation/timeouts, optional GitHub startup, token secrecy, nullable `HealthIssue.source`, and the Task 1–6 gateway behavior remain preserved. No Argo token or mutation/exec API was added.

### Strict TDD Evidence

Tests and production-shaped fixtures were changed before implementation. The initial focused command was:

`bunx vitest run gateway/src/providers/-github.test.ts gateway/src/providers/-argocd.test.ts gateway/src/-deployment-correlation.test.ts gateway/src/providers/-kubernetes.test.ts gateway/src/-snapshot.test.ts gateway/src/-runtime.test.ts`

RED result: exit 1; 6 files ran, with 12 failed and 48 passed. Failures demonstrated the old `main`/all-workflows URL, propagation of malicious `html_url`, source-SHA/Argo-revision coupling, stale repository names, sidecar-first evidence collapse, missing evidence incorrectly becoming Healthy, absent mismatch rules, and a malformed Argo payload crash.

Final GREEN result for the same command: exit 0; 6 files and 60 tests passed.

### Verification Evidence

- Focused Fix Round 1 suites: exit 0; 6 files and 60 tests passed.
- Gateway/shared regressions: `bunx vitest run gateway/src shared/homelab` — exit 0; 9 files and 111 tests passed.
- Full repository suite: `bun run test` — exit 0; 21 files and 192 tests passed.
- Gateway build: `bun run build:gateway` — exit 0; 968 modules bundled.
- Application build: `bun run build` — exit 0; client, SSR, and Nitro builds completed. Existing generated-CSS and third-party bundler warnings remain non-fatal.
- Lint: `bun run lint` — exit 0; 0 warnings and 0 errors across 79 files.
- Scoped formatting: `bunx oxfmt` and `bunx oxfmt --check` over the 13 changed Task 7 code/test/fixture files — exit 0.
- Diff validation: `git diff --check` — exit 0.
- TypeScript: `bunx tsc --noEmit` exits 2 only for the two known unrelated diagnostics in `src/lib/secret-vault.ts:46` and `src/routes/_layout/todos/-PrioritySection.tsx:59`; no Task 7 diagnostic is present.

The literal `bun test` command was also attempted, but Bun interpreted it as its native test runner rather than the repository script. That runner lacks this suite's configured jsdom/Vitest helpers and was stopped after reproducing unrelated runner-only failures. The authoritative full-suite command is the package script `bun run test`, which passed all 192 tests.

### Files Changed in Fix Round 1

- `.superpowers/sdd/2026-08-04-homelab-dashboard/task-7-report.md`
- `gateway/src/providers/github.ts`
- `gateway/src/providers/argocd.ts`
- `gateway/src/deployment-correlation.ts`
- `gateway/src/providers/kubernetes-mappers.ts`
- `gateway/src/snapshot.ts`
- `shared/homelab/contracts.ts`
- `gateway/src/providers/-github.test.ts`
- `gateway/src/providers/-argocd.test.ts`
- `gateway/src/-deployment-correlation.test.ts`
- `gateway/src/providers/-kubernetes.test.ts`
- `gateway/src/-snapshot.test.ts`
- `gateway/src/providers/fixtures/github.json`
- `gateway/src/providers/fixtures/argocd.json`

### Fix Round 1 Self-Review and Concerns

- The review was checked finding-by-finding against the current production `youtube-mp3` workflow and Kustomize/Argo manifests; those files confirm the `development` branch, full source-SHA image tags, separate GitOps overlay commit, and `yootoob-*` GHCR names.
- All GitHub HTTP calls remain GET-only with injected fetch boundaries in tests. The read token is retained only in the server-side authorization header and is absent from normalized data/errors.
- Argo remains a Kubernetes Custom Objects Application read in namespace `argocd`; no direct Argo credential or write client exists.
- No test performs a live network request.
- No independent reviewer subagent was available in this environment, so the final review gate was performed directly against the complete diff and all seven findings.
- Live GitHub/Argo/Kubernetes endpoints were intentionally not contacted; production-shaped fixtures and injected read-only boundaries remain the verification mechanism.

## Fix Round 2 (2026-08-04)

### Status

DONE — the remaining Important finding from review of commit `1855321` is addressed with deep Kubernetes result validation, defensive correlation handling, and route-level regression coverage.

### Finding Resolution

- `ClusterData` is now validated field-by-field before a successful Kubernetes provider result is trusted by deployment snapshot composition. Nodes, namespaces, workloads, pods, events, resource metrics/history, every pod `containerImages` array, and every container image evidence field must match the shared contract.
- A malformed or legacy Kubernetes payload is converted to the existing fixed `Kubernetes unavailable` source failure with Unknown/stale partial-source semantics. Raw provider data, credentials, paths, and stack details are not retained in the deployment response.
- Correlation independently validates each selected pod's `containerImages` at runtime. Missing arrays, non-array legacy values, and malformed entries create `deployment-container-images-unavailable` Unknown evidence instead of throwing.
- Tag and digest comparisons are suppressed whenever selected pod container evidence is malformed, so incomplete data cannot create a mismatch or false Healthy result. Existing Critical zero-replica precedence remains unchanged.
- The `/deployments` regression exercises the real Hono route with a malformed successful Kubernetes result and proves it returns HTTP 200 with a partial Unknown snapshot and fixed source error.
- Existing valid Kubernetes inventory, pod detail, health, GitHub, Argo, runtime, and Round 1 behavior remains unchanged.

### Strict TDD Evidence

Only the three focused test files were edited before production code:

- `gateway/src/-deployment-correlation.test.ts`
- `gateway/src/-snapshot.test.ts`
- `gateway/src/-app.test.ts`

Initial RED command:

`bunx vitest run gateway/src/-deployment-correlation.test.ts gateway/src/-snapshot.test.ts gateway/src/-app.test.ts`

RED result: exit 1; 3 files ran, with 4 failed and 21 passed. Direct correlation failed on both absent and non-array `containerImages`; snapshot collection threw the same `.filter` error; and `/deployments` returned HTTP 500 while emitting the correlation stack. These failures reproduced the reviewed trust-boundary defect.

The regression matrix was then expanded to include malformed `containerImages` entries and mixed legacy/current pod shapes. Final GREEN for the same command: exit 0; 3 files and 27 tests passed.

### Verification Evidence

- Focused Task 7: `bunx vitest run gateway/src/providers/-github.test.ts gateway/src/providers/-argocd.test.ts gateway/src/-deployment-correlation.test.ts gateway/src/providers/-kubernetes.test.ts gateway/src/-snapshot.test.ts gateway/src/-runtime.test.ts gateway/src/-app.test.ts` — exit 0; 7 files and 71 tests passed.
- Gateway/shared regressions: `bunx vitest run gateway/src shared/homelab` — exit 0; 9 files and 117 tests passed.
- Full repository suite: `bun run test` — exit 0; 21 files and 198 tests passed.
- Gateway build: `bun run build:gateway` — exit 0; 968 modules bundled.
- Application build: `bun run build` — exit 0; client, SSR, and Nitro builds completed with only the existing generated-CSS and third-party bundler warnings.
- Lint: `bun run lint` — exit 0; 0 warnings and 0 errors across 79 files.
- Scoped formatting: `bunx oxfmt` and `bunx oxfmt --check` over the five changed TypeScript source/test files — exit 0.
- TypeScript: `bunx tsc --noEmit` exits 2 only for the two known unrelated diagnostics in `src/lib/secret-vault.ts:46` and `src/routes/_layout/todos/-PrioritySection.tsx:59`; no Task 7 diagnostic is present.
- Diff validation: `git diff --check` — exit 0.

### Files Changed in Fix Round 2

- `.superpowers/sdd/2026-08-04-homelab-dashboard/task-7-report.md`
- `gateway/src/snapshot.ts`
- `gateway/src/deployment-correlation.ts`
- `gateway/src/-snapshot.test.ts`
- `gateway/src/-deployment-correlation.test.ts`
- `gateway/src/-app.test.ts`

### Fix Round 2 Self-Review and Concerns

- Deep validation occurs before correlation and does not expose a generic cast or partially trusted pod shape.
- The correlation fallback is independent of snapshot validation so direct callers also receive explicit Unknown evidence.
- No mutation/exec API, credential, network call, Kubernetes manifest, shared contract change, or unrelated application file was added or modified.
- Valid Kubernetes mapper output is covered by the unchanged provider tests and the complete gateway/shared/full regression suites.
- No reviewer subagent capability was available in this environment; the final review gate was performed directly against the complete diff and the remaining finding.
- Live GitHub, Argo, and Kubernetes endpoints were intentionally not contacted.

## Fix Round 3 (2026-08-04)

### Status

DONE — the remaining runtime-totality finding from review of commit `75ef18b` is addressed at the direct public `correlateDeployment` boundary with strict tests-first evidence.

### Finding Resolution

- `correlateDeployment` now treats its Kubernetes argument as untrusted runtime data before any correlation dereference. The complete evidence object is accepted only when `workloads` and `pods` are arrays and every nested record passes the runtime guards.
- Workload guards require string `kind`, `name`, and `namespace`, a recognized health `status`, and finite non-negative integer `desiredReplicas` and `availableReplicas` values.
- Pod guards require string `name` and `namespace`, a recognized health `status`, boolean `ready`, an array of `containerImages`, and valid `{ name, repository, reference, tag, digest }` types for every nested entry.
- Any malformed Kubernetes shape is normalized to unavailable evidence before `find`, `filter`, `startsWith`, replica comparison, or image correlation can run. Both deployment workloads and the rollout become explicit Unknown evidence with zeroed safe replica summaries; the application receives the fixed `deployment-kubernetes-evidence-invalid` issue and reason `Kubernetes deployment evidence is invalid.`
- Safe pod identity is inspected separately only to preserve the Round 2 `deployment-container-images-unavailable` issue for a known API/frontend target. No malformed nested value or raw provider payload is copied into the result.
- Valid typed inputs retain the existing behavior. The valid control remains Healthy, and a valid workload with zero available replicas remains Critical.
- Snapshot integration now passes pod health status into the direct correlation contract. Existing route-side deep provider validation and partial-source handling remain unchanged.

### Strict TDD Evidence

The compact table-driven direct correlator regression was added before implementation. It covers a valid control and malformed variants for null/non-array workload and pod collections; malformed workload records, kind, name, namespace, and status; malformed pod records, name, namespace, and status; `NaN`, string, and negative desired/available replicas; null/non-array `containerImages`; and malformed nested image evidence.

Initial RED command:

`bunx vitest run gateway/src/-deployment-correlation.test.ts`

Initial RED result: exit 1; 35 tests ran, with 22 failed and 13 passed. The failures reproduced throws from array and string operations, false Healthy states from malformed kinds/statuses and coerced replicas, and false Critical/Warning states from malformed names and negative replicas.

After the application-level guard was green, the preserved Round 2 per-target image evidence was restored tests-first. The same command produced the compatibility RED: exit 1; 38 tests ran, with 3 failed and 35 passed because malformed `containerImages` no longer emitted `deployment-container-images-unavailable`.

Final GREEN for the direct correlator: exit 0; 1 file and 38 tests passed.

### Verification Evidence

- Focused Task 7: `bunx vitest run gateway/src/providers/-github.test.ts gateway/src/providers/-argocd.test.ts gateway/src/-deployment-correlation.test.ts gateway/src/providers/-kubernetes.test.ts gateway/src/-snapshot.test.ts gateway/src/-runtime.test.ts gateway/src/-app.test.ts` — exit 0; 7 files and 94 tests passed.
- Gateway/shared regressions: `bunx vitest run gateway shared` — exit 0; 9 files and 140 tests passed.
- Full configured repository suite: `bun run test` — exit 0; 21 files and 221 tests passed.
- Gateway build: `bun run build:gateway` — exit 0; 968 modules bundled into `gateway/dist/index.js`.
- Application build: `bun run build` — exit 0; client, SSR, and Nitro builds completed with only the existing generated-CSS and third-party bundler warnings.
- Lint: `bun run lint` — exit 0; 0 warnings and 0 errors across 79 files.
- Scoped formatting: `bunx oxfmt --write` followed by `bunx oxfmt --check` over the three changed TypeScript source/test files — exit 0.
- TypeScript: `bunx tsc --noEmit` exits 2 only for the two known unrelated diagnostics in `src/lib/secret-vault.ts:46` and `src/routes/_layout/todos/-PrioritySection.tsx:59`; no Task 7 diagnostic is present.
- Diff validation: `git diff --check` — exit 0.

The literal `bun test` command was also attempted, but Bun interpreted it as its native runner rather than the repository's Vitest script. Its jsdom and Vitest-helper incompatibilities produced unrelated runner-only failures. The authoritative configured suite is `bun run test`, which passed all 221 tests.

### Files Changed in Fix Round 3

- `.superpowers/sdd/2026-08-04-homelab-dashboard/task-7-report.md`
- `gateway/src/deployment-correlation.ts`
- `gateway/src/-deployment-correlation.test.ts`
- `gateway/src/snapshot.ts`

### Fix Round 3 Self-Review and Concerns

- The public correlator no longer trusts its TypeScript annotation at runtime for any Kubernetes field it dereferences.
- Malformed evidence cannot generate a tag/digest mismatch, false Healthy state, or false replica Critical/Warning state. The fixed Unknown application issue is always present for malformed Kubernetes input.
- Existing valid image correlation, sidecar handling, GitHub/Argo evidence separation, zero-replica Critical behavior, nullable issue source semantics, read-only provider APIs, optional startup, and token secrecy remain covered by the focused and full regressions.
- No live network request, mutation/exec API, credential, Kubernetes manifest, shared contract, fixture, or unrelated application file was added or changed.
- No reviewer subagent capability was available in this environment; the final review gate was performed directly against the complete diff and the Round 3 finding.
- Full-project TypeScript remains blocked only by the two approved unrelated errors listed above. The application build continues to emit existing non-fatal generated-CSS and third-party bundler warnings.

## Fix Round 4 (2026-08-04)

### Status

DONE — the two remaining Important findings from review of commit `8b725e7` are addressed with explicit missing-workload semantics and hostile-shape-safe runtime parsing.

### Finding Resolution

1. Valid Kubernetes evidence that lacks a target workload now emits `deployment-workload-unavailable` Unknown evidence. The missing workload summary uses `null` desired/available replicas rather than inventing zero replicas, and `DeploymentWorkloadSummary` reflects that nullable contract. Empty arrays, unrelated workloads, and a missing target workload with a matching live pod all remain Unknown without any Critical issue. A present valid target workload with `availableReplicas: 0` still emits `deployment-unavailable` and remains Critical. The Round 3 malformed-whole-source fallback retains its prior zeroed safe summaries.
2. A shared runtime inspector now reads required fields only through own data-property descriptors, accepts only plain/null-prototype records, checks arrays slot-by-slot for density, and wraps array/prototype/descriptor introspection in `try/catch`. Accessors, inherited fields, custom prototypes, sparse workload/pod/container-image arrays, and throwing proxy traps are rejected without invoking getters or propagating raw errors. Both `correlateDeployment` and route-side `ClusterData` handling build fresh validated copies before correlation; caller input is not mutated or serialized before validation. Invalid direct input returns fixed Unknown correlation evidence, while invalid route data becomes the fixed `Kubernetes unavailable` partial source. Valid plain objects, null-prototype objects, and valid zero-replica evidence retain their prior outcomes.

The existing `development`/`build-images.yml` workflow, exact `yootoob` repositories, source-SHA versus Argo revision semantics, per-container tag/digest evidence, Unknown/mismatch precedence, canonical GitHub URLs, provider timeouts, optional startup, and read-only GitHub/Argo/Kubernetes APIs remain unchanged.

### Strict TDD Evidence

Only `gateway/src/-deployment-correlation.test.ts` and `gateway/src/-snapshot.test.ts` were changed before the first production edit.

Initial RED command:

`bunx vitest run gateway/src/-deployment-correlation.test.ts gateway/src/-snapshot.test.ts`

Initial RED result: exit 1; 2 files ran, with 19 failed and 48 passed. The failures reproduced all three false-Critical missing-target variants, throwing accessors, inherited/custom prototypes accepted as healthy, sparse arrays accepted or crashing correlation, and throwing prototype/property-descriptor proxy traps accepted as healthy.

The public top-level/source accessor cases were then added before their normalization code. RED command:

`bunx vitest run gateway/src/-deployment-correlation.test.ts`

Second RED result: exit 1; 53 tests ran, with 3 failed and 50 passed. The top-level correlation accessor, nested workflow accessor, and nested Argo accessor each escaped before descriptor-based input normalization.

Final focused GREEN:

`bunx vitest run gateway/src/-deployment-correlation.test.ts gateway/src/-snapshot.test.ts`

Result: exit 0; 2 files and 70 tests passed.

The first gateway/shared regression run exposed one existing Prometheus integration failure because fresh validated copies no longer matched raw provider objects by identity. The implementation retained raw identity only for source selection while forwarding the validated copy; the unchanged merge regression then passed. Final gateway/shared verification is listed below.

### Verification Evidence

- Focused Task 7: `bunx vitest run gateway/src/providers/-github.test.ts gateway/src/providers/-argocd.test.ts gateway/src/-deployment-correlation.test.ts gateway/src/providers/-kubernetes.test.ts gateway/src/-snapshot.test.ts gateway/src/-runtime.test.ts gateway/src/-app.test.ts` — exit 0; 7 files and 120 tests passed.
- Gateway/shared regressions: `bunx vitest run gateway shared` — exit 0; 9 files and 166 tests passed.
- Full configured repository suite: `bun run test` — exit 0; 21 files and 247 tests passed.
- Gateway build: `bun run build:gateway` — exit 0; 969 modules bundled into `gateway/dist/index.js`.
- Application build: `bun run build` — exit 0; client, SSR, and Nitro production builds completed. Existing generated-CSS and third-party `use client`/unused-import warnings remain non-fatal.
- Lint: `bun run lint` — exit 0; 0 warnings and 0 errors across 80 files.
- Scoped formatting: `bunx oxfmt --write` followed by `bunx oxfmt --check` over the six changed TypeScript source/test/contract files — exit 0; all files match OXC formatting.
- TypeScript: `bunx tsc --noEmit` exits 2 only for the two known unrelated diagnostics in `src/lib/secret-vault.ts:46` and `src/routes/_layout/todos/-PrioritySection.tsx:59`; no Task 7 diagnostic is present.
- Diff validation: `git diff --check` — exit 0.

### Files Changed in Fix Round 4

- `.superpowers/sdd/2026-08-04-homelab-dashboard/task-7-report.md`
- `gateway/src/runtime-validation.ts`
- `gateway/src/deployment-correlation.ts`
- `gateway/src/snapshot.ts`
- `shared/homelab/contracts.ts`
- `gateway/src/-deployment-correlation.test.ts`
- `gateway/src/-snapshot.test.ts`

### Fix Round 4 Self-Review and Concerns

- No raw hostile value is cloned, spread, stringified, or returned before validation. Descriptor values are copied into fresh plain records/arrays only after the required own data properties and dense slots pass inspection.
- No accessor is invoked by the new validation path. Prototype and descriptor operations are contained by fixed-fallback `try/catch` handling, including revoked/throwing proxy behavior.
- No mutation/exec API, credential, provider endpoint, Kubernetes manifest, workflow configuration, fixture, or unrelated application source was changed.
- No live GitHub, Argo CD, or Kubernetes endpoint was contacted; injected provider boundaries and production-shaped fixtures remain the verification mechanism.
- No reviewer subagent capability was available in this environment, so the final review gate was performed directly against the complete scoped diff and all requested regressions.
- The application build retains its pre-existing non-fatal generated-CSS and dependency bundler warnings. Full-project TypeScript retains only the two pre-existing unrelated diagnostics listed above.

## Fix Round 5 (2026-08-04)

### Status

DONE — all three remaining Important findings are addressed with descriptor-safe GitHub/Argo boundary parsing, proxy-first shared runtime inspection, single-pass Kubernetes normalization, and explicit collection bounds.

### Finding Resolution

1. `/deployments` no longer trusts raw `WorkflowRun` or `ArgoApplicationState` values. The exported parsers reject proxies, accessors, inherited/custom-prototype records, sparse nested arrays, malformed canonical fields, and oversized collections, then return fresh normalized copies. A malformed successful provider result becomes the fixed source error (`GitHub unavailable` or `Argo CD unavailable`) with HTTP 200 Unknown/partial-source evidence; raw values, getter text, and stacks are not exposed.
2. The shared inspector now uses `node:util` `types.isProxy` before array, prototype, key, or descriptor introspection. It examines every own string and symbol descriptor and rejects any accessor, including unknown extra accessors. Records require `Object.prototype` or a null prototype and intended own data fields. Arrays require `Array.prototype` or a null prototype, own data descriptors for every dense index, no unexpected keys/symbols, and no sparse slots. Kubernetes pod records are inspected once per untrusted source; later deployment correlation receives only the fresh validated copy plus fixed target-container diagnostics.
3. Named limits are enforced before allocation or index iteration for GitHub workflow runs, Argo resources/images, Kubernetes nodes/conditions/namespaces/workloads/pods/container images/events, and resource metric collections/points. A sparse array with length `1_000_000_000` is rejected before `Array.from` is called. Max and max-plus-one controls cover the shared array inspector and representative route/provider collections.

Existing missing-target Unknown semantics and present zero-replica Critical semantics remain unchanged. Valid plain and null-prototype controls remain accepted.

### Strict TDD Evidence

The first production edit followed the requested checkpoint tests in `gateway/src/-runtime-validation.test.ts`, `gateway/src/-snapshot.test.ts`, and `gateway/src/-app.test.ts`.

Initial RED command:

`bunx vitest run gateway/src/-runtime-validation.test.ts gateway/src/-snapshot.test.ts gateway/src/-app.test.ts`

Initial RED result: exit 1; 3 files ran, with 10 failed and 26 passed. The failures showed transparent proxies and unknown accessors being accepted, max-plus-one and huge sparse arrays reaching unsafe paths, WorkflowRun/Argo getters returning HTTP 500, and otherwise-valid transparent workflow/Argo/cluster proxies being trusted.

The single-pass pod and safe diagnostic regressions were then added before the correlation refactor:

`bunx vitest run gateway/src/-deployment-correlation.test.ts gateway/src/-snapshot.test.ts`

Second RED result: exit 1; 2 files ran, with 2 failed and 72 passed. A direct pod was inspected three times (21 descriptor reads instead of 7), and invalid target `containerImages` omitted the fixed `deployment-container-images-unavailable` diagnostic.

Compatibility tests for present transparent proxies in optional GitHub author and Argo summary/sync-result/resource-health data were also added before their handling. The combined provider command exited 1 with 4 failed and 13 passed, then passed after the optional-record parsing fix.

Final focused GREEN:

`bunx vitest run gateway/src/-runtime-validation.test.ts gateway/src/providers/-github.test.ts gateway/src/providers/-argocd.test.ts gateway/src/-deployment-correlation.test.ts gateway/src/providers/-kubernetes.test.ts gateway/src/-snapshot.test.ts gateway/src/-runtime.test.ts gateway/src/-app.test.ts`

Result: exit 0; 8 files and 163 tests passed.

### Verification Evidence

- Gateway/shared regressions: `bunx vitest run gateway shared` — exit 0; 10 files and 209 tests passed.
- Full configured repository suite: `bun run test` — exit 0; 22 files and 290 tests passed.
- Gateway build: `bun run build:gateway` — exit 0; 969 modules bundled into `gateway/dist/index.js`.
- Application build: `bun run build` — exit 0; client, SSR, and Nitro production builds completed with only the existing generated-CSS and third-party bundler warnings.
- Lint: `bun run lint` — exit 0; 0 warnings and 0 errors across 81 files.
- Scoped formatting: `bunx oxfmt --check` over the 11 changed TypeScript source/test files — exit 0; all files match OXC formatting.
- TypeScript: `bunx tsc --noEmit` exits 2 only for the two known unrelated diagnostics in `src/lib/secret-vault.ts:46` and `src/routes/_layout/todos/-PrioritySection.tsx:59`; no Task 7 diagnostic is present.
- Diff validation: `git diff --check` — exit 0.

### Files Changed in Fix Round 5

- `.superpowers/sdd/2026-08-04-homelab-dashboard/task-7-report.md`
- `gateway/src/runtime-validation.ts`
- `gateway/src/providers/github.ts`
- `gateway/src/providers/argocd.ts`
- `gateway/src/deployment-correlation.ts`
- `gateway/src/snapshot.ts`
- `gateway/src/-runtime-validation.test.ts`
- `gateway/src/providers/-github.test.ts`
- `gateway/src/providers/-argocd.test.ts`
- `gateway/src/-deployment-correlation.test.ts`
- `gateway/src/-snapshot.test.ts`
- `gateway/src/-app.test.ts`

### Fix Round 5 Self-Review and Concerns

- Every Task 7 runtime array parser has an explicit named limit, and all route/correlation work after validation operates on fresh bounded copies rather than hostile provider values.
- Proxy detection precedes every potentially trapping array/prototype/key inspection. Descriptor reads are contained by fixed-fallback `try/catch`, and no accessor is invoked by the validation path.
- Existing healthy, partial-source, malformed-source, missing-target Unknown, and zero-replica Critical behavior is covered by the focused and full regressions.
- No shared contract, provider endpoint, mutation/exec API, credential, manifest, workflow configuration, fixture, or unrelated application source was changed. No live GitHub, Argo CD, or Kubernetes endpoint was contacted.
- No independent reviewer subagent capability was available in this environment; the final review gate was performed directly against the complete scoped diff and all three findings.
- Full-project TypeScript remains blocked only by the two pre-existing unrelated diagnostics listed above. The application build retains its pre-existing non-fatal generated-CSS and third-party dependency warnings.
