import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseAllDocuments } from "yaml";

const projectId = "1617f220-140c-4a04-a8e7-468a71e4ff50";
const authName = "dum-dashboard-monies-infisical-auth";
const secretName = "dum-dashboard-tool-secrets";
const tokenName = "DUMQ_TOOL_TOKEN";

type Document = Record<string, unknown>;

const fail = (message: string): never => {
  throw new Error(message);
};

const asRecord = (value: unknown): Document | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Document) : undefined;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const valueAt = (value: unknown, ...keys: string[]): unknown => {
  let current = value;
  for (const key of keys) {
    current = asRecord(current)?.[key];
  }
  return current;
};

const loadDocuments = (path: string): Document[] =>
  parseAllDocuments(readFileSync(path, "utf8"))
    .map((document) => asRecord(document.toJSON()))
    .filter((document): document is Document => document !== undefined);

const findDocuments = (documents: Document[], kind: string, name: string): Document[] =>
  documents.filter(
    (document) => document.kind === kind && valueAt(document, "metadata", "name") === name,
  );

const findOneDocument = (documents: Document[], kind: string, name: string): Document => {
  const matches = findDocuments(documents, kind, name);
  if (matches.length !== 1) {
    fail(`Expected one ${kind}/${name}; found ${matches.length}.`);
  }
  return matches[0] ?? fail(`Missing ${kind}/${name}.`);
};

const podSpecFor = (document: Document): Document | undefined => {
  if (document.kind === "Pod") return asRecord(document.spec);
  if (document.kind === "CronJob") {
    return asRecord(valueAt(document, "spec", "jobTemplate", "spec", "template", "spec"));
  }
  if (
    ["DaemonSet", "Deployment", "Job", "ReplicaSet", "StatefulSet"].includes(String(document.kind))
  ) {
    return asRecord(valueAt(document, "spec", "template", "spec"));
  }
  return undefined;
};

const containersFor = (document: Document): Document[] => {
  const podSpec = podSpecFor(document);
  if (!podSpec) return [];
  return ["initContainers", "containers", "ephemeralContainers"].flatMap((field) =>
    asArray(podSpec[field])
      .map(asRecord)
      .filter((container): container is Document => container !== undefined),
  );
};

const tokenEntries = (container: Document): Document[] =>
  asArray(container.env)
    .map(asRecord)
    .filter((entry): entry is Document => entry?.name === tokenName);

const referencesToolSecret = (container: Document): boolean => {
  const explicitReference = asArray(container.env).some(
    (entry) => valueAt(entry, "valueFrom", "secretKeyRef", "name") === secretName,
  );
  const bulkReference = asArray(container.envFrom).some(
    (entry) => valueAt(entry, "secretRef", "name") === secretName,
  );
  return explicitReference || bulkReference;
};

const podReferencesToolSecretVolume = (document: Document): boolean => {
  const podSpec = podSpecFor(document);
  if (!podSpec) return false;

  return asArray(podSpec.volumes).some((volume) => {
    if (valueAt(volume, "secret", "secretName") === secretName) return true;
    return asArray(valueAt(volume, "projected", "sources")).some(
      (source) => valueAt(source, "secret", "name") === secretName,
    );
  });
};

const assertNoLiteralToken = (documents: Document[], renderedText: string): void => {
  for (const document of documents) {
    for (const container of containersFor(document)) {
      for (const entry of tokenEntries(container)) {
        if (Object.hasOwn(entry, "value")) {
          fail(`${tokenName} must not have a literal value in a workload.`);
        }
      }
    }

    if (document.kind === "ConfigMap" || document.kind === "Secret") {
      const data = asRecord(document.data);
      const stringData = asRecord(document.stringData);
      if (Object.hasOwn(data ?? {}, tokenName) || Object.hasOwn(stringData ?? {}, tokenName)) {
        fail(`${tokenName} must not be committed in a ConfigMap or Kubernetes Secret.`);
      }
    }
  }

  if (renderedText.includes("value: DUMQ_TOOL_TOKEN")) {
    fail("Rendered manifests must not contain a literal tool token value.");
  }
};

