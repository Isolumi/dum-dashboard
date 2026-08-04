# Homelab Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy Dum Dashboard to `dumachine` and add a Tailscale-only, read-only Homelab group that reports K3s health, deployment state, services, resource history, and live pod logs.

**Architecture:** The existing TanStack Start app runs as a Node container in K3s and communicates only with an internal Homelab Gateway. The TypeScript gateway normalizes independent Kubernetes, Argo CD, Prometheus, GitHub, and service-probe providers into shared snapshot contracts; the browser polls snapshots every 10 seconds and proxies live logs through server-sent events.

**Tech Stack:** TanStack Start, React 19, TypeScript, Tailwind 4, shadcn/ui, Vitest, Hono, Kubernetes JavaScript client, Prometheus HTTP API, GitHub REST API, Docker, Kustomize, Argo CD, GHCR, cert-manager, and kube-prometheus-stack `86.0.1`.

## Global Constraints

- Execution must start from a commit that contains the current uncommitted Calendar/auth/secret-vault work. Preserve it; do not stash, discard, or reconstruct it silently.
- Use an isolated worktree at execution time through `superpowers:using-git-worktrees`.
- Keep the existing TanStack Start, React, Tailwind, shadcn/ui, Lucide, OXC, and Supabase stack.
- Use TDD: write a failing focused test, confirm the expected failure, implement minimally, and rerun the focused and affected suites.
- Use only semantic Tailwind tokens; do not add hardcoded hex, RGB, or OKLCH values in components.
- Use `.yml` for every Kubernetes and GitHub Actions file.
- Support only `dumachine` in v1.
- Homelab is read-only: no create, update, patch, delete, exec, attach, port-forward, or rollout actions.
- Dashboard access is Tailscale-only at `https://dashboard.doh.lumilumi.xyz` with no visit-time application login.
- Google Calendar may still use its one-time OAuth consent flow when connecting or reconnecting Calendar.
- Poll visible Homelab snapshots every 10 seconds; mark source data older than 30 seconds Unknown/stale.
- Keep infrastructure credentials server-side and separate the read-only GitHub credential from CI image-push credentials.
- Initial service mapping uses namespace `yootoob-mp3`, Argo app `yootoob-mp3-dumachine`, and deployments `yootoob-mp3-api` and `yootoob-mp3-frontend`.
- Each task must commit only its listed files and must not absorb unrelated worktree changes.

---

### Task 1: Replace Visit-Time OAuth With a Single-Owner Server Boundary

**Files:**
- Create: `src/lib/runtime-env.ts`
- Create: `src/hooks/usePollingRefresh.ts`
- Create: `src/hooks/-usePollingRefresh.test.tsx`
- Modify: `.env.example`
- Modify: `src/lib/server-auth.ts`
- Modify: `src/lib/-server-auth.test.ts`
- Modify: `src/lib/supabase-admin.ts`
- Modify: `src/routes/_layout.tsx`
- Modify: `src/components/AppSidebar.tsx`
- Modify: `src/routes/todos/todos.functions.ts`
- Modify: `src/routes/todos/-todos.functions.test.ts`
- Modify: `src/routes/_layout/todos/index.tsx`
- Modify: `src/routes/_layout/todos/-TodoBentoCard.tsx`
- Modify: `src/routes/_layout/todos/-TodoBentoCard.test.tsx`
- Modify: `src/routes/_layout/calendar/-calendar.functions.ts`
- Modify: `src/routes/_layout/calendar/-calendar.functions.test.ts`
- Modify: `src/routes/_layout/calendar/-CalendarBentoCard.tsx`
- Modify: `src/routes/_layout/calendar/-CalendarBentoCard.test.tsx`
- Delete: `src/routes/login.tsx`
- Delete: `src/routes/auth/callback.tsx`
- Delete: `src/lib/auth.ts`
- Delete: `src/lib/auth-schemas.ts`
- Delete: `src/lib/-auth.test.ts`
- Delete: `src/hooks/useTodosRealtime.ts`
- Delete: `src/hooks/-useTodosRealtime.test.tsx`
- Delete if no imports remain: `src/lib/supabase.ts`

**Interfaces:**
- Produces: `requireServerEnv(name: string): string`
- Produces: `getOwnerUser(): { id: string }`
- Produces: `assertSameOrigin(): void`
- Produces: `usePollingRefresh(callback: () => void | Promise<void>, intervalMs: number): void`
- Changes Todo and Calendar server inputs so they no longer accept `supabase_access_token`.

- [ ] **Step 1: Write server-boundary and polling tests**

```ts
it("returns the configured owner without a browser token", () => {
  vi.stubEnv("OWNER_USER_ID", "owner-user-id");
  expect(getOwnerUser()).toEqual({ id: "owner-user-id" });
});

it("rejects a mutation from another origin", () => {
  mockHeaders({ origin: "https://evil.example", host: "dashboard.doh.lumilumi.xyz" });
  expect(() => assertSameOrigin()).toThrow("Cross-origin request rejected");
});

it("refreshes on the configured interval", async () => {
  vi.useFakeTimers();
  const refresh = vi.fn();
  renderHook(() => usePollingRefresh(refresh, 3000));
  await vi.advanceTimersByTimeAsync(3000);
  expect(refresh).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `bunx vitest run src/lib/-server-auth.test.ts src/hooks/-usePollingRefresh.test.tsx`  
Expected: FAIL because `getOwnerUser`, `assertSameOrigin`, and `usePollingRefresh` do not exist.

- [ ] **Step 3: Implement runtime-neutral owner and origin helpers**

```ts
// src/lib/runtime-env.ts
export function requireServerEnv(name: string): string {
  const value = typeof process === "undefined" ? "" : process.env[name];
  if (!value) throw new Error(`Missing server-only ${name} secret`);
  return value;
}

