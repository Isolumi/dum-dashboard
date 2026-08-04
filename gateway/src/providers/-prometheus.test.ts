import { Response, type RequestInit } from "node-fetch";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClusterData, ResourceMetrics } from "../../../shared/homelab/contracts";
import { collectSnapshot } from "../snapshot";
import fixture from "./fixtures/prometheus.json";
import { PrometheusProvider } from "./prometheus";

const CPU_QUERY = '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))';
const MEMORY_QUERY = "100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))";
const DISK_QUERY =
  '100 * (1 - (node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"}))';
const NOW = Date.parse("2026-08-04T12:00:00.000Z");

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function vector(value?: number) {
  return {
    status: "success",
    data: {
      resultType: "vector",
      result:
        value === undefined
          ? []
          : [{ metric: { instance: "dumachine:9100" }, value: [NOW / 1000, String(value)] }],
    },
  };
}

function matrix(values: readonly [number, number][]) {
  return {
    status: "success",
    data: {
      resultType: "matrix",
      result: [
        {
          metric: { instance: "dumachine:9100" },
          values: values.map(([timestamp, value]) => [timestamp / 1000, String(value)]),
        },
      ],
    },
  };
}

const emptyCluster: ClusterData = {
  nodes: [],
  namespaces: [],
  workloads: [],
  pods: [],
  events: [],
  resources: { current: [], history: [] },
};

