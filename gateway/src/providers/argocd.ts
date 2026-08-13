import {
  CustomObjectsApi,
  KubeConfig,
  Observable,
  type ConfigurationOptions,
  type ObservableMiddleware,
  type RequestContext,
  type ResponseContext,
} from "@kubernetes/client-node";
import type { Provider } from "./provider";
import { loadKubernetesConfig } from "./kubernetes";
import {
  readDenseArray,
  readOwnDataProperties,
  readOwnDataRecord,
  RUNTIME_COLLECTION_LIMITS,
} from "../runtime-validation";

const ARGO_NAMESPACE = "argocd";

interface CustomObjectsReadApi {
  getNamespacedCustomObject(
    params: {
      group: string;
      version: string;
      namespace: string;
      plural: string;
      name: string;
    },
    options?: ConfigurationOptions,
  ): Promise<unknown>;
}

export interface ArgoResourceState {
  group: string;
  version: string;
  kind: string;
  namespace: string;
  name: string;
  syncStatus: string;
  healthStatus: string | null;
  healthMessage: string | null;
}

export interface ArgoApplicationState {
  name: string;
  namespace: string;
  sync: { status: string; revision: string };
  health: { status: string; message: string | null; lastTransitionAt: string | null };
  operation: {
    phase: string;
    message: string | null;
    revision: string | null;
    startedAt: string | null;
    finishedAt: string | null;
  };
  resources: ArgoResourceState[];
  images: string[];
}

export interface ArgoProviderOptions {
  applicationName: string;
  environment?: NodeJS.ProcessEnv;
  kubeConfig?: KubeConfig;
  customObjectsApi?: CustomObjectsReadApi;
}

function isOptionalString(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.length > 0);
}

function isRequiredString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseDenseArray<T>(
  value: unknown,
  maxLength: number,
  parse: (entry: unknown) => T | null,
): T[] | null {
  const entries = readDenseArray(value, maxLength);
  if (!entries) return null;

  const parsed: T[] = [];
  for (const entry of entries) {
    const result = parse(entry);
    if (result === null) return null;
    parsed.push(result);
  }
  return parsed;
}

export function parseArgoApplicationState(value: unknown): ArgoApplicationState | null {
  const fields = readOwnDataProperties(value, [
    "name",
    "namespace",
    "sync",
    "health",
    "operation",
    "resources",
    "images",
  ]);
  const sync = fields ? readOwnDataProperties(fields.sync, ["status", "revision"]) : null;
  const health = fields
    ? readOwnDataProperties(fields.health, ["status", "message", "lastTransitionAt"])
    : null;
  const operation = fields
    ? readOwnDataProperties(fields.operation, [
        "phase",
        "message",
        "revision",
        "startedAt",
        "finishedAt",
      ])
    : null;
  if (
    !fields ||
    !isRequiredString(fields.name) ||
    fields.namespace !== ARGO_NAMESPACE ||
    !sync ||
    !isRequiredString(sync.status) ||
    !isRequiredString(sync.revision) ||
    !health ||
    !isRequiredString(health.status) ||
    !isOptionalString(health.message) ||
    !isOptionalString(health.lastTransitionAt) ||
    !operation ||
    !isRequiredString(operation.phase) ||
    !isOptionalString(operation.message) ||
    !isOptionalString(operation.revision) ||
    !isOptionalString(operation.startedAt) ||
    !isOptionalString(operation.finishedAt)
  ) {
    return null;
  }

  const resources = parseDenseArray<ArgoResourceState>(
    fields.resources,
    RUNTIME_COLLECTION_LIMITS.argoResources,
    (resource) => {
      const resourceFields = readOwnDataProperties(resource, [
        "group",
        "version",
        "kind",
        "namespace",
        "name",
        "syncStatus",
        "healthStatus",
        "healthMessage",
      ]);
      if (
        !resourceFields ||
        typeof resourceFields.group !== "string" ||
        typeof resourceFields.version !== "string" ||
        !isRequiredString(resourceFields.kind) ||
        typeof resourceFields.namespace !== "string" ||
        !isRequiredString(resourceFields.name) ||
        !isRequiredString(resourceFields.syncStatus) ||
        !isOptionalString(resourceFields.healthStatus) ||
        !isOptionalString(resourceFields.healthMessage)
      ) {
        return null;
      }
      return {
        group: resourceFields.group,
        version: resourceFields.version,
        kind: resourceFields.kind,
        namespace: resourceFields.namespace,
        name: resourceFields.name,
        syncStatus: resourceFields.syncStatus,
        healthStatus: resourceFields.healthStatus,
        healthMessage: resourceFields.healthMessage,
      };
    },
  );
  const images = parseDenseArray(fields.images, RUNTIME_COLLECTION_LIMITS.argoImages, (image) =>
    isRequiredString(image) ? image : null,
  );
  if (!resources || !images) return null;

  return {
    name: fields.name,
    namespace: fields.namespace,
    sync: { status: sync.status, revision: sync.revision },
    health: {
      status: health.status,
      message: health.message,
      lastTransitionAt: health.lastTransitionAt,
    },
    operation: {
      phase: operation.phase,
      message: operation.message,
      revision: operation.revision,
      startedAt: operation.startedAt,
      finishedAt: operation.finishedAt,
    },
    resources,
    images,
  };
}