// src/lib/server-auth.ts
export function getOwnerUser(): { id: string } {
  return { id: requireServerEnv("OWNER_USER_ID") };
}

export function assertSameOrigin(): void {
  const origin = getRequestHeader("origin");
  const host = getRequestHeader("host");
  if (!origin || !host || new URL(origin).host !== host) {
    throw new Error("Cross-origin request rejected");
  }
}
```

Call `assertSameOrigin()` in Todo create/update/delete/reorder functions. Read functions use `getOwnerUser()` without requiring a client token. Calendar connection and event reads use `getOwnerUser().id`; Calendar authorization-code state validation remains unchanged.

- [ ] **Step 4: Remove the route guard and sign-out UI**

Replace `_layout`’s `beforeLoad` with direct layout rendering, remove the sidebar footer, delete login/auth callback files, and regenerate the route tree with `bun run build` after focused tests pass.

- [ ] **Step 5: Replace token-aware clients and anonymous Supabase realtime**

Call server functions with only their domain input:

```ts
const fresh = await getTodos();
const created = await createTodo({ data: fields });
const result = await getCalendarEvents({
  data: { time_min: now.toISOString(), time_max: thirtyDaysOut.toISOString() },
});
```

Use `usePollingRefresh(() => loadTodos({ showLoading: false }), 3000)` on the Todos page so cross-tab updates remain visible without exposing an authenticated Supabase session.

- [ ] **Step 6: Update tests and environment documentation**

Add `OWNER_USER_ID=your-existing-supabase-owner-uuid` to `.env.example`; remove assertions about signed-out states and access-token inputs; assert that mutation tests call `assertSameOrigin` and that Calendar OAuth writes the configured owner ID.

- [ ] **Step 7: Run all affected checks**

Run: `bunx vitest run src/lib src/hooks src/routes/todos src/routes/_layout/todos src/routes/_layout/calendar`  
Expected: PASS.  
Run: `bun run lint && bun run fmt:check && bun run build`  
Expected: all commands exit 0 and the generated route tree has no `/login` or `/auth/callback` route.

- [ ] **Step 8: Commit**

```bash
git add .env.example src
git commit -m "feat: use tailscale-only single-owner access"
```

### Task 2: Move the Dashboard Runtime From Cloudflare Worker to Node

**Files:**
- Create: `Dockerfile.dashboard`
- Create: `.dockerignore`
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `vite.config.ts`
- Modify: `vitest.config.ts`
- Modify: `src/lib/secret-vault.ts`
- Modify: `src/routes/_layout/calendar/-calendar.functions.ts`
- Delete: `src/lib/cf-env.ts`
- Delete: `src/worker.ts`
- Delete: `wrangler.jsonc`

**Interfaces:**
- Produces: `bun run start` launching `.output/server/index.mjs` on `PORT`.
- Produces: dashboard image listening on port `3000`.
- Consumes: `requireServerEnv` from Task 1.

- [ ] **Step 1: Add a runtime configuration test**

Add a test proving server secrets resolve from `process.env` and no test imports `getCfEnv`.

- [ ] **Step 2: Run the test and confirm the old Worker dependency fails the expectation**

Run: `bunx vitest run src/lib/-secret-vault.test.ts src/routes/_layout/calendar/-calendar.functions.test.ts`  
Expected: FAIL while the implementation still reads Cloudflare bindings.

- [ ] **Step 3: Switch Vite and package scripts to the default Node server**

Remove `cloudflare()` from `vite.config.ts`, remove `@cloudflare/vite-plugin` and `wrangler`, and use:

```json
{
  "scripts": {
    "build": "vite build",
    "start": "node .output/server/index.mjs"
  }
}
```

Replace Cloudflare environment reads in Calendar, Supabase admin, and secret-vault code with `requireServerEnv`.

- [ ] **Step 4: Add the dashboard image**

```dockerfile
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

- [ ] **Step 5: Verify local Node and container execution**

Run: `bun install && bun run test && bun run build`  
Expected: PASS and `.output/server/index.mjs` exists.  
Run: `docker build -f Dockerfile.dashboard -t dum-dashboard:test .`  
Run: `docker run --rm -d --name dum-dashboard-test -p 33000:3000 --env-file .dev.vars dum-dashboard:test`  
Run: `curl --fail http://127.0.0.1:33000/`  
Expected: HTTP success. Stop only this container with `docker stop dum-dashboard-test`.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock vite.config.ts vitest.config.ts src Dockerfile.dashboard .dockerignore
git rm wrangler.jsonc
git commit -m "build: run dashboard on node"
```

### Task 3: Define Shared Snapshots and Deterministic Health Rules

**Files:**
- Create: `shared/homelab/contracts.ts`
- Create: `shared/homelab/health-rules.ts`
- Create: `shared/homelab/-health-rules.test.ts`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`

**Interfaces:**
- Produces: `HealthStatus`, `HealthIssue`, `SourceState`, `Snapshot<T>`, `ClusterSnapshot`, `DeploymentSnapshot`, `ServiceSnapshot`, and `OverviewSnapshot`.
- Produces: `evaluateNode`, `evaluateWorkload`, `evaluateCertificate`, `evaluateResources`, `evaluateSourceFreshness`, and `rollUpStatus`.

- [ ] **Step 1: Write table-driven health-rule tests**

