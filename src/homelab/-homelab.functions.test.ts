import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ClusterData,
  ClusterSnapshot,
  DeploymentSnapshot,
  OverviewSnapshot,
  ServiceSnapshot,
} from "@shared/homelab/contracts";
import { createGateway } from "../../gateway/src/app";
import { createProductionGatewayDependencies } from "../../gateway/src/runtime";

vi.mock("#/lib/server-auth", () => ({
  noStore: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: vi.fn(() => ({
    handler: (handler: () => unknown) => handler,
  })),
}));

const { getClusterSnapshot, getDeploymentSnapshot, getHomelabOverview, getServiceSnapshot } =
  await import("./homelab.functions");
const { noStore } = await import("#/lib/server-auth");

const OBSERVED_AT = "2026-08-04T12:00:00.000Z";
const GATEWAY_SOURCE_SHA = "1829d6ba3b55e66a2134ae64161b9e48ad39a197";

const envelope: Omit<OverviewSnapshot, "data"> = {
  status: "healthy",
  observedAt: OBSERVED_AT,
  stale: false,
  issues: [],
  sources: [],
};

const overview: OverviewSnapshot = {
  ...envelope,
  data: {
    cluster: { status: "healthy", readyNodes: 1, totalNodes: 1 },
    workloads: { healthy: 2, warning: 0, critical: 0, unknown: 0, total: 2 },
    argo: { status: "healthy", syncedApplications: 1, totalApplications: 1 },
    resources: { current: [], history: [] },
    activeIssues: [],
    recentActivity: [],
    services: [],
  },
};

const cluster: ClusterSnapshot = {
  ...envelope,
  data: {
    nodes: [],
    namespaces: [],
    workloads: [],
    pods: [],
    events: [],
    resources: { current: [], history: [] },
  },
};

const deployments: DeploymentSnapshot = {
  ...envelope,
  data: { applications: [] },
};

const services: ServiceSnapshot = {
  ...envelope,
  data: { services: [] },
};

function gatewayClusterData(): ClusterData {
  const workload = (name: string) => ({
    kind: "Deployment",
    name,
    namespace: "yootoob-mp3",
    status: "healthy" as const,
    desiredReplicas: 1,
    availableReplicas: 1,
    failureReason: null,
    restartIncrease15m: false,
  });
  const pod = (name: "api" | "frontend", digest: string) => ({
    name: `yootoob-mp3-${name}-abc`,
    namespace: "yootoob-mp3",
    status: "healthy" as const,
    ready: true,
    restartCount: 0,
    node: "dumachine",
    image: `ghcr.io/isolumi/yootoob-mp3-${name}:${GATEWAY_SOURCE_SHA}`,
    imageTag: `ghcr.io/isolumi/yootoob-mp3-${name}:${GATEWAY_SOURCE_SHA}`,
    imageDigest: `sha256:${digest.repeat(64)}`,
    containerImages: [
      {
        name,
        repository: `ghcr.io/isolumi/yootoob-mp3-${name}`,
        reference: `ghcr.io/isolumi/yootoob-mp3-${name}:${GATEWAY_SOURCE_SHA}`,
        tag: GATEWAY_SOURCE_SHA,
        digest: `sha256:${digest.repeat(64)}`,
      },
    ],
    createdAt: "2026-08-04T11:59:30.000Z",
  });

  return {
    nodes: [{ name: "dumachine", ready: true, status: "healthy", conditions: ["Ready"] }],
    namespaces: [
      {
        name: "yootoob-mp3",
        status: "healthy",
        workloadCount: 2,
        podCount: 2,
      },
    ],
    workloads: [workload("yootoob-mp3-api"), workload("yootoob-mp3-frontend")],
    pods: [pod("api", "a"), pod("frontend", "b")],
    events: [
      {
        id: "yootoob-mp3/rollout-complete",
        namespace: "yootoob-mp3",
        resource: "Deployment/yootoob-mp3-api",
        status: "healthy",
        reason: "RolloutComplete",
        message: "Deployment rollout completed.",
        observedAt: "2026-08-04T12:01:00.000Z",
      },
    ],
    resources: {
      current: [
        { resource: "cpu", usagePercent: 42, observedAt: "2026-08-04T12:02:00.000Z" },
        { resource: "memory", usagePercent: 61, observedAt: "2026-08-04T12:02:00.000Z" },
        { resource: "disk", usagePercent: 37, observedAt: "2026-08-04T12:02:00.000Z" },
      ],
      history: [
        {
          resource: "cpu",
          points: [
            { timestamp: "2026-08-03T12:02:00.000Z", value: 35 },
            { timestamp: "2026-08-04T12:02:00.000Z", value: 42 },
          ],
        },
        {
          resource: "memory",
          points: [
            { timestamp: "2026-08-03T12:02:00.000Z", value: 58 },
            { timestamp: "2026-08-04T12:02:00.000Z", value: 61 },
          ],
        },
        {
          resource: "disk",
          points: [
            { timestamp: "2026-08-03T12:02:00.000Z", value: 36 },
            { timestamp: "2026-08-04T12:02:00.000Z", value: 37 },
          ],
        },
      ],
    },
  };
}

