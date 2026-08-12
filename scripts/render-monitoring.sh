#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(git -C "${script_dir}" rev-parse --show-toplevel)"
render_file="$(mktemp)"
trap 'rm -f "${render_file}"' EXIT

docker run --rm \
  --volume "${repo_root}:/work:ro" \
  alpine/helm:3.18.4 \
  template kube-prometheus-stack kube-prometheus-stack \
  --repo https://prometheus-community.github.io/helm-charts \
  --version 86.0.1 \
  --namespace monitoring \
  --values /work/k8s/argocd/prometheus-values.yml >"${render_file}"

grep -Eq -- '- host: "?grafana[.]doh[.]lumilumi[.]xyz"?$' "${render_file}"
grep -q 'kind: Ingress' "${render_file}"
grep -q 'volumeClaimTemplate:' "${render_file}"
grep -q 'storage: 20Gi' "${render_file}"
printf 'Monitoring chart render: PASS\n'
