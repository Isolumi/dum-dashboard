import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createGateway } from "../app";
import type { ClusterData, PodDetail } from "../../../shared/homelab/contracts";
import fixture from "./fixtures/kubernetes.json";
import { mapClusterData, mapPodDetail, type KubernetesInventory } from "./kubernetes-mappers";
import { KubernetesProvider, loadKubernetesConfig } from "./kubernetes";

const kubernetesFixture = fixture as unknown as KubernetesInventory;
const fixturePod = kubernetesFixture.pods.items[0]!;

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
    const upstream = new AbortController();
    let options: Record<string, unknown> | undefined;
    const logClient = {
      log: vi.fn(
        async (
          _namespace: string,
          _pod: string,
          _container: string,
          output: Writable,
          receivedOptions: Record<string, unknown>,
        ) => {
          options = receivedOptions;
          queueMicrotask(() => output.write("2026-08-04T12:00:00Z request complete\n"));
          return upstream;
        },
      ),
    };
    const provider = new KubernetesProvider({ logClient });
    const downstream = new AbortController();
    const iterator = provider
      .streamPodLogs("homelab", "gateway-abc", "gateway", downstream.signal)
      [Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: "2026-08-04T12:00:00Z request complete",
    });
    expect(options).toMatchObject({ tailLines: 200, follow: true });

    downstream.abort();
    expect(upstream.signal.aborted).toBe(true);
    await iterator.return?.();
  });
});

describe("pod gateway routes", () => {
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
});