```ts
it.each([
  [{ ready: false }, "critical", "node-not-ready"],
  [{ ready: true }, "healthy", "node-ready"],
])("evaluates node health", (input, status, ruleId) => {
  expect(evaluateNode(input)).toMatchObject({ status, ruleId });
});

it("never reports stale source data as healthy", () => {
  expect(evaluateSourceFreshness("2026-08-04T00:00:00Z", Date.parse("2026-08-04T00:00:31Z")))
    .toMatchObject({ status: "unknown", ruleId: "source-stale" });
});
```

- [ ] **Step 2: Confirm the contracts and rules are missing**

Run: `bunx vitest run shared/homelab/-health-rules.test.ts`  
Expected: FAIL with unresolved contract/rule imports.

- [ ] **Step 3: Implement exact shared status contracts**

```ts
export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export interface HealthIssue {
  ruleId: string;
  status: Exclude<HealthStatus, "healthy">;
  reason: string;
  source: "kubernetes" | "argocd" | "prometheus" | "github" | "service-probe";
  resource: string;
  observedAt: string;
  evidence: Record<string, string | number | boolean | null>;
}

export interface Snapshot<T> {
  data: T | null;
  status: HealthStatus;
  observedAt: string;
  stale: boolean;
  issues: HealthIssue[];
  sources: SourceState[];
}
```

Define resource thresholds exactly as approved: CPU/memory 85% Warning and 95% Critical for five minutes; disk 90% Warning and 97% Critical; certificate 14 days Warning and expired Critical; source age over 30 seconds Unknown.

- [ ] **Step 4: Implement roll-up semantics**

`rollUpStatus` returns Critical when any child is Critical, Warning when none are Critical and any is Warning, Unknown when all non-Healthy evidence is Unknown, otherwise Healthy. Preserve Unknown issues separately so missing data never appears as a proven failure.

- [ ] **Step 5: Verify contracts and rules**

Run: `bunx vitest run shared/homelab/-health-rules.test.ts`  
Expected: PASS.  
Run: `bun run lint && bun run fmt:check`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared tsconfig.json vitest.config.ts
git commit -m "feat: define homelab health contracts"
```

### Task 4: Build the Gateway Core and Partial-Failure Aggregator

**Files:**
- Create: `gateway/src/config.ts`
- Create: `gateway/src/providers/provider.ts`
- Create: `gateway/src/snapshot.ts`
- Create: `gateway/src/app.ts`
- Create: `gateway/src/index.ts`
- Create: `gateway/src/-snapshot.test.ts`
- Create: `gateway/src/-app.test.ts`
- Create: `Dockerfile.gateway`
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `vitest.config.ts`

**Interfaces:**
- Produces: `Provider<T> = { source: SourceName; collect(signal: AbortSignal): Promise<T> }`.
- Produces: `collectProviders(providers, timeoutMs, now): Promise<SourceResult[]>`.
- Produces: `createGateway(dependencies): Hono` with `/healthz`, `/overview`, `/cluster`, `/deployments`, and `/services`.

- [ ] **Step 1: Write partial-provider and health endpoint tests**

```ts
it("returns successful provider data when another provider fails", async () => {
  const results = await collectProviders([okProvider, failingProvider], 1000, fixedNow);
  expect(results).toMatchObject([
    { source: "kubernetes", ok: true },
    { source: "github", ok: false, error: "GitHub unavailable" },
  ]);
});

it("reports process health without contacting providers", async () => {
  const response = await createGateway(testDependencies).request("/healthz");
  expect(response.status).toBe(200);
});
```

- [ ] **Step 2: Confirm failure**

Run: `bunx vitest run gateway/src/-snapshot.test.ts gateway/src/-app.test.ts`  
Expected: FAIL because the gateway modules do not exist.

- [ ] **Step 3: Implement provider isolation and gateway routes**

Use one `AbortController` per provider, a 5-second default timeout, `Promise.allSettled`, and a normalized `SourceState`. Route handlers call only the aggregator; they do not contain provider-specific mapping logic.

- [ ] **Step 4: Add gateway build and runtime scripts**

```json
{
  "scripts": {
    "build:gateway": "bun build gateway/src/index.ts --target=node --outdir gateway/dist",
    "start:gateway": "node gateway/dist/index.js"
  },
  "dependencies": {
    "@hono/node-server": "^1.19.0",
    "hono": "^4.9.0"
  }
}
```

- [ ] **Step 5: Add and smoke-test the gateway image**

Use a Bun build stage and `node:22-alpine` runtime, expose `8080`, start `gateway/dist/index.js`, and verify:

Run: `bun run build:gateway && PORT=38080 node gateway/dist/index.js &`  
Run: `curl --fail http://127.0.0.1:38080/healthz`  
Expected body: `{"status":"ok"}`. Stop only the PID started by this step.

- [ ] **Step 6: Run checks and commit**

Run: `bunx vitest run gateway shared/homelab && bun run lint && bun run fmt:check`  
Expected: PASS.

```bash
git add gateway shared package.json bun.lock vitest.config.ts Dockerfile.gateway
git commit -m "feat: add read-only homelab gateway"
```

### Task 5: Add Kubernetes Inventory, Events, Pod Detail, and Log Streaming

**Files:**
- Create: `gateway/src/providers/kubernetes.ts`
- Create: `gateway/src/providers/kubernetes-mappers.ts`
- Create: `gateway/src/providers/-kubernetes.test.ts`
- Create: `gateway/src/providers/fixtures/kubernetes.json`
- Modify: `gateway/src/app.ts`
- Modify: `gateway/src/config.ts`
- Modify: `package.json`
- Modify: `bun.lock`

