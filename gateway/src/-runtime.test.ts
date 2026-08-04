import { describe, expect, it } from "vitest";
import { createGateway } from "./app";
import { createProductionGatewayDependencies } from "./runtime";

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

    expect(dependencies.providers.cluster.map(({ source }) => source)).toEqual(["kubernetes"]);
    expect(dependencies.providers.cluster[0]).toBe(dependencies.kubernetesProvider);

    const response = await createGateway(dependencies).request("/healthz");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
