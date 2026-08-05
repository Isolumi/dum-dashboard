# Homelab Dashboard

**Date:** 2026-08-04  
**Status:** Approved

## Goal

Extend the existing Dum Dashboard into a personal, modular “everything dashboard” whose first new group is **Homelab**. The Homelab area provides a read-only view of the health, resource usage, deployments, services, and live pod logs for the single K3s cluster on `dumachine`.

The dashboard must answer these questions quickly:

1. Is the homelab healthy?
2. If not, what needs attention and why?
3. Did a pushed commit build, sync through Argo CD, and reach the running cluster?
4. What services are running, and where can they be opened?

The design must preserve the existing dashboard tools and modular registry while leaving room for unrelated future groups and tools.

## Approved Product Decisions

- Build on the existing `dum-dashboard` application.
- Keep Homelab as one main sidebar group with internal tabs.
- Use the internal tabs **Overview**, **Cluster**, **Deployments**, and **Services**.
- Support `dumachine` only in v1.
- Restrict dashboard access to Tailscale; do not show an application login screen.
- Keep all Homelab capabilities read-only in v1.
- Refresh snapshots automatically every 10 seconds.
- Show opinionated `Healthy`, `Warning`, `Critical`, or `Unknown` statuses with plain-English explanations and expandable raw evidence.
- Include current and historical CPU and memory data using Prometheus.
- Include live streaming pod logs.
- Show alerts only inside the dashboard in v1.
- Deploy the dashboard itself to K3s using the same GitHub Actions, GHCR, Kustomize, and Argo CD GitOps pattern as other homelab applications.
- Use private HTTPS at `dashboard.doh.lumilumi.xyz`.

## Scope

### In scope

- A Homelab summary card on the dashboard’s main overview.
- A grouped Homelab sidebar entry and nested Homelab routes.
- Cluster, workload, pod, event, deployment, CI/CD, service, certificate, and resource-history visibility.
- Correlation from Git commit through GitHub Actions, image tag, Argo CD revision, and live Kubernetes workload.
- On-demand server-sent event streams for pod logs.
- Tailscale-only deployment of the dashboard and its internal gateway on `dumachine`.
- Migration of existing personal-tool server access so the dashboard can open without a visit-time login.

### Out of scope

- Mutating Kubernetes or Argo CD resources.
- Restart, rollback, resync, scale, delete, shell/exec, or configuration-edit controls.
- Multiple K3s clusters or nodes beyond `dumachine`.
- Public dashboard access.
- Discord, email, browser-push, or other external alert delivery.
- Long-term log storage, search, or log analytics.
- Replacing Supabase for existing personal tools.
- Building a general observability platform to replace Prometheus, Argo CD, or GitHub Actions.

## Information Architecture

The existing tool registry remains the source of truth for top-level navigation and overview cards. It is extended to represent grouped tools with child routes.

```text
Dashboard
├── Overview
├── Todos
├── Calendar
└── Homelab
    ├── Overview
    ├── Cluster
    ├── Deployments
    └── Services
```

Selecting **Homelab** opens its Overview. The four child routes appear as top tabs inside the Homelab page rather than four top-level sidebar items. A warning selected from any Homelab view deep-links to the relevant tab and resource.

## User Interface

### Main dashboard overview

Homelab appears as another modular bento card. It shows the rolled-up health status, node readiness, healthy workload count, active issue count, and last successful refresh. Selecting the card opens the Homelab Overview.

### Homelab Overview

The first view is optimized for triage rather than exhaustive data. It contains:

- Overall Homelab status and last refresh time.
- Summary cards for cluster health, workload readiness, Argo CD sync, and active issues.
- A prioritized issues list when anything is Warning, Critical, or Unknown.
- Current CPU and memory values plus default 24-hour history charts.
- Recent activity, including deployments, failed workflows, certificate changes, and important cluster events.
- A compact service list with health and direct private HTTPS links.

If there are no active issues, the issues area explicitly says that nothing needs attention. It does not disappear and leave ambiguous empty space.

### Cluster

The Cluster tab contains:

