import { PassThrough, Readable } from "node:stream";
import type { KubeConfig } from "@kubernetes/client-node";
import { Response, type RequestInit } from "node-fetch";
import { describe, expect, it, vi } from "vitest";
import { createGateway } from "../app";
import type { ClusterData, PodDetail } from "../../../shared/homelab/contracts";
import fixture from "./fixtures/kubernetes.json";
import { mapClusterData, mapPodDetail, type KubernetesInventory } from "./kubernetes-mappers";
import { KubernetesProvider, loadKubernetesConfig } from "./kubernetes";

const kubernetesFixture = fixture as unknown as KubernetesInventory;
const fixturePod = kubernetesFixture.pods.items[0]!;

function createLogKubeConfig() {
  const applyToFetchOptions = vi.fn(async () => ({
    headers: { authorization: "Bearer private" },
  }));
  const kubeConfig = {
    getCurrentCluster: vi.fn(() => ({ server: "https://cluster.test" })),
    applyToFetchOptions,
  } as unknown as KubeConfig;

  return { kubeConfig, applyToFetchOptions };
}

async function readSseUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  marker: string,
  timeoutMs = 250,
): Promise<string> {
  const decoder = new TextDecoder();
  let body = "";
  const deadline = Date.now() + timeoutMs;

  while (!body.includes(marker)) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const result = await Promise.race([
      reader.read(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), remaining)),
    ]);
    if (!result || result.done) break;
    body += decoder.decode(result.value, { stream: true });
  }

  return body;
}

