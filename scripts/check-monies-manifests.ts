import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

import * as ts from "typescript";
import { parseAllDocuments } from "yaml";

const expectedUrl = "http://monies.monies.svc.cluster.local:3333";
const privateHost = "monies.monies.svc.cluster.local";
const tokenName = "MONIES_API_TOKEN";
const expectedProjectId = "1617f220-140c-4a04-a8e7-468a71e4ff50";
const credentialSecretName = "dum-dashboard-monies-infisical-auth-credentials";
const targetSecretName = "dum-dashboard-monies-secrets";
const tokenBytes = Buffer.from(tokenName, "ascii");
const privateHostBytes = Buffer.from(privateHost, "ascii");
const viteMoniesPattern = /\bVITE_[A-Z0-9_]*MONIES[A-Z0-9_]*\b/i;
const tokenAssignmentPattern = /^\s*(?:export\s+)?MONIES_API_TOKEN\s*=/m;
const expectedDashboardLabels = {
  "app.kubernetes.io/name": "dum-dashboard",
  "app.kubernetes.io/component": "dashboard",
};

type CheckOptions = {
  repoRoot: string;
  renderedPath: string;
  publicDir: string;
};

const fail = (message: string): never => {
  throw new Error(message);
};

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonical(entry)]),
  );
};

const same = (actual: unknown, expected: unknown): boolean =>
  JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected));

const hasLabels = (
  actual: Record<string, string> | undefined,
  expected: Record<string, string>,
): boolean => Object.entries(expected).every(([key, value]) => actual?.[key] === value);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const hasDirectTokenValue = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(hasDirectTokenValue);
  const record = asRecord(value);
  if (!record) return false;
  if (record.name === tokenName && Object.hasOwn(record, "value")) return true;
  return Object.values(record).some(hasDirectTokenValue);
};

const loadDocuments = (path: string) =>
  parseAllDocuments(readFileSync(path, "utf8"))
    .map((document) => document.toJSON())
    .filter(Boolean);

const findDocument = (documents: ReturnType<typeof loadDocuments>, kind: string, name: string) =>
  documents.find((document) => document?.kind === kind && document?.metadata?.name === name);

const normalizedRelativePath = (repoRoot: string, path: string): string =>
  relative(repoRoot, path).split(sep).join("/");

const readText = (path: string): string | undefined => {
  const contents = readFileSync(path);
  if (contents.includes(0)) return undefined;
  return contents.toString("utf8");
};

const trackedCandidatePaths = (repoRoot: string): string[] => {
  const result = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.status !== 0) {
    fail("Could not list tracked files for the Monies client-secret check.");
  }

  return (result.stdout ?? "").split("\0").filter(Boolean).sort();
};

const isEnvironmentFile = (path: string): boolean => {
  const name = basename(path);
  return name === ".env" || name.startsWith(".env.");
};

const isKubernetesYaml = (path: string): boolean =>
  path.startsWith("k8s/") && /\.ya?ml$/i.test(path);

const isJavaScriptOrTypeScript = (path: string): boolean => /\.(?:[cm]?[jt]s|[jt]sx)$/i.test(path);

const hasDirectTokenIdentifierAssignment = (path: string, contents: string): boolean => {
  const sourceFile = ts.createSourceFile(path, contents, ts.ScriptTarget.Latest, true);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === tokenName &&
      node.initializer
    ) {
      found = true;
      return;
    }
    if (ts.isBinaryExpression(node)) {
      let assignmentTarget = node.left;
      while (ts.isParenthesizedExpression(assignmentTarget)) {
        assignmentTarget = assignmentTarget.expression;
      }
      if (
        ts.isIdentifier(assignmentTarget) &&
        assignmentTarget.text === tokenName &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
};

const inspectKubernetesFile = (
  relativePath: string,
  contents: string,
  violations: string[],
): void => {
  const documents = parseAllDocuments(contents);
  for (const [index, document] of documents.entries()) {
    if (document.errors.length > 0) {
      violations.push(`${relativePath}: Kubernetes YAML document ${index + 1} is invalid.`);
      continue;
    }

    const resource = document.toJSON();
    if (!resource) continue;
    if (resource.kind === "Secret") {
      const secretName = resource.metadata?.name;
      const data = resource.data ?? {};
      const stringData = resource.stringData ?? {};
      if (secretName === credentialSecretName) {
        violations.push(`${relativePath}: Universal Auth credential Secret must not be committed.`);
      }
      if (Object.hasOwn(data, tokenName) || Object.hasOwn(stringData, tokenName)) {
        violations.push(`${relativePath}: Monies API token must not be committed in a Secret.`);
      }
    }
    if (resource.kind === "ConfigMap" && Object.hasOwn(resource.data ?? {}, tokenName)) {
      violations.push(`${relativePath}: Monies API token must not be stored in a ConfigMap.`);
    }
    if (hasDirectTokenValue(resource)) {
      violations.push(`${relativePath}: Monies API token must not have a direct workload value.`);
    }
  }
};

const inspectTrackedFiles = (repoRoot: string): string[] => {
  const violations: string[] = [];
  for (const relativePath of trackedCandidatePaths(repoRoot)) {
    const absolutePath = join(repoRoot, relativePath);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) continue;
    const contents = readText(absolutePath);
    if (contents === undefined) continue;

    if (viteMoniesPattern.test(contents)) {
      violations.push(`${relativePath}: Monies VITE variable must not be committed.`);
    }
    if (isEnvironmentFile(relativePath) && tokenAssignmentPattern.test(contents)) {
      violations.push(`${relativePath}: Monies API token assignment must not be committed.`);
    }
    if (
      isJavaScriptOrTypeScript(relativePath) &&
      hasDirectTokenIdentifierAssignment(relativePath, contents)
    ) {
      violations.push(
        `${relativePath}: Monies API token identifier must not be assigned directly.`,
      );
    }
    if (
      (relativePath === ".github/workflows/build-images.yml" ||
        basename(relativePath).startsWith("Dockerfile")) &&
      contents.includes(tokenName)
    ) {
      violations.push(`${relativePath}: Monies API token must not be a CI or image build input.`);
    }
    if (isKubernetesYaml(relativePath)) {
      inspectKubernetesFile(relativePath, contents, violations);
    }
  }
  return violations;
};

