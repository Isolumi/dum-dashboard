# Dum Dashboard

A private, Tailscale-only personal dashboard for dumachine. Its Homelab section combines K3s,
Argo CD, GitHub Actions, GHCR, Prometheus, private service probes, and live pod logs in one read-only
interface.

## Homelab views

- **Overview:** cluster and workload health, active issues, resources, activity, and services.
- **Cluster:** nodes, namespaces, workloads, pods, resource history, pod details, and live logs.
- **Deployments:** commit-to-live evidence across GitHub Actions, GHCR, Argo CD, K3s, and pods.
- **Services:** private HTTPS endpoints, latency, certificates, Argo health, versions, and pod count.

The browser talks only to the dashboard's same-origin server. A separate ClusterIP-only gateway
holds Kubernetes, Argo, Prometheus, GitHub, and service-probe access. Its Kubernetes ServiceAccount
is read-only and cannot read Secrets, mutate resources, or exec into pods.

## Local development

Requirements: Bun 1.3.14+, Docker for image checks, and `kubectl` for manifest rendering.

```bash
bun install --frozen-lockfile
bun run dev
```

The application listens on `http://localhost:3000`.

## Quality checks

```bash
bun run test
bun run lint
bun run fmt:check
bun run build
bun run build:gateway
kubectl kustomize k8s/overlays/dumachine >/tmp/dum-dashboard-rendered.yml
bash scripts/check-readonly-rbac.sh
bash scripts/check-tailnet-boundary.sh
```

## Deployment

Changes enter the protected `v1` branch through a passing pull request. GitHub Actions builds two
immutable SHA-tagged images, then updates the bot-managed `deploy` branch watched by Argo CD:

- `ghcr.io/isolumi/dum-dashboard`
- `ghcr.io/isolumi/homelab-gateway`

It then updates only `k8s/overlays/dumachine/kustomization.yml`; Argo CD performs the rollout.
Application workloads should not be applied manually. The separate
`k8s/bootstrap/traefik-tailscale-only.yml` cluster setting restricts Traefik to Tailscale's IPv4
range; private DNS alone is not treated as access control.

See [Homelab Dashboard Operations](docs/homelab-dashboard-operations.md) for copyable Secret setup,
GitOps bootstrap, verification, security checks, and rollback commands.

## Main directories

- `src/routes/_layout/homelab/` — React Homelab views.
- `gateway/` — read-only cluster and external-source gateway.
- `shared/homelab/` — exact contracts and health rules.
- `k8s/base/` — reusable dashboard and gateway resources.
- `k8s/overlays/dumachine/` — dumachine configuration, HTTPS, and network policy.
- `k8s/argocd/` — Argo CD Applications and Prometheus values.
- `k8s/bootstrap/` — explicitly applied cluster-level security bootstrap.
