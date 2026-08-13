import { describe, expect, it, vi } from "vitest";
import type { ClusterData, Snapshot } from "../../shared/homelab/contracts";
import { createGateway } from "./app";
import { createProductionGatewayDependencies } from "./runtime";
import type { ApplicationCatalogEntry, HomelabCatalog } from "./service-catalog";
import type { ServiceCatalogEntry, ServiceProbeResult } from "./service-probe";

const emptyCluster: ClusterData = {
  nodes: [],
  namespaces: [],
  workloads: [],
  pods: [],
  events: [],
  resources: { current: [], history: [] },
};

describe("production gateway dependencies", () => {
  it("catches the production break where catalog-backed service probes are not wired", async () => {
    const application: ApplicationCatalogEntry = {
      id: "yootoob-mp3",
      name: "Yootoob MP3",
      namespace: "yootoob-mp3",
      argoApplication: "yootoob-mp3-dumachine",
      github: {
        repository: "Isolumi/youtube-mp3",
        branch: "development",
        workflow: "build-images.yml",
      },
      workloads: [
        {
          kind: "Deployment",
          name: "yootoob-mp3-api",
          imageRepository: "ghcr.io/isolumi/yootoob-mp3-api",
          tracksSource: true,
        },
      ],
    };
    const entry: ServiceCatalogEntry = {
      id: "yootoob-mp3",
      name: "yootoob-mp3",
      description: "Private YouTube MP3 downloader",
      url: "https://yootoob.doh.lumilumi.xyz",
      applicationId: application.id,
      namespace: "yootoob-mp3",
      argoApplication: "yootoob-mp3-dumachine",
      workloads: application.workloads,
    };
    const probeResult: ServiceProbeResult = {
      entry,
      id: entry.id,
      reachable: true,
      status: "healthy",
      latencyMs: 42,
      certificateExpiresAt: "2026-09-01T00:00:00.000Z",
      consecutiveFailures: 0,
    };
    const catalog: HomelabCatalog = { applications: [application], services: [entry] };
    const dependencies = await createProductionGatewayDependencies(
      { NODE_ENV: "production" },
      {
        loadServiceCatalog: async () => catalog,
        probeService: async () => probeResult,
      },
    );

    const serviceProviders = dependencies.providers.services;
    expect(serviceProviders.map(({ source }) => source)).toEqual([
      "service-probe",
      "argocd",
      "kubernetes",
    ]);
    await expect(serviceProviders[0]!.collect(new AbortController().signal)).resolves.toEqual([
      probeResult,
    ]);
    expect(serviceProviders[2]).toBe(dependencies.kubernetesProvider);
  });

  it("uses Kubernetes for pod routes and both Kubernetes and Prometheus for cluster snapshots", async () => {
    const dependencies = await createProductionGatewayDependencies({
      NODE_ENV: "production",
      PROMETHEUS_URL: "http://prometheus.monitoring.svc.cluster.local:9090",
    });

    expect(dependencies.kubernetesProvider.source).toBe("kubernetes");
    expect(dependencies.providers.cluster.map(({ source }) => source)).toEqual([
      "kubernetes",
      "prometheus",
    ]);
    expect(dependencies.providers.cluster[0]).toBe(dependencies.kubernetesProvider);
    expect(dependencies.providers.deployments.map(({ source }) => source)).toEqual([
      "github",
      "github",
      "github",
      "github",
      "argocd",
      "argocd",
      "argocd",
      "argocd",
      "kubernetes",
    ]);
    expect(dependencies.applications.map(({ id }) => id)).toEqual([
      "dum-dashboard",
      "yootoob-mp3",
      "uwumi",
      "taxhacker",
      "monitoring",
    ]);
  });

  it("wires a selected history window through the production Prometheus provider", async () => {
    const dependencies = await createProductionGatewayDependencies({
      NODE_ENV: "production",
      PROMETHEUS_URL: "http://prometheus.monitoring.svc.cluster.local:9090",
    });
    vi.spyOn(dependencies.kubernetesProvider, "collect").mockResolvedValue(
      structuredClone(emptyCluster),
    );
    const prometheusProvider = dependencies.providers.cluster.find(
      ({ source }) => source === "prometheus",
    )! as (typeof dependencies.providers.cluster)[number] & {
      collectForWindow: ReturnType<typeof vi.fn>;
    };
    const collectForWindow = vi.fn(async () => ({ current: [], history: [] }));
    vi.spyOn(prometheusProvider, "collect").mockResolvedValue({ current: [], history: [] });
    prometheusProvider.collectForWindow = collectForWindow;

    const response = await createGateway(dependencies).request("/cluster?window=7d");

    expect(response.status).toBe(200);
    expect(collectForWindow).toHaveBeenCalledWith("7d", expect.any(AbortSignal));
    expect(response.url).not.toContain("prometheus.monitoring.svc.cluster.local");
  });

  it("starts with Kubernetes only when PROMETHEUS_URL is absent", async () => {
    const dependencies = await createProductionGatewayDependencies({ NODE_ENV: "production" });
    vi.spyOn(dependencies.kubernetesProvider, "collect").mockResolvedValue(
      structuredClone(emptyCluster),
    );

    expect(dependencies.providers.cluster.map(({ source }) => source)).toEqual(["kubernetes"]);
    expect(dependencies.providers.cluster[0]).toBe(dependencies.kubernetesProvider);
    expect(dependencies.providers.deployments.map(({ source }) => source)).toEqual([
      "github",
      "github",
      "github",
      "github",
      "argocd",
      "argocd",
      "argocd",
      "argocd",
      "kubernetes",
    ]);

    const gateway = createGateway(dependencies);
    const healthResponse = await gateway.request("/healthz");
    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toEqual({ status: "ok" });

    const clusterResponse = await gateway.request("/cluster");
    expect(clusterResponse.status).toBe(200);
    const snapshot = (await clusterResponse.json()) as Snapshot<ClusterData[]>;
    expect(snapshot.sources.map(({ source }) => source)).toEqual(["kubernetes"]);
    expect(snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "cpu-usage-unknown", source: null }),
        expect.objectContaining({ ruleId: "memory-usage-unknown", source: null }),
        expect.objectContaining({ ruleId: "disk-usage-unknown", source: null }),
      ]),
    );
  });
});
