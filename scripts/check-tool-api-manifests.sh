#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(git -C "${script_dir}" rev-parse --show-toplevel)"
base="${repo_root}/k8s/base"
overlay="${repo_root}/k8s/overlays/dumachine"
base_rendered=""
overlay_rendered=""

while (( $# > 0 )); do
  case "$1" in
    --base-rendered)
      if (( $# < 2 )); then
        echo "--base-rendered requires a path." >&2
        exit 2
      fi
      base_rendered="$2"
      shift 2
      ;;
    --overlay-rendered)
      if (( $# < 2 )); then
        echo "--overlay-rendered requires a path." >&2
        exit 2
      fi
      overlay_rendered="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -n "${base_rendered}" || -n "${overlay_rendered}" ]]; then
  if [[ -z "${base_rendered}" || -z "${overlay_rendered}" ]]; then
    echo "--base-rendered and --overlay-rendered must be used together." >&2
    exit 2
  fi
  if [[ ! -f "${base_rendered}" || ! -f "${overlay_rendered}" ]]; then
    echo "The supplied rendered manifest paths must be files." >&2
    exit 2
  fi
else
  base_rendered="$(mktemp)"
  overlay_rendered="$(mktemp)"
  trap 'rm -f "${base_rendered}" "${overlay_rendered}"' EXIT

  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required to render the dashboard manifests." >&2
    exit 1
  fi

  kubectl kustomize "${base}" >"${base_rendered}"
  kubectl kustomize "${overlay}" >"${overlay_rendered}"
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required to inspect the dashboard manifests." >&2
  exit 1
fi

cd "${repo_root}"
bun scripts/check-tool-api-manifests.ts \
  --base-rendered "${base_rendered}" \
  --overlay-rendered "${overlay_rendered}"

bun run - "${overlay_rendered}" <<'BUN'
import { readFileSync } from "node:fs";

import { parseAllDocuments } from "yaml";

const overlayRenderedPath = process.argv[2];
const documents = parseAllDocuments(readFileSync(overlayRenderedPath, "utf8"))
  .map((document) => document.toJSON())
  .filter(Boolean);
const policies = documents.filter(
  (document) =>
    document.kind === "NetworkPolicy" &&
    document.metadata?.name === "dum-dashboard-traefik-only",
);

if (policies.length !== 1) {
  throw new Error(
    `Expected one NetworkPolicy/dum-dashboard-traefik-only; found ${policies.length}.`,
  );
}

const policy = policies[0];
const expectedSpec = {
  podSelector: {
    matchLabels: {
      "app.kubernetes.io/name": "dum-dashboard",
      "app.kubernetes.io/component": "dashboard",
    },
  },
  policyTypes: ["Ingress"],
  ingress: [
    {
      from: [
        {
          namespaceSelector: {
            matchLabels: { "kubernetes.io/metadata.name": "kube-system" },
          },
          podSelector: {
            matchLabels: {
              "app.kubernetes.io/instance": "traefik-kube-system",
              "app.kubernetes.io/name": "traefik",
            },
          },
        },
        {
          namespaceSelector: {
            matchLabels: { "kubernetes.io/metadata.name": "uwumi" },
          },
          podSelector: { matchLabels: { app: "dumq-mcp" } },
        },
      ],
      ports: [{ port: 3000, protocol: "TCP" }],
    },
  ],
};

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
};

const normalizeSpec = (spec) => {
  const normalized = structuredClone(spec);
  for (const ingress of normalized.ingress ?? []) {
    ingress.from?.sort((left, right) =>
      JSON.stringify(canonicalize(left)).localeCompare(JSON.stringify(canonicalize(right))),
    );
  }
  return canonicalize(normalized);
};

if (
  policy.apiVersion !== "networking.k8s.io/v1" ||
  policy.metadata?.namespace !== "dum-dashboard" ||
  JSON.stringify(normalizeSpec(policy.spec)) !== JSON.stringify(normalizeSpec(expectedSpec))
) {
  throw new Error(
    "NetworkPolicy/dum-dashboard-traefik-only does not match the approved rendered ingress contract.",
  );
}

console.info("DumQ NetworkPolicy ingress contract: PASS");
BUN
