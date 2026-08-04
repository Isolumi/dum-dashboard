import { describe, expect, it, vi } from "vitest";
import type { ClusterData, Snapshot } from "../../shared/homelab/contracts";
import { createGateway } from "./app";
import { createProductionGatewayDependencies } from "./runtime";

const emptyCluster: ClusterData = {
  nodes: [],
  namespaces: [],
  workloads: [],
  pods: [],
  events: [],
  resources: { current: [], history: [] },
};

describe("production gateway dependencies", () => {
  it("uses Kubernetes for pod routes and both Kubernetes and Prometheus for cluster snapshots", () => {
    const dependencies = createProductionGatewayDependencies({
      NODE_ENV: "production",
      PROMETHEUS_URL: "http://prometheus.monitoring.svc.cluster.local:9090",
    });

    expect(dependencies.kubernetesProvider.source).toBe("kubernetes");
    expect(dependencies.providers.cluster.map(({ source }) => source)).toEqual([
      "kubernetes",
      "prometheus",
    ]);
    expect(dependencies.providers.cluster[0]).toBe(dependencies.kubernetesProvider);
  });

  it("starts with Kubernetes only when PROMETHEUS_URL is absent", async () => {
    const dependencies = createProductionGatewayDependencies({ NODE_ENV: "production" });
    vi.spyOn(dependencies.kubernetesProvider, "collect").mockResolvedValue(
      structuredClone(emptyCluster),
    );

    expect(dependencies.providers.cluster.map(({ source }) => source)).toEqual(["kubernetes"]);
    expect(dependencies.providers.cluster[0]).toBe(dependencies.kubernetesProvider);

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
