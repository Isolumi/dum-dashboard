#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(git -C "${script_dir}" rev-parse --show-toplevel)"
values_file="${PROMETHEUS_VALUES_PATH:-${repo_root}/k8s/argocd/prometheus-values.yml}"
values_file="$(cd -- "$(dirname -- "${values_file}")" && pwd -P)/$(basename -- "${values_file}")"
render_file="$(mktemp)"
trap 'rm -f "${render_file}"' EXIT

docker run --rm \
  --volume "${values_file}:/monitoring-values.yml:ro" \
  alpine/helm:3.18.4 \
  template kube-prometheus-stack kube-prometheus-stack \
  --repo https://prometheus-community.github.io/helm-charts \
  --version 86.0.1 \
  --namespace monitoring \
  --values /monitoring-values.yml >"${render_file}"

RENDER_FILE="${render_file}" bun --eval '
  import { readFileSync } from "node:fs";
  import { parseAllDocuments } from "yaml";

  const documents = parseAllDocuments(readFileSync(process.env.RENDER_FILE, "utf8"))
    .map((document) => document.toJSON())
    .filter(Boolean);
  const ingresses = documents.filter((document) => document.kind === "Ingress");
  if (ingresses.length !== 1) {
    throw new Error(`Monitoring render must contain exactly one Ingress; found ${ingresses.length}.`);
  }

  const ingress = ingresses[0];
  const ruleHosts = (ingress.spec?.rules ?? []).map((rule) => rule.host);
  const tlsHosts = (ingress.spec?.tls ?? []).flatMap((entry) => entry.hosts ?? []);
  if (
    ingress.apiVersion !== "networking.k8s.io/v1" ||
    ingress.metadata?.name !== "kube-prometheus-stack-grafana" ||
    ingress.metadata?.namespace !== "monitoring" ||
    ingress.metadata?.annotations?.["cert-manager.io/cluster-issuer"] !== "letsencrypt-prod" ||
    ingress.metadata?.annotations?.["traefik.ingress.kubernetes.io/router.entrypoints"] !==
      "websecure" ||
    ingress.spec?.ingressClassName !== "traefik" ||
    JSON.stringify(ruleHosts) !== JSON.stringify(["grafana.doh.lumilumi.xyz"]) ||
    JSON.stringify(tlsHosts) !== JSON.stringify(["grafana.doh.lumilumi.xyz"]) ||
    ingress.spec?.tls?.[0]?.secretName !== "grafana-lumilumi-tls"
  ) {
    throw new Error("The only rendered Ingress must be the approved private Grafana Ingress.");
  }
'
grep -q 'volumeClaimTemplate:' "${render_file}"
grep -q 'storage: 20Gi' "${render_file}"
printf 'Monitoring chart render: PASS\n'
