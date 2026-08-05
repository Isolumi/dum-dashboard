import fetch, { type RequestInit, type Response } from "node-fetch";
import type {
  MetricPoint,
  ResourceHistory as ResourceSeries,
  ResourceMetrics,
  ResourceWindow,
} from "../../../shared/homelab/contracts";
import { getGatewayConfig } from "../config";
import type { WindowedProvider } from "./provider";

const PROMETHEUS_TIMEOUT_MS = 5_000;
const RANGE_CACHE_TTL_MS = 10_000;

const CPU_QUERY = '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))';
const MEMORY_QUERY = "100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))";
const DISK_QUERY =
  '100 * (1 - (node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"}))';

export interface PrometheusSample {
  metric: Record<string, string>;
  timestamp: string;
  value: number;
}

export type PrometheusVector = PrometheusSample[];

export interface MetricSeries {
  metric: Record<string, string>;
  points: MetricPoint[];
}

export interface ResourceHistory {
  window: ResourceWindow;
  series: ResourceSeries[];
}

type FetchApi = (url: string, options: RequestInit) => Promise<Response>;

export interface PrometheusProviderOptions {
  baseUrl?: string;
  environment?: NodeJS.ProcessEnv;
  fetchApi?: FetchApi;
  now?: () => number;
}

interface CacheEntry {
  expiresAt: number;
  value: MetricSeries[];
}

