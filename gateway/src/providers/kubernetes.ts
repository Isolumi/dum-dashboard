import { PassThrough, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  AppsV1Api,
  CoreV1Api,
  KubeConfig,
  Observable,
  type ConfigurationOptions,
  type CoreV1EventList,
  type V1LabelSelector,
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
import fetch, { type RequestInit, type Response } from "node-fetch";
import type { ClusterData, PodDetail } from "../../../shared/homelab/contracts";
import { evaluateWorkload } from "../../../shared/homelab/health-rules";
import { normalizePodLogCursor } from "../../../shared/homelab/log-cursor";
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

type LogFetch = (url: string, options: RequestInit) => Promise<Response>;

const RESTART_WINDOW_MS = 15 * 60 * 1_000;
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
    sinceTime?: string,
  ): AsyncIterable<string>;
}

export interface KubernetesProviderOptions {
  environment?: NodeJS.ProcessEnv;
  kubeConfig?: KubeConfig;
  coreApi?: CoreReadApi;
  appsApi?: AppsReadApi;
  fetchApi?: LogFetch;
  now?: () => number;
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

function workloadKey(kind: string, namespace: string, name: string): string {
  return `${kind}\u0000${namespace}\u0000${name}`;
}

function podMatchesSelector(pod: V1Pod, namespace: string, selector?: V1LabelSelector): boolean {
  if (pod.metadata?.namespace !== namespace || !selector) return false;
  const labels = pod.metadata?.labels ?? {};
  const matchLabels = Object.entries(selector.matchLabels ?? {});
  const expressions = selector.matchExpressions ?? [];
  if (matchLabels.length === 0 && expressions.length === 0) return false;
  if (!matchLabels.every(([key, value]) => labels[key] === value)) return false;

  return expressions.every((expression) => {
    const present = Object.hasOwn(labels, expression.key);
    const value = labels[expression.key];
    const values = expression.values ?? [];
    if (expression.operator === "In") return present && values.includes(value!);
    if (expression.operator === "NotIn") return !present || !values.includes(value!);
    if (expression.operator === "Exists") return present;
    if (expression.operator === "DoesNotExist") return !present;
    return false;
  });
}

function restartCountsByWorkload(
  deployments: V1DeploymentList,
  statefulSets: V1StatefulSetList,
  daemonSets: V1DaemonSetList,
  pods: V1PodList,
): Map<string, number> {
  const counts = new Map<string, number>();
  const groups = [
    { kind: "Deployment", items: deployments.items },
    { kind: "StatefulSet", items: statefulSets.items },
    { kind: "DaemonSet", items: daemonSets.items },
  ] as const;

  for (const { kind, items } of groups) {
    for (const workload of items) {
      const name = workload.metadata?.name;
      const namespace = workload.metadata?.namespace;
      if (!name || !namespace) continue;
      const count = pods.items
        .filter((pod) => podMatchesSelector(pod, namespace, workload.spec?.selector))
        .reduce(
          (total, pod) =>
            total +
            (pod.status?.containerStatuses ?? []).reduce(
              (podTotal, container) => podTotal + container.restartCount,
              0,
            ),
          0,
        );
      counts.set(workloadKey(kind, namespace, name), count);
    }
  }

  return counts;
}

export class KubernetesProvider implements KubernetesReader {
  readonly source = "kubernetes" as const;

  private readonly environment: NodeJS.ProcessEnv;
  private kubeConfig?: KubeConfig;
  private coreApi?: CoreReadApi;
  private appsApi?: AppsReadApi;
  private readonly fetchApi: LogFetch;
  private readonly now: () => number;
  private readonly previousRestartCounts = new Map<string, number>();
  private readonly restartDetectedAt = new Map<string, number>();

