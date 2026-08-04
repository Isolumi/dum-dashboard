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
    const cluster = mapClusterData(kubernetesFixture);

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
    await expect(podResponse.json()).resolves.toMatchObject({ name: "gateway-abc" });
    expect(logsResponse.headers.get("content-type")).toContain("text/event-stream");
    expect(await logsResponse.text()).toBe(
      'event: ready\ndata: {"status":"ready"}\n\nevent: line\ndata: {"line":"2026-08-04T12:00:00Z request complete"}\n\n',
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
