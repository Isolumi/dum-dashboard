#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(git -C "${script_dir}" rev-parse --show-toplevel)"
overlay="${repo_root}/k8s/overlays/dumachine"
rendered="$(mktemp)"
trap 'rm -f "${rendered}"' EXIT

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required to render the dashboard overlay." >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required to inspect the rendered dashboard manifests." >&2
  exit 1
fi

kubectl kustomize "${overlay}" >"${rendered}"

cd "${repo_root}"
RENDERED_PATH="${rendered}" \
ENV_EXAMPLE_PATH="${repo_root}/.env.example" \
WORKFLOW_PATH="${repo_root}/.github/workflows/build-images.yml" \
DASHBOARD_DOCKERFILE="${repo_root}/Dockerfile.dashboard" \
GATEWAY_DOCKERFILE="${repo_root}/Dockerfile.gateway" \
BROWSER_SOURCE_ROOT="${repo_root}/src/routes/_layout" \
PUBLIC_ROOT="${repo_root}/public" \
bun --eval '
  import { readFileSync, readdirSync, statSync } from "node:fs";
  import { join } from "node:path";
  import { parseAllDocuments } from "yaml";

  const expectedUrl = "http://monies.monies.svc.cluster.local:3333";
  const expectedProjectId = "1617f220-140c-4a04-a8e7-468a71e4ff50";
  const credentialSecretName = "dum-dashboard-monies-infisical-auth-credentials";
  const targetSecretName = "dum-dashboard-monies-secrets";
  const expectedDashboardLabels = {
    "app.kubernetes.io/name": "dum-dashboard",
    "app.kubernetes.io/component": "dashboard",
  };

  const fail = (message) => {
    throw new Error(message);
  };
  const loadDocuments = (path) =>
    parseAllDocuments(readFileSync(path, "utf8"))
      .map((document) => document.toJSON())
      .filter(Boolean);
  const find = (documents, kind, name) =>
    documents.find(
      (document) => document?.kind === kind && document?.metadata?.name === name,
    );
  const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  };
  const same = (actual, expected) =>
    JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected));
  const hasLabels = (actual, expected) =>
    Object.entries(expected).every(([key, value]) => actual?.[key] === value);
  const readTextFiles = (root) => {
    const files = [];
    for (const entry of readdirSync(root)) {
      const path = join(root, entry);
      if (statSync(path).isDirectory()) files.push(...readTextFiles(path));
      else files.push(path);
    }
    return files;
  };
  const hasDirectTokenValue = (value) => {
    if (Array.isArray(value)) return value.some(hasDirectTokenValue);
    if (!value || typeof value !== "object") return false;
    if (value.name === "MONIES_API_TOKEN" && Object.hasOwn(value, "value")) return true;
    return Object.values(value).some(hasDirectTokenValue);
  };

  const documents = loadDocuments(process.env.RENDERED_PATH);
  const dashboardConfig = find(documents, "ConfigMap", "dum-dashboard-config");
  if (dashboardConfig?.data?.MONIES_API_URL !== expectedUrl) {
    fail("dum-dashboard-config must contain the exact private Monies service URL.");
  }
  for (const configMap of documents.filter((document) => document.kind === "ConfigMap")) {
    if (Object.hasOwn(configMap.data ?? {}, "MONIES_API_TOKEN")) {
      fail("MONIES_API_TOKEN must not be stored in a ConfigMap.");
    }
  }

  const envExample = readFileSync(process.env.ENV_EXAMPLE_PATH, "utf8");
  const urlAssignments = envExample
    .split(/\r?\n/)
    .filter((line) => line.startsWith("MONIES_API_URL="));
  if (!same(urlAssignments, [`MONIES_API_URL=${expectedUrl}`])) {
    fail(".env.example must contain one exact server-only MONIES_API_URL assignment.");
  }
  if (/^MONIES_API_TOKEN=/m.test(envExample) || /^VITE_.*MONIES/m.test(envExample)) {
    fail(".env.example must not contain the Monies token or a VITE Monies variable.");
  }

  const deployment = find(documents, "Deployment", "dum-dashboard");
  const podLabels = deployment?.spec?.template?.metadata?.labels;
  if (
    deployment?.metadata?.namespace !== "dum-dashboard" ||
    !hasLabels(podLabels, expectedDashboardLabels)
  ) {
    fail("Dashboard pod labels must match the Task 8 Monies ingress selector.");
  }
  const dashboardContainer = deployment?.spec?.template?.spec?.containers?.find(
    (container) => container.name === "dashboard",
  );
  const envFrom = dashboardContainer?.envFrom ?? [];
  const secretRefs = envFrom
    .filter((entry) => entry.secretRef)
    .map((entry) => entry.secretRef.name);
  if (
    envFrom?.[0]?.configMapRef?.name !== "dum-dashboard-config" ||
    !same(secretRefs, ["dum-dashboard-secrets", targetSecretName]) ||
    envFrom?.length !== 3
  ) {
    fail("Dashboard envFrom must load the Monies Secret as its second secretRef.");
  }
  if (hasDirectTokenValue(documents)) {
    fail("MONIES_API_TOKEN must not have a direct value in rendered workloads.");
  }

  const connection = find(documents, "InfisicalConnection", "infisical-cloud");
  if (
    connection?.metadata?.namespace !== "dum-dashboard" ||
    connection?.spec?.address !== "https://app.infisical.com"
  ) {
    fail("The dashboard Infisical connection is missing or invalid.");
  }

  const auth = find(documents, "InfisicalAuth", "dum-dashboard-monies-infisical-auth");
  const universal = auth?.spec?.universal;
  if (
    auth?.metadata?.namespace !== "dum-dashboard" ||
    auth?.spec?.method !== "universal" ||
    auth?.spec?.infisicalConnectionRef?.name !== "infisical-cloud" ||
    auth?.spec?.infisicalConnectionRef?.namespace !== "dum-dashboard" ||
    universal?.clientIdRef?.name !== credentialSecretName ||
    universal?.clientIdRef?.namespace !== "dum-dashboard" ||
    universal?.clientIdRef?.key !== "clientId" ||
    universal?.clientSecretRef?.name !== credentialSecretName ||
    universal?.clientSecretRef?.namespace !== "dum-dashboard" ||
    universal?.clientSecretRef?.key !== "clientSecret"
  ) {
    fail("Infisical Universal Auth must reference the external dashboard credential Secret.");
  }
  if (
    documents.some(
      (document) =>
        document.kind === "Secret" && document.metadata?.name === credentialSecretName,
    )
  ) {
    fail("Dashboard Universal Auth credentials must never be committed.");
  }

  const staticSecret = find(
    documents,
    "InfisicalStaticSecret",
    "dum-dashboard-monies-secrets",
  );
  const sources = staticSecret?.spec?.sources ?? [];
  const targets = staticSecret?.spec?.targets ?? [];
  if (
    staticSecret?.metadata?.namespace !== "dum-dashboard" ||
    staticSecret?.spec?.infisicalAuthRef?.name !== "dum-dashboard-monies-infisical-auth" ||
    staticSecret?.spec?.infisicalAuthRef?.namespace !== "dum-dashboard" ||
    sources.length !== 1 ||
    sources[0]?.projectId !== expectedProjectId ||
    sources[0]?.environmentSlug !== "prod" ||
    sources[0]?.secretPath !== "/dashboard" ||
    targets.length !== 1 ||
    targets[0]?.name !== targetSecretName ||
    targets[0]?.namespace !== "dum-dashboard" ||
    targets[0]?.kind !== "Secret" ||
    targets[0]?.creationPolicy !== "Owner"
  ) {
    fail("Infisical must sync only the approved prod /dashboard path into the Monies Secret.");
  }

  const dashboardPolicy = find(documents, "NetworkPolicy", "dum-dashboard-traefik-only");
  const dashboardIngress = dashboardPolicy?.spec?.ingress ?? [];
  const dashboardSource = dashboardIngress[0]?.from?.[0];
  const dashboardPorts = dashboardIngress[0]?.ports ?? [];
  if (
    !same(dashboardPolicy?.spec?.podSelector?.matchLabels, expectedDashboardLabels) ||
    !same(dashboardPolicy?.spec?.policyTypes, ["Ingress"]) ||
    dashboardIngress.length !== 1 ||
    dashboardIngress[0]?.from?.length !== 1 ||
    !same(dashboardSource?.namespaceSelector?.matchLabels, {
      "kubernetes.io/metadata.name": "kube-system",
    }) ||
    !same(dashboardSource?.podSelector?.matchLabels, {
      "app.kubernetes.io/instance": "traefik-kube-system",
      "app.kubernetes.io/name": "traefik",
    }) ||
    dashboardPorts.length !== 1 ||
    dashboardPorts[0]?.port !== 3000 ||
    dashboardPorts[0]?.protocol !== "TCP"
  ) {
    fail("The existing Traefik-only dashboard ingress boundary changed.");
  }
  for (const policy of documents.filter((document) => document.kind === "NetworkPolicy")) {
    if (policy.spec?.policyTypes?.includes("Egress") || Object.hasOwn(policy.spec ?? {}, "egress")) {
      fail("Task 12 must not add a dashboard egress policy.");
    }
  }

  for (const path of [
    process.env.WORKFLOW_PATH,
    process.env.DASHBOARD_DOCKERFILE,
    process.env.GATEWAY_DOCKERFILE,
  ]) {
    if (readFileSync(path, "utf8").includes("MONIES_API_TOKEN")) {
      fail("MONIES_API_TOKEN must not be a workflow value or image build argument.");
    }
  }
  for (const root of [process.env.BROWSER_SOURCE_ROOT, process.env.PUBLIC_ROOT]) {
    for (const path of readTextFiles(root)) {
      if (readFileSync(path, "utf8").includes("MONIES_API_TOKEN")) {
        fail(`Browser code must not reference MONIES_API_TOKEN: ${path}`);
      }
    }
  }

  console.info(
    "Monies manifests: PASS (destination policy contract: dum-dashboard/dashboard -> monies:3333)",
  );
'