- `dumachine` readiness and node conditions.
- Current CPU, memory, and disk usage.
- CPU and memory history with selectable time windows.
- Namespace and workload health summaries.
- Searchable/filterable pod table with readiness, status, age, restart count, node, and image.
- Recent Kubernetes warning events.
- Pod detail with containers, conditions, image digests, restart reasons, and raw status evidence.
- On-demand live logs with container selection, pause/resume, auto-scroll control, and reconnect state.

The initial log stream returns the latest 200 lines and then follows new output. Closing the panel closes the upstream Kubernetes log connection. Logs are not persisted by the dashboard.

### Deployments

The Deployments tab presents each application as a pipeline:

```text
Commit -> GitHub Actions -> GHCR image -> Argo CD revision -> K3s rollout -> live pods
```

For each application it shows:

- Repository, branch, commit SHA, message, author, and timestamp.
- Latest relevant GitHub Actions workflow status, conclusion, duration, and link.
- Expected image tag/digest from the GitOps manifests.
- Argo CD sync status, health status, operation result, revision, and last transition.
- Kubernetes deployment revision, available replicas, rollout state, and live pod image digests.
- Whether the expected commit/image matches what is currently running.
- A plain-English failure explanation and a link to the source system when correlation breaks.

The dashboard must distinguish a failed new deployment from a currently unavailable service. A failed CI run produces a deployment Warning while the still-running previous version may remain Healthy.

### Services

The Services tab is the private application catalog. Each service displays:

- Friendly name and description.
- Current health and reason.
- Clickable private HTTPS URL.
- Reachability and response time.
- TLS certificate expiry.
- Kubernetes namespace and owning workload.
- Current image version/digest and deployment age.
- Related pods, deployment, and Argo CD application.

Service discovery is configuration-assisted rather than inferred blindly. A small checked-in catalog maps friendly service names to URLs and Kubernetes/Argo resources; live state enriches those entries. This avoids displaying internal Kubernetes services that are not user-facing applications.

## Health Model

Every monitored resource receives one of four statuses:

| Status     | Meaning                                                                              |
| ---------- | ------------------------------------------------------------------------------------ |
| `Healthy`  | Expected state is ready, synced, reachable, and within normal thresholds.            |
| `Warning`  | Degraded or needing attention, but the current service is still usable.              |
| `Critical` | Unavailable, expired, or unable to satisfy its expected state.                       |
| `Unknown`  | Health cannot be established because source data is missing, stale, or unauthorized. |

Each computed status includes:

- A stable rule identifier.
- A short, plain-English reason.
- The observation timestamp.
- The contributing source and resource.
- Structured raw evidence for an expandable details view.

### Initial deterministic rules

- Node `Ready=False` or `Ready=Unknown`: Critical.
- Desired workload with zero available replicas: Critical.
- Workload with some but not all desired replicas: Warning.
- Crash loop, image pull failure, or repeated failed scheduling: Critical when unavailable; otherwise Warning.
- Container restart count increasing repeatedly within 15 minutes: Warning.
- Argo CD `Degraded`: Critical.
- Argo CD `OutOfSync` while the current workload remains available: Warning.
- Latest deployment workflow failed: Warning for deployment state, without automatically marking the running service Critical.
- Configured service endpoint unreachable across two consecutive refreshes: Critical.
- TLS certificate expired: Critical; expiring within 14 days: Warning.
- CPU or memory above 85% for five minutes: Warning; above 95% for five minutes: Critical.
- Disk above 90%: Warning; above 97%: Critical.
- Source observation older than 30 seconds: Unknown for source-dependent state.

Thresholds live in typed server-side configuration so they can be adjusted without changing UI code. Overall status is the worst active status among its children, ordered `Critical`, `Warning`, `Unknown`, `Healthy`; however, Unknown is shown separately from a proven failure in issue sorting and visual treatment.

## System Architecture

