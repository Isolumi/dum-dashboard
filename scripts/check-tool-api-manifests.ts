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

const podSpecsFor = (document: Document): Document[] => {
  const candidates = [
    document.kind === "Pod" ? document.spec : undefined,
    document.kind === "PodTemplate" ? valueAt(document, "template", "spec") : undefined,
    valueAt(document, "spec", "template", "spec"),
    valueAt(document, "spec", "jobTemplate", "spec", "template", "spec"),
  ];
  return candidates
    .map(asRecord)
    .filter((podSpec): podSpec is Document => podSpec !== undefined)
    .filter((podSpec, index, podSpecs) => podSpecs.indexOf(podSpec) === index);
};

type ContainerLocation = {
  container: Document;
  document: Document;
  field: string;
};

const containerLocationsFor = (document: Document): ContainerLocation[] => {
  return podSpecsFor(document).flatMap((podSpec) =>
    ["initContainers", "containers", "ephemeralContainers"].flatMap((field) =>
      asArray(podSpec[field])
        .map(asRecord)
        .filter((container): container is Document => container !== undefined)
        .map((container) => ({ container, document, field })),
    ),
  );
};

type EnvironmentLocation = ContainerLocation & {
  entry: Document;
};

const environmentLocations = (documents: Document[]): EnvironmentLocation[] =>
  documents.flatMap((document) =>
    containerLocationsFor(document).flatMap((location) =>
      asArray(location.container.env)
        .map(asRecord)
        .filter((entry): entry is Document => entry !== undefined)
        .map((entry) => ({ ...location, entry })),
    ),
  );

const secretKeyRefFor = (entry: Document): Document | undefined =>
  asRecord(valueAt(entry, "valueFrom", "secretKeyRef"));

const isToolTokenReference = (entry: Document): boolean => {
  const reference = secretKeyRefFor(entry);
  return reference?.name === secretName || reference?.key === tokenName;
};

const podReferencesToolSecretVolume = (document: Document): boolean => {
  return podSpecsFor(document).some((podSpec) =>
    asArray(podSpec.volumes).some((volume) => {
      if (valueAt(volume, "secret", "secretName") === secretName) return true;
      return asArray(valueAt(volume, "projected", "sources")).some(
        (source) => valueAt(source, "secret", "name") === secretName,
      );
    }),
  );
};

const assertNoLiteralToken = (documents: Document[], renderedText: string): void => {
  for (const { entry } of environmentLocations(documents)) {
    if (entry.name === tokenName && Object.hasOwn(entry, "value")) {
      fail(`${tokenName} must not have a literal value in a workload.`);
    }
  }

  for (const document of documents) {
    if (document.kind === "ConfigMap" || document.kind === "Secret") {
      const containsToken = ["data", "stringData", "binaryData"].some((field) =>
        Object.hasOwn(asRecord(document[field]) ?? {}, tokenName),
      );
      if (containsToken) {
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
  const dashboardPodSpec =
    asRecord(valueAt(deployment, "spec", "template", "spec")) ??
    fail(`${renderName}: Deployment/dum-dashboard must contain spec.template.spec.`);
  const dashboardContainers = asArray(dashboardPodSpec.containers)
    .map(asRecord)
    .filter((container): container is Document => container !== undefined)
    .filter((container) => container.name === "dashboard");
  if (dashboardContainers.length !== 1) {
    fail(`${renderName}: expected one normal dashboard container.`);
  }

  const dashboard = dashboardContainers[0] ?? fail(`${renderName}: dashboard container missing.`);
  const environment = environmentLocations(documents);
  const tokenNameEntries = environment.filter(({ entry }) => entry.name === tokenName);
  const toolTokenReferences = environment.filter(({ entry }) => isToolTokenReference(entry));

  if (tokenNameEntries.length !== 1) {
    fail(`${renderName}: exactly one ${tokenName} environment entry is required.`);
  }
  if (toolTokenReferences.length !== 1) {
    fail(`${renderName}: exactly one tool-token secretKeyRef is required.`);
  }

  const tokenLocation = tokenNameEntries[0] ?? fail(`${renderName}: ${tokenName} entry missing.`);
  const referenceLocation =
    toolTokenReferences[0] ?? fail(`${renderName}: tool-token secretKeyRef missing.`);
  if (tokenLocation.entry !== referenceLocation.entry) {
    fail(`${renderName}: ${tokenName} and the tool-token secretKeyRef must be one entry.`);
  }

  const tokenEnv = tokenLocation.entry;
  if (
    tokenLocation.document !== deployment ||
    tokenLocation.container !== dashboard ||
    tokenLocation.field !== "containers" ||
    valueAt(tokenEnv, "valueFrom", "secretKeyRef", "name") !== secretName ||
    valueAt(tokenEnv, "valueFrom", "secretKeyRef", "key") !== tokenName ||
    Object.hasOwn(tokenEnv, "value")
  ) {
    fail(`${renderName}: ${tokenName} must use the exact dedicated secretKeyRef.`);
  }

  for (const document of documents) {
    if (podReferencesToolSecretVolume(document)) {
      const workloadName = String(valueAt(document, "metadata", "name") ?? "unknown");
      fail(`${renderName}: ${workloadName} must not mount the tool Secret as a volume.`);
    }
    for (const { container } of containerLocationsFor(document)) {
      if (
        asArray(container.envFrom).some(
          (entry) => valueAt(entry, "secretRef", "name") === secretName,
        )
      ) {
        const workloadName = String(valueAt(document, "metadata", "name") ?? "unknown");
        const containerName = String(container.name ?? "unknown");
        fail(`${renderName}: ${workloadName}/${containerName} must not load the tool Secret.`);
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
    toolSecret.apiVersion !== "secrets.infisical.com/v1beta1" ||
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