**Interfaces:**
- Produces: `KubernetesProvider.collect(): Promise<ClusterData>`.
- Produces: `getPod(namespace: string, pod: string): Promise<PodDetail>`.
- Produces: `streamPodLogs(namespace, pod, container, signal): AsyncIterable<string>`.
- Adds: `GET /pods/:namespace/:pod` and `GET /pods/:namespace/:pod/logs?container=name`.

- [ ] **Step 1: Write fixture-based mapper and log-cleanup tests**

Assert Ready node mapping, unavailable replica mapping, Warning event sorting, image digest preservation, initial `tailLines: 200`, `follow: true`, and upstream abort when the HTTP client disconnects.

- [ ] **Step 2: Confirm failure**

Run: `bunx vitest run gateway/src/providers/-kubernetes.test.ts`  
Expected: FAIL because `KubernetesProvider` and mappers do not exist.

- [ ] **Step 3: Implement in-cluster Kubernetes access**

Add `@kubernetes/client-node`; load in-cluster config in production and default kubeconfig only when `NODE_ENV !== "production"`. Read nodes, namespaces, Deployments, StatefulSets, DaemonSets, pods, and warning events. Argo Application custom resources remain owned by the Argo provider in Task 7. Never call mutation or exec APIs.

- [ ] **Step 4: Implement SSE log framing**

Each log line is emitted as:

```text
event: line
data: {"line":"2026-08-04T12:00:00Z request complete"}

```

Emit `event: ready` after connecting and `event: error` with a safe message on upstream failure. Abort the Kubernetes request immediately when the downstream signal aborts.

- [ ] **Step 5: Verify provider and gateway regression tests**

Run: `bunx vitest run gateway/src/providers/-kubernetes.test.ts gateway/src/-app.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add gateway package.json bun.lock
git commit -m "feat: read kubernetes health and pod logs"
```

### Task 6: Add Prometheus Resource History

**Files:**
- Create: `gateway/src/providers/prometheus.ts`
- Create: `gateway/src/providers/-prometheus.test.ts`
- Create: `gateway/src/providers/fixtures/prometheus.json`
- Modify: `gateway/src/config.ts`
- Modify: `gateway/src/snapshot.ts`

**Interfaces:**
- Produces: `PrometheusProvider.queryInstant(query: string): Promise<PrometheusVector>`.
- Produces: `PrometheusProvider.queryRange(query, start, end, step): Promise<MetricSeries[]>`.
- Produces: `getResourceHistory(window: "1h" | "6h" | "24h" | "7d"): Promise<ResourceHistory>`.
- Adds current CPU/memory/disk and 24-hour CPU/memory series to `ClusterData`.

- [ ] **Step 1: Write Prometheus response and cache tests**

Assert successful vector/matrix parsing, non-2xx error normalization, five-second timeout, and reuse of a range result for 10 seconds without a second upstream fetch.

- [ ] **Step 2: Confirm failure**

Run: `bunx vitest run gateway/src/providers/-prometheus.test.ts`  
Expected: FAIL because the Prometheus provider does not exist.

- [ ] **Step 3: Implement exact v1 queries**

Use:

```promql
100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))
100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))
100 * (1 - (node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"}))
```

Use one-minute steps for `1h`, two-minute steps for `6h`, five-minute steps for `24h`, and thirty-minute steps for `7d`. Default to `24h`. Keep the Prometheus base URL server-side as `PROMETHEUS_URL`.

- [ ] **Step 4: Wire metrics into health evaluation**

Apply the approved sustained CPU/memory and disk thresholds, preserving missing metrics as Unknown rather than zero.

- [ ] **Step 5: Verify and commit**

Run: `bunx vitest run gateway/src/providers/-prometheus.test.ts shared/homelab/-health-rules.test.ts gateway/src/-snapshot.test.ts`  
Expected: PASS.

```bash
git add gateway shared
git commit -m "feat: add prometheus resource history"
```

### Task 7: Correlate GitHub, Argo CD, Images, and Live Workloads

**Files:**
- Create: `gateway/src/providers/github.ts`
- Create: `gateway/src/providers/argocd.ts`
- Create: `gateway/src/deployment-correlation.ts`
- Create: `gateway/src/providers/-github.test.ts`
- Create: `gateway/src/providers/-argocd.test.ts`
- Create: `gateway/src/-deployment-correlation.test.ts`
- Create: `gateway/src/providers/fixtures/github.json`
- Create: `gateway/src/providers/fixtures/argocd.json`
- Modify: `gateway/src/config.ts`
- Modify: `gateway/src/snapshot.ts`

**Interfaces:**
- Produces: `GitHubProvider.getLatestWorkflow(repo, branch): Promise<WorkflowRun>`.
- Produces: `ArgoProvider.getApplication(name): Promise<ArgoApplicationState>`.
- Produces: `correlateDeployment(input): DeploymentState`.

- [ ] **Step 1: Write correlation matrix tests**

Cover these exact outcomes: matching commit/image/live digest is Healthy; failed latest workflow with previous live version is Warning; Argo OutOfSync with available workload is Warning; Argo Degraded is Critical; expected tag differs from live pods is Warning; zero available replicas is Critical.

- [ ] **Step 2: Confirm failure**

Run: `bunx vitest run gateway/src/providers/-github.test.ts gateway/src/providers/-argocd.test.ts gateway/src/-deployment-correlation.test.ts`  
Expected: FAIL with missing providers and correlator.

