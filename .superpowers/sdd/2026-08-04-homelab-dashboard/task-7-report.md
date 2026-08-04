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