function requiredString(value: unknown): string {
  if (!isRequiredString(value)) throw new Error("invalid value");
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalDataRecord(
  record: ReadonlyMap<PropertyKey, unknown>,
  key: string,
): ReadonlyMap<PropertyKey, unknown> | null {
  if (!record.has(key)) return null;
  const value = record.get(key);
  if (value === null || value === undefined) return null;
  const parsed = readOwnDataRecord(value);
  if (!parsed) throw new Error("invalid optional record");
  return parsed;
}

function revisionFromRecord(
  record: ReadonlyMap<PropertyKey, unknown>,
  required: boolean,
): string | null {
  const direct = record.get("revision");
  if (isRequiredString(direct)) return direct;
  if (direct !== undefined && direct !== null && direct !== "") {
    throw new Error("invalid revision");
  }

  if (record.has("revisions")) {
    const revisions = parseDenseArray(record.get("revisions"), 32, (revision) =>
      isRequiredString(revision) ? revision : null,
    );
    if (!revisions || revisions.length === 0) throw new Error("invalid revisions");
    return revisions.join(",");
  }

  if (required) throw new Error("missing revision");
  return null;
}

function operationImages(syncResult: ReadonlyMap<PropertyKey, unknown> | null): string[] {
  if (!syncResult?.has("resources")) return [];
  const resources = readDenseArray(
    syncResult.get("resources"),
    RUNTIME_COLLECTION_LIMITS.argoResources,
  );
  if (!resources) throw new Error("invalid operation resources");

  return resources.flatMap((resource) => {
    const fields = readOwnDataRecord(resource);
    if (!fields) throw new Error("invalid operation resource");
    if (!fields.has("images")) return [];
    const images = readDenseArray(fields.get("images"), RUNTIME_COLLECTION_LIMITS.argoImages);
    if (!images) throw new Error("invalid operation resource images");
    return images.map(requiredString);
  });
}

function requestOptions(signal: AbortSignal): ConfigurationOptions {
  const signalMiddleware: ObservableMiddleware = {
    pre(context: RequestContext) {
      context.setSignal(signal);
      return new Observable(Promise.resolve(context));
    },
    post(context: ResponseContext) {
      return new Observable(Promise.resolve(context));
    },
  };
  return { middleware: [signalMiddleware], middlewareMergeStrategy: "append" };
}

function mapApplication(payload: unknown): ArgoApplicationState {
  const payloadFields = readOwnDataProperties(payload, ["metadata", "status"]);
  const metadata = payloadFields
    ? readOwnDataProperties(payloadFields.metadata, ["name", "namespace"])
    : null;
  const status = payloadFields ? readOwnDataRecord(payloadFields.status) : null;
  if (!metadata || !status) {
    throw new Error("invalid application");
  }
  const sync = readOwnDataRecord(status.get("sync"));
  const health = readOwnDataRecord(status.get("health"));
  const operationState = readOwnDataRecord(status.get("operationState"));
  if (!sync?.has("status") || !health?.has("status") || !operationState?.has("phase")) {
    throw new Error("invalid application status");
  }
  const syncRevision = revisionFromRecord(sync, true);
  if (!syncRevision) throw new Error("missing sync revision");
  const syncResult = optionalDataRecord(operationState, "syncResult");
  if (syncResult && !syncResult.has("revision")) throw new Error("invalid sync result");
  const resourcesValue = status.has("resources") ? status.get("resources") : [];
  const resources = readDenseArray(resourcesValue, RUNTIME_COLLECTION_LIMITS.argoResources);
  const summary = optionalDataRecord(status, "summary");
  const imagesValue = summary?.has("images") ? summary.get("images") : [];
  const imageEntries = readDenseArray(imagesValue, RUNTIME_COLLECTION_LIMITS.argoImages);
  if (!resources || !imageEntries) throw new Error("invalid application collections");
  const images = [
    ...new Set([...imageEntries.map(requiredString), ...operationImages(syncResult)]),
  ];
  if (images.length > RUNTIME_COLLECTION_LIMITS.argoImages) {
    throw new Error("too many application images");
  }

  const phase = operationState.get("phase");
  const operationMessage = operationState.get("message");
  const startedAt = operationState.get("startedAt");
  const finishedAt = operationState.get("finishedAt");

  return {
    name: requiredString(metadata.name),
    namespace: requiredString(metadata.namespace),
    sync: {
      status: requiredString(sync.get("status")),
      revision: syncRevision,
    },
    health: {
      status: requiredString(health.get("status")),
      message: optionalString(health.get("message")),
      lastTransitionAt: optionalString(health.get("lastTransitionTime")),
    },
    operation: {
      phase: requiredString(phase),
      message: optionalString(operationMessage),
      revision: syncResult ? revisionFromRecord(syncResult, false) : null,
      startedAt: optionalString(startedAt),
      finishedAt: optionalString(finishedAt),
    },
    resources: resources.map((resource) => {
      const fields = readOwnDataRecord(resource);
      if (!fields) throw new Error("invalid application resource");
      const resourceHealth = optionalDataRecord(fields, "health");
      return {
        group: optionalString(fields.get("group")) ?? "",
        version: optionalString(fields.get("version")) ?? "",
        kind: requiredString(fields.get("kind")),
        namespace: optionalString(fields.get("namespace")) ?? "default",
        name: requiredString(fields.get("name")),
        syncStatus: requiredString(fields.get("status")),
        healthStatus: optionalString(resourceHealth?.get("status")),
        healthMessage: optionalString(resourceHealth?.get("message")),
      };
    }),
    images,
  };
}

export class ArgoProvider implements Provider<ArgoApplicationState> {
  readonly source = "argocd" as const;

  private readonly environment: NodeJS.ProcessEnv;
  private readonly applicationName: string;
  private kubeConfig: KubeConfig | undefined;
  private customObjectsApi: CustomObjectsReadApi | undefined;

  constructor(options: ArgoProviderOptions) {
    this.applicationName = requiredString(options.applicationName);
    this.environment = options.environment ?? process.env;
    this.kubeConfig = options.kubeConfig;
    this.customObjectsApi = options.customObjectsApi;
  }

  private getCustomObjectsApi(): CustomObjectsReadApi {
    this.kubeConfig ??= loadKubernetesConfig(this.environment, new KubeConfig());
    this.customObjectsApi ??= this.kubeConfig.makeApiClient(CustomObjectsApi);
    return this.customObjectsApi;
  }

  private async application(name: string, signal?: AbortSignal): Promise<ArgoApplicationState> {
    let payload: unknown;
    try {
      payload = await this.getCustomObjectsApi().getNamespacedCustomObject(
        {
          group: "argoproj.io",
          version: "v1alpha1",
          namespace: ARGO_NAMESPACE,
          plural: "applications",
          name,
        },
        signal ? requestOptions(signal) : {},
      );
    } catch {
      throw new Error("Argo CD request failed");
    }

    try {
      return mapApplication(payload);
    } catch {
      throw new Error("Argo CD response invalid");
    }
  }

  getApplication(name: string): Promise<ArgoApplicationState> {
    return this.application(name);
  }

  collect(signal: AbortSignal): Promise<ArgoApplicationState> {
    return this.application(this.applicationName, signal);
  }
}