- [ ] **Step 3: Implement read-only GitHub requests**

Use `Authorization: Bearer ${GITHUB_READ_TOKEN}`, `X-GitHub-Api-Version: 2022-11-28`, and repository `Isolumi/youtube-mp3`. Read workflow runs and commit metadata only; include the GitHub HTML URL in normalized evidence.

- [ ] **Step 4: Map the live Argo application**

Read `yootoob-mp3-dumachine` from namespace `argocd`, mapping `.status.sync`, `.status.health`, `.status.operationState`, `.status.sync.revision`, and resource health. Do not add an Argo token unless a required approved field is unavailable through the Application custom resource.

- [ ] **Step 5: Correlate both live deployments**

Compare the Git SHA/tag against `yootoob-mp3-api` and `yootoob-mp3-frontend` images in namespace `yootoob-mp3`; report each workload separately and roll them into the application pipeline.

- [ ] **Step 6: Verify and commit**

Run: `bunx vitest run gateway/src/providers gateway/src/-deployment-correlation.test.ts`  
Expected: PASS.

```bash
git add gateway
git commit -m "feat: correlate cicd deployment state"
```

### Task 8: Add the Explicit Service Catalog and Private HTTPS Probes

**Files:**
- Create: `config/homelab-services.yml`
- Create: `gateway/src/service-catalog.ts`
- Create: `gateway/src/service-probe.ts`
- Create: `gateway/src/-service-catalog.test.ts`
- Create: `gateway/src/-service-probe.test.ts`
- Modify: `gateway/src/snapshot.ts`
- Modify: `package.json`
- Modify: `bun.lock`

**Interfaces:**
- Produces: `loadServiceCatalog(path: string): ServiceCatalogEntry[]`.
- Produces: `probeService(entry, signal): Promise<ServiceProbeResult>`.

- [ ] **Step 1: Add the exact initial catalog**

```yml
services:
  - id: yootoob-mp3
    name: yootoob-mp3
    description: Private YouTube MP3 downloader
    url: https://yootoob.doh.lumilumi.xyz
    namespace: yootoob-mp3
    argoApplication: yootoob-mp3-dumachine
    workloads:
      - kind: Deployment
        name: yootoob-mp3-api
      - kind: Deployment
        name: yootoob-mp3-frontend
```

- [ ] **Step 2: Write parsing, timeout, consecutive-failure, latency, and certificate tests**

Assert unknown catalog keys are rejected, one failed probe is Warning, two consecutive failures are Critical, and certificate expiry within 14 days is Warning.

- [ ] **Step 3: Confirm failure**

Run: `bunx vitest run gateway/src/-service-catalog.test.ts gateway/src/-service-probe.test.ts`  
Expected: FAIL because parser and probe modules do not exist.

- [ ] **Step 4: Implement YAML parsing and bounded probes**

Add `yaml`; validate every field with Zod. Probe with a five-second timeout, record response time, and inspect the peer certificate with Node `tls.connect` using the URL hostname and port. Never disable TLS verification.

- [ ] **Step 5: Verify and commit**

Run: `bunx vitest run gateway/src/-service-catalog.test.ts gateway/src/-service-probe.test.ts gateway/src/-snapshot.test.ts`  
Expected: PASS.

```bash
git add config gateway package.json bun.lock
git commit -m "feat: monitor configured private services"
```

### Task 9: Add the Dashboard Homelab Data Layer and Log Proxy

**Files:**
- Create: `src/homelab/homelab.functions.ts`
- Create: `src/homelab/-homelab.functions.test.ts`
- Create: `src/homelab/useHomelabSnapshot.ts`
- Create: `src/homelab/-useHomelabSnapshot.test.tsx`
- Create: `src/routes/api/homelab/logs.$namespace.$pod.ts`
- Create: `src/routes/api/homelab/-logs.test.ts`
- Modify: `.env.example`
- Modify: `vitest.config.ts`

**Interfaces:**
- Produces: `getHomelabOverview`, `getClusterSnapshot`, `getDeploymentSnapshot`, and `getServiceSnapshot` server functions.
- Produces: `useHomelabSnapshot<T>(fetcher, initialData): { snapshot; refreshing; error }`.
- Produces: same-origin SSE endpoint `/api/homelab/logs/:namespace/:pod?container=name`.

- [ ] **Step 1: Write secret-boundary, polling, stale-preservation, and SSE-abort tests**

Assert `GATEWAY_URL` never appears in serialized browser output, refresh fires at 10 seconds without overlap, the last good snapshot remains visible on a failed refresh, and downstream disconnect aborts the gateway fetch.

- [ ] **Step 2: Confirm failure**

Run: `bunx vitest run src/homelab src/routes/api/homelab`  
Expected: FAIL because the Homelab data layer does not exist.

- [ ] **Step 3: Implement server-only gateway calls**

Use `requireServerEnv("GATEWAY_URL")`, a five-second timeout for snapshots, `Cache-Control: no-store`, and schema validation before returning data to the UI.

- [ ] **Step 4: Implement non-overlapping polling**

The hook starts a new request only after the previous request settles, refreshes every 10 seconds while mounted, cancels on unmount, and marks retained data stale when `observedAt` exceeds 30 seconds.

- [ ] **Step 5: Proxy SSE without buffering**

