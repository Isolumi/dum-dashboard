import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import * as ts from "typescript";
import { parseAllDocuments } from "yaml";

const image =
  "ghcr.io/alexxit/go2rtc:1.9.14@sha256:1120820fa7405c7655c71928c1f919feaa031fbb34fdc13ebe716006179fe346";
const projectId = "1617f220-140c-4a04-a8e7-468a71e4ff50";
const secretName = "dum-dashboard-camera-secrets";
const usernameKey = "TAPO_CAMERA_USERNAME";
const passwordKey = "TAPO_CAMERA_PASSWORD";
const hostKey = "TAPO_CAMERA_HOST";
const cameraHost = "192.168.2.44";
const cameraKeys = [usernameKey, passwordKey];
const allowedModules = ["api", "ws", "rtsp", "mp4"];
const allowedPaths = ["/camera-stream/", "/camera-stream/api/ws", "/camera-stream/api/streams"];
const expectedCameraLabels: Record<string, string> = {
  "app.kubernetes.io/component": "camera-stream",
  "app.kubernetes.io/name": "go2rtc",
};
const traefikSource = {
  namespaceSelector: { matchLabels: { "kubernetes.io/metadata.name": "kube-system" } },
  podSelector: {
    matchLabels: {
      "app.kubernetes.io/instance": "traefik-kube-system",
      "app.kubernetes.io/name": "traefik",
    },
  },
};
const allowedKeyPaths = new Set([
  "scripts/check-camera-manifests.ts",
  "tests/-check-camera-manifests.test.ts",
  "k8s/overlays/dumachine/camera-config.yml",
  "k8s/base/go2rtc-deployment.yml",
  "k8s/overlays/dumachine/camera-infisical.yml",
  "docs/superpowers/specs/2026-08-21-tapo-camera-dashboard-design.md",
  "docs/superpowers/plans/2026-08-21-tapo-camera-dashboard.md",
  "docs/homelab-dashboard-operations.md",
]);
const cameraConfigPath = "k8s/overlays/dumachine/camera-config.yml";
const documentationRtspPaths = new Set([
  "docs/superpowers/specs/2026-08-21-tapo-camera-dashboard-design.md",
  "docs/superpowers/plans/2026-08-21-tapo-camera-dashboard.md",
  "docs/homelab-dashboard-operations.md",
]);
const rtspPatternPaths = new Set([
  "scripts/check-camera-manifests.ts",
  "tests/-check-camera-manifests.test.ts",
]);
const usernameBytes = Buffer.from(usernameKey, "ascii");
const passwordBytes = Buffer.from(passwordKey, "ascii");
const rtspBytes = Buffer.from("rtsp://", "ascii");
const hostBytes = Buffer.from(cameraHost, "ascii");
const viteCameraPattern = /\bVITE_TAPO_CAMERA_(?:USERNAME|PASSWORD)\b/;

export type CameraCheckOptions = {
  repoRoot: string;
  renderedPath: string;
  publicDir: string;
};

type Document = Record<string, any>;

const fail = (message: string): never => {
  throw new Error(message);
};

const asRecord = (value: unknown): Record<string, any> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : undefined;

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  const record = asRecord(value);
  if (!record) return value;
  return Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonical(entry)]),
  );
};

const same = (actual: unknown, expected: unknown): boolean =>
  JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected));

const normalizedRelativePath = (repoRoot: string, path: string): string =>
  relative(repoRoot, path).split(sep).join("/");

const readText = (path: string): string | undefined => {
  const contents = readFileSync(path);
  return contents.includes(0) ? undefined : contents.toString("utf8");
};

const trackedPaths = (repoRoot: string): string[] => {
  const result = spawnSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) fail("Could not list Git-tracked files for the camera boundary check.");
  return (result.stdout ?? "").split("\0").filter(Boolean).sort();
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

const loadDocuments = (path: string): Document[] =>
  parseAllDocuments(readFileSync(path, "utf8")).map((document, index) => {
    if (document.errors.length > 0) fail(`Rendered YAML document ${index + 1} is invalid.`);
    return document.toJSON() as Document;
  });

const findDocument = (documents: Document[], kind: string, name: string): Document | undefined =>
  documents.find((document) => document?.kind === kind && document?.metadata?.name === name);