describe("Kubernetes mappers", () => {
  it("maps inventory and sorts only Warning events without losing image digests", () => {
    const inventory = structuredClone(kubernetesFixture);
    inventory.deployments.items[0]!.metadata!.creationTimestamp = new Date("2026-08-04T10:00:00Z");
    inventory.deployments.items[0]!.metadata!.annotations = {
      "deployment.kubernetes.io/revision": "7",
    };
    const cluster = mapClusterData(inventory);

    expect(cluster.nodes).toEqual([
      {
        name: "dumachine",
        ready: true,
        status: "healthy",
        conditions: ["MemoryPressure=False", "Ready=True"],
      },
    ]);
    expect(cluster.workloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "Deployment",
          name: "gateway",
          namespace: "homelab",
          desiredReplicas: 2,
          availableReplicas: 0,
          createdAt: "2026-08-04T10:00:00.000Z",
          revision: "7",
          status: "critical",
        }),
      ]),
    );
    expect(cluster.namespaces).toEqual([
      {
        name: "homelab",
        status: "healthy",
        workloadCount: 3,
        podCount: 2,
      },
    ]);
    expect(cluster.events.map(({ id }) => id)).toEqual(["event-new", "event-old"]);
    expect(cluster.events.every(({ status }) => status === "warning")).toBe(true);
    expect(cluster.pods[0].image).toBe("ghcr.io/isolumi/gateway@sha256:0123456789abcdef");
    expect(cluster.pods[0]).toMatchObject({
      imageTag: "ghcr.io/isolumi/gateway:main",
      imageDigest: "sha256:0123456789abcdef",
    });
    expect(cluster.resources).toEqual({ current: [], history: [] });
  });

  it("maps the pod evidence needed by the detail view as JSON-safe data", () => {
    const detail = mapPodDetail(fixturePod);

    expect(detail).toMatchObject({
      name: "gateway-abc",
      namespace: "homelab",
      conditions: [
        {
          type: "Ready",
          status: "False",
          reason: "ContainersNotReady",
          message: "containers with unready status: [gateway]",
          lastTransitionAt: "2026-08-04T11:05:00Z",
        },
      ],
      containers: [
        {
          name: "gateway",
          image: "ghcr.io/isolumi/gateway:main",
          imageId: "ghcr.io/isolumi/gateway@sha256:0123456789abcdef",
          ready: false,
          restartCount: 3,
          state: "waiting",
          reason: "CrashLoopBackOff",
        },
      ],
    });
    expect(detail.rawStatus).toEqual(fixturePod.status);
    expect(() => JSON.stringify(detail satisfies PodDetail)).not.toThrow();
  });

  it("treats successfully completed job pods as healthy", () => {
    const pod = structuredClone(fixturePod);
    pod.status!.phase = "Succeeded";
    pod.status!.conditions = [];
    pod.status!.containerStatuses![0]!.state = {
      terminated: { exitCode: 0, reason: "Completed" },
    };

    expect(mapPodDetail(pod).status).toBe("healthy");
  });

  it("infers workload kinds when Kubernetes list items omit type metadata", () => {
    const inventory = structuredClone(kubernetesFixture);
    for (const workload of [
      inventory.deployments.items[0],
      inventory.statefulSets.items[0],
      inventory.daemonSets.items[0],
    ]) {
      if (workload) delete workload.kind;
    }

    expect(mapClusterData(inventory).workloads.map(({ kind }) => kind)).toEqual([
      "Deployment",
      "StatefulSet",
      "DaemonSet",
    ]);
  });

  it("preserves every container image and does not present a sidecar as the pod image", () => {
    const inventory = structuredClone(kubernetesFixture);
    const pod = inventory.pods.items[0]!;
    pod.spec!.containers = [
      { name: "metrics", image: "quay.io/prometheus/node-exporter:v1.9.1" },
      ...pod.spec!.containers,
    ];
    pod.status!.containerStatuses = [
      {
        name: "metrics",
        image: "quay.io/prometheus/node-exporter:v1.9.1",
        imageID:
          "docker-pullable://quay.io/prometheus/node-exporter@sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        ready: true,
        restartCount: 0,
        state: { running: { startedAt: new Date("2026-08-04T11:01:00Z") } },
      },
      ...pod.status!.containerStatuses!,
    ];
    inventory.pods.items = [pod];

    const summary = mapClusterData(inventory).pods[0];

    expect(summary).toMatchObject({
      image: null,
      imageTag: null,
      imageDigest: null,
    });
    expect(summary?.containerImages).toEqual([
      {
        name: "metrics",
        repository: "quay.io/prometheus/node-exporter",
        reference: "quay.io/prometheus/node-exporter:v1.9.1",
        tag: "v1.9.1",
        digest: "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      },
      {
        name: "gateway",
        repository: "ghcr.io/isolumi/gateway",
        reference: "ghcr.io/isolumi/gateway:main",
        tag: "main",
        digest: "sha256:0123456789abcdef",
      },
    ]);
  });

  it("retains a container with an Unknown digest when imageID is absent", () => {
    const inventory = structuredClone(kubernetesFixture);
    const pod = inventory.pods.items[0]!;
    (pod.status!.containerStatuses![0] as { imageID?: string }).imageID = undefined;
    inventory.pods.items = [pod];

    const summary = mapClusterData(inventory).pods[0];

    expect(summary?.containerImages).toEqual([
      {
        name: "gateway",
        repository: "ghcr.io/isolumi/gateway",
        reference: "ghcr.io/isolumi/gateway:main",
        tag: "main",
        digest: null,
      },
    ]);
    expect(summary?.imageDigest).toBeNull();
  });

  it("does not classify a normal ContainerCreating wait as a critical failure", () => {
    const pod = structuredClone(fixturePod);
    pod.status!.containerStatuses![0]!.state = {
      waiting: { reason: "ContainerCreating" },
    };

    expect(mapPodDetail(pod).status).toBe("warning");
  });
});