  constructor(options: KubernetesProviderOptions = {}) {
    this.environment = options.environment ?? process.env;
    this.kubeConfig = options.kubeConfig;
    this.coreApi = options.coreApi;
    this.appsApi = options.appsApi;
    this.fetchApi = options.fetchApi ?? fetch;
    this.now = options.now ?? Date.now;
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

  private applyRestartHistory(
    cluster: ClusterData,
    restartCounts: ReadonlyMap<string, number>,
  ): ClusterData {
    const observedAt = this.now();
    const cutoff = observedAt - RESTART_WINDOW_MS;
    const activeWorkloads = new Set<string>();
    const workloads = cluster.workloads.map((workload) => {
      const key = workloadKey(workload.kind, workload.namespace, workload.name);
      activeWorkloads.add(key);
      const restartCount = restartCounts.get(key) ?? 0;
      const previousRestartCount = this.previousRestartCounts.get(key);
      if (previousRestartCount !== undefined && restartCount > previousRestartCount) {
        this.restartDetectedAt.set(key, observedAt);
      }
      this.previousRestartCounts.set(key, restartCount);
      const detectedAt = this.restartDetectedAt.get(key);
      const restartIncrease15m = detectedAt !== undefined && detectedAt >= cutoff;
      const status = evaluateWorkload({
        kind: workload.kind,
        name: workload.name,
        desiredReplicas: workload.desiredReplicas,
        availableReplicas: workload.availableReplicas,
        ...(workload.failureReason ? { failureReason: workload.failureReason } : {}),
        restartIncrease15m,
      }).status;

      return { ...workload, status, restartIncrease15m };
    });

    for (const key of this.previousRestartCounts.keys()) {
      if (!activeWorkloads.has(key)) {
        this.previousRestartCounts.delete(key);
        this.restartDetectedAt.delete(key);
      }
    }

    return { ...cluster, workloads };
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

    const cluster = mapClusterData({
      nodes,
      namespaces,
      deployments,
      statefulSets,
      daemonSets,
      pods,
      events,
    });
    return this.applyRestartHistory(
      cluster,
      restartCountsByWorkload(deployments, statefulSets, daemonSets, pods),
    );
  }

  async getPod(namespace: string, pod: string): Promise<PodDetail> {
    const detail = await this.getCoreApi().readNamespacedPod({
      namespace,
      name: pod,
    });
    return mapPodDetail(detail);
  }

  private async connectPodLogs(
    namespace: string,
    pod: string,
    container: string,
    signal: AbortSignal,
    sinceTime?: string,
  ): Promise<{ output: PassThrough; completion: Promise<void> }> {
    const cursor = sinceTime === undefined ? null : normalizePodLogCursor(sinceTime);
    if (sinceTime !== undefined && !cursor) throw new Error("Invalid pod log cursor");

    const kubeConfig = this.getKubeConfig();
    const cluster = kubeConfig.getCurrentCluster();
    if (!cluster) throw new Error("Kubernetes cluster configuration is unavailable");

    const url = new URL(cluster.server);
    const basePath = url.pathname.replace(/\/$/, "");
    url.pathname = `${basePath}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(pod)}/log`;
    url.searchParams.set("container", container);
    if (cursor) url.searchParams.set("sinceTime", cursor);
    else url.searchParams.set("tailLines", "200");
    url.searchParams.set("follow", "true");
    url.searchParams.set("timestamps", "true");

    const authenticatedOptions = await kubeConfig.applyToFetchOptions({});
    const response = await this.fetchApi(url.toString(), {
      ...authenticatedOptions,
      method: "GET",
      signal,
    });
    if (!response.ok || !response.body) {
      if (response.body) (response.body as Readable).destroy();
      throw new Error("Kubernetes log request failed");
    }

    const output = new PassThrough();
    const completion = pipeline(response.body as Readable, output, { signal });
    void completion.catch(() => undefined);
    return { output, completion };
  }

  streamPodLogs(
    namespace: string,
    pod: string,
    container: string,
    signal: AbortSignal,
    sinceTime?: string,
  ): PodLogStream {
    const upstream = new AbortController();
    let output: PassThrough | undefined;
    let completion: Promise<void> | undefined;
    const abortUpstream = () => {
      upstream.abort();
      output?.destroy();
    };

    signal.addEventListener("abort", abortUpstream, { once: true });
    if (signal.aborted) abortUpstream();

    const connection = this.connectPodLogs(
      namespace,
      pod,
      container,
      upstream.signal,
      sinceTime,
    ).then((connected) => {
      output = connected.output;
      completion = connected.completion;
      if (signal.aborted) abortUpstream();
    });
    void connection.catch(() => undefined);

    return {
      ready: connection,
      async *[Symbol.asyncIterator]() {
        try {
          await connection;
          yield* linesFrom(output!);
          await completion;
        } finally {
          signal.removeEventListener("abort", abortUpstream);
          abortUpstream();
        }
      },
    };
  }
}