function gatewayWorkflowData() {
  return {
    repository: "Isolumi/youtube-mp3",
    branch: "development",
    name: "Build and publish images",
    status: "completed",
    conclusion: "success",
    commit: {
      sha: GATEWAY_SOURCE_SHA,
      message: "Build production images",
      author: "Isolumi",
      committedAt: "2026-08-04T11:58:00.000Z",
      url: `https://github.com/Isolumi/youtube-mp3/commit/${GATEWAY_SOURCE_SHA}`,
    },
    startedAt: "2026-08-04T11:58:00.000Z",
    completedAt: "2026-08-04T12:00:30.000Z",
    durationMs: 150_000,
    url: "https://github.com/Isolumi/youtube-mp3/actions/runs/987654321",
  };
}

function gatewayArgoData() {
  return {
    name: "yootoob-mp3-dumachine",
    namespace: "argocd",
    sync: { status: "Synced", revision: GATEWAY_SOURCE_SHA },
    health: {
      status: "Healthy",
      message: "Application is healthy",
      lastTransitionAt: "2026-08-04T12:01:00.000Z",
    },
    operation: {
      phase: "Succeeded",
      message: "successfully synced",
      revision: GATEWAY_SOURCE_SHA,
      startedAt: "2026-08-04T12:00:00.000Z",
      finishedAt: "2026-08-04T12:01:00.000Z",
    },
    resources: [],
    images: [
      `ghcr.io/isolumi/yootoob-mp3-api:${GATEWAY_SOURCE_SHA}`,
      `ghcr.io/isolumi/yootoob-mp3-frontend:${GATEWAY_SOURCE_SHA}`,
    ],
  };
}

function gatewayServiceProbeData() {
  return [
    {
      entry: {
        id: "yootoob-mp3",
        name: "yootoob-mp3",
        description: "Private YouTube MP3 downloader",
        url: "https://yootoob.doh.lumilumi.xyz",
        namespace: "yootoob-mp3",
        argoApplication: "yootoob-mp3-dumachine",
        workloads: [
          { kind: "Deployment", name: "yootoob-mp3-api" },
          { kind: "Deployment", name: "yootoob-mp3-frontend" },
        ],
      },
      id: "yootoob-mp3",
      reachable: true,
      status: "healthy" as const,
      latencyMs: 42,
      certificateExpiresAt: "2026-09-01T00:00:00.000Z",
      consecutiveFailures: 0,
    },
  ];
}

const endpointResponses = new Map<string, unknown>([
  ["overview", overview],
  ["cluster", cluster],
  ["deployments", deployments],
  ["services", services],
]);

