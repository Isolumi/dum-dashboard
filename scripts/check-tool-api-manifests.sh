#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(git -C "${script_dir}" rev-parse --show-toplevel)"
base="${repo_root}/k8s/base"
overlay="${repo_root}/k8s/overlays/dumachine"
base_rendered="$(mktemp)"
overlay_rendered="$(mktemp)"
trap 'rm -f "${base_rendered}" "${overlay_rendered}"' EXIT

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required to render the dashboard manifests." >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required to inspect the dashboard manifests." >&2
  exit 1
fi

kubectl kustomize "${base}" >"${base_rendered}"
kubectl kustomize "${overlay}" >"${overlay_rendered}"

cd "${repo_root}"
bun scripts/check-tool-api-manifests.ts \
  --base-rendered "${base_rendered}" \
  --overlay-rendered "${overlay_rendered}"
