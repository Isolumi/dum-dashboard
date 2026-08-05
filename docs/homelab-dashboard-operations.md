# Homelab Dashboard Operations

This runbook deploys the dashboard through Argo CD. Application workloads are never applied by
hand.

## Prerequisites

- A pull request has passed CI and merged into `v1`; the image workflow has updated `deploy`.
- `kubectl` points at dumachine.
- Argo CD, cert-manager, `letsencrypt-prod`, Traefik, and private Tailscale DNS are working.
- A classic GitHub PAT with `read:packages` for the `ghcr-pull` Secret.
- Optional: a read-only GitHub token increases API limits. Public deployment evidence works without
  one; private repositories require a fine-grained token with Contents read and Actions read.

## 1. Enforce the tailnet boundary

Private DNS is not access control. K3s ServiceLB otherwise opens Traefik on every node interface, so
apply the cluster bootstrap setting that limits all HTTP/HTTPS ingress to Tailscale's IPv4 range:

```zsh
kubectl apply -f k8s/bootstrap/traefik-tailscale-only.yml
kubectl -n kube-system get service traefik \
  -o jsonpath='{.spec.loadBalancerSourceRanges}{"\n"}'
```

The second command must print `["100.64.0.0/10"]`. Verify a current private site works through the
Tailscale IP and is unreachable through dumachine's LAN IP:

```zsh
scripts/check-tailnet-boundary.sh
```

The dashboard's NetworkPolicy separately permits its pod to receive traffic only from Traefik.

## 2. Create runtime Secrets

Run this exact block in zsh. Input is hidden where it contains a secret, and the variables are
removed from the shell afterward.

```zsh
kubectl create namespace dum-dashboard --dry-run=client -o yaml | kubectl apply -f -

read "GHCR_USER?GitHub username: "
read -s "GHCR_PULL_TOKEN?GHCR read:packages token: "; echo
kubectl -n dum-dashboard create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username="$GHCR_USER" \
  --docker-password="$GHCR_PULL_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

read "SUPABASE_URL?Supabase project URL: "
read -s "SUPABASE_SECRET_KEY?Supabase secret key: "; echo
read "OWNER_USER_ID?Supabase owner UUID: "
read "GOOGLE_CLIENT_ID?Google client ID: "
read -s "GOOGLE_CLIENT_SECRET?Google client secret: "; echo
read -s "GOOGLE_TOKEN_ENCRYPTION_KEY?Calendar encryption key: "; echo
kubectl -n dum-dashboard create secret generic dum-dashboard-secrets \
  --from-literal=SUPABASE_URL="$SUPABASE_URL" \
  --from-literal=SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" \
  --from-literal=OWNER_USER_ID="$OWNER_USER_ID" \
  --from-literal=GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  --from-literal=GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
  --from-literal=GOOGLE_TOKEN_ENCRYPTION_KEY="$GOOGLE_TOKEN_ENCRYPTION_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n dum-dashboard create secret generic homelab-gateway-secrets \
  --dry-run=client -o yaml | kubectl apply -f -

unset GHCR_USER GHCR_PULL_TOKEN SUPABASE_URL SUPABASE_SECRET_KEY OWNER_USER_ID GOOGLE_CLIENT_ID \
  GOOGLE_CLIENT_SECRET GOOGLE_TOKEN_ENCRYPTION_KEY
```

## 3. Bootstrap the restricted Argo boundaries

From the repository root:

```zsh
kubectl apply -f k8s/argocd/dum-dashboard-bootstrap-project.yml
kubectl apply -f k8s/argocd/dum-dashboard-project.yml
kubectl apply -f k8s/argocd/prometheus-project.yml
kubectl apply -f k8s/argocd/dum-dashboard-bootstrap.yml

kubectl -n argocd patch application dum-dashboard-bootstrap --type=merge \
  --patch='{"operation":{"sync":{"revision":"v1"}}}'
kubectl -n argocd wait application/dum-dashboard-bootstrap \
  --for=jsonpath='{.status.sync.status}'=Synced --timeout=120s

# CoreDNS only discovers a newly created optional coredns-custom volume after its pod restarts.
kubectl -n kube-system rollout restart deployment/coredns
kubectl -n kube-system rollout status deployment/coredns --timeout=120s

kubectl apply -f k8s/argocd/prometheus.yml
kubectl apply -f k8s/argocd/dum-dashboard.yml
```