Forward `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and `Connection: keep-alive`; pass the route request’s abort signal upstream and never log returned pod lines in the dashboard server.

- [ ] **Step 6: Verify and commit**

Run: `bunx vitest run src/homelab src/routes/api/homelab && bun run build`  
Expected: PASS.

```bash
git add .env.example src/homelab src/routes/api vitest.config.ts src/routeTree.gen.ts
git commit -m "feat: add homelab dashboard data layer"
```

### Task 10: Add Grouped Navigation and the Homelab Overview

**Files:**
- Create: `src/routes/_layout/homelab/route.tsx`
- Create: `src/routes/_layout/homelab/index.tsx`
- Create: `src/routes/_layout/homelab/-HomelabTabs.tsx`
- Create: `src/routes/_layout/homelab/-HomelabBentoCard.tsx`
- Create: `src/routes/_layout/homelab/-StatusBadge.tsx`
- Create: `src/routes/_layout/homelab/-IssueList.tsx`
- Create: `src/routes/_layout/homelab/-ResourceChart.tsx`
- Create: `src/routes/_layout/homelab/-HomelabOverview.test.tsx`
- Create: `src/routes/_layout/homelab/-HomelabBentoCard.test.tsx`
- Modify: `src/tools/registry.ts`
- Modify: `src/components/AppSidebar.tsx`
- Modify: `src/routes/_layout/index.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Extends `ToolEntry` with `children?: Array<{ id; label; route }>`.
- Produces Homelab routes `/homelab`, `/homelab/cluster`, `/homelab/deployments`, and `/homelab/services`.

- [ ] **Step 1: Write navigation and overview component tests**

Assert Homelab appears once in the sidebar, `/homelab` opens Overview, child tabs are internal, Warning issues sort before Unknown, empty issues say “Nothing needs attention,” and semantic status labels are not color-only.

- [ ] **Step 2: Confirm failure**

Run: `bunx vitest run src/routes/_layout/homelab`  
Expected: FAIL because the Homelab components do not exist.

- [ ] **Step 3: Register the grouped Homelab tool**

```ts
{
  id: "homelab",
  label: "Homelab",
  route: "/homelab",
  icon: Server,
  BentoCard: HomelabBentoCard,
  children: [
    { id: "overview", label: "Overview", route: "/homelab" },
    { id: "cluster", label: "Cluster", route: "/homelab/cluster" },
    { id: "deployments", label: "Deployments", route: "/homelab/deployments" },
    { id: "services", label: "Services", route: "/homelab/services" },
  ],
}
```

- [ ] **Step 4: Build the approved overview**

Render overall status and refresh age, cluster/workload/Argo/issues cards, active issue reasons with expandable evidence, 24-hour CPU/memory charts, recent activity, and compact service links. Use current semantic chart tokens and add only named semantic health tokens to `src/styles.css`.

- [ ] **Step 5: Verify responsive and degraded states**

Run: `bunx vitest run src/routes/_layout/homelab src/tools src/components`  
Expected: PASS.  
Run: `bun run build && bun run lint && bun run fmt:check`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: add homelab navigation and overview"
```

### Task 11: Build the Cluster View and Live Log Panel

**Files:**
- Create: `src/routes/_layout/homelab/cluster.tsx`
- Create: `src/routes/_layout/homelab/-ClusterSummary.tsx`
- Create: `src/routes/_layout/homelab/-PodTable.tsx`
- Create: `src/routes/_layout/homelab/-PodDetail.tsx`
- Create: `src/routes/_layout/homelab/-LiveLogPanel.tsx`
- Create: `src/routes/_layout/homelab/-ClusterView.test.tsx`
- Create: `src/routes/_layout/homelab/-LiveLogPanel.test.tsx`

**Interfaces:**
- Consumes: `ClusterSnapshot` and `/api/homelab/logs/:namespace/:pod` from Task 9.
- Produces: searchable pod table and an EventSource-backed live log panel.

- [ ] **Step 1: Write cluster and log behavior tests**

Assert current/history metrics, `1h`/`6h`/`24h`/`7d` history controls, node conditions, namespace filter, pod search, restart warning, event ordering, container selection, initial 200-line display, pause/resume, auto-scroll toggle, reconnect state, and EventSource closure on panel unmount.

- [ ] **Step 2: Confirm failure**

Run: `bunx vitest run src/routes/_layout/homelab/-ClusterView.test.tsx src/routes/_layout/homelab/-LiveLogPanel.test.tsx`  
Expected: FAIL because Cluster components do not exist.

- [ ] **Step 3: Implement the Cluster route and detail selection**

Use URL search parameters `namespace`, `pod`, and `container` so issue deep-links and refreshes preserve the selected resource. Display raw evidence in a disclosure panel beneath the plain-English reason.

- [ ] **Step 4: Implement bounded browser logs**

Keep at most 2,000 rendered lines in memory, expose Clear/Pause/Resume controls, escape all text through React rendering, and reconnect after 1, 2, 4, 8, then 15 seconds while the panel remains open.

- [ ] **Step 5: Verify and commit**

Run: `bunx vitest run src/routes/_layout/homelab && bun run build`  
Expected: PASS.

```bash
git add src/routes/_layout/homelab src/routeTree.gen.ts
git commit -m "feat: add cluster health and live logs"
```

### Task 12: Build Deployment and Service Views

**Files:**
- Create: `src/routes/_layout/homelab/deployments.tsx`
- Create: `src/routes/_layout/homelab/services.tsx`
- Create: `src/routes/_layout/homelab/-DeploymentPipeline.tsx`
- Create: `src/routes/_layout/homelab/-ServiceCard.tsx`
- Create: `src/routes/_layout/homelab/-DeploymentsView.test.tsx`
- Create: `src/routes/_layout/homelab/-ServicesView.test.tsx`

**Interfaces:**
- Consumes: `DeploymentSnapshot` and `ServiceSnapshot` from Task 9.
- Produces: commit-to-live pipeline and private service catalog UI.

- [ ] **Step 1: Write deployment and service component tests**

Assert commit, workflow, image, Argo, rollout, and live stages; failed CI with healthy old pods displays Warning rather than Critical; mismatch reason is visible; service URL is clickable; certificate expiry and probe latency render; missing source data is Unknown.

- [ ] **Step 2: Confirm failure**

Run: `bunx vitest run src/routes/_layout/homelab/-DeploymentsView.test.tsx src/routes/_layout/homelab/-ServicesView.test.tsx`  
Expected: FAIL because these views do not exist.

- [ ] **Step 3: Implement the pipeline view**

Render stages in this order: Commit, GitHub Actions, GHCR image, Argo CD, K3s rollout, live pods. Each failed/unknown stage shows its source reason and safe external link when one exists.

- [ ] **Step 4: Implement the service catalog view**

Render status, reason, `https://yootoob.doh.lumilumi.xyz`, response time, certificate expiry, namespace, both workload versions, deployment age, related pod count, and Argo app.

