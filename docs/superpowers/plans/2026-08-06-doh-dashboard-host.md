# Doh Dashboard Host Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the private dashboard to `https://doh.lumilumi.xyz` and leave the old dashboard hostname without a route or redirect.

**Architecture:** Make one GitOps cutover in the dumachine Kustomize overlay. The Ingress and cert-manager Certificate will use only the apex hostname; the existing service, Argo application, and TLS Secret name remain unchanged.

**Tech Stack:** Kubernetes, Kustomize, Argo CD, Traefik, cert-manager, Bash, Bun/Vitest

## Global Constraints

- Brief downtime during certificate reissuance is acceptable.
- `dashboard.doh.lumilumi.xyz` must not redirect or serve the dashboard after cutover.
- Access remains Tailscale-only with no application login.
- A configured Google web client must allow
  `https://doh.lumilumi.xyz/calendar/oauth/callback` as an exact authorized redirect URI.
- Do not modify the user's dirty main checkout; use the existing isolated worktree.

---

### Task 1: Enforce and implement the apex hostname

**Files:**

- Modify: `scripts/check-readonly-rbac.sh`
- Modify: `k8s/overlays/dumachine/ingress.yml`
- Modify: `k8s/overlays/dumachine/certificate.yml`
- Modify: `docs/homelab-dashboard-operations.md`
- Modify: `src/lib/-server-auth.test.ts`
- Modify: `src/routes/api/homelab/-logs.test.ts`
- Modify: `src/routes/_layout/calendar/-calendar.functions.test.ts`

**Interfaces:**

- Consumes: rendered resources from `kubectl kustomize k8s/overlays/dumachine`
- Produces: one Ingress rule/TLS host and one Certificate DNS name, all exactly `doh.lumilumi.xyz`

- [ ] **Step 1: Add a failing rendered-manifest assertion**

Extend the Bun validation inside `scripts/check-readonly-rbac.sh` after the ClusterIP service checks:

```ts
const dashboardHost = "doh.lumilumi.xyz";
const retiredDashboardHost = "dashboard.doh.lumilumi.xyz";
const dashboardTlsSecret = "dum-dashboard-lumilumi-tls";
const dashboardIngressResource = find(normal, "Ingress", "dum-dashboard");
const dashboardCertificate = find(normal, "Certificate", "dum-dashboard-lumilumi");
if (
  JSON.stringify(normal).includes(retiredDashboardHost) ||
  dashboardIngressResource?.spec?.rules?.length !== 1 ||
  dashboardIngressResource.spec.rules[0]?.host !== dashboardHost ||
  dashboardIngressResource?.spec?.tls?.length !== 1 ||
  !same(dashboardIngressResource.spec.tls[0]?.hosts ?? [], [dashboardHost]) ||
  dashboardIngressResource.spec.tls[0]?.secretName !== dashboardTlsSecret ||
  !same(dashboardCertificate?.spec?.dnsNames ?? [], [dashboardHost]) ||
  dashboardCertificate?.spec?.secretName !== dashboardTlsSecret
) {
  fail("Dashboard Ingress and Certificate must use only the approved host and TLS Secret.");
}
```

- [ ] **Step 2: Run the boundary check and verify RED**

Run: `bash scripts/check-readonly-rbac.sh`

Expected: exit 1 with `Dashboard Ingress and Certificate must use only the approved host and TLS Secret.` because the rendered manifests still use `dashboard.doh.lumilumi.xyz`.

- [ ] **Step 3: Change the active Kubernetes hostname**

In `k8s/overlays/dumachine/ingress.yml`, replace both the TLS host and rule host with
`doh.lumilumi.xyz`. In `k8s/overlays/dumachine/certificate.yml`, make `spec.dnsNames` contain only
`doh.lumilumi.xyz`. Keep `dum-dashboard-lumilumi-tls` unchanged.

- [ ] **Step 4: Update current operational examples**

Replace active dashboard URL examples in the operations runbook and request-origin fixtures with
`https://doh.lumilumi.xyz`. Keep the cutover design document's references to the retired hostname
because they document the intentional removal.

Assert that Calendar OAuth generated from the new request origin contains the exact redirect URI
`https://doh.lumilumi.xyz/calendar/oauth/callback`, and document that URI as a Google web-client
prerequisite.

- [ ] **Step 5: Verify GREEN and run the complete local gate**

Run:

```zsh
bash scripts/check-readonly-rbac.sh
bun run test
bun run lint
bun run fmt:check
bunx tsc --noEmit
bun run build:gateway
bun run build
git diff --check
```

Expected: boundary validation passes; 516 or more tests pass; lint, formatting, TypeScript, both builds, and diff checks exit 0.

- [ ] **Step 6: Commit the implementation**

```zsh
git add scripts/check-readonly-rbac.sh k8s/overlays/dumachine/ingress.yml \
  k8s/overlays/dumachine/certificate.yml docs/homelab-dashboard-operations.md \
  src/lib/-server-auth.test.ts src/routes/api/homelab/-logs.test.ts \
  src/routes/_layout/calendar/-calendar.functions.test.ts
git commit -m "feat: move dashboard to doh apex"
```

### Task 2: Review, merge, and verify the live cutover

**Files:**

- Verify: `.github/workflows/build-images.yml`
- Verify: `k8s/argocd/dum-dashboard.yml`
- Verify: `scripts/check-tailnet-boundary.sh`

**Interfaces:**

- Consumes: protected `v1` merge and generated `deploy` branch revision
- Produces: live HTTPS dashboard at `doh.lumilumi.xyz`; no dashboard route at the retired hostname

- [ ] **Step 1: Push and open the pull request**

```zsh
git push -u origin feat/doh-dashboard-host
gh pr create --base v1 --head feat/doh-dashboard-host \
  --title "Move dashboard to doh.lumilumi.xyz" \
  --body "Replace the dashboard Ingress and certificate hostname with the doh apex and retire the old dashboard hostname."
```

- [ ] **Step 2: Wait for required review and CI**

Run `gh pr checks --required --watch` and address every actionable unresolved review thread. Merge
only after the required `verify` check passes and all review conversations are resolved.

- [ ] **Step 3: Follow the post-merge GitOps pipeline**

Watch the `v1` push workflow through `verify`, `build-and-push`, and `update-tags`. Refresh
`dum-dashboard-dumachine` in Argo and wait until its exact `deploy` revision is `Synced` and
`Healthy`.

- [ ] **Step 4: Verify certificate and routes**

Run:

```zsh
kubectl -n dum-dashboard wait certificate/dum-dashboard-lumilumi \
  --for=condition=Ready --timeout=300s
scripts/check-tailnet-boundary.sh doh.lumilumi.xyz
curl --fail --show-error https://doh.lumilumi.xyz/homelab
test "$(curl --insecure --silent --output /dev/null --write-out '%{http_code}' \
  --max-redirs 0 https://dashboard.doh.lumilumi.xyz)" = "404"
```

Expected: the new route succeeds through Tailscale and is blocked through the LAN address; the old
route returns exactly HTTP 404 without following redirects. `--insecure` is intentional for this
negative check because the retired hostname is no longer included in the dashboard certificate.

- [ ] **Step 5: Verify in a real browser**

Load `https://doh.lumilumi.xyz/homelab` and every Homelab child tab. Confirm no login prompt,
certificate warning, critical UI marker, or JavaScript runtime error appears.