async function collectClusterSnapshot(resources: ResourceMetrics) {
  return collectSnapshot(
    [
      {
        source: "kubernetes",
        collect: async () => structuredClone(emptyCluster),
      },
      {
        source: "prometheus",
        collect: async () => resources,
      },
    ],
    1_000,
    () => new Date(NOW),
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("PrometheusProvider", () => {
  it("parses a successful Prometheus vector response", async () => {
    const fetchApi = vi.fn(async (_url: string, _options: RequestInit) =>
      jsonResponse(fixture.vector),
    );
    const provider = new PrometheusProvider({
      environment: { PROMETHEUS_URL: "http://prometheus.test/" },
      fetchApi,
    });

    await expect(provider.queryInstant("up")).resolves.toEqual([
      {
        metric: { instance: "dumachine:9100", job: "node-exporter" },
        timestamp: "2026-08-04T12:00:00.000Z",
        value: 42.5,
      },
    ]);
    expect(new URL(fetchApi.mock.calls[0]![0]).pathname).toBe("/api/v1/query");
    expect(new URL(fetchApi.mock.calls[0]![0]).searchParams.get("query")).toBe("up");
  });

  it("parses a successful Prometheus matrix response", async () => {
    const fetchApi = vi.fn(async (_url: string, _options: RequestInit) =>
      jsonResponse(fixture.matrix),
    );
    const provider = new PrometheusProvider({ baseUrl: "http://prometheus.test", fetchApi });

    await expect(
      provider.queryRange("up", "2026-08-04T11:55:00.000Z", "2026-08-04T12:00:00.000Z", "300s"),
    ).resolves.toEqual([
      {
        metric: { instance: "dumachine:9100", job: "node-exporter" },
        points: [
          { timestamp: "2026-08-04T11:55:00.000Z", value: 40 },
          { timestamp: "2026-08-04T12:00:00.000Z", value: 42.5 },
        ],
      },
    ]);
  });

  it("normalizes non-2xx and network failures without exposing upstream details", async () => {
    const non2xx = new PrometheusProvider({
      baseUrl: "http://prometheus.test",
      fetchApi: vi.fn(async () => jsonResponse({ error: "token=private" }, 503)),
    });
    const networkFailure = new PrometheusProvider({
      baseUrl: "http://prometheus.test",
      fetchApi: vi.fn(async () => {
        throw new Error("token=private stack=/secret/path");
      }),
    });

    await expect(non2xx.queryInstant("up")).rejects.toThrow(/^Prometheus request failed$/);
    await expect(networkFailure.queryInstant("up")).rejects.toThrow(/^Prometheus request failed$/);
  });

  it("aborts an upstream request at the fixed five-second timeout", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const provider = new PrometheusProvider({
      baseUrl: "http://prometheus.test",
      fetchApi: vi.fn((_url: string, options: RequestInit) => {
        requestSignal = options.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener(
            "abort",
            () => reject(new Error("token=private upstream aborted")),
            { once: true },
          );
        });
      }),
    });

    const request = provider.queryInstant("up");
    const rejection = expect(request).rejects.toThrow(/^Prometheus request timed out$/);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(requestSignal?.aborted).toBe(true);
    await rejection;
  });

  it("reuses an identical range result for ten seconds without a second fetch", async () => {
    let now = NOW;
    const fetchApi = vi.fn(async (_url: string, _options: RequestInit) =>
      jsonResponse(fixture.matrix),
    );
    const provider = new PrometheusProvider({
      baseUrl: "http://prometheus.test",
      fetchApi,
      now: () => now,
    });
    const args = ["up", "2026-08-04T11:55:00.000Z", "2026-08-04T12:00:00.000Z", "300s"] as const;

    const first = await provider.queryRange(...args);
    now += 9_999;
    const cached = await provider.queryRange(...args);

    expect(cached).toEqual(first);
    expect(fetchApi).toHaveBeenCalledTimes(1);

    now += 1;
    await provider.queryRange(...args);
    expect(fetchApi).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["1h", 60 * 60 * 1_000, "60s"],
    ["6h", 6 * 60 * 60 * 1_000, "120s"],
    ["24h", 24 * 60 * 60 * 1_000, "300s"],
    ["7d", 7 * 24 * 60 * 60 * 1_000, "1800s"],
  ] as const)(
    "uses the approved queries and step for %s history",
    async (window, duration, step) => {
      const fetchApi = vi.fn(async (_url: string, _options: RequestInit) =>
        jsonResponse(fixture.matrix),
      );
      const provider = new PrometheusProvider({
        baseUrl: "http://prometheus.test",
        fetchApi,
        now: () => NOW,
      });

      const history = await provider.getResourceHistory(window);
      const urls = fetchApi.mock.calls.map(([url]) => new URL(url));

      expect(history).toMatchObject({
        window,
        series: [{ resource: "cpu" }, { resource: "memory" }],
      });
      expect(urls.map((url) => url.searchParams.get("query"))).toEqual([CPU_QUERY, MEMORY_QUERY]);
      expect(urls.every((url) => url.pathname === "/api/v1/query_range")).toBe(true);
      expect(
        urls.every(
          (url) => url.searchParams.get("start") === new Date(NOW - duration).toISOString(),
        ),
      ).toBe(true);
      expect(urls.every((url) => url.searchParams.get("end") === new Date(NOW).toISOString())).toBe(
        true,
      );
      expect(urls.every((url) => url.searchParams.get("step") === step)).toBe(true);
    },
  );

  it("defaults resource history to the approved 24-hour window", async () => {
    const fetchApi = vi.fn(async (_url: string, _options: RequestInit) =>
      jsonResponse(fixture.matrix),
    );
    const provider = new PrometheusProvider({
      baseUrl: "http://prometheus.test",
      fetchApi,
      now: () => NOW,
    });

    const history = await provider.getResourceHistory();

    expect(history.window).toBe("24h");
    expect(
      fetchApi.mock.calls.every(([url]) => new URL(url).searchParams.get("step") === "300s"),
    ).toBe(true);
  });

  it("collects current CPU, memory, disk and 24-hour CPU and memory series", async () => {
    const currentValues = new Map([
      [CPU_QUERY, 86],
      [MEMORY_QUERY, 72],
      [DISK_QUERY, 91],
    ]);
    const fetchApi = vi.fn(async (url: string) => {
      const request = new URL(url);
      const query = request.searchParams.get("query")!;
      return jsonResponse(
        request.pathname.endsWith("query_range")
          ? matrix([
              [NOW - 300_000, currentValues.get(query)!],
              [NOW, currentValues.get(query)!],
            ])
          : vector(currentValues.get(query)),
      );
    });
    const provider = new PrometheusProvider({
      baseUrl: "http://prometheus.test",
      fetchApi,
      now: () => NOW,
    });

    await expect(provider.collect(new AbortController().signal)).resolves.toEqual({
      current: [
        { resource: "cpu", usagePercent: 86, observedAt: "2026-08-04T12:00:00.000Z" },
        { resource: "memory", usagePercent: 72, observedAt: "2026-08-04T12:00:00.000Z" },
        { resource: "disk", usagePercent: 91, observedAt: "2026-08-04T12:00:00.000Z" },
      ],
      history: [
        {
          resource: "cpu",
          points: [
            { timestamp: "2026-08-04T11:55:00.000Z", value: 86 },
            { timestamp: "2026-08-04T12:00:00.000Z", value: 86 },
          ],
        },
        {
          resource: "memory",
          points: [
            { timestamp: "2026-08-04T11:55:00.000Z", value: 72 },
            { timestamp: "2026-08-04T12:00:00.000Z", value: 72 },
          ],
        },
      ],
    });
  });
});

