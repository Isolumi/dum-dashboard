import { PassThrough, type Writable } from "node:stream";
import {
  AppsV1Api,
  CoreV1Api,
  KubeConfig,
  Log,
  Observable,
  type ConfigurationOptions,
  type CoreV1EventList,
  type LogOptions,
  type ObservableMiddleware,
  type RequestContext,
  type ResponseContext,
  type V1DaemonSetList,
  type V1DeploymentList,
  type V1NamespaceList,
  type V1NodeList,
  type V1Pod,
  type V1PodList,
  type V1StatefulSetList,
} from "@kubernetes/client-node";
import type { ClusterData, PodDetail } from "../../../shared/homelab/contracts";
import { getKubernetesConfigSource } from "../config";
import type { Provider } from "./provider";
import { mapClusterData, mapPodDetail } from "./kubernetes-mappers";

interface KubeConfigLoader {
  loadFromCluster(): void;
  loadFromDefault(): void;
}

interface CoreReadApi {
  listNode(params?: object, options?: ConfigurationOptions): Promise<V1NodeList>;
  listNamespace(params?: object, options?: ConfigurationOptions): Promise<V1NamespaceList>;
  listPodForAllNamespaces(params?: object, options?: ConfigurationOptions): Promise<V1PodList>;
  listEventForAllNamespaces(
    params?: { fieldSelector?: string },
    options?: ConfigurationOptions,
  ): Promise<CoreV1EventList>;
  readNamespacedPod(
    params: { namespace: string; name: string },
    options?: ConfigurationOptions,
  ): Promise<V1Pod>;
}

interface AppsReadApi {
  listDeploymentForAllNamespaces(
    params?: object,
    options?: ConfigurationOptions,
  ): Promise<V1DeploymentList>;
  listStatefulSetForAllNamespaces(
    params?: object,
    options?: ConfigurationOptions,
  ): Promise<V1StatefulSetList>;
  listDaemonSetForAllNamespaces(
    params?: object,
    options?: ConfigurationOptions,
  ): Promise<V1DaemonSetList>;
}

interface PodLogClient {
  log(
    namespace: string,
    pod: string,
    container: string,
    output: Writable,
    options?: LogOptions,
  ): Promise<AbortController>;
}

export interface PodLogStream extends AsyncIterable<string> {
  ready: Promise<void>;
}

export interface KubernetesReader extends Provider<ClusterData> {
  getPod(namespace: string, pod: string): Promise<PodDetail>;
  streamPodLogs(
    namespace: string,
    pod: string,
    container: string,
    signal: AbortSignal,
  ): AsyncIterable<string>;
}

export interface KubernetesProviderOptions {
  environment?: NodeJS.ProcessEnv;
  kubeConfig?: KubeConfig;
  coreApi?: CoreReadApi;
  appsApi?: AppsReadApi;
  logClient?: PodLogClient;
}

export function loadKubernetesConfig<T extends KubeConfigLoader>(
  environment: NodeJS.ProcessEnv,
  kubeConfig: T,
): T {
  if (getKubernetesConfigSource(environment) === "in-cluster") {
    kubeConfig.loadFromCluster();
  } else {
    kubeConfig.loadFromDefault();
  }
  return kubeConfig;
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

function linesFrom(output: PassThrough): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      let buffered = "";
      for await (const chunk of output) {
        buffered += chunk.toString();
        const lines = buffered.split(/\r?\n/);
        buffered = lines.pop() ?? "";
        yield* lines;
      }
      if (buffered) yield buffered;
    },
  };
}

export class KubernetesProvider implements KubernetesReader {
  readonly source = "kubernetes" as const;

  private readonly environment: NodeJS.ProcessEnv;
  private kubeConfig?: KubeConfig;
  private coreApi?: CoreReadApi;
  private appsApi?: AppsReadApi;
  private logClient?: PodLogClient;

  constructor(options: KubernetesProviderOptions = {}) {
    this.environment = options.environment ?? process.env;
    this.kubeConfig = options.kubeConfig;
    this.coreApi = options.coreApi;
    this.appsApi = options.appsApi;
    this.logClient = options.logClient;
  }

  private getKubeConfig(): KubeConfig {
    this.kubeConfig ??= loadKubernetesConfig(this.environment, new KubeConfig());
    return this.kubeConfig;
  }

  private getCoreApi(): CoreReadApi {
    this.coreApi ??= this.getKubeConfig().makeApiClient(CoreV1Api);
    return this.coreApi;
  }

  private getAppsApi(): AppsReadApi {
    this.appsApi ??= this.getKubeConfig().makeApiClient(AppsV1Api);
    return this.appsApi;
  }

  private getLogClient(): PodLogClient {
    this.logClient ??= new Log(this.getKubeConfig());
    return this.logClient;
  }

  async collect(signal: AbortSignal): Promise<ClusterData> {
    const coreApi = this.getCoreApi();
    const appsApi = this.getAppsApi();
    const options = requestOptions(signal);
    const [nodes, namespaces, deployments, statefulSets, daemonSets, pods, events] =
      await Promise.all([
        coreApi.listNode({}, options),
        coreApi.listNamespace({}, options),
        appsApi.listDeploymentForAllNamespaces({}, options),
        appsApi.listStatefulSetForAllNamespaces({}, options),
        appsApi.listDaemonSetForAllNamespaces({}, options),
        coreApi.listPodForAllNamespaces({}, options),
        coreApi.listEventForAllNamespaces({ fieldSelector: "type=Warning" }, options),
      ]);

    return mapClusterData({
      nodes,
      namespaces,
      deployments,
      statefulSets,
      daemonSets,
      pods,
      events,
    });
  }

  async getPod(namespace: string, pod: string): Promise<PodDetail> {
    const detail = await this.getCoreApi().readNamespacedPod({ namespace, name: pod });
    return mapPodDetail(detail);
  }

  streamPodLogs(
    namespace: string,
    pod: string,
    container: string,
    signal: AbortSignal,
  ): PodLogStream {
    const output = new PassThrough();
    let upstream: AbortController | undefined;
    const abortUpstream = () => {
      upstream?.abort();
      output.destroy();
    };

    signal.addEventListener("abort", abortUpstream, { once: true });
    const connection = this.getLogClient()
      .log(namespace, pod, container, output, {
        tailLines: 200,
        follow: true,
        timestamps: true,
      })
      .then((controller) => {
        upstream = controller;
        if (signal.aborted) abortUpstream();
      })
      .catch((error: unknown) => {
        output.destroy(error instanceof Error ? error : new Error("Kubernetes log stream failed"));
        throw error;
      });

    return {
      ready: connection,
      async *[Symbol.asyncIterator]() {
        try {
          await connection;
          yield* linesFrom(output);
        } finally {
          signal.removeEventListener("abort", abortUpstream);
          abortUpstream();
        }
      },
    };
  }
}