- [ ] **Step 5: Verify and commit**

Run: `bunx vitest run src/routes/_layout/homelab && bun run build && bun run lint && bun run fmt:check`  
Expected: PASS.

```bash
git add src/routes/_layout/homelab src/routeTree.gen.ts
git commit -m "feat: add deployments and services views"
```

### Task 13: Add K3s Manifests, Read-Only RBAC, and GitHub Image Builds

**Files:**
- Create: `.github/workflows/build-images.yml`
- Create: `k8s/base/namespace.yml`
- Create: `k8s/base/dashboard-deployment.yml`
- Create: `k8s/base/dashboard-service.yml`
- Create: `k8s/base/gateway-deployment.yml`
- Create: `k8s/base/gateway-service.yml`
- Create: `k8s/base/gateway-rbac.yml`
- Create: `k8s/base/kustomization.yml`
- Create: `k8s/overlays/dumachine/config.yml`
- Create: `k8s/overlays/dumachine/certificate.yml`
- Create: `k8s/overlays/dumachine/ingress.yml`
- Create: `k8s/overlays/dumachine/network-policy.yml`
- Create: `k8s/overlays/dumachine/kustomization.yml`
- Create: `k8s/argocd/dum-dashboard.yml`
- Create: `scripts/check-readonly-rbac.sh`

**Interfaces:**
- Produces namespace `dum-dashboard`, images `ghcr.io/isolumi/dum-dashboard` and `ghcr.io/isolumi/homelab-gateway`, Argo app `dum-dashboard-dumachine`, and TLS secret `dum-dashboard-lumilumi-tls`.

- [ ] **Step 1: Write the RBAC assertion script before manifests**

The script renders `k8s/overlays/dumachine`, extracts gateway rules, fails if verbs include `create|update|patch|delete|deletecollection`, and fails if resources include `pods/exec|pods/attach|pods/portforward|ephemeralcontainers`.

- [ ] **Step 2: Run it and confirm failure**

Run: `bash scripts/check-readonly-rbac.sh`  
Expected: FAIL because the manifests do not exist.

- [ ] **Step 3: Add minimum gateway RBAC**

Grant only `get`, `list`, and `watch` for nodes, namespaces, pods, `pods/log`, events, services, endpoints, deployments, daemonsets, statefulsets, replicasets, ingresses, certificates, and Argo `applications`. Grant no Secret reads and no mutation/exec subresources.

- [ ] **Step 4: Add workloads and private ingress**

Use dashboard port `3000`, gateway port `8080`, ClusterIP services, readiness/liveness endpoints, resource requests/limits, rolling updates, `letsencrypt-prod`, host `dashboard.doh.lumilumi.xyz`, and TLS secret `dum-dashboard-lumilumi-tls`. Mount the service catalog ConfigMap read-only at `/etc/dum-dashboard/services.yml`. The NetworkPolicy restricts gateway ingress to dashboard pods; do not add a default-deny egress policy until K3s API, DNS, Prometheus, GitHub, and private-service destinations have been verified explicitly.

- [ ] **Step 5: Add non-secret and secret configuration references**

Dashboard environment uses `GATEWAY_URL=http://homelab-gateway.dum-dashboard.svc.cluster.local:8080`, Supabase/Calendar values from `dum-dashboard-secrets`, and `OWNER_USER_ID` server-side. Gateway uses `PROMETHEUS_URL=http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090`, catalog path, and `GITHUB_READ_TOKEN` from `homelab-gateway-secrets`.

- [ ] **Step 6: Add the two-image GitHub Actions workflow**

Trigger on pushes to `v1`, ignore only `k8s/overlays/dumachine/kustomization.yml`, run tests/lint/build, authenticate to GHCR, build and push both Dockerfiles with `${GITHUB_SHA}`, replace both `newTag:` values in the dumachine overlay, commit only that overlay, and push with `[skip ci]`.

- [ ] **Step 7: Render and validate**

Run: `kubectl kustomize k8s/overlays/dumachine > /tmp/dum-dashboard-rendered.yml`  
Run: `bash scripts/check-readonly-rbac.sh`  
Run: `kubectl apply --dry-run=client -f /tmp/dum-dashboard-rendered.yml`  
Expected: all commands exit 0; rendered files contain no mutation verbs or plaintext secrets.

- [ ] **Step 8: Commit**

```bash
git add .github k8s scripts
git commit -m "deploy: add dumachine gitops manifests"
```