describe("KubernetesProvider", () => {
  it("uses in-cluster configuration exclusively in production", () => {
    const productionConfig = {
      loadFromCluster: vi.fn(),
      loadFromDefault: vi.fn(),
    };
    const developmentConfig = {
      loadFromCluster: vi.fn(),
      loadFromDefault: vi.fn(),
    };

    loadKubernetesConfig({ NODE_ENV: "production" }, productionConfig);
    loadKubernetesConfig({ NODE_ENV: "development" }, developmentConfig);

    expect(productionConfig.loadFromCluster).toHaveBeenCalledOnce();
    expect(productionConfig.loadFromDefault).not.toHaveBeenCalled();
    expect(developmentConfig.loadFromDefault).toHaveBeenCalledOnce();
    expect(developmentConfig.loadFromCluster).not.toHaveBeenCalled();
  });

  it("collects the allowed resource lists and maps them", async () => {
    const coreApi = {
      listNode: vi.fn(async () => kubernetesFixture.nodes),
      listNamespace: vi.fn(async () => kubernetesFixture.namespaces),
      listPodForAllNamespaces: vi.fn(async () => kubernetesFixture.pods),
      listEventForAllNamespaces: vi.fn(async () => kubernetesFixture.events),
      readNamespacedPod: vi.fn(),
    };
    const appsApi = {
      listDeploymentForAllNamespaces: vi.fn(async () => kubernetesFixture.deployments),
      listStatefulSetForAllNamespaces: vi.fn(async () => kubernetesFixture.statefulSets),
      listDaemonSetForAllNamespaces: vi.fn(async () => kubernetesFixture.daemonSets),
    };
    const provider = new KubernetesProvider({ coreApi, appsApi });

    const cluster: ClusterData = await provider.collect(new AbortController().signal);

    expect(provider.source).toBe("kubernetes");
    expect(cluster.nodes[0]).toMatchObject({ name: "dumachine", ready: true });
    expect(coreApi.listEventForAllNamespaces).toHaveBeenCalledWith(
      expect.objectContaining({ fieldSelector: "type=Warning" }),
      expect.anything(),
    );
    expect(
      [
        coreApi.listNode,
        coreApi.listNamespace,
        coreApi.listPodForAllNamespaces,
        coreApi.listEventForAllNamespaces,
        appsApi.listDeploymentForAllNamespaces,
        appsApi.listStatefulSetForAllNamespaces,
        appsApi.listDaemonSetForAllNamespaces,
      ].every((read) => read.mock.calls.length === 1),
    ).toBe(true);
  });

  it("reports only aggregate workload restart increases observed within 15 minutes", async () => {
    const inventory = structuredClone(kubernetesFixture);
    const firstPod = inventory.pods.items.find((pod) => pod.metadata?.name === "prometheus-0")!;
    const secondPod = structuredClone(firstPod);
    secondPod.metadata!.name = "prometheus-1";
    firstPod.status!.containerStatuses![0]!.restartCount = 5;
    secondPod.status!.containerStatuses![0]!.restartCount = 0;
    inventory.pods.items.push(secondPod);
    let now = Date.parse("2026-08-04T12:00:00Z");
    const coreApi = {
      listNode: vi.fn(async () => inventory.nodes),
      listNamespace: vi.fn(async () => inventory.namespaces),
      listPodForAllNamespaces: vi.fn(async () => inventory.pods),
      listEventForAllNamespaces: vi.fn(async () => inventory.events),
      readNamespacedPod: vi.fn(),
    };
    const appsApi = {
      listDeploymentForAllNamespaces: vi.fn(async () => inventory.deployments),
      listStatefulSetForAllNamespaces: vi.fn(async () => inventory.statefulSets),
      listDaemonSetForAllNamespaces: vi.fn(async () => inventory.daemonSets),
    };
    const provider = new KubernetesProvider({
      coreApi,
      appsApi,
      now: () => now,
    });
    const prometheus = (cluster: ClusterData) =>
      cluster.workloads.find((workload) => workload.name === "prometheus")!;

    const first = await provider.collect(new AbortController().signal);

    expect(prometheus(first)).toMatchObject({
      restartIncrease15m: false,
      status: "healthy",
    });

    now += 10_000;
    firstPod.status!.containerStatuses![0]!.restartCount = 3;
    secondPod.status!.containerStatuses![0]!.restartCount = 1;
    const aggregateDecrease = await provider.collect(new AbortController().signal);

    expect(prometheus(aggregateDecrease)).toMatchObject({
      restartIncrease15m: false,
      status: "healthy",
    });

    now += 10_000;
    secondPod.status!.containerStatuses![0]!.restartCount = 3;
    const aggregateIncrease = await provider.collect(new AbortController().signal);

    expect(prometheus(aggregateIncrease)).toMatchObject({
      restartIncrease15m: true,
      status: "warning",
    });

    for (let index = 0; index < 100; index += 1) {
      const rapidRefresh = await provider.collect(new AbortController().signal);
      expect(prometheus(rapidRefresh).restartIncrease15m).toBe(true);
    }
  });

  it("attributes restarts by workload selector instead of overlapping pod-name prefixes", async () => {
    const inventory = structuredClone(kubernetesFixture);
    const base = inventory.statefulSets.items[0]!;
    const worker = structuredClone(base);
    base.metadata!.name = "app";
    base.spec!.selector!.matchLabels = { app: "app" };
    worker.metadata!.name = "app-worker";
    worker.spec!.selector!.matchLabels = { app: "app-worker" };
    inventory.statefulSets.items = [base, worker];

    const appPod = inventory.pods.items.find(
      (candidate) => candidate.metadata?.name === "prometheus-0",
    )!;
    const workerPod = structuredClone(appPod);
    appPod.metadata!.name = "app-0";
    appPod.metadata!.labels = { app: "app" };
    appPod.status!.containerStatuses![0]!.restartCount = 0;
    workerPod.metadata!.name = "app-worker-0";
    workerPod.metadata!.labels = { app: "app-worker" };
    workerPod.status!.containerStatuses![0]!.restartCount = 0;
    inventory.pods.items = [appPod, workerPod];

    let now = Date.parse("2026-08-04T12:00:00Z");
    const provider = new KubernetesProvider({
      now: () => now,
      coreApi: {
        listNode: vi.fn(async () => inventory.nodes),
        listNamespace: vi.fn(async () => inventory.namespaces),
        listPodForAllNamespaces: vi.fn(async () => inventory.pods),
        listEventForAllNamespaces: vi.fn(async () => inventory.events),
        readNamespacedPod: vi.fn(),
      },
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn(async () => inventory.deployments),
        listStatefulSetForAllNamespaces: vi.fn(async () => inventory.statefulSets),
        listDaemonSetForAllNamespaces: vi.fn(async () => inventory.daemonSets),
      },
    });
    const workload = (cluster: ClusterData, name: string) =>
      cluster.workloads.find((candidate) => candidate.name === name)!;

    await provider.collect(new AbortController().signal);
    now += 10_000;
    workerPod.status!.containerStatuses![0]!.restartCount = 1;
    const restarted = await provider.collect(new AbortController().signal);

    expect(workload(restarted, "app").restartIncrease15m).toBe(false);
    expect(workload(restarted, "app-worker").restartIncrease15m).toBe(true);
  });

  it("clears a restart increase immediately after its baseline ages past 15 minutes", async () => {
    const inventory = structuredClone(kubernetesFixture);
    const pod = inventory.pods.items.find(
      (candidate) => candidate.metadata?.name === "prometheus-0",
    )!;
    pod.status!.containerStatuses![0]!.restartCount = 0;
    const startedAt = Date.parse("2026-08-04T12:00:00Z");
    let now = startedAt;
    const provider = new KubernetesProvider({
      now: () => now,
      coreApi: {
        listNode: vi.fn(async () => inventory.nodes),
        listNamespace: vi.fn(async () => inventory.namespaces),
        listPodForAllNamespaces: vi.fn(async () => inventory.pods),
        listEventForAllNamespaces: vi.fn(async () => inventory.events),
        readNamespacedPod: vi.fn(),
      },
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn(async () => inventory.deployments),
        listStatefulSetForAllNamespaces: vi.fn(async () => inventory.statefulSets),
        listDaemonSetForAllNamespaces: vi.fn(async () => inventory.daemonSets),
      },
    });
    const restartIncreased = async () => {
      const cluster = await provider.collect(new AbortController().signal);
      return cluster.workloads.find((workload) => workload.name === "prometheus")!
        .restartIncrease15m;
    };

    await expect(restartIncreased()).resolves.toBe(false);
    now += 10_000;
    pod.status!.containerStatuses![0]!.restartCount = 1;
    await expect(restartIncreased()).resolves.toBe(true);

    now += 10_000;
    pod.status!.containerStatuses![0]!.restartCount = 0;
    await expect(restartIncreased()).resolves.toBe(true);

    now = startedAt + 10_000 + 15 * 60_000;
    await expect(restartIncreased()).resolves.toBe(true);

    now += 1;
    await expect(restartIncreased()).resolves.toBe(false);
  });

  it("forgets restart history when a workload is removed", async () => {
    const inventory = structuredClone(kubernetesFixture);
    const workload = inventory.statefulSets.items[0]!;
    const pod = inventory.pods.items.find(
      (candidate) => candidate.metadata?.name === "prometheus-0",
    )!;
    pod.status!.containerStatuses![0]!.restartCount = 0;
    let now = Date.parse("2026-08-04T12:00:00Z");
    const provider = new KubernetesProvider({
      now: () => now,
      coreApi: {
        listNode: vi.fn(async () => inventory.nodes),
        listNamespace: vi.fn(async () => inventory.namespaces),
        listPodForAllNamespaces: vi.fn(async () => inventory.pods),
        listEventForAllNamespaces: vi.fn(async () => inventory.events),
        readNamespacedPod: vi.fn(),
      },
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn(async () => inventory.deployments),
        listStatefulSetForAllNamespaces: vi.fn(async () => inventory.statefulSets),
        listDaemonSetForAllNamespaces: vi.fn(async () => inventory.daemonSets),
      },
    });
    const prometheus = (cluster: ClusterData) =>
      cluster.workloads.find((candidate) => candidate.name === "prometheus");

    expect(prometheus(await provider.collect(new AbortController().signal))).toMatchObject({
      restartIncrease15m: false,
    });

    now += 10_000;
    inventory.statefulSets.items = [];
    inventory.pods.items = inventory.pods.items.filter(
      (candidate) => candidate.metadata?.name !== "prometheus-0",
    );
    expect(prometheus(await provider.collect(new AbortController().signal))).toBeUndefined();

    now += 10_000;
    workload.status!.availableReplicas = 1;
    pod.status!.containerStatuses![0]!.restartCount = 1;
    inventory.statefulSets.items = [workload];
    inventory.pods.items.push(pod);
    expect(prometheus(await provider.collect(new AbortController().signal))).toMatchObject({
      restartIncrease15m: false,
      status: "healthy",
    });
  });

  it("returns typed pod detail from the read-only pod endpoint", async () => {
    const provider = new KubernetesProvider({
      coreApi: {
        listNode: vi.fn(),
        listNamespace: vi.fn(),
        listPodForAllNamespaces: vi.fn(),
        listEventForAllNamespaces: vi.fn(),
        readNamespacedPod: vi.fn(async () => fixturePod),
      },
      appsApi: {
        listDeploymentForAllNamespaces: vi.fn(),
        listStatefulSetForAllNamespaces: vi.fn(),
        listDaemonSetForAllNamespaces: vi.fn(),
      },
    });

    const detail: PodDetail = await provider.getPod("homelab", "gateway-abc");

    expect(detail.containers[0]).toMatchObject({
      name: "gateway",
      reason: "CrashLoopBackOff",
    });
  });

  it("requests an initial 200-line tail, follows, and aborts upstream from the signal", async () => {
    const { kubeConfig, applyToFetchOptions } = createLogKubeConfig();
    let requestUrl: string | undefined;
    let requestOptions: RequestInit | undefined;
    const fetchApi = vi.fn(async (url: string, options: RequestInit) => {
      requestUrl = url;
      requestOptions = options;
      return new Response(Readable.from(["2026-08-04T12:00:00Z request complete\n"]), {
        status: 200,
      });
    });
    const provider = new KubernetesProvider({ kubeConfig, fetchApi });
    const downstream = new AbortController();
    const iterator = provider
      .streamPodLogs("homelab", "gateway-abc", "gateway", downstream.signal)
      [Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: "2026-08-04T12:00:00Z request complete",
    });
    const url = new URL(requestUrl!);
    expect(url.pathname).toBe("/api/v1/namespaces/homelab/pods/gateway-abc/log");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      container: "gateway",
      tailLines: "200",
      follow: "true",
      timestamps: "true",
    });
    expect(requestOptions).toMatchObject({
      method: "GET",
      headers: { authorization: "Bearer private" },
    });
    expect(applyToFetchOptions).toHaveBeenCalledWith({});

    downstream.abort();
    expect(requestOptions?.signal?.aborted).toBe(true);
    await iterator.return?.();
  });

  it("resumes from a validated timestamp cursor without replaying a fresh 200-line tail", async () => {
    const { kubeConfig } = createLogKubeConfig();
    let requestUrl: string | undefined;
    const fetchApi = vi.fn(async (url: string) => {
      requestUrl = url;
      return new Response(Readable.from(["2026-08-04T12:00:01Z next line\n"]), {
        status: 200,
      });
    });
    const provider = new KubernetesProvider({ kubeConfig, fetchApi });
    const cursor = "2026-08-04T12:00:00.123456789Z";
    const iterator = provider
      .streamPodLogs("homelab", "gateway-abc", "gateway", new AbortController().signal, cursor)
      [Symbol.asyncIterator]();

    await iterator.next();
    const url = new URL(requestUrl!);
    expect(url.searchParams.get("sinceTime")).toBe(cursor);
    expect(url.searchParams.has("tailLines")).toBe(false);
    expect(url.searchParams.get("follow")).toBe("true");
    expect(url.searchParams.get("timestamps")).toBe("true");
    await iterator.return?.();
  });

  it("rejects a malformed direct resume cursor before Kubernetes access", async () => {
    const { kubeConfig } = createLogKubeConfig();
    const fetchApi = vi.fn();
    const provider = new KubernetesProvider({ kubeConfig, fetchApi });
    const logs = provider.streamPodLogs(
      "homelab",
      "gateway-abc",
      "gateway",
      new AbortController().signal,
      "../../secret",
    );

    await expect(logs.ready).rejects.toThrow("Invalid pod log cursor");
    expect(fetchApi).not.toHaveBeenCalled();
  });

  it("aborts the initial request while its connection is still pending", async () => {
    const { kubeConfig } = createLogKubeConfig();
    let requestSignal: AbortSignal | undefined;
    const fetchApi = vi.fn((_url: string, options: RequestInit) => {
      requestSignal = options.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
      });
    });
    const provider = new KubernetesProvider({ kubeConfig, fetchApi });
    const downstream = new AbortController();

    const logs = provider.streamPodLogs("homelab", "gateway-abc", "gateway", downstream.signal);
    await vi.waitFor(() => expect(fetchApi).toHaveBeenCalledOnce());
    downstream.abort();

    expect(requestSignal?.aborted).toBe(true);
    await expect(logs.ready).rejects.toThrow("aborted");
  });
});

