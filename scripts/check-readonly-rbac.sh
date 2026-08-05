#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
normal_overlay="$repo_root/k8s/overlays/dumachine"
bootstrap_overlay="$repo_root/k8s/bootstrap/dum-dashboard"
normal_rendered="$(mktemp)"
bootstrap_rendered="$(mktemp)"
trap 'rm -f "$normal_rendered" "$bootstrap_rendered"' EXIT

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required to render and inspect the gateway RBAC." >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required to parse and inspect the deployment policy." >&2
  exit 1
fi

if ! kubectl kustomize "$normal_overlay" >"$normal_rendered"; then
  echo "Failed to render $normal_overlay." >&2
  exit 1
fi

if ! kubectl kustomize "$bootstrap_overlay" >"$bootstrap_rendered"; then
  echo "Failed to render $bootstrap_overlay." >&2
  exit 1
fi

cd "$repo_root"
NORMAL_RENDERED="$normal_rendered" \
BOOTSTRAP_RENDERED="$bootstrap_rendered" \
WORKFLOW_PATH="$repo_root/.github/workflows/build-images.yml" \
ROLLBACK_WORKFLOW_PATH="$repo_root/.github/workflows/rollback-deploy.yml" \
NORMAL_PROJECT_PATH="$repo_root/k8s/argocd/dum-dashboard-project.yml" \
NORMAL_APPLICATION_PATH="$repo_root/k8s/argocd/dum-dashboard.yml" \
BOOTSTRAP_PROJECT_PATH="$repo_root/k8s/argocd/dum-dashboard-bootstrap-project.yml" \
BOOTSTRAP_APPLICATION_PATH="$repo_root/k8s/argocd/dum-dashboard-bootstrap.yml" \
PROMETHEUS_PROJECT_PATH="$repo_root/k8s/argocd/prometheus-project.yml" \
PROMETHEUS_APPLICATION_PATH="$repo_root/k8s/argocd/prometheus.yml" \
PROMETHEUS_VALUES_PATH="$repo_root/k8s/argocd/prometheus-values.yml" \
DASHBOARD_DOCKERFILE="$repo_root/Dockerfile.dashboard" \
GATEWAY_DOCKERFILE="$repo_root/Dockerfile.gateway" \
TRAEFIK_BOUNDARY_PATH="$repo_root/k8s/bootstrap/traefik-tailscale-only.yml" \
bun --eval '
  import { readFileSync } from "node:fs";
  import { parse, parseAllDocuments } from "yaml";

  const fail = (message) => {
    throw new Error(message);
  };
  const loadDocuments = (path) =>
    parseAllDocuments(readFileSync(path, "utf8")).map((document) => document.toJSON());
  const find = (documents, kind, name) =>
    documents.find(
      (document) => document?.kind === kind && document?.metadata?.name === name,
    );
  const sorted = (values) => [...values].sort();
  const same = (actual, expected) =>
    JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected));
  const assertExactRule = (rules, { apiGroups, resources, verbs, resourceNames }) => {
    const match = rules.find(
      (rule) =>
        same(rule?.apiGroups ?? [], apiGroups) &&
        same(rule?.resources ?? [], resources) &&
        same(rule?.verbs ?? [], verbs) &&
        same(rule?.resourceNames ?? [], resourceNames ?? []),
    );
    if (!match) {
      fail(
        `Missing exact RBAC rule ${JSON.stringify({ apiGroups, resources, verbs, resourceNames })}`,
      );
    }
  };

  const normal = loadDocuments(process.env.NORMAL_RENDERED);
  const bootstrap = loadDocuments(process.env.BOOTSTRAP_RENDERED);
  const clusterScopedKinds = new Set([
    "ClusterRole",
    "ClusterRoleBinding",
    "CustomResourceDefinition",
    "Namespace",
    "Node",
    "PersistentVolume",
    "StorageClass",
  ]);
  const leakedClusterResource = normal.find((document) => clusterScopedKinds.has(document?.kind));
  if (leakedClusterResource) {
    fail(`Normal application renders cluster-scoped ${leakedClusterResource.kind}.`);
  }

  const serviceAccount = find(normal, "ServiceAccount", "homelab-gateway");
  if (serviceAccount?.metadata?.namespace !== "dum-dashboard") {
    fail("Normal application is missing the homelab-gateway ServiceAccount.");
  }
  for (const serviceName of ["dum-dashboard", "homelab-gateway"]) {
    const service = find(normal, "Service", serviceName);
    if (service?.spec?.type !== "ClusterIP") {
      fail(`${serviceName} must remain ClusterIP-only.`);
    }
  }
  const dashboardPolicy = find(normal, "NetworkPolicy", "dum-dashboard-traefik-only");
  const dashboardIngress = dashboardPolicy?.spec?.ingress ?? [];
  const dashboardSource = dashboardIngress[0]?.from?.[0];
  if (
    dashboardIngress.length !== 1 ||
    dashboardIngress[0]?.from?.length !== 1 ||
    dashboardSource?.namespaceSelector?.matchLabels?.["kubernetes.io/metadata.name"] !==
      "kube-system" ||
    dashboardSource?.podSelector?.matchLabels?.["app.kubernetes.io/name"] !== "traefik" ||
    dashboardIngress[0]?.ports?.[0]?.port !== 3000
  ) {
    fail("Dashboard ingress must be restricted to Traefik in kube-system on port 3000.");
  }
  const normalAllowedKinds = new Set([
    "/ConfigMap",
    "/Service",
    "/ServiceAccount",
    "apps/Deployment",
    "cert-manager.io/Certificate",
    "networking.k8s.io/Ingress",
    "networking.k8s.io/NetworkPolicy",
  ]);
  for (const document of normal) {
    const apiVersion = document?.apiVersion ?? "";
    const group = apiVersion.includes("/") ? apiVersion.split("/", 1)[0] : "";
    const groupKind = `${group}/${document?.kind ?? ""}`;
    if (!normalAllowedKinds.has(groupKind)) {
      fail(`Normal application renders an unapproved resource kind: ${groupKind}`);
    }
  }

  const bootstrapIdentities = bootstrap.map(
    (document) => `${document?.kind}/${document?.metadata?.namespace ?? ""}/${document?.metadata?.name}`,
  );
  if (
    !same(bootstrapIdentities, [
      "Namespace//dum-dashboard",
      "ClusterRole//homelab-gateway-readonly",
      "ClusterRoleBinding//homelab-gateway-readonly",
      "Role/argocd/homelab-gateway-argocd-readonly",
      "RoleBinding/argocd/homelab-gateway-argocd-readonly",
      "ConfigMap/kube-system/coredns-custom",
    ])
  ) {
    fail("Bootstrap renders resources beyond the reviewed namespace and RBAC set.");
  }

  const clusterRole = find(bootstrap, "ClusterRole", "homelab-gateway-readonly");
  if (!clusterRole || !Array.isArray(clusterRole.rules) || clusterRole.rules.length !== 4) {
    fail("Bootstrap must render the exact four-rule gateway ClusterRole.");
  }
  assertExactRule(clusterRole.rules, {
    apiGroups: [""],
    resources: ["nodes", "namespaces", "events"],
    verbs: ["list"],
  });
  assertExactRule(clusterRole.rules, {
    apiGroups: [""],
    resources: ["pods"],
    verbs: ["get", "list"],
  });
  assertExactRule(clusterRole.rules, {
    apiGroups: [""],
    resources: ["pods/log"],
    verbs: ["get"],
  });
  assertExactRule(clusterRole.rules, {
    apiGroups: ["apps"],
    resources: ["deployments", "daemonsets", "statefulsets"],
    verbs: ["list"],
  });

  const clusterBinding = find(
    bootstrap,
    "ClusterRoleBinding",
    "homelab-gateway-readonly",
  );
  const clusterSubject = clusterBinding?.subjects?.find(
    (subject) =>
      subject?.kind === "ServiceAccount" &&
      subject?.name === "homelab-gateway" &&
      subject?.namespace === "dum-dashboard",
  );
  if (clusterBinding?.roleRef?.name !== "homelab-gateway-readonly" || !clusterSubject) {
    fail("Gateway ClusterRole is not bound to the expected ServiceAccount.");
  }

  const argoRole = find(bootstrap, "Role", "homelab-gateway-argocd-readonly");
  if (!argoRole || !Array.isArray(argoRole.rules) || argoRole.rules.length !== 1) {
    fail("Bootstrap must render one exact namespaced Argo CD Role.");
  }
  assertExactRule(argoRole.rules, {
    apiGroups: ["argoproj.io"],
    resources: ["applications"],
    verbs: ["get"],
    resourceNames: ["yootoob-mp3-dumachine"],
  });
  if (argoRole.metadata?.namespace !== "argocd") {
    fail("Argo CD read access must be confined to the argocd namespace.");
  }

  const argoBinding = find(
    bootstrap,
    "RoleBinding",
    "homelab-gateway-argocd-readonly",
  );
  const argoSubject = argoBinding?.subjects?.find(
    (subject) =>
      subject?.kind === "ServiceAccount" &&
      subject?.name === "homelab-gateway" &&
      subject?.namespace === "dum-dashboard",
  );
  if (
    argoBinding?.metadata?.namespace !== "argocd" ||
    argoBinding?.roleRef?.kind !== "Role" ||
    argoBinding?.roleRef?.name !== "homelab-gateway-argocd-readonly" ||
    !argoSubject
  ) {
    fail("Argo CD Role is not bound to the expected ServiceAccount.");
  }

  for (const document of bootstrap) {
    for (const rule of document?.rules ?? []) {
      for (const verb of rule?.verbs ?? []) {
        if (!["get", "list"].includes(verb)) fail(`Forbidden RBAC verb: ${verb}`);
      }
      for (const value of [...(rule?.apiGroups ?? []), ...(rule?.resources ?? [])]) {
        if (value === "*") fail("Wildcard gateway RBAC is forbidden.");
      }
    }
  }

  const normalProject = parse(readFileSync(process.env.NORMAL_PROJECT_PATH, "utf8"));
  if (
    normalProject?.kind !== "AppProject" ||
    normalProject?.metadata?.name !== "dum-dashboard" ||
    !normalProject?.spec?.clusterResourceBlacklist?.some(
      (entry) => entry?.group === "*" && entry?.kind === "*",
    )
  ) {
    fail("The normal AppProject must deny every cluster-scoped resource.");
  }
  const normalWhitelistedKinds = (normalProject?.spec?.namespaceResourceWhitelist ?? []).map(
    (entry) => `${entry.group}/${entry.kind}`,
  );
  if (!same(normalWhitelistedKinds, normalAllowedKinds)) {
    fail("The normal AppProject namespaced allowlist differs from the rendered app needs.");
  }
  for (const kind of ["Role", "RoleBinding"]) {
    if (
      !normalProject?.spec?.namespaceResourceBlacklist?.some(
        (entry) => entry?.group === "rbac.authorization.k8s.io" && entry?.kind === kind,
      )
    ) {
      fail(`The normal AppProject must deny namespaced ${kind} resources.`);
    }
  }

  const normalApplication = parse(
    readFileSync(process.env.NORMAL_APPLICATION_PATH, "utf8"),
  );
  if (normalApplication?.spec?.project !== "dum-dashboard") {
    fail("The dashboard Application must use the restricted dum-dashboard AppProject.");
  }
  if (
    normalApplication?.spec?.source?.repoURL !==
      "https://github.com/Isolumi/dum-dashboard.git" ||
    normalApplication?.spec?.source?.targetRevision !== "deploy" ||
    normalApplication?.spec?.source?.path !== "k8s/overlays/dumachine" ||
    normalApplication?.spec?.destination?.server !== "https://kubernetes.default.svc" ||
    normalApplication?.spec?.destination?.namespace !== "dum-dashboard"
  ) {
    fail("The dashboard Application source or destination escaped its reviewed boundary.");
  }
  if (
    (normalApplication?.spec?.syncPolicy?.syncOptions ?? []).includes("CreateNamespace=true")
  ) {
    fail("The normal Application must not create its destination namespace.");
  }

  const bootstrapProject = parse(
    readFileSync(process.env.BOOTSTRAP_PROJECT_PATH, "utf8"),
  );
  if (
    bootstrapProject?.kind !== "AppProject" ||
    bootstrapProject?.metadata?.name !== "dum-dashboard-bootstrap"
  ) {
    fail("The bootstrap AppProject is missing.");
  }
  const allowedClusterKinds = (bootstrapProject?.spec?.clusterResourceWhitelist ?? []).map(
    (entry) => `${entry.group}/${entry.kind}`,
  );
  if (
    !same(allowedClusterKinds, [
      "/Namespace",
      "rbac.authorization.k8s.io/ClusterRole",
      "rbac.authorization.k8s.io/ClusterRoleBinding",
    ])
  ) {
    fail("The bootstrap AppProject cluster allowlist is broader than required.");
  }
  const allowedNamespaceKinds = (
    bootstrapProject?.spec?.namespaceResourceWhitelist ?? []
  ).map((entry) => `${entry.group}/${entry.kind}`);
  if (
    !same(allowedNamespaceKinds, [
      "/ConfigMap",
      "rbac.authorization.k8s.io/Role",
      "rbac.authorization.k8s.io/RoleBinding",
    ])
  ) {
    fail("The bootstrap AppProject namespaced allowlist is broader than required.");
  }
  const bootstrapDestinations = bootstrapProject?.spec?.destinations ?? [];
  if (
    !same(
      bootstrapDestinations.map((destination) => `${destination.server}/${destination.namespace}`),
      [
        "https://kubernetes.default.svc/argocd",
        "https://kubernetes.default.svc/kube-system",
      ],
    )
  ) {
    fail("The bootstrap AppProject destinations are broader than required.");
  }
  const corednsCustom = find(bootstrap, "ConfigMap", "coredns-custom");
  if (
    corednsCustom?.metadata?.namespace !== "kube-system" ||
    corednsCustom?.data?.["doh.override"] !==
      "rewrite stop name regex ^.*[.]doh[.]lumilumi[.]xyz[.]$ traefik.kube-system.svc.cluster.local. answer auto\n"
  ) {
    fail("Bootstrap must route private doh hostnames to the in-cluster Traefik service.");
  }

  const bootstrapApplication = parse(
    readFileSync(process.env.BOOTSTRAP_APPLICATION_PATH, "utf8"),
  );
  if (
    bootstrapApplication?.spec?.project !== "dum-dashboard-bootstrap" ||
    bootstrapApplication?.spec?.source?.repoURL !==
      "https://github.com/Isolumi/dum-dashboard.git" ||
    bootstrapApplication?.spec?.source?.targetRevision !== "v1" ||
    bootstrapApplication?.spec?.source?.path !== "k8s/bootstrap/dum-dashboard" ||
    bootstrapApplication?.spec?.destination?.server !== "https://kubernetes.default.svc" ||
    bootstrapApplication?.spec?.destination?.namespace !== "argocd"
  ) {
    fail("The bootstrap Application is not isolated in its dedicated project/path.");
  }
  if (bootstrapApplication?.spec?.syncPolicy?.automated) {
    fail("The privileged bootstrap Application must require a manual sync.");
  }

  const prometheusProject = parse(
    readFileSync(process.env.PROMETHEUS_PROJECT_PATH, "utf8"),
  );
  const prometheusClusterKinds = (
    prometheusProject?.spec?.clusterResourceWhitelist ?? []
  ).map((entry) => `${entry.group}/${entry.kind}`);
  const prometheusNamespaceKinds = (
    prometheusProject?.spec?.namespaceResourceWhitelist ?? []
  ).map((entry) => `${entry.group}/${entry.kind}`);
  if (
    prometheusProject?.metadata?.name !== "dum-dashboard-monitoring" ||
    !same(prometheusProject?.spec?.sourceRepos ?? [], [
      "https://prometheus-community.github.io/helm-charts",
      "https://github.com/Isolumi/dum-dashboard",
    ]) ||
    !same(prometheusClusterKinds, [
      "/Namespace",
      "apiextensions.k8s.io/CustomResourceDefinition",
      "rbac.authorization.k8s.io/ClusterRole",
      "rbac.authorization.k8s.io/ClusterRoleBinding",
    ]) ||
    !same(prometheusNamespaceKinds, [
      "/Service",
      "/ServiceAccount",
      "apps/DaemonSet",
      "apps/Deployment",
      "monitoring.coreos.com/Prometheus",
      "monitoring.coreos.com/PrometheusRule",
      "monitoring.coreos.com/ServiceMonitor",
    ])
  ) {
    fail("The Prometheus AppProject differs from its exact reviewed resource boundary.");
  }
  const prometheusDestinations = prometheusProject?.spec?.destinations ?? [];
  if (
    prometheusDestinations.length !== 1 ||
    prometheusDestinations[0]?.server !== "https://kubernetes.default.svc" ||
    prometheusDestinations[0]?.namespace !== "monitoring"
  ) {
    fail("Prometheus must be confined to the monitoring namespace.");
  }

  const prometheusApplication = parse(
    readFileSync(process.env.PROMETHEUS_APPLICATION_PATH, "utf8"),
  );
  if (
    prometheusApplication?.spec?.project !== "dum-dashboard-monitoring" ||
    prometheusApplication?.spec?.destination?.server !== "https://kubernetes.default.svc" ||
    prometheusApplication?.spec?.destination?.namespace !== "monitoring" ||
    !same(prometheusApplication?.spec?.syncPolicy?.syncOptions ?? [], [
      "CreateNamespace=true",
      "ServerSideApply=true",
    ])
  ) {
    fail("Prometheus Application must use the restricted project and server-side apply.");
  }
  const prometheusValues = parse(readFileSync(process.env.PROMETHEUS_VALUES_PATH, "utf8"));
  if (
    prometheusValues?.prometheusOperator?.admissionWebhooks?.enabled !== false ||
    prometheusValues?.prometheusOperator?.tls?.enabled !== false ||
    prometheusValues?.coreDns?.enabled !== false ||
    prometheusValues?.kubeProxy?.enabled !== false
  ) {
    fail("Prometheus values must avoid webhook TLS and kube-system write access.");
  }

  const workflow = parse(readFileSync(process.env.WORKFLOW_PATH, "utf8"));
  if (
    !same(workflow?.on?.pull_request?.branches ?? [], ["v1"]) ||
    !same(workflow?.on?.push?.branches ?? [], ["v1"])
  ) {
    fail("Workflow must verify v1 pull requests and build only v1 pushes.");
  }
  if (workflow?.permissions?.contents !== "read") {
    fail("Workflow default contents permission must be read-only.");
  }
  const actionUses = [];
  for (const job of Object.values(workflow?.jobs ?? {})) {
    for (const step of job?.steps ?? []) {
      if (typeof step?.uses === "string") actionUses.push(step.uses);
    }
  }
  for (const action of actionUses) {
    if (!/@[0-9a-f]{40}$/.test(action)) fail(`Action is not pinned to a full SHA: ${action}`);
  }
  for (const [name, job] of Object.entries(workflow?.jobs ?? {})) {
    const contents = job?.permissions?.contents ?? workflow?.permissions?.contents;
    if (contents !== "read") {
      fail(`Job ${name} must keep contents read-only.`);
    }
  }
  const writers = Object.entries(workflow?.jobs ?? {}).filter(
    ([, job]) => (job?.permissions?.contents ?? workflow?.permissions?.contents) === "write",
  );
  if (writers.length !== 0) {
    fail("No image workflow job may receive contents write access.");
  }
  const expectedPermissions = {
    verify: { contents: "read" },
    "build-and-push": { contents: "read", packages: "write" },
    "update-tags": { contents: "read" },
  };
  if (!same(Object.keys(workflow?.jobs ?? {}), Object.keys(expectedPermissions))) {
    fail("Workflow jobs differ from the reviewed verify/build/update pipeline.");
  }
  for (const [name, permissions] of Object.entries(expectedPermissions)) {
    if (JSON.stringify(workflow?.jobs?.[name]?.permissions) !== JSON.stringify(permissions)) {
      fail(`Job ${name} permissions differ from the least-privilege contract.`);
    }
  }
  const verifyCommands = (workflow?.jobs?.verify?.steps ?? [])
    .map((step) => step?.run ?? "")
    .join("\n");
  if (
    !verifyCommands.includes("scripts/check-readonly-rbac.sh") ||
    !verifyCommands.includes("bash -n scripts/check-tailnet-boundary.sh")
  ) {
    fail("CI verify must enforce the deployment and tailnet boundary guards.");
  }
  const updateCommands = (workflow?.jobs?.["update-tags"]?.steps ?? [])
    .map((step) => step?.run ?? "")
    .join("\n");
  if (!updateCommands.includes("git push origin HEAD:deploy")) {
    fail("The image workflow must update only the deploy branch.");
  }
  const mergeIndex = updateCommands.indexOf("git merge --no-edit");
  const identityIndex = updateCommands.indexOf("git config user.name \"github-actions[bot]\"");
  if (mergeIndex < 0 || identityIndex < 0 || identityIndex > mergeIndex) {
    fail("The deploy workflow must configure its Git identity before a merge can commit.");
  }
  const updateCheckout = workflow?.jobs?.["update-tags"]?.steps?.find(
    (step) => typeof step?.uses === "string" && step.uses.startsWith("actions/checkout@"),
  );
  if (
    updateCheckout?.with?.["ssh-key"] !== "${{ secrets.DEPLOY_BRANCH_SSH_KEY }}" ||
    !updateCommands.includes("git remote set-url origin git@github.com:Isolumi/dum-dashboard.git")
  ) {
    fail("Deploy updates must authenticate with the dedicated deploy-key secret.");
  }
  const rollbackWorkflow = parse(readFileSync(process.env.ROLLBACK_WORKFLOW_PATH, "utf8"));
  if (
    rollbackWorkflow?.permissions?.contents !== "read" ||
    rollbackWorkflow?.jobs?.rollback?.permissions?.contents !== "read" ||
    !rollbackWorkflow?.on?.workflow_dispatch?.inputs?.deploy_commit?.required
  ) {
    fail("Rollback must be an explicit workflow dispatch with a read-only token.");
  }
  for (const step of rollbackWorkflow?.jobs?.rollback?.steps ?? []) {
    if (typeof step?.uses === "string" && !/@[0-9a-f]{40}$/.test(step.uses)) {
      fail(`Rollback action is not pinned to a full SHA: ${step.uses}`);
    }
  }
  const rollbackCommands = (rollbackWorkflow?.jobs?.rollback?.steps ?? [])
    .map((step) => step?.run ?? "")
    .join("\n");
  const rollbackCheckout = rollbackWorkflow?.jobs?.rollback?.steps?.find(
    (step) => typeof step?.uses === "string" && step.uses.startsWith("actions/checkout@"),
  );
  if (rollbackCheckout?.with?.["ssh-key"] !== "${{ secrets.DEPLOY_BRANCH_SSH_KEY }}") {
    fail("Rollback must authenticate with the dedicated deploy-key secret.");
  }
  for (const requiredCommand of [
    "git merge-base --is-ancestor",
    "git diff-tree --no-commit-id --name-only",
    "git revert --no-edit",
    "git push origin HEAD:deploy",
  ]) {
    if (!rollbackCommands.includes(requiredCommand)) {
      fail(`Rollback workflow is missing guard: ${requiredCommand}`);
    }
  }
  const traefikBoundary = parse(readFileSync(process.env.TRAEFIK_BOUNDARY_PATH, "utf8"));
  const traefikValues = parse(traefikBoundary?.spec?.valuesContent ?? "");
  if (
    traefikBoundary?.kind !== "HelmChartConfig" ||
    traefikBoundary?.metadata?.name !== "traefik" ||
    traefikBoundary?.metadata?.namespace !== "kube-system" ||
    !same(traefikValues?.service?.spec?.loadBalancerSourceRanges ?? [], ["100.64.0.0/10"])
  ) {
    fail("Traefik must restrict LoadBalancer sources to the Tailscale IPv4 range.");
  }
  for (const path of [process.env.DASHBOARD_DOCKERFILE, process.env.GATEWAY_DOCKERFILE]) {
    const fromLines = readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.startsWith("FROM "));
    if (
      fromLines.length === 0 ||
      fromLines.some((line) => !/^FROM [^\s@]+@sha256:[0-9a-f]{64}(?: AS \S+)?$/.test(line))
    ) {
      fail(`Every container base image must be pinned by digest: ${path}`);
    }
  }
'

echo "Deployment security policy is least-privilege and structurally enforced."