```text
Browser on tailnet
    |
    | HTTPS, no app login
    v
dum-dashboard (TanStack Start on K3s)
    |
    | internal HTTP/SSE only
    v
Homelab Gateway (ClusterIP, no Ingress)
    |-- Kubernetes API
    |-- Argo CD Application resources
    |-- Prometheus HTTP API
    `-- GitHub API
```

### Dashboard application

The TanStack Start application owns page rendering, route-level loading, browser polling, charts, and the public server endpoints consumed by its own UI. Browser code never receives Kubernetes, GitHub, Argo CD, Prometheus, Supabase admin, or infrastructure credentials.

The current Cloudflare Worker runtime is replaced for this deployment with a K3s-compatible server runtime and container image. Existing Cloudflare-specific environment access is refactored behind runtime-neutral server configuration. Existing tools and Supabase remain part of the same application.

### Homelab Gateway

The gateway is a separate internal TypeScript service in the same repository. It provides normalized read-only APIs and isolates infrastructure-specific clients from the dashboard UI.

Providers are independent adapters:

- **Kubernetes provider:** nodes, namespaces, workloads, pods, events, custom resources, and log streams.
- **Argo CD provider:** Argo Application custom resources and operation state, using Kubernetes API access where sufficient. A separate Argo token is added only if a required field is unavailable through the Application resources.
- **Prometheus provider:** instant and range queries for resource metrics.
- **GitHub provider:** workflow, commit, and repository metadata using a separate read-only credential.
- **Service probe provider:** bounded HTTPS checks against explicitly configured private service URLs.

Provider results are normalized before health rules run. One failed provider cannot prevent successful providers from returning data.

### API shape

The dashboard server proxies these internal gateway capabilities:

- `GET /overview`
- `GET /cluster`
- `GET /deployments`
- `GET /services`
- `GET /pods/:namespace/:pod`
- `GET /pods/:namespace/:pod/logs?container=...` using server-sent events

Snapshot responses use a common envelope:

```ts
interface Snapshot<T> {
  data: T | null;
  status: "healthy" | "warning" | "critical" | "unknown";
  observedAt: string;
  stale: boolean;
  issues: HealthIssue[];
  sources: SourceState[];
}
```

The browser polls snapshot endpoints every 10 seconds. Requests are deduplicated per page, cancelled when navigating away, and do not overlap if a prior request is still running.

## Access and Security

### Tailscale-only access

- `dashboard.doh.lumilumi.xyz` resolves through the existing Tailscale-restricted DNS setup to `dumachine`.
- Traefik serves the dashboard through private HTTPS using the existing cert-manager and Cloudflare DNS-01 certificate flow.
- The dashboard has no public ingress path and no application login screen.
- Tailnet ACLs are the primary access boundary. Anyone allowed by those ACLs to reach the dashboard can use the personal tools and view Homelab data.

### Existing Google login and personal data

The current route-level Google/Supabase login gate is removed. This is distinct from Google Calendar authorization:

- Visiting the dashboard requires no Google login.
- Connecting or reconnecting Google Calendar may still open Google’s one-time OAuth consent flow.
- Existing Supabase operations move behind server-only functions that act on the configured single owner account.
- The Supabase secret key and fixed owner identifier remain server-only.
- Client-side realtime subscriptions may use a narrowly scoped publishable-key path, but must not receive admin credentials. If existing row-level security cannot safely support no-login realtime, v1 uses polling for those personal tools until a server-mediated realtime channel is added.

Because removing the login also removes per-request user identity, all state-changing personal-tool endpoints must validate same-origin requests and remain inaccessible outside the Tailscale-only deployment. Homelab endpoints remain read-only regardless.

### Infrastructure credentials

- The gateway uses a dedicated Kubernetes ServiceAccount with the minimum read/watch permissions required for the listed resources and pod logs.
- It receives no verbs for create, update, patch, delete, exec, attach, port-forward, or ephemeral containers.
- The GitHub credential is separate from build/push credentials and has read-only repository metadata and Actions access.
- Prometheus is reached by ClusterIP.
- Gateway and dashboard secrets are injected from Kubernetes Secrets and never committed to Git or included in browser bundles.
- The gateway has no Ingress and is reachable only as an internal ClusterIP service.

## Refresh, Caching, and Failure Handling

- Visible snapshot data refreshes every 10 seconds.
- Expensive Prometheus range queries may be cached server-side for one refresh interval.
- Data older than 30 seconds is visibly marked stale and cannot produce a Healthy result.
- Source failures include the reason, last successful observation, and retry state.
- A failed source degrades only dependent fields; unrelated tabs and cards remain usable.
- Snapshot requests use bounded timeouts and backoff after repeated failures.
- Log streams reconnect with bounded exponential backoff and display connection state.
- The UI preserves the last good value while clearly marking it stale instead of replacing it with zero.
- Loading, empty, disconnected, unauthorized, stale, and partial-failure states are designed explicitly.

## Deployment Design

The repository produces two runtime images:

1. `dum-dashboard` for the TanStack Start application.
2. `homelab-gateway` for the internal read-only service.

The GitOps flow is:

```text
Push -> GitHub Actions -> GHCR -> Kustomize image tags -> Argo CD -> K3s rollout
```

Kubernetes manifests use `.yml` consistently and include:

- Dashboard Deployment and ClusterIP Service.
- Gateway Deployment, ClusterIP Service, ServiceAccount, Role/ClusterRole, and bindings.
- Dashboard Ingress and cert-manager certificate configuration for `dashboard.doh.lumilumi.xyz`.
- ConfigMaps for non-secret health thresholds and the service catalog.
- Secret references for server-only credentials.
- Resource requests/limits, readiness probes, liveness probes, and rolling-update settings.
- NetworkPolicy where supported, allowing gateway traffic only from the dashboard and required infrastructure endpoints.

Prometheus is installed and managed as a separate chart-based Argo CD application. The dashboard consumes it as a dependency rather than owning its lifecycle.

## Testing and Verification

### Automated tests

- Unit tests for every deterministic health rule and roll-up behavior.
- Provider contract tests using recorded fixtures for Kubernetes, Argo CD resources, Prometheus, and GitHub.
- Gateway integration tests proving partial provider failure still returns valid partial snapshots.
- RBAC tests or manifest assertions proving forbidden mutation and exec verbs are absent.
- Dashboard server tests proving secrets never appear in serialized responses.
- Component tests for all four statuses and loading, stale, empty, and partial-failure states.
- Deployment-correlation tests for successful, failed-CI, out-of-sync, rollout-failed, and version-mismatch paths.
- SSE tests for initial tail, follow mode, disconnect cleanup, and reconnect behavior.
- Existing dashboard regression tests for Todos, Calendar, Clock, navigation, and the overview.
- Kustomize render validation and Kubernetes schema validation for all manifests.

### Deployment verification

- Argo CD reports both dashboard workloads Synced and Healthy.
- Dashboard and gateway pods are Ready with no unexpected restarts.
- `dashboard.doh.lumilumi.xyz` resolves only through the intended Tailscale DNS path and presents a valid certificate.
- The dashboard opens without an application login prompt from an authorized tailnet device.
- It is unreachable from a device outside the tailnet path.
- Live cluster values match direct read-only `kubectl`, Argo CD, Prometheus, and GitHub checks.
- A controlled provider outage produces Unknown/stale UI without blanking unaffected data.
- Closing a live-log panel terminates the corresponding upstream stream.

## Future Extensions

The gateway/provider boundary supports future Homelab features such as additional clusters, external alert delivery, persistent logs, and carefully gated actions. Mutating actions require a separate design with explicit confirmation, audit logging, stricter authorization, and narrower write credentials; they are not incremental toggles on the v1 read-only gateway.

The grouped registry pattern also allows unrelated future dashboard groups without coupling them to Homelab infrastructure.

## Success Criteria

The first release is successful when the user can open `dashboard.doh.lumilumi.xyz` over Tailscale without logging in, understand the current health of `dumachine` within a few seconds, trace the latest `yootoob-mp3` deployment from commit to live pods, open private service URLs, inspect historical resources, and stream pod logs—all without the dashboard holding any Kubernetes mutation capability.