### Task 14: Install Prometheus Through Argo CD and Complete End-to-End Verification

**Files:**
- Create: `k8s/argocd/prometheus.yml`
- Create: `k8s/argocd/prometheus-values.yml`
- Create: `docs/homelab-dashboard-operations.md`
- Modify: `README.md`

**Interfaces:**
- Produces Argo app `kube-prometheus-stack` in namespace `monitoring` using chart `86.0.1`.
- Produces a copyable operator runbook for secrets, bootstrap, verification, and rollback.

- [ ] **Step 1: Add the pinned Prometheus Argo application**

Use an Argo multi-source Application: the first source is official repo `https://prometheus-community.github.io/helm-charts`, chart `kube-prometheus-stack`, version `86.0.1`, with value file `$values/k8s/argocd/prometheus-values.yml`; the second source is `https://github.com/Isolumi/dum-dashboard`, revision `v1`, with `ref: values`. Enable automated prune/self-heal and namespace creation. Disable Grafana and Alertmanager for v1, disable K3s-inaccessible etcd/controller-manager/scheduler scrapes, retain metrics for seven days, and set Prometheus requests of `250m` CPU/`512Mi` memory and limits of `1` CPU/`2Gi` memory.

- [ ] **Step 2: Write the operations runbook**

Include these exact zsh-safe secret commands, followed by Argo inspection, private DNS/HTTPS, direct `kubectl` comparison, and Git-revert rollback commands:

```zsh
kubectl create namespace dum-dashboard --dry-run=client -o yaml | kubectl apply -f -

read -s "SUPABASE_SECRET_KEY?Supabase secret key: "; echo
read "OWNER_USER_ID?Supabase owner UUID: "
read "GOOGLE_CLIENT_ID?Google client ID: "
read -s "GOOGLE_CLIENT_SECRET?Google client secret: "; echo
read -s "GOOGLE_TOKEN_ENCRYPTION_KEY?Calendar encryption key: "; echo
kubectl -n dum-dashboard create secret generic dum-dashboard-secrets \
  --from-literal=SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" \
  --from-literal=OWNER_USER_ID="$OWNER_USER_ID" \
  --from-literal=GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  --from-literal=GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
  --from-literal=GOOGLE_TOKEN_ENCRYPTION_KEY="$GOOGLE_TOKEN_ENCRYPTION_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

read -s "GITHUB_READ_TOKEN?Read-only GitHub token: "; echo
kubectl -n dum-dashboard create secret generic homelab-gateway-secrets \
  --from-literal=GITHUB_READ_TOKEN="$GITHUB_READ_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

unset SUPABASE_SECRET_KEY OWNER_USER_ID GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET \
  GOOGLE_TOKEN_ENCRYPTION_KEY GITHUB_READ_TOKEN

kubectl -n argocd get applications dum-dashboard-dumachine kube-prometheus-stack
dig +short dashboard.doh.lumilumi.xyz
curl --fail --show-error https://dashboard.doh.lumilumi.xyz
kubectl get nodes
kubectl -n yootoob-mp3 get deployments,pods

deploy_commit="$(git log -n 1 --format=%H -- k8s/overlays/dumachine/kustomization.yml)"
git revert "$deploy_commit"
git push origin v1
```

- [ ] **Step 3: Run the complete local quality gate**

Run: `bun run test && bun run lint && bun run fmt:check && bun run build && bun run build:gateway`  
Expected: all commands exit 0.  
Run: `kubectl kustomize k8s/overlays/dumachine >/tmp/dum-dashboard-rendered.yml && bash scripts/check-readonly-rbac.sh`  
Expected: both commands exit 0.

- [ ] **Step 4: Bootstrap through GitOps**

After the required Secrets exist, apply only the Argo Application manifests:

```bash
kubectl apply -f k8s/argocd/prometheus.yml
kubectl apply -f k8s/argocd/dum-dashboard.yml
```

Wait for Argo CD to report both applications Synced and Healthy; do not manually apply rendered application workloads.

- [ ] **Step 5: Verify the live acceptance criteria**

Run read-only checks for pod readiness/restarts, `curl --fail https://dashboard.doh.lumilumi.xyz`, certificate issuer/expiry, gateway ClusterIP-only exposure, Prometheus target health, and Argo state. In the browser verify no login prompt, 10-second refresh, Overview/Cluster/Deployments/Services, the `yootoob-mp3` commit-to-live mapping, service link, stale-source behavior, and opening/closing a live pod log stream.

- [ ] **Step 6: Run final regression and security review**

Confirm no browser bundle contains `GITHUB_READ_TOKEN`, `SUPABASE_SECRET_KEY`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY`, or Kubernetes credentials. Confirm the gateway ServiceAccount cannot create a ConfigMap and cannot exec into a pod using `kubectl auth can-i --as=system:serviceaccount:dum-dashboard:homelab-gateway`.

- [ ] **Step 7: Commit**

```bash
git add k8s/argocd README.md docs/homelab-dashboard-operations.md
git commit -m "docs: add homelab dashboard operations"
```

## Final Review Gate

Before merging or pushing the implementation branch:

1. Use `superpowers:requesting-code-review` for a spec-compliance and code-quality review.
2. Fix every accepted Critical or Important finding with focused tests.
3. Re-run the complete Task 14 quality gate.
4. Use `superpowers:verification-before-completion` before claiming the dashboard is complete or healthy.
5. Use `superpowers:finishing-a-development-branch` to choose merge, PR, or branch-preservation handling without touching unrelated user changes.