const assertDashboardSecretBoundary = (documents: Document[], renderName: string): void => {
  const deployment = findOneDocument(documents, "Deployment", "dum-dashboard");
  const dashboardContainers = containersFor(deployment).filter(
    (container) => container.name === "dashboard",
  );
  if (dashboardContainers.length !== 1) {
    fail(`${renderName}: expected one dashboard container.`);
  }

  const dashboard = dashboardContainers[0] ?? fail(`${renderName}: dashboard container missing.`);
  const entries = tokenEntries(dashboard);
  if (entries.length !== 1) {
    fail(`${renderName}: dashboard must have one explicit ${tokenName} environment entry.`);
  }

  const tokenEnv = entries[0] ?? fail(`${renderName}: ${tokenName} entry missing.`);
  if (
    valueAt(tokenEnv, "valueFrom", "secretKeyRef", "name") !== secretName ||
    valueAt(tokenEnv, "valueFrom", "secretKeyRef", "key") !== tokenName ||
    Object.hasOwn(tokenEnv, "value")
  ) {
    fail(`${renderName}: ${tokenName} must use the exact dedicated secretKeyRef.`);
  }

  if (
    asArray(dashboard.envFrom).some((entry) => valueAt(entry, "secretRef", "name") === secretName)
  ) {
    fail(`${renderName}: the tool Secret must not be loaded through envFrom.`);
  }

  for (const document of documents) {
    if (podReferencesToolSecretVolume(document)) {
      const workloadName = String(valueAt(document, "metadata", "name") ?? "unknown");
      fail(`${renderName}: ${workloadName} must not mount the tool Secret as a volume.`);
    }
    for (const container of containersFor(document)) {
      const isDashboard = document === deployment && container === dashboard;
      if (!isDashboard && (tokenEntries(container).length > 0 || referencesToolSecret(container))) {
        const workloadName = String(valueAt(document, "metadata", "name") ?? "unknown");
        const containerName = String(container.name ?? "unknown");
        fail(`${renderName}: ${workloadName}/${containerName} must not receive the tool Secret.`);
      }
    }
  }
};

const assertInfisicalContract = (documents: Document[]): void => {
  const toolSecret = findOneDocument(documents, "InfisicalStaticSecret", secretName);
  const sources = asArray(valueAt(toolSecret, "spec", "sources"));
  const targets = asArray(valueAt(toolSecret, "spec", "targets"));
  const source = sources[0];
  const target = targets[0];

  if (
    valueAt(toolSecret, "metadata", "namespace") !== "dum-dashboard" ||
    valueAt(toolSecret, "spec", "infisicalAuthRef", "name") !== authName ||
    valueAt(toolSecret, "spec", "infisicalAuthRef", "namespace") !== "dum-dashboard" ||
    valueAt(toolSecret, "spec", "syncOptions", "refreshInterval") !== "60s" ||
    valueAt(toolSecret, "spec", "syncOptions", "instantUpdates") !== false ||
    sources.length !== 1 ||
    valueAt(source, "projectId") !== projectId ||
    valueAt(source, "environmentSlug") !== "prod" ||
    valueAt(source, "secretPath") !== "/tool-api" ||
    targets.length !== 1 ||
    valueAt(target, "name") !== secretName ||
    valueAt(target, "namespace") !== "dum-dashboard" ||
    valueAt(target, "kind") !== "Secret" ||
    valueAt(target, "creationPolicy") !== "Owner"
  ) {
    fail("The tool API Infisical projection does not match the approved contract.");
  }
};

const assertNoToolApiIngressPath = (documents: Document[]): void => {
  for (const ingress of documents.filter((document) => document.kind === "Ingress")) {
    for (const rule of asArray(valueAt(ingress, "spec", "rules"))) {
      for (const path of asArray(valueAt(rule, "http", "paths"))) {
        const pathValue = valueAt(path, "path");
        if (typeof pathValue === "string" && pathValue.includes("/api/tools")) {
          fail("Ingress must not contain a /api/tools path.");
        }
      }
    }
  }
};

type CheckOptions = {
  baseRenderedPath: string;
  overlayRenderedPath: string;
};

export const checkToolApiManifests = (options: CheckOptions): void => {
  const baseText = readFileSync(options.baseRenderedPath, "utf8");
  const overlayText = readFileSync(options.overlayRenderedPath, "utf8");
  const baseDocuments = loadDocuments(options.baseRenderedPath);
  const overlayDocuments = loadDocuments(options.overlayRenderedPath);

  assertInfisicalContract(overlayDocuments);
  assertDashboardSecretBoundary(baseDocuments, "base render");
  assertDashboardSecretBoundary(overlayDocuments, "dumachine render");
  assertNoLiteralToken(baseDocuments, baseText);
  assertNoLiteralToken(overlayDocuments, overlayText);
  assertNoToolApiIngressPath(baseDocuments);
  assertNoToolApiIngressPath(overlayDocuments);
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
    checkToolApiManifests({
      baseRenderedPath: readArgument("--base-rendered"),
      overlayRenderedPath: readArgument("--overlay-rendered"),
    });
    console.info("DumQ tool API manifest and secret boundary: PASS");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Tool API manifest check failed.");
    process.exitCode = 1;
  }
}