beforeEach(() => {
  vi.stubEnv("GATEWAY_URL", "http://gateway.internal:8080");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const endpoint = new URL(String(input)).pathname.split("/").at(-1) ?? "";
      return Response.json(endpointResponses.get(endpoint));
    }),
  );
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("homelab server functions", () => {
  it("catches the production break where the real gateway overview cannot cross the Task 9 schema boundary", async () => {
    const clusterData = gatewayClusterData();
    const serviceProbe = gatewayServiceProbeData()[0]!;
    const dependencies = createProductionGatewayDependencies(
      {
        NODE_ENV: "production",
        PROMETHEUS_URL: "http://prometheus.monitoring.svc.cluster.local:9090",
      },
      {
        loadServiceCatalog: async () => [serviceProbe.entry],
        probeService: async () => serviceProbe,
      },
    );
    vi.spyOn(dependencies.kubernetesProvider, "collect").mockResolvedValue(
      structuredClone(clusterData),
    );
    const prometheusProvider = dependencies.providers.cluster.find(
      ({ source }) => source === "prometheus",
    )!;
    vi.spyOn(prometheusProvider, "collect").mockResolvedValue(
      structuredClone(clusterData.resources),
    );
    const githubProvider = dependencies.providers.deployments.find(
      ({ source }) => source === "github",
    )!;
    vi.spyOn(githubProvider, "collect").mockResolvedValue(gatewayWorkflowData());
    const argoProvider = dependencies.providers.deployments.find(
      ({ source }) => source === "argocd",
    )!;
    vi.spyOn(argoProvider, "collect").mockResolvedValue(gatewayArgoData());
    const gateway = createGateway({
      ...dependencies,
      now: () => new Date("2026-08-04T12:02:00.000Z"),
    });
    vi.mocked(fetch).mockImplementation((input, init) =>
      Promise.resolve(gateway.request(input instanceof Request ? input : String(input), init)),
    );

    await expect(getHomelabOverview()).resolves.toMatchObject({
      status: "healthy",
      stale: false,
      data: {
        cluster: { status: "healthy", readyNodes: 1, totalNodes: 1 },
        workloads: { healthy: 2, warning: 0, critical: 0, unknown: 0, total: 2 },
        argo: { status: "healthy", syncedApplications: 1, totalApplications: 1 },
        resources: clusterData.resources,
        activeIssues: [],
        recentActivity: [
          {
            id: "yootoob-mp3/rollout-complete",
            resource: "Deployment/yootoob-mp3-api",
            message: "Deployment rollout completed.",
            status: "healthy",
            occurredAt: "2026-08-04T12:01:00.000Z",
            source: "kubernetes",
            url: null,
          },
        ],
        services: [
          expect.objectContaining({
            name: "yootoob-mp3",
            status: "healthy",
            url: "https://yootoob.doh.lumilumi.xyz",
          }),
        ],
      },
      sources: expect.arrayContaining([
        expect.objectContaining({ source: "kubernetes", status: "healthy", stale: false }),
        expect.objectContaining({ source: "prometheus", status: "healthy", stale: false }),
        expect.objectContaining({ source: "github", status: "healthy", stale: false }),
        expect.objectContaining({ source: "argocd", status: "healthy", stale: false }),
        expect.objectContaining({ source: "service-probe", status: "healthy", stale: false }),
      ]),
    });
  });

  it("returns the exact validated snapshot contract for every gateway endpoint", async () => {
    await expect(getHomelabOverview()).resolves.toEqual(overview);
    await expect(getClusterSnapshot()).resolves.toEqual(cluster);
    await expect(getDeploymentSnapshot()).resolves.toEqual(deployments);
    await expect(getServiceSnapshot()).resolves.toEqual(services);

    expect(noStore).toHaveBeenCalledTimes(4);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      "http://gateway.internal:8080/overview",
      "http://gateway.internal:8080/cluster",
      "http://gateway.internal:8080/deployments",
      "http://gateway.internal:8080/services",
    ]);
    for (const [, options] of vi.mocked(fetch).mock.calls) {
      expect(options).toMatchObject({ cache: "no-store" });
      expect(new Headers(options?.headers).get("Cache-Control")).toBe("no-store");
    }
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "ftp://host/file"])(
    "catches the production break where browser-facing overview links accept %s",
    async (unsafeUrl) => {
      const unsafeOverview = structuredClone(overview);
      unsafeOverview.data!.recentActivity = [
        {
          id: "unsafe-activity",
          resource: "Deployment/dum-dashboard",
          message: "Unsafe activity link",
          status: "warning",
          occurredAt: OBSERVED_AT,
          source: "argocd",
          url: unsafeUrl,
        },
      ];
      unsafeOverview.data!.services = [
        {
          name: "Unsafe service",
          description: "Unsafe service link",
          status: "unknown",
          url: unsafeUrl,
          certificateExpiresAt: null,
          probeLatencyMs: null,
          namespace: null,
          workload: null,
          image: null,
          observedAt: OBSERVED_AT,
        },
      ];
      vi.mocked(fetch).mockResolvedValue(Response.json(unsafeOverview));

      await expect(getHomelabOverview()).rejects.toMatchObject({
        message: "Homelab data unavailable",
        stack: undefined,
      });
    },
  );

  it("keeps safe HTTPS activity and service controls across the server schema boundary", async () => {
    const safeOverview = structuredClone(overview);
    safeOverview.data!.recentActivity = [
      {
        id: "safe-activity",
        resource: "Deployment/dum-dashboard",
        message: "Safe activity link",
        status: "healthy",
        occurredAt: OBSERVED_AT,
        source: "argocd",
        url: "https://argocd.doh.lumilumi.xyz/applications/dum-dashboard",
      },
    ];
    safeOverview.data!.services = [
      {
        name: "Grafana",
        description: "Metrics and dashboards",
        status: "healthy",
        url: "https://grafana.doh.lumilumi.xyz",
        certificateExpiresAt: null,
        probeLatencyMs: 24,
        namespace: "monitoring",
        workload: "Deployment/grafana",
        image: "grafana/grafana:12",
        observedAt: OBSERVED_AT,
      },
    ];
    vi.mocked(fetch).mockResolvedValue(Response.json(safeOverview));

    await expect(getHomelabOverview()).resolves.toMatchObject({
      data: {
        recentActivity: [{ url: "https://argocd.doh.lumilumi.xyz/applications/dum-dashboard" }],
        services: [{ url: "https://grafana.doh.lumilumi.xyz" }],
      },
    });
  });

  it("rejects malformed gateway data without serializing gateway secrets or a stack", async () => {
    const gatewayUrl = "http://gateway.internal:8080/private-credential";
    vi.stubEnv("GATEWAY_URL", gatewayUrl);
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ ...overview, credential: gatewayUrl, stack: "/private/gateway.ts:42" }),
    );

    const error = await getHomelabOverview().catch((caught: unknown) => caught);
    const browserPayload = JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    expect(browserPayload).toBe('{"message":"Homelab data unavailable"}');
    expect(browserPayload).not.toContain(gatewayUrl);
    expect(browserPayload).not.toContain("credential");
    expect(browserPayload).not.toContain("gateway.ts");
  });

  it("does not read or expose a gateway error body", async () => {
    const gatewayBody = "credential=private pod-line=secret stack=/gateway/provider.ts:42";
    vi.mocked(fetch).mockResolvedValue(new Response(gatewayBody, { status: 502 }));

    const error = await getClusterSnapshot().catch((caught: unknown) => caught);
    const browserPayload = JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    expect(browserPayload).toBe('{"message":"Homelab data unavailable"}');
    expect(browserPayload).not.toContain(gatewayBody);
  });

  it("aborts a snapshot request after five seconds", async () => {
    vi.useFakeTimers();
    let upstreamSignal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation(
      (_input, options) =>
        new Promise<Response>((_resolve, reject) => {
          upstreamSignal = options?.signal ?? undefined;
          upstreamSignal?.addEventListener(
            "abort",
            () => reject(new DOMException("The operation was aborted", "AbortError")),
            { once: true },
          );
        }),
    );

    const result = getServiceSnapshot().catch((caught: unknown) => caught);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(upstreamSignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const error = await result;

    expect(upstreamSignal?.aborted).toBe(true);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Homelab data unavailable");
    expect((error as Error).stack).toBeUndefined();
  });
});