describe("pod gateway routes", () => {
  it.each([
    "/pods/bad%2Fname/pod",
    "/pods/./pod",
    "/pods/good/bad%2Fname",
    "/pods/good/%2e%2e",
    "/pods/good/.",
    "/pods//pod",
    "/pods/good/",
    "/pods/Bad/pod",
    "/pods/good/a..b",
    `/pods/${"a".repeat(64)}/pod`,
  ])("rejects invalid namespace or pod path %s before Kubernetes access", async (path) => {
    const getPod = vi.fn(async () => mapPodDetail(fixturePod));
    const kubernetesProvider = {
      source: "kubernetes" as const,
      collect: vi.fn(async () => mapClusterData(kubernetesFixture)),
      getPod,
      streamPodLogs: async function* () {
        yield "unused";
      },
    };

    const response = await createGateway({ kubernetesProvider }).request(path);

    expect(response.status).toBe(400);
    expect(getPod).not.toHaveBeenCalled();
  });

  it.each([
    "/pods/good/pod/logs?container=",
    "/pods/good/pod/logs?container=.",
    "/pods/good/pod/logs?container=bad%2Fname",
    "/pods/good/pod/logs?container=main.container",
    `/pods/good/pod/logs?container=${"a".repeat(64)}`,
  ])("rejects invalid container query %s before Kubernetes access", async (path) => {
    const streamPodLogs = vi.fn(async function* () {
      yield "unused";
    });
    const kubernetesProvider = {
      source: "kubernetes" as const,
      collect: vi.fn(async () => mapClusterData(kubernetesFixture)),
      getPod: vi.fn(async () => mapPodDetail(fixturePod)),
      streamPodLogs,
    };

    const response = await createGateway({ kubernetesProvider }).request(path);

    expect(response.status).toBe(400);
    expect(streamPodLogs).not.toHaveBeenCalled();
  });

  it.each([
    "/pods/good/pod/logs?container=main&since=..%2Fsecret",
    "/pods/good/pod/logs?container=main&since=2026-08-04%2012%3A00%3A00Z",
    "/pods/good/pod/logs?container=main&since=2026-08-04T12%3A00%3A00",
  ])("rejects invalid log cursor query %s before Kubernetes access", async (path) => {
    const streamPodLogs = vi.fn(async function* () {
      yield "unused";
    });
    const kubernetesProvider = {
      source: "kubernetes" as const,
      collect: vi.fn(async () => mapClusterData(kubernetesFixture)),
      getPod: vi.fn(async () => mapPodDetail(fixturePod)),
      streamPodLogs,
    };

    const response = await createGateway({ kubernetesProvider }).request(path);

    expect(response.status).toBe(400);
    expect(streamPodLogs).not.toHaveBeenCalled();
  });

  it.each([
    "/pods/bad%2Fname/pod/logs?container=main",
    "/pods/good/bad%2Fname/logs?container=main",
    "/pods/good/%2e%2e/logs?container=main",
    "/pods/Bad/pod/logs?container=main",
  ])("rejects invalid log path %s before Kubernetes access", async (path) => {
    const streamPodLogs = vi.fn(async function* () {
      yield "unused";
    });
    const kubernetesProvider = {
      source: "kubernetes" as const,
      collect: vi.fn(async () => mapClusterData(kubernetesFixture)),
      getPod: vi.fn(async () => mapPodDetail(fixturePod)),
      streamPodLogs,
    };

    const response = await createGateway({ kubernetesProvider }).request(path);

    expect(response.status).toBe(400);
    expect(streamPodLogs).not.toHaveBeenCalled();
  });

  it("accepts a DNS subdomain pod name and DNS label container name", async () => {
    const getPod = vi.fn(async () => mapPodDetail(fixturePod));
    const kubernetesProvider = {
      source: "kubernetes" as const,
      collect: vi.fn(async () => mapClusterData(kubernetesFixture)),
      getPod,
      streamPodLogs: async function* () {
        yield "unused";
      },
    };

    const response = await createGateway({ kubernetesProvider }).request(
      "/pods/homelab/gateway.part-1",
    );

    expect(response.status).toBe(200);
    expect(getPod).toHaveBeenCalledWith("homelab", "gateway.part-1");
  });

  it("returns pod detail and frames ready and line events", async () => {
    const kubernetesProvider = {
      source: "kubernetes" as const,
      collect: vi.fn(async () => mapClusterData(kubernetesFixture)),
      getPod: vi.fn(async () => mapPodDetail(fixturePod)),
      streamPodLogs: async function* () {
        yield "2026-08-04T12:00:00Z request complete";
      },
    };
    const app = createGateway({ kubernetesProvider });

    const podResponse = await app.request("/pods/homelab/gateway-abc");
    const logsResponse = await app.request("/pods/homelab/gateway-abc/logs?container=gateway");

    expect(podResponse.status).toBe(200);
    await expect(podResponse.json()).resolves.toMatchObject({
      name: "gateway-abc",
    });
    expect(logsResponse.headers.get("content-type")).toContain("text/event-stream");
    expect(await logsResponse.text()).toBe(
      'event: ready\ndata: {"status":"ready"}\n\nevent: line\ndata: {"line":"2026-08-04T12:00:00Z request complete","cursor":"2026-08-04T12:00:00Z"}\n\n',
    );
  });

  it("passes a validated resume cursor from the gateway to the provider", async () => {
    const streamPodLogs = vi.fn(async function* () {
      yield "2026-08-04T12:00:01Z next";
    });
    const kubernetesProvider = {
      source: "kubernetes" as const,
      collect: vi.fn(async () => mapClusterData(kubernetesFixture)),
      getPod: vi.fn(async () => mapPodDetail(fixturePod)),
      streamPodLogs,
    };
    const cursor = "2026-08-04T12:00:00.123456789Z";

    const response = await createGateway({ kubernetesProvider }).request(
      `/pods/homelab/gateway-abc/logs?container=gateway&since=${encodeURIComponent(cursor)}`,
    );
    await response.text();

    expect(streamPodLogs).toHaveBeenCalledWith(
      "homelab",
      "gateway-abc",
      "gateway",
      expect.any(AbortSignal),
      cursor,
    );
  });

  it("aborts the upstream log stream when the HTTP client disconnects", async () => {
    let upstreamSignal: AbortSignal | undefined;
    const kubernetesProvider = {
      source: "kubernetes" as const,
      collect: vi.fn(async () => mapClusterData(kubernetesFixture)),
      getPod: vi.fn(async () => mapPodDetail(fixturePod)),
      streamPodLogs(_namespace: string, _pod: string, _container: string, signal: AbortSignal) {
        upstreamSignal = signal;
        return (async function* () {
          yield "connected";
          await new Promise<void>(() => undefined);
        })();
      },
    };
    const response = await createGateway({ kubernetesProvider }).request(
      "/pods/homelab/gateway-abc/logs?container=gateway",
    );
    const reader = response.body?.getReader();

    await reader?.read();
    await reader?.cancel();
    await vi.waitFor(() => expect(upstreamSignal?.aborted).toBe(true));
  });

  it("aborts a provider-backed log request when the client disconnects before ready", async () => {
    const { kubeConfig } = createLogKubeConfig();
    let requestSignal: AbortSignal | undefined;
    const fetchApi = vi.fn((_url: string, options: RequestInit) => {
      requestSignal = options.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
      });
    });
    const kubernetesProvider = new KubernetesProvider({ kubeConfig, fetchApi });
    const response = await createGateway({ kubernetesProvider }).request(
      "/pods/homelab/gateway-abc/logs?container=gateway",
    );
    const reader = response.body!.getReader();

    await vi.waitFor(() => expect(fetchApi).toHaveBeenCalledOnce());
    await reader.cancel();

    await vi.waitFor(() => expect(requestSignal?.aborted).toBe(true));
  });

  it("emits only a safe error event when Kubernetes log streaming fails", async () => {
    const kubernetesProvider = {
      source: "kubernetes" as const,
      collect: vi.fn(async () => mapClusterData(kubernetesFixture)),
      getPod: vi.fn(async () => mapPodDetail(fixturePod)),
      streamPodLogs() {
        return {
          [Symbol.asyncIterator]() {
            return {
              next: async () => {
                throw new Error("credential=private stack=/secret/path");
              },
            };
          },
        };
      },
    };

    const response = await createGateway({ kubernetesProvider }).request(
      "/pods/homelab/gateway-abc/logs?container=gateway",
    );
    const body = await response.text();

    expect(body).toContain('event: error\ndata: {"message":"Pod logs unavailable"}');
    expect(body).not.toContain("credential=private");
    expect(body).not.toContain("/secret/path");
  });

  it("contains an initial provider connection rejection in a fixed safe SSE error", async () => {
    const { kubeConfig } = createLogKubeConfig();
    const kubernetesProvider = new KubernetesProvider({
      kubeConfig,
      fetchApi: vi.fn(async () => {
        throw new Error("credential=private stack=/secret/path");
      }),
    });

    const response = await createGateway({ kubernetesProvider }).request(
      "/pods/homelab/gateway-abc/logs?container=gateway",
    );
    const body = await response.text();

    expect(body).toBe('event: error\ndata: {"message":"Pod logs unavailable"}\n\n');
    expect(body).not.toContain("credential=private");
    expect(body).not.toContain("/secret/path");
  });

  it("forwards a post-connect source error into safe SSE and aborts upstream", async () => {
    const source = new PassThrough();
    const { kubeConfig } = createLogKubeConfig();
    let requestSignal: AbortSignal | undefined;
    const kubernetesProvider = new KubernetesProvider({
      kubeConfig,
      fetchApi: vi.fn(async (_url, options) => {
        requestSignal = options.signal ?? undefined;
        queueMicrotask(() => source.write("2026-08-04T12:00:00Z connected\n"));
        return new Response(source, { status: 200 });
      }),
    });
    const response = await createGateway({ kubernetesProvider }).request(
      "/pods/homelab/gateway-abc/logs?container=gateway",
    );
    const reader = response.body!.getReader();

    const initial = await readSseUntil(reader, "event: line");
    expect(initial).toContain("event: ready");
    expect(initial).toContain("event: line");

    source.destroy(new Error("credential=private stack=/secret/path"));
    const failure = await readSseUntil(reader, "event: error");

    expect(failure).toContain('event: error\ndata: {"message":"Pod logs unavailable"}');
    expect(failure).not.toContain("credential=private");
    expect(failure).not.toContain("/secret/path");
    expect(requestSignal?.aborted).toBe(true);
    await reader.cancel();
  });
});
