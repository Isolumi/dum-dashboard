#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(git -C "${script_dir}" rev-parse --show-toplevel)"
overlay="${repo_root}/k8s/overlays/dumachine"
rendered="$(mktemp)"
public_dir="${CAMERA_PUBLIC_DIR:-${repo_root}/.output/public}"
trap 'rm -f "${rendered}"' EXIT

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required to render the dashboard overlay." >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required to inspect the camera deployment." >&2
  exit 1
fi

kubectl kustomize "${overlay}" >"${rendered}"

cd "${repo_root}"
bun scripts/check-camera-manifests.ts \
  --repo-root "${repo_root}" \
  --rendered "${rendered}" \
  --public-dir "${public_dir}"
