import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ClusterSnapshot,
  DeploymentSnapshot,
  OverviewSnapshot,
  ServiceSnapshot,
} from "@shared/homelab/contracts";

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