const containsCameraKey = (value: unknown): boolean => {
  if (typeof value === "string") return cameraKeys.some((key) => value.includes(key));
  if (Array.isArray(value)) return value.some(containsCameraKey);
  const record = asRecord(value);
  return record
    ? Object.entries(record).some(
        ([key, entry]) => containsCameraKey(key) || containsCameraKey(entry),
      )
    : false;
};

const hasDirectCameraValue = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(hasDirectCameraValue);
  const record = asRecord(value);
  if (!record) return false;
  if (cameraKeys.includes(record.name) && Object.hasOwn(record, "value")) return true;
  return Object.values(record).some(hasDirectCameraValue);
};

const hasDirectIdentifierAssignment = (path: string, contents: string): boolean => {
  if (!/\.(?:[cm]?[jt]s|[jt]sx)$/i.test(path)) return false;
  const source = ts.createSourceFile(path, contents, ts.ScriptTarget.Latest, true);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      cameraKeys.includes(node.name.text) &&
      node.initializer
    ) {
      found = true;
      return;
    }
    if (ts.isBinaryExpression(node)) {
      let target = node.left;
      while (ts.isParenthesizedExpression(target)) target = target.expression;
      if (
        ts.isIdentifier(target) &&
        cameraKeys.includes(target.text) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

const isKubernetesYaml = (path: string): boolean =>
  path.startsWith("k8s/") && /\.ya?ml$/i.test(path);

const validSourceTemplate = (contents: string): boolean => {
  const expected = [
    `rtsp://\${${usernameKey}}:\${${passwordKey}}@\${${hostKey}}:554/stream1`,
    `rtsp://\${${usernameKey}}:\${${passwordKey}}@\${${hostKey}}:554/stream2`,
  ];
  const found = contents.match(/rtsp:\/\/[^\s"'`]+/g) ?? [];
  return same(found.sort(), expected.sort());
};

const hasConcreteCredentialBearingRtspUrl = (contents: string): boolean =>
  (contents.match(/rtsp:\/\/[^\s"'`]+/g) ?? []).some((url) => {
    const at = url.indexOf("@");
    if (at < 0) return false;
    const userInfo = url.slice("rtsp://".length, at);
    return !(
      userInfo === "..." || /^(?:\$\{[^}]+\}|<[^>]+>)(?::(?:\$\{[^}]+\}|<[^>]+>))?$/.test(userInfo)
    );
  });

const inspectTrackedKubernetesFile = (
  relativePath: string,
  contents: string,
  violations: string[],
): void => {
  for (const [index, document] of parseAllDocuments(contents).entries()) {
    if (document.errors.length > 0) {
      violations.push(`${relativePath}: Kubernetes YAML document ${index + 1} is invalid.`);
      continue;
    }
    const resource = document.toJSON() as Document | undefined;
    if (!resource) continue;
    if (resource.kind === "Secret") {
      const data = resource.data ?? {};
      const stringData = resource.stringData ?? {};
      if (cameraKeys.some((key) => Object.hasOwn(data, key) || Object.hasOwn(stringData, key))) {
        violations.push(`${relativePath}: camera Secret data must not be committed.`);
      }
    }
    if (
      resource.kind === "ConfigMap" &&
      cameraKeys.some((key) => Object.hasOwn(resource.data ?? {}, key))
    ) {
      violations.push(`${relativePath}: camera credentials must not be ConfigMap values.`);
    }
    if (hasDirectCameraValue(resource)) {
      violations.push(
        `${relativePath}: camera credentials must use secretKeyRef, not a direct value.`,
      );
    }
  }
};

const inspectTrackedFiles = (repoRoot: string): string[] => {
  const violations: string[] = [];
  for (const relativePath of trackedPaths(repoRoot)) {
    const absolutePath = join(repoRoot, relativePath);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) continue;
    const contents = readText(absolutePath);
    if (contents === undefined) continue;
    if (viteCameraPattern.test(contents) && !documentationRtspPaths.has(relativePath)) {
      violations.push(`${relativePath}: browser camera credential variable must not be committed.`);
    }
    if (!allowedKeyPaths.has(relativePath) && containsCameraKey(contents)) {
      violations.push(`${relativePath}: camera secret key name is not permitted in this file.`);
    }
    const hasRtspMarker = contents.includes("rtsp://");
    if (relativePath === cameraConfigPath && hasRtspMarker && !validSourceTemplate(contents)) {
      violations.push(
        `${relativePath}: only the approved unexpanded RTSP templates are permitted.`,
      );
    }
    if (documentationRtspPaths.has(relativePath) && hasConcreteCredentialBearingRtspUrl(contents)) {
      violations.push(
        `${relativePath}: concrete credential-bearing RTSP URL must not be committed.`,
      );
    }
    if (
      hasRtspMarker &&
      relativePath !== cameraConfigPath &&
      !documentationRtspPaths.has(relativePath) &&
      !rtspPatternPaths.has(relativePath)
    ) {
      violations.push(
        `${relativePath}: RTSP URL or template is not permitted in runtime/source files.`,
      );
    }
    if (hasDirectIdentifierAssignment(relativePath, contents)) {
      violations.push(`${relativePath}: camera secret identifier must not be assigned directly.`);
    }
    if (isKubernetesYaml(relativePath))
      inspectTrackedKubernetesFile(relativePath, contents, violations);
  }
  return violations;
};

const inspectBuiltPublicFiles = (repoRoot: string, publicDir: string): string[] => {
  if (!existsSync(publicDir) || !statSync(publicDir).isDirectory()) {
    fail(
      `${normalizedRelativePath(repoRoot, publicDir)}: built public directory is missing; run bun run build first.`,
    );
  }
  const forbidden = [
    [usernameBytes, "camera username key"],
    [passwordBytes, "camera password key"],
    [rtspBytes, "RTSP URL marker"],
    [hostBytes, "camera host"],
  ] as const;
  const violations: string[] = [];
  for (const path of allFiles(publicDir)) {
    const contents = readFileSync(path);
    const relativePath = normalizedRelativePath(repoRoot, path);
    for (const [needle, label] of forbidden) {
      if (contents.includes(needle)) {
        violations.push(`${relativePath}: built public artifact contains a ${label}.`);
      }
    }
  }
  return violations;
};

const validateConfigMap = (documents: Document[]): void => {
  const configMap = findDocument(documents, "ConfigMap", "go2rtc-config");
  const data = configMap?.data;
  if (
    configMap?.metadata?.namespace !== "dum-dashboard" ||
    data?.[hostKey] !== cameraHost ||
    typeof data?.["go2rtc.yml"] !== "string" ||
    cameraKeys.some((key) => Object.hasOwn(data, key))
  ) {
    fail("go2rtc ConfigMap must contain only the approved camera host and configuration.");
  }
  const config = parseAllDocuments(data["go2rtc.yml"])[0];
  if (!config || config.errors.length > 0) fail("go2rtc ConfigMap configuration is invalid YAML.");
  const value = config.toJSON() as Document;
  const expectedStreams = {
    "camera-high": `rtsp://\${${usernameKey}}:\${${passwordKey}}@\${${hostKey}}:554/stream1`,
    "camera-low": `rtsp://\${${usernameKey}}:\${${passwordKey}}@\${${hostKey}}:554/stream2`,
  };
  if (
    !same(value?.app?.modules, allowedModules) ||
    value?.api?.listen !== ":1984" ||
    value?.api?.base_path !== "/camera-stream" ||
    !same(value?.api?.allow_paths, allowedPaths) ||
    value?.api?.origin === "*" ||
    value?.rtsp?.listen !== "" ||
    value?.webrtc?.listen !== "" ||
    value?.srtp?.listen !== "" ||
    !same(value?.streams, expectedStreams)
  ) {
    fail("go2rtc ConfigMap does not match the approved module, HTTP, and stream contract.");
  }
};

const validateDeployments = (documents: Document[]): void => {
  const deployment = findDocument(documents, "Deployment", "go2rtc");
  const pod = deployment?.spec?.template?.spec;
  const container = pod?.containers?.find((entry: Document) => entry.name === "go2rtc");
  const expectedPodSecurity = {
    fsGroup: 65532,
    runAsGroup: 65532,
    runAsNonRoot: true,
    runAsUser: 65532,
    seccompProfile: { type: "RuntimeDefault" },
  };
  const expectedContainerSecurity = {
    allowPrivilegeEscalation: false,
    capabilities: { drop: ["ALL"] },
    readOnlyRootFilesystem: true,
  };
  const expectedResources = {
    limits: { cpu: "250m", memory: "256Mi" },
    requests: { cpu: "25m", memory: "32Mi" },
  };
  const environment = container?.env ?? [];
  const environmentByName = Object.fromEntries(
    environment.map((entry: Document) => [entry.name, entry]),
  );
  const validSecretReference = (key: string): boolean =>
    environmentByName[key]?.valueFrom?.secretKeyRef?.name === secretName &&
    environmentByName[key]?.valueFrom?.secretKeyRef?.key === key &&
    environmentByName[key]?.valueFrom?.secretKeyRef?.optional !== true &&
    !Object.hasOwn(environmentByName[key] ?? {}, "value");
  if (
    deployment?.metadata?.namespace !== "dum-dashboard" ||
    deployment?.spec?.replicas !== 1 ||
    deployment?.spec?.strategy?.type !== "Recreate" ||
    pod?.automountServiceAccountToken !== false ||
    !same(pod?.securityContext, expectedPodSecurity) ||
    pod?.containers?.length !== 1 ||
    !container ||
    container.image !== image ||
    !same(container.securityContext, expectedContainerSecurity) ||
    !same(container.resources, expectedResources) ||
    !same(container.ports, [{ containerPort: 1984, name: "http", protocol: "TCP" }]) ||
    environment.length !== 3 ||
    environmentByName[hostKey]?.valueFrom?.configMapKeyRef?.name !== "go2rtc-config" ||
    environmentByName[hostKey]?.valueFrom?.configMapKeyRef?.key !== hostKey ||
    !validSecretReference(usernameKey) ||
    !validSecretReference(passwordKey)
  ) {
    fail("go2rtc Deployment does not match the immutable image, secret, or security contract.");
  }
};

const podSpecs = (document: Document): Document[] => {
  if (document?.metadata?.namespace !== "dum-dashboard") return [];
  const directPodSpec = document.kind === "Pod" ? document.spec : document.spec?.template?.spec;
  const cronJobPodSpec = document.spec?.jobTemplate?.spec?.template?.spec;
  return [directPodSpec, cronJobPodSpec].filter(Boolean);
};

const secretVolumeReferencesCameraSecret = (volume: Document): boolean =>
  volume?.secret?.secretName === secretName ||
  (volume?.projected?.sources ?? []).some(
    (source: Document) => source?.secret?.name === secretName,
  );

const validateCameraSecretInjection = (documents: Document[]): void => {
  for (const document of documents) {
    for (const pod of podSpecs(document)) {
      if ((pod.volumes ?? []).some(secretVolumeReferencesCameraSecret)) {
        fail("Camera Secret must not be mounted as a pod volume.");
      }
      for (const [containerType, containers] of [
        ["containers", pod.containers ?? []],
        ["initContainers", pod.initContainers ?? []],
        ["ephemeralContainers", pod.ephemeralContainers ?? []],
      ] as const) {
        for (const container of containers) {
          const isGo2rtcMainContainer =
            document.kind === "Deployment" &&
            document.metadata?.name === "go2rtc" &&
            containerType === "containers" &&
            container.name === "go2rtc";
          const usesCameraEnvFrom = (container.envFrom ?? []).some(
            (entry: Document) => entry?.secretRef?.name === secretName,
          );
          const cameraSecretEnv = (container.env ?? []).filter(
            (entry: Document) => entry?.valueFrom?.secretKeyRef?.name === secretName,
          );
          const hasUnexpectedGo2rtcReference = cameraSecretEnv.some(
            (entry: Document) =>
              !cameraKeys.includes(entry.name) || entry.valueFrom?.secretKeyRef?.key !== entry.name,
          );
          if (
            usesCameraEnvFrom ||
            hasUnexpectedGo2rtcReference ||
            (!isGo2rtcMainContainer && cameraSecretEnv.length > 0)
          ) {
            fail("Only the go2rtc main container may reference the camera Secret by secretKeyRef.");
          }
        }
      }
    }
  }
};

const validateService = (documents: Document[]): void => {
  const service = findDocument(documents, "Service", "go2rtc");
  if (
    service?.metadata?.namespace !== "dum-dashboard" ||
    service?.spec?.type !== "ClusterIP" ||
    !same(service?.spec?.ports, [{ name: "http", port: 1984, protocol: "TCP", targetPort: "http" }])
  ) {
    fail("go2rtc Service must be ClusterIP-only with one TCP 1984 port.");
  }
};

const validateIngress = (documents: Document[]): void => {
  const ingress = findDocument(documents, "Ingress", "dum-dashboard");
  const paths = ingress?.spec?.rules?.flatMap((rule: Document) => rule.http?.paths ?? []) ?? [];
  const cameraPaths = paths.filter((path: Document) => path.backend?.service?.name === "go2rtc");
  const expectedCameraPaths = ["/camera-stream/video-rtc.js", "/camera-stream/api/ws"];
  const allIngresses = documents.filter(
    (document) => document.kind === "Ingress" && document.metadata?.namespace === "dum-dashboard",
  );
  const allCameraPaths = allIngresses
    .flatMap((resource) =>
      (resource.spec?.rules ?? []).flatMap((rule: Document) => rule.http?.paths ?? []),
    )
    .filter((path: Document) => path.backend?.service?.name === "go2rtc");
  const hasGo2rtcDefaultBackend = allIngresses.some(
    (resource) => resource.spec?.defaultBackend?.service?.name === "go2rtc",
  );
  if (
    ingress?.metadata?.namespace !== "dum-dashboard" ||
    cameraPaths.length !== 2 ||
    allCameraPaths.length !== 2 ||
    hasGo2rtcDefaultBackend ||
    !same(
      cameraPaths.map((path: Document) => ({
        path: path.path,
        pathType: path.pathType,
        port: path.backend?.service?.port?.number,
      })),
      expectedCameraPaths.map((path) => ({ path, pathType: "Exact", port: 1984 })),
    ) ||
    !same(
      allCameraPaths.map((path: Document) => ({
        path: path.path,
        pathType: path.pathType,
        port: path.backend?.service?.port?.number,
      })),
      expectedCameraPaths.map((path) => ({ path, pathType: "Exact", port: 1984 })),
    ) ||
    !paths.some(
      (path: Document) =>
        path.path === "/" &&
        path.pathType === "Prefix" &&
        path.backend?.service?.name === "dum-dashboard" &&
        path.backend?.service?.port?.number === 3000,
    )
  ) {
    fail(
      "Ingress must expose only the two exact go2rtc paths and preserve dashboard root routing.",
    );
  }
};

const selectorCanMatchCamera = (selector: unknown): boolean => {
  const value = asRecord(selector);
  if (!value) return true;
  if (Object.keys(value).some((key) => key !== "matchLabels" && key !== "matchExpressions")) {
    return true;
  }
  const matchLabels = asRecord(value.matchLabels);
  if (value.matchLabels !== undefined && !matchLabels) return true;
  if (
    matchLabels &&
    Object.entries(matchLabels).some(
      ([key, expected]) =>
        typeof expected !== "string" ||
        (Object.hasOwn(expectedCameraLabels, key) && expectedCameraLabels[key] !== expected),
    )
  ) {
    return false;
  }
  if (value.matchExpressions === undefined) return true;
  if (!Array.isArray(value.matchExpressions)) return true;
  for (const expression of value.matchExpressions) {
    const requirement = asRecord(expression);
    const key = requirement?.key;
    const operator = requirement?.operator;
    const values = requirement?.values;
    if (typeof key !== "string" || typeof operator !== "string") return true;
    const cameraValue = expectedCameraLabels[key];
    if (operator === "In") {
      if (!Array.isArray(values) || !values.every((entry) => typeof entry === "string"))
        return true;
      if (cameraValue !== undefined && !values.includes(cameraValue)) return false;
    } else if (operator === "NotIn") {
      if (!Array.isArray(values) || !values.every((entry) => typeof entry === "string"))
        return true;
      if (cameraValue !== undefined && values.includes(cameraValue)) return false;
    } else if (operator === "Exists") {
      if (cameraValue === undefined || values !== undefined) return true;
    } else if (operator === "DoesNotExist") {
      if (cameraValue !== undefined) return false;
      if (values !== undefined) return true;
    } else {
      return true;
    }
  }
  return true;
};

const policyAddsTrafficAllowance = (policy: Document): boolean =>
  ["ingress", "egress"].some((field) => {
    const rules = policy.spec?.[field];
    return Object.hasOwn(policy.spec ?? {}, field) && (!Array.isArray(rules) || rules.length > 0);
  });

const validateInfisical = (documents: Document[]): void => {
  const resource = findDocument(documents, "InfisicalStaticSecret", secretName);
  if (
    resource?.apiVersion !== "secrets.infisical.com/v1beta1" ||
    resource?.metadata?.namespace !== "dum-dashboard" ||
    resource?.spec?.infisicalAuthRef?.name !== "dum-dashboard-monies-infisical-auth" ||
    resource?.spec?.infisicalAuthRef?.namespace !== "dum-dashboard" ||
    !same(resource?.spec?.syncOptions, {
      instantUpdates: false,
      refreshInterval: "60s",
    }) ||
    !same(resource?.spec?.sources, [
      { environmentSlug: "prod", projectId, secretPath: "/camera" },
    ]) ||
    !same(resource?.spec?.targets, [
      { creationPolicy: "Owner", kind: "Secret", name: secretName, namespace: "dum-dashboard" },
    ])
  ) {
    fail("Infisical must sync only the approved prod /camera path into the camera Secret.");
  }
};

const validateNetworkPolicy = (documents: Document[]): void => {
  const policies = documents.filter(
    (document) =>
      document.kind === "NetworkPolicy" &&
      document.metadata?.namespace === "dum-dashboard" &&
      same(document.spec?.podSelector?.matchLabels, expectedCameraLabels),
  );
  const cameraSelectingPolicies = documents.filter(
    (document) =>
      document.kind === "NetworkPolicy" &&
      document.metadata?.namespace === "dum-dashboard" &&
      selectorCanMatchCamera(document.spec?.podSelector),
  );
  const policy = policies[0];
  if (
    policies.length !== 1 ||
    policy?.metadata?.namespace !== "dum-dashboard" ||
    !same(policy.spec?.policyTypes, ["Ingress", "Egress"]) ||
    !same(policy.spec?.ingress, [
      { from: [traefikSource], ports: [{ port: 1984, protocol: "TCP" }] },
    ]) ||
    !same(policy.spec?.egress, [
      {
        ports: [{ port: 554, protocol: "TCP" }],
        to: [{ ipBlock: { cidr: "192.168.2.44/32" } }],
      },
    ])
  ) {
    fail("Camera NetworkPolicy must allow only Traefik ingress and camera RTSP egress.");
  }
  if (
    cameraSelectingPolicies.some(
      (candidate) => candidate !== policy && policyAddsTrafficAllowance(candidate),
    )
  ) {
    fail("No additional NetworkPolicy may add ingress or egress allowances for go2rtc.");
  }
};

const checkRenderedManifestContract = (options: CameraCheckOptions): void => {
  const documents = loadDocuments(options.renderedPath);
  if (hasDirectCameraValue(documents))
    fail("Camera credentials must not have direct rendered values.");
  validateConfigMap(documents);
  validateDeployments(documents);
  validateCameraSecretInjection(documents);
  validateService(documents);
  validateIngress(documents);
  validateInfisical(documents);
  validateNetworkPolicy(documents);
};

export const checkCameraRepository = (options: CameraCheckOptions): void => {
  checkRenderedManifestContract(options);
  const violations = [
    ...inspectTrackedFiles(options.repoRoot),
    ...inspectBuiltPublicFiles(options.repoRoot, options.publicDir),
  ];
  if (violations.length > 0) {
    fail(`Camera secret and network boundary violations:\n${violations.sort().join("\n")}`);
  }
};

const readArgument = (name: string): string => {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (typeof value !== "string" || value.length === 0) {
    fail(`Missing required argument ${name}.`);
  }
  return resolve(value ?? "");
};

if (import.meta.main) {
  try {
    checkCameraRepository({
      publicDir: readArgument("--public-dir"),
      renderedPath: readArgument("--rendered"),
      repoRoot: readArgument("--repo-root"),
    });
    console.info("Camera manifest and public-boundary contract: PASS");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Camera manifest check failed.");
    process.exitCode = 1;
  }
}