describe("Prometheus cluster snapshot integration", () => {
  it("adds resources to ClusterData and evaluates sustained CPU/memory plus disk", async () => {
    const snapshot = await collectClusterSnapshot({
      current: [
        { resource: "cpu", usagePercent: 96, observedAt: "2026-08-04T12:00:00.000Z" },
        { resource: "memory", usagePercent: 86, observedAt: "2026-08-04T12:00:00.000Z" },
        { resource: "disk", usagePercent: 91, observedAt: "2026-08-04T12:00:00.000Z" },
      ],
      history: [
        {
          resource: "cpu",
          points: [
            { timestamp: "2026-08-04T11:55:00.000Z", value: 96 },
            { timestamp: "2026-08-04T12:00:00.000Z", value: 96 },
          ],
        },
        {
          resource: "memory",
          points: [
            { timestamp: "2026-08-04T11:55:00.000Z", value: 86 },
            { timestamp: "2026-08-04T12:00:00.000Z", value: 86 },
          ],
        },
      ],
    });
    const cluster = (snapshot.data as ClusterData[])[0]!;

    expect(cluster.resources.current).toHaveLength(3);
    expect(cluster.resources.history.map(({ resource }) => resource)).toEqual(["cpu", "memory"]);
    expect(snapshot.status).toBe("critical");
    expect(snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "cpu-usage-critical", status: "critical" }),
        expect.objectContaining({ ruleId: "memory-usage-warning", status: "warning" }),
        expect.objectContaining({ ruleId: "disk-usage-warning", status: "warning" }),
      ]),
    );
  });

  it("does not raise CPU or memory health until the threshold is sustained for five minutes", async () => {
    const snapshot = await collectClusterSnapshot({
      current: [
        { resource: "cpu", usagePercent: 96, observedAt: "2026-08-04T12:00:00.000Z" },
        { resource: "memory", usagePercent: 86, observedAt: "2026-08-04T12:00:00.000Z" },
        { resource: "disk", usagePercent: 20, observedAt: "2026-08-04T12:00:00.000Z" },
      ],
      history: [
        {
          resource: "cpu",
          points: [
            { timestamp: "2026-08-04T11:55:00.000Z", value: 80 },
            { timestamp: "2026-08-04T12:00:00.000Z", value: 96 },
          ],
        },
        {
          resource: "memory",
          points: [
            { timestamp: "2026-08-04T11:55:00.000Z", value: 80 },
            { timestamp: "2026-08-04T12:00:00.000Z", value: 86 },
          ],
        },
      ],
    });

    expect(snapshot.status).toBe("healthy");
    expect(snapshot.issues).toEqual([]);
  });

  it("reports Warning when only the lower CPU threshold was sustained", async () => {
    const snapshot = await collectClusterSnapshot({
      current: [
        { resource: "cpu", usagePercent: 96, observedAt: "2026-08-04T12:00:00.000Z" },
        { resource: "memory", usagePercent: 20, observedAt: "2026-08-04T12:00:00.000Z" },
        { resource: "disk", usagePercent: 20, observedAt: "2026-08-04T12:00:00.000Z" },
      ],
      history: [
        {
          resource: "cpu",
          points: [
            { timestamp: "2026-08-04T11:55:00.000Z", value: 90 },
            { timestamp: "2026-08-04T12:00:00.000Z", value: 96 },
          ],
        },
        {
          resource: "memory",
          points: [
            { timestamp: "2026-08-04T11:55:00.000Z", value: 20 },
            { timestamp: "2026-08-04T12:00:00.000Z", value: 20 },
          ],
        },
      ],
    });

    expect(snapshot.status).toBe("warning");
    expect(snapshot.issues).toContainEqual(
      expect.objectContaining({ ruleId: "cpu-usage-warning", status: "warning" }),
    );
  });

  it("keeps a missing metric Unknown instead of substituting zero", async () => {
    const snapshot = await collectClusterSnapshot({
      current: [
        { resource: "cpu", usagePercent: 20, observedAt: "2026-08-04T12:00:00.000Z" },
        { resource: "disk", usagePercent: 20, observedAt: "2026-08-04T12:00:00.000Z" },
      ],
      history: [
        {
          resource: "cpu",
          points: [
            { timestamp: "2026-08-04T11:55:00.000Z", value: 20 },
            { timestamp: "2026-08-04T12:00:00.000Z", value: 20 },
          ],
        },
        { resource: "memory", points: [] },
      ],
    });
    const cluster = (snapshot.data as ClusterData[])[0]!;

    expect(cluster.resources.current.some(({ resource }) => resource === "memory")).toBe(false);
    expect(snapshot.status).toBe("unknown");
    expect(snapshot.issues).toContainEqual(
      expect.objectContaining({
        ruleId: "memory-usage-unknown",
        status: "unknown",
        evidence: expect.objectContaining({ usagePercent: null }),
      }),
    );
  });
});
