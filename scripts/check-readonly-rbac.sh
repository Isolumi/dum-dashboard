#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
overlay="$repo_root/k8s/overlays/dumachine"
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required to render and inspect the gateway RBAC." >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required to parse and inspect the rendered RBAC." >&2
  exit 1
fi

if ! kubectl kustomize "$overlay" >"$rendered"; then
  echo "Failed to render $overlay." >&2
  exit 1
fi

cd "$repo_root"
RENDERED_MANIFEST="$rendered" bun --eval '
  import { readFileSync } from "node:fs";
  import { parseAllDocuments } from "yaml";

  const path = process.env.RENDERED_MANIFEST;
  const documents = parseAllDocuments(readFileSync(path, "utf8")).map((document) => document.toJSON());
  const role = documents.find(
    (document) =>
      document?.kind === "ClusterRole" && document?.metadata?.name === "homelab-gateway-readonly",
  );
  if (!role || !Array.isArray(role.rules)) {
    throw new Error("Rendered manifests do not contain the homelab-gateway-readonly ClusterRole.");
  }

  const allowedVerbs = new Set(["get", "list", "watch"]);
  const forbiddenResources = new Set([
    "secrets",
    "pods/exec",
    "pods/attach",
    "pods/portforward",
    "pods/ephemeralcontainers",
    "ephemeralcontainers",
  ]);
  const expectedResources = new Set([
    "nodes",
    "namespaces",
    "pods",
    "pods/log",
    "events",
    "services",
    "endpoints",
    "deployments",
    "daemonsets",
    "statefulsets",
    "replicasets",
    "ingresses",
    "certificates",
    "applications",
  ]);
  const grantedResources = new Set();

  for (const rule of role.rules) {
    if (!Array.isArray(rule?.verbs) || !Array.isArray(rule?.resources)) {
      throw new Error("Gateway RBAC contains a malformed rule.");
    }
    for (const verb of rule.verbs) {
      if (!allowedVerbs.has(verb)) throw new Error(`Gateway RBAC contains forbidden verb: ${verb}`);
    }
    for (const resource of rule.resources) {
      if (forbiddenResources.has(resource)) {
        throw new Error(`Gateway RBAC contains forbidden resource: ${resource}`);
      }
      grantedResources.add(resource);
    }
  }

  for (const resource of expectedResources) {
    if (!grantedResources.has(resource)) throw new Error(`Gateway RBAC is missing: ${resource}`);
  }

  const binding = documents.find(
    (document) =>
      document?.kind === "ClusterRoleBinding" &&
      document?.metadata?.name === "homelab-gateway-readonly",
  );
  const subject = binding?.subjects?.find(
    (entry) =>
      entry?.kind === "ServiceAccount" &&
      entry?.name === "homelab-gateway" &&
      entry?.namespace === "dum-dashboard",
  );
  if (binding?.roleRef?.name !== "homelab-gateway-readonly" || !subject) {
    throw new Error("Gateway read-only role is not bound to the expected ServiceAccount.");
  }
'

echo "Gateway RBAC is read-only and contains no forbidden subresources."