const WINDOWS: Record<ResourceWindow, { durationMs: number; step: string }> = {
  "1h": { durationMs: 60 * 60 * 1_000, step: "60s" },
  "6h": { durationMs: 6 * 60 * 60 * 1_000, step: "120s" },
  "24h": { durationMs: 24 * 60 * 60 * 1_000, step: "300s" },
  "7d": { durationMs: 7 * 24 * 60 * 60 * 1_000, step: "1800s" },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function metricLabels(value: unknown): Record<string, string> {
  if (!isRecord(value) || Object.values(value).some((label) => typeof label !== "string")) {
    throw new Error("invalid metric labels");
  }
  return value as Record<string, string>;
}

function metricPoint(value: unknown): MetricPoint {
  if (!Array.isArray(value) || value.length !== 2) throw new Error("invalid metric point");
  const timestamp = Number(value[0]);
  const metricValue = Number(value[1]);
  if (!Number.isFinite(timestamp) || !Number.isFinite(metricValue)) {
    throw new Error("invalid metric point");
  }
  return { timestamp: new Date(timestamp * 1_000).toISOString(), value: metricValue };
}

function resultData(payload: unknown, resultType: "vector" | "matrix"): unknown[] {
  if (!isRecord(payload) || payload.status !== "success" || !isRecord(payload.data)) {
    throw new Error("invalid Prometheus response");
  }
  if (payload.data.resultType !== resultType || !Array.isArray(payload.data.result)) {
    throw new Error("invalid Prometheus response");
  }
  return payload.data.result;
}

function parseVector(payload: unknown): PrometheusVector {
  return resultData(payload, "vector").map((result) => {
    if (!isRecord(result)) throw new Error("invalid Prometheus vector");
    const point = metricPoint(result.value);
    return { metric: metricLabels(result.metric), ...point };
  });
}

function parseMatrix(payload: unknown): MetricSeries[] {
  return resultData(payload, "matrix").map((result) => {
    if (!isRecord(result) || !Array.isArray(result.values)) {
      throw new Error("invalid Prometheus matrix");
    }
    return {
      metric: metricLabels(result.metric),
      points: result.values.map(metricPoint),
    };
  });
}

function parameter(value: string | number | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function cloneMetricSeries(series: readonly MetricSeries[]): MetricSeries[] {
  return series.map(({ metric, points }) => ({
    metric: { ...metric },
    points: points.map((point) => ({ ...point })),
  }));
}

function waitForCaller<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) return Promise.reject(new Error("Prometheus request aborted"));

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (complete: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      complete();
    };
    const abort = () => finish(() => reject(new Error("Prometheus request aborted")));

    signal.addEventListener("abort", abort, { once: true });
    operation.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

export class PrometheusProvider implements WindowedProvider<ResourceMetrics> {
  readonly source = "prometheus" as const;

  private readonly baseUrl: URL;
  private readonly fetchApi: FetchApi;
  private readonly now: () => number;
  private readonly rangeCache = new Map<string, CacheEntry>();
  private readonly rangeInFlight = new Map<string, Promise<MetricSeries[]>>();

  constructor(options: PrometheusProviderOptions = {}) {
    const baseUrl =
      options.baseUrl ?? getGatewayConfig(options.environment ?? process.env).prometheusUrl;
    if (!baseUrl) throw new Error("Prometheus is not configured");

    this.baseUrl = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    this.fetchApi = options.fetchApi ?? fetch;
    this.now = options.now ?? Date.now;
  }

  private async request(
    endpoint: "query" | "query_range",
    parameters: Record<string, string>,
    parentSignal?: AbortSignal,
  ): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromParent = () => controller.abort(parentSignal?.reason);
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
    if (parentSignal?.aborted) abortFromParent();

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, PROMETHEUS_TIMEOUT_MS);
    const url = new URL(`api/v1/${endpoint}`, this.baseUrl);
    for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value);

    try {
      const response = await this.fetchApi(url.toString(), {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("non-2xx response");
      return await response.json();
    } catch {
      throw new Error(timedOut ? "Prometheus request timed out" : "Prometheus request failed");
    } finally {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener("abort", abortFromParent);
    }
  }

  private async queryInstantWithSignal(
    query: string,
    signal?: AbortSignal,
  ): Promise<PrometheusVector> {
    const payload = await this.request("query", { query }, signal);
    try {
      return parseVector(payload);
    } catch {
      throw new Error("Prometheus response invalid");
    }
  }

  queryInstant(query: string): Promise<PrometheusVector> {
    return this.queryInstantWithSignal(query);
  }

  private async queryRangeWithSignal(
    query: string,
    start: string | number | Date,
    end: string | number | Date,
    step: string | number,
    signal?: AbortSignal,
  ): Promise<MetricSeries[]> {
    if (signal?.aborted) throw new Error("Prometheus request aborted");

    const parameters = {
      query,
      start: parameter(start),
      end: parameter(end),
      step: String(step),
    };
    const cacheKey = JSON.stringify(parameters);
    const now = this.now();
    for (const [key, entry] of this.rangeCache) {
      if (entry.expiresAt <= now) this.rangeCache.delete(key);
    }
    const cached = this.rangeCache.get(cacheKey);
    if (cached) {
      const value = await waitForCaller(Promise.resolve(cached.value), signal);
      return cloneMetricSeries(value);
    }

    const existingRequest = this.rangeInFlight.get(cacheKey);
    if (existingRequest) return cloneMetricSeries(await waitForCaller(existingRequest, signal));

    const sharedRequest = (async () => {
      const payload = await this.request("query_range", parameters);
      let value: MetricSeries[];
      try {
        value = parseMatrix(payload);
      } catch {
        throw new Error("Prometheus response invalid");
      }
      const cachedValue = cloneMetricSeries(value);
      this.rangeCache.set(cacheKey, {
        expiresAt: this.now() + RANGE_CACHE_TTL_MS,
        value: cachedValue,
      });
      return cachedValue;
    })();
    this.rangeInFlight.set(cacheKey, sharedRequest);
    const clearInFlight = () => {
      if (this.rangeInFlight.get(cacheKey) === sharedRequest) {
        this.rangeInFlight.delete(cacheKey);
      }
    };
    void sharedRequest.then(clearInFlight, clearInFlight);

    return cloneMetricSeries(await waitForCaller(sharedRequest, signal));
  }

  queryRange(
    query: string,
    start: string | number | Date,
    end: string | number | Date,
    step: string | number,
    signal?: AbortSignal,
  ): Promise<MetricSeries[]> {
    return this.queryRangeWithSignal(query, start, end, step, signal);
  }

  private async resourceHistory(
    window: ResourceWindow,
    signal?: AbortSignal,
  ): Promise<ResourceHistory> {
    const { durationMs, step } = WINDOWS[window];
    const bucketEnd = Math.floor(this.now() / RANGE_CACHE_TTL_MS) * RANGE_CACHE_TTL_MS;
    const end = new Date(bucketEnd).toISOString();
    const start = new Date(bucketEnd - durationMs).toISOString();
    const [cpu, memory] = await Promise.all([
      this.queryRangeWithSignal(CPU_QUERY, start, end, step, signal),
      this.queryRangeWithSignal(MEMORY_QUERY, start, end, step, signal),
    ]);

    return {
      window,
      series: [
        { resource: "cpu", points: cpu[0]?.points ?? [] },
        { resource: "memory", points: memory[0]?.points ?? [] },
      ],
    };
  }

  getResourceHistory(
    window: ResourceWindow = "24h",
    signal?: AbortSignal,
  ): Promise<ResourceHistory> {
    return this.resourceHistory(window, signal);
  }

  async collectForWindow(window: ResourceWindow, signal: AbortSignal): Promise<ResourceMetrics> {
    const [cpu, memory, disk, history] = await Promise.all([
      this.queryInstantWithSignal(CPU_QUERY, signal),
      this.queryInstantWithSignal(MEMORY_QUERY, signal),
      this.queryInstantWithSignal(DISK_QUERY, signal),
      this.resourceHistory(window, signal),
    ]);
    const current = [
      ["cpu", cpu[0]],
      ["memory", memory[0]],
      ["disk", disk[0]],
    ] as const;

    return {
      current: current.flatMap(([resource, sample]) =>
        sample ? [{ resource, usagePercent: sample.value, observedAt: sample.timestamp }] : [],
      ),
      history: history.series,
    };
  }

  collect(signal: AbortSignal): Promise<ResourceMetrics> {
    return this.collectForWindow("24h", signal);
  }
}