The manually synchronized bootstrap application owns the namespace, reviewed read-only RBAC, and
the private CoreDNS route that sends `*.doh.lumilumi.xyz` to in-cluster Traefik. The normal
dashboard and monitoring applications use separate restricted projects. Do not run `kubectl apply`
against `k8s/base`, `k8s/overlays`, or `k8s/bootstrap/dum-dashboard`; Argo CD owns those resources.

Watch all applications until they report `Synced` and `Healthy`:

```zsh
kubectl -n argocd get applications \
  dum-dashboard-bootstrap dum-dashboard-dumachine kube-prometheus-stack --watch
```

## 4. Verify the deployment

Start with Argo, private DNS/HTTPS, and a direct cluster comparison:

```zsh
kubectl -n argocd get applications dum-dashboard-dumachine kube-prometheus-stack
dig +short dashboard.doh.lumilumi.xyz
curl --fail --show-error https://dashboard.doh.lumilumi.xyz
kubectl get nodes
kubectl -n yootoob-mp3 get deployments,pods
```

Check readiness, restarts, private exposure, and the certificate:

```zsh
kubectl -n dum-dashboard get deployments,pods,services,ingress,certificate
kubectl -n dum-dashboard get networkpolicy \
  homelab-gateway-dashboard-only dum-dashboard-traefik-only
kubectl -n dum-dashboard get service homelab-gateway \
  -o jsonpath='{.spec.type}{"\n"}{.spec.clusterIP}{"\n"}'
kubectl -n dum-dashboard get certificate dum-dashboard-lumilumi \
  -o jsonpath='{.spec.issuerRef.name}{"\n"}{.status.conditions[?(@.type=="Ready")].status}{"\n"}'
kubectl -n dum-dashboard get secret dum-dashboard-lumilumi-tls \
  -o jsonpath='{.data.tls\.crt}' | base64 --decode | openssl x509 -noout -issuer -enddate
scripts/check-tailnet-boundary.sh dashboard.doh.lumilumi.xyz
```

`homelab-gateway` must say `ClusterIP`. The certificate issuer must be `letsencrypt-prod` and its
Ready condition must be `True`.

Check Prometheus targets in two terminals:

```zsh
# Terminal 1
kubectl -n monitoring port-forward service/kube-prometheus-stack-prometheus 9090:9090
```

```zsh
# Terminal 2
curl --fail --silent --show-error \
  'http://127.0.0.1:9090/api/v1/targets?state=active' | jq \
  '[.data.activeTargets[] | {scrapePool, health, lastError}]'
```

## 5. Verify read-only security

The first two commands must print `no`; the final two must print `yes`:

```zsh
kubectl auth can-i create configmaps \
  --as=system:serviceaccount:dum-dashboard:homelab-gateway \
  --namespace=dum-dashboard
kubectl auth can-i create pods/exec \
  --as=system:serviceaccount:dum-dashboard:homelab-gateway \
  --namespace=dum-dashboard
kubectl auth can-i list pods \
  --as=system:serviceaccount:dum-dashboard:homelab-gateway \
  --all-namespaces
kubectl auth can-i get applications.argoproj.io/yootoob-mp3-dumachine \
  --as=system:serviceaccount:dum-dashboard:homelab-gateway \
  --namespace=argocd
```

## 6. Browser acceptance

Open `https://dashboard.doh.lumilumi.xyz` on a device connected to your tailnet and confirm:

- there is no login prompt;
- Overview, Cluster, Deployments, and Services open;
- data refreshes automatically after about 10 seconds;
- the `yootoob-mp3` commit-to-live pipeline and private service link appear;
- a missing source is shown as Unknown instead of Healthy;
- a pod log stream opens, renders text, and closes when the panel closes.

## 7. Roll back an image deployment

This reverts the latest GitOps image-tag commit and lets Argo restore the prior images:

```zsh
git fetch origin deploy
deploy_commit="$(git log -n 1 --format=%H -- k8s/overlays/dumachine/kustomization.yml)"
gh workflow run rollback-deploy.yml -f deploy_commit="$deploy_commit"
gh run watch --exit-status
```

Then watch recovery:

```zsh
kubectl -n argocd get application dum-dashboard-dumachine --watch
```
