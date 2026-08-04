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

const ARGO_NAMESPACE = "argocd";
const ARGO_APPLICATION = "yootoob-mp3-dumachine";

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
  environment?: NodeJS.ProcessEnv;
  kubeConfig?: KubeConfig;
  customObjectsApi?: CustomObjectsReadApi;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.length > 0);
}

export function isArgoApplicationState(value: unknown): value is ArgoApplicationState {
  if (
    !isRecord(value) ||
    value.name !== ARGO_APPLICATION ||
    value.namespace !== ARGO_NAMESPACE ||
    !isRecord(value.sync) ||
    typeof value.sync.status !== "string" ||
    typeof value.sync.revision !== "string" ||
    !isRecord(value.health) ||
    typeof value.health.status !== "string" ||
    !isOptionalString(value.health.message) ||
    !isOptionalString(value.health.lastTransitionAt) ||
    !isRecord(value.operation) ||
    typeof value.operation.phase !== "string" ||
    !isOptionalString(value.operation.message) ||
    !isOptionalString(value.operation.revision) ||
    !isOptionalString(value.operation.startedAt) ||
    !isOptionalString(value.operation.finishedAt) ||
    !Array.isArray(value.resources) ||
    !Array.isArray(value.images) ||
    value.images.some((image) => typeof image !== "string" || image.length === 0)
  ) {
    return false;
  }

  return value.resources.every(
    (resource) =>
      isRecord(resource) &&
      typeof resource.group === "string" &&
      typeof resource.version === "string" &&
      typeof resource.kind === "string" &&
      typeof resource.namespace === "string" &&
      typeof resource.name === "string" &&
      typeof resource.syncStatus === "string" &&
      isOptionalString(resource.healthStatus) &&
      isOptionalString(resource.healthMessage),
  );
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new Error("invalid value");
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
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
  if (!isRecord(payload) || !isRecord(payload.metadata) || !isRecord(payload.status)) {
    throw new Error("invalid application");
  }
  const status = payload.status;
  if (!isRecord(status.sync) || !isRecord(status.health) || !isRecord(status.operationState)) {
    throw new Error("invalid application status");
  }
  const operationState = status.operationState;
  const syncResult = isRecord(operationState.syncResult) ? operationState.syncResult : undefined;
  const resources = Array.isArray(status.resources) ? status.resources : [];
  const summary = isRecord(status.summary) ? status.summary : undefined;
  const images = Array.isArray(summary?.images) ? summary.images.map(requiredString) : [];

  return {
    name: requiredString(payload.metadata.name),
    namespace: requiredString(payload.metadata.namespace),
    sync: {
      status: requiredString(status.sync.status),
      revision: requiredString(status.sync.revision),
    },
    health: {
      status: requiredString(status.health.status),
      message: optionalString(status.health.message),
      lastTransitionAt: optionalString(status.health.lastTransitionTime),
    },
    operation: {
      phase: requiredString(operationState.phase),
      message: optionalString(operationState.message),
      revision: optionalString(syncResult?.revision),
      startedAt: optionalString(operationState.startedAt),
      finishedAt: optionalString(operationState.finishedAt),
    },
    resources: resources.map((resource) => {
      if (!isRecord(resource)) throw new Error("invalid application resource");
      const health = isRecord(resource.health) ? resource.health : undefined;
      return {
        group: optionalString(resource.group) ?? "",
        version: optionalString(resource.version) ?? "",
        kind: requiredString(resource.kind),
        namespace: optionalString(resource.namespace) ?? "default",
        name: requiredString(resource.name),
        syncStatus: requiredString(resource.status),
        healthStatus: optionalString(health?.status),
        healthMessage: optionalString(health?.message),
      };
    }),
    images,
  };
}

export class ArgoProvider implements Provider<ArgoApplicationState> {
  readonly source = "argocd" as const;

  private readonly environment: NodeJS.ProcessEnv;
  private kubeConfig: KubeConfig | undefined;
  private customObjectsApi: CustomObjectsReadApi | undefined;

  constructor(options: ArgoProviderOptions = {}) {
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
    return this.application(ARGO_APPLICATION, signal);
  }
}