const allFiles = (root: string): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...allFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
};

const inspectBuiltPublicFiles = (repoRoot: string, publicDir: string): string[] => {
  if (!existsSync(publicDir) || !statSync(publicDir).isDirectory()) {
    fail(
      `${normalizedRelativePath(repoRoot, publicDir)}: built public directory is missing; run bun run build first.`,
    );
  }

  const violations: string[] = [];
  for (const path of allFiles(publicDir)) {
    const contents = readFileSync(path);
    const bytePreservingText = contents.toString("latin1");
    const relativePath = normalizedRelativePath(repoRoot, path);
    if (contents.includes(tokenBytes)) {
      violations.push(`${relativePath}: built public artifact contains the Monies API token name.`);
    }
    if (viteMoniesPattern.test(bytePreservingText)) {
      violations.push(`${relativePath}: built public artifact contains a Monies VITE token name.`);
    }
    if (contents.includes(privateHostBytes)) {
      violations.push(`${relativePath}: built public artifact contains the private Monies host.`);
    }
  }
  return violations;
};

const checkRenderedManifestContract = ({ repoRoot, renderedPath }: CheckOptions): void => {
  const documents = loadDocuments(renderedPath);
  const dashboardConfig = findDocument(documents, "ConfigMap", "dum-dashboard-config");
  if (dashboardConfig?.data?.MONIES_API_URL !== expectedUrl) {
    fail("dum-dashboard-config must contain the exact private Monies service URL.");
  }
  for (const configMap of documents.filter((document) => document.kind === "ConfigMap")) {
    if (Object.hasOwn(configMap.data ?? {}, tokenName)) {
      fail("MONIES_API_TOKEN must not be stored in a ConfigMap.");
    }
  }

  const envExamplePath = join(repoRoot, ".env.example");
  const envExample = readFileSync(envExamplePath, "utf8");
  const urlAssignments = envExample
    .split(/\r?\n/)
    .filter((line) => line.startsWith("MONIES_API_URL="));
  if (!same(urlAssignments, [`MONIES_API_URL=${expectedUrl}`])) {
    fail(".env.example must contain one exact server-only MONIES_API_URL assignment.");
  }
  if (tokenAssignmentPattern.test(envExample) || viteMoniesPattern.test(envExample)) {
    fail(".env.example must not contain the Monies token or a VITE Monies variable.");
  }

  const deployment = findDocument(documents, "Deployment", "dum-dashboard");
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
    envFrom.length !== 3
  ) {
    fail("Dashboard envFrom must load the Monies Secret as its second secretRef.");
  }
  if (hasDirectTokenValue(documents)) {
    fail("MONIES_API_TOKEN must not have a direct value in rendered workloads.");
  }

  const connection = findDocument(documents, "InfisicalConnection", "infisical-cloud");
  if (
    connection?.metadata?.namespace !== "dum-dashboard" ||
    connection?.spec?.address !== "https://app.infisical.com"
  ) {
    fail("The dashboard Infisical connection is missing or invalid.");
  }

  const auth = findDocument(documents, "InfisicalAuth", "dum-dashboard-monies-infisical-auth");
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
      (document) => document.kind === "Secret" && document.metadata?.name === credentialSecretName,
    )
  ) {
    fail("Dashboard Universal Auth credentials must never be committed.");
  }

  const staticSecret = findDocument(
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

  const dashboardPolicy = findDocument(documents, "NetworkPolicy", "dum-dashboard-traefik-only");
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
    if (
      policy.spec?.policyTypes?.includes("Egress") ||
      Object.hasOwn(policy.spec ?? {}, "egress")
    ) {
      fail("Task 12 must not add a dashboard egress policy.");
    }
  }
};

export const checkMoniesRepository = (options: CheckOptions): void => {
  checkRenderedManifestContract(options);
  const violations = [
    ...inspectTrackedFiles(options.repoRoot),
    ...inspectBuiltPublicFiles(options.repoRoot, options.publicDir),
  ];
  if (violations.length > 0) {
    fail(`Monies client-secret boundary violations:\n${violations.sort().join("\n")}`);
  }
};

const readArgument = (name: string): string => {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) fail(`Missing required argument ${name}.`);
  return resolve(value);
};

if (import.meta.main) {
  try {
    checkMoniesRepository({
      repoRoot: readArgument("--repo-root"),
      renderedPath: readArgument("--rendered"),
      publicDir: readArgument("--public-dir"),
    });
    console.info(
      "Monies manifests and client-secret boundary: PASS " +
        "(dum-dashboard/dashboard -> monies:3333)",
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Monies manifest check failed.");
    process.exitCode = 1;
  }
}
