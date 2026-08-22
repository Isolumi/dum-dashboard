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
- Optional Google Calendar OAuth: add the exact authorized redirect URI
  `https://doh.lumilumi.xyz/calendar/oauth/callback` to the Google web client before setting
  `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

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
kubectl apply -f k8s/argocd/dum-dashboard-dns-project.yml
kubectl apply -f k8s/argocd/dum-dashboard-project.yml
kubectl apply -f k8s/argocd/prometheus-project.yml
kubectl apply -f k8s/argocd/dum-dashboard-bootstrap.yml
kubectl apply -f k8s/argocd/dum-dashboard-dns.yml

git fetch origin v1
DUM_DASH_REVISION="$(git rev-parse origin/v1)"
kubectl -n argocd patch application dum-dashboard-bootstrap --type=merge \
  --patch="{\"operation\":{\"sync\":{\"revision\":\"$DUM_DASH_REVISION\"}}}"
kubectl -n argocd patch application dum-dashboard-dns --type=merge \
  --patch="{\"operation\":{\"sync\":{\"revision\":\"$DUM_DASH_REVISION\"}}}"
kubectl -n argocd wait application/dum-dashboard-bootstrap \
  --for=jsonpath='{.status.sync.revision}'="$DUM_DASH_REVISION" --timeout=120s
kubectl -n argocd wait application/dum-dashboard-dns \
  --for=jsonpath='{.status.sync.revision}'="$DUM_DASH_REVISION" --timeout=120s
kubectl -n argocd wait application/dum-dashboard-bootstrap \
  --for=jsonpath='{.status.sync.status}'=Synced --timeout=120s
kubectl -n argocd wait application/dum-dashboard-dns \
  --for=jsonpath='{.status.sync.status}'=Synced --timeout=120s
unset DUM_DASH_REVISION

# CoreDNS only discovers a newly created optional coredns-custom volume after its pod restarts.
kubectl -n kube-system rollout restart deployment/coredns
kubectl -n kube-system rollout status deployment/coredns --timeout=120s

kubectl apply -f k8s/argocd/prometheus.yml
kubectl apply -f k8s/argocd/dum-dashboard.yml
```

The manually synchronized bootstrap applications split namespace/RBAC access from the dedicated
CoreDNS ConfigMap boundary. Address lookups for `*.doh.lumilumi.xyz` go to in-cluster Traefik;
TXT lookups still go to public DNS for ACME renewal. The normal dashboard and monitoring
applications use separate restricted projects. Do not run `kubectl apply` against `k8s/base`,
`k8s/overlays`, or `k8s/bootstrap`; Argo CD owns those resources.

Watch all applications until they report `Synced` and `Healthy`:

```zsh
kubectl -n argocd get applications \
  dum-dashboard-bootstrap dum-dashboard-dumachine kube-prometheus-stack --watch
```

## 4. Verify the deployment

Start with Argo, private DNS/HTTPS, and a direct cluster comparison:

```zsh
kubectl -n argocd get applications dum-dashboard-dumachine kube-prometheus-stack
dig +short doh.lumilumi.xyz
curl --fail --show-error https://doh.lumilumi.xyz
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
scripts/check-tailnet-boundary.sh doh.lumilumi.xyz
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

Open `https://doh.lumilumi.xyz` on a device connected to your tailnet and confirm:

- there is no login prompt;
- Overview, Cluster, Deployments, and Services open;
- data refreshes automatically after about 10 seconds;
- the `yootoob-mp3` commit-to-live pipeline and private service link appear;
- a missing source is shown as Unknown instead of Healthy;
- a pod log stream opens, renders text, and closes when the panel closes.

## 7. Camera stream

Reserve `192.168.2.44` for the Tapo camera in the router DHCP settings. A changed camera
address is a configuration change.

In Infisical, open project `1617f220-140c-4a04-a8e7-468a71e4ff50`, select environment `prod`,
create path `/camera`, and add `TAPO_CAMERA_USERNAME` and `TAPO_CAMERA_PASSWORD` from the Tapo
Camera Account. Do not add secret values to Git, this guide, or a shell command.

The dashboard browser never receives these values. Only the `go2rtc` pod receives them. After a
camera credential rotation and a successful Infisical refresh, restart only `deployment/go2rtc`.
Kubernetes environment variables do not change inside a running pod:

```zsh
kubectl -n dum-dashboard rollout restart deployment/go2rtc
kubectl -n dum-dashboard rollout status deployment/go2rtc --timeout=180s
```

Check camera health:

```zsh
kubectl -n dum-dashboard get infisicalstaticsecret dum-dashboard-camera-secrets
kubectl -n dum-dashboard rollout status deployment/go2rtc --timeout=180s
kubectl -n dum-dashboard get pod,service,ingress,networkpolicy -l app.kubernetes.io/part-of=dum-dashboard
kubectl -n dum-dashboard logs deployment/go2rtc --tail=100
```

Check the internal stream names without displaying credentials:

```zsh
kubectl -n dum-dashboard exec deployment/go2rtc -- \
  curl -fsS http://127.0.0.1:1984/camera-stream/api/streams
```

To roll back the camera stream, create and merge a normal `v1` revert pull request. Do not delete
camera resources by hand or change Argo CD by hand:

```zsh
git fetch origin v1
git switch --create rollback/camera-stream --track origin/v1
git revert <camera-feature-commit>
git push -u origin rollback/camera-stream
pr_url="$(gh pr create \
  --base v1 \
  --head rollback/camera-stream \
  --title "revert: remove private Tapo camera dashboard" \
  --body "Reverts the camera stream feature.")"
gh pr checks "$pr_url" --watch
gh pr merge "$pr_url" --merge --delete-branch
merge_sha="$(gh pr view "$pr_url" --json mergeCommit --jq '.mergeCommit.oid')"
test -n "${merge_sha}"
camera_run_id=""
for attempt in {1..30}; do
  camera_run_id="$(gh run list \
    --workflow "Build and deploy images" \
    --branch v1 \
    --commit "$merge_sha" \
    --event push \
    --limit 1 \
    --json databaseId \
    --jq '.[0].databaseId')"
  [[ -n "${camera_run_id}" ]] && break
  sleep 10
done
test -n "${camera_run_id}"
gh run watch "${camera_run_id}" --exit-status
for attempt in {1..30}; do
  git fetch origin deploy
  git merge-base --is-ancestor "$merge_sha" origin/deploy && break
  sleep 10
done
git merge-base --is-ancestor "$merge_sha" origin/deploy
kubectl -n argocd get application dum-dashboard-dumachine --watch
```

## 8. Roll back an image deployment

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
