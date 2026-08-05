/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ClusterSnapshot, PodDetail, PodSummary } from "@shared/homelab/contracts";
import { ClusterSummary } from "./-ClusterSummary";
import { PodTable } from "./-PodTable";
import { ClusterView, normalizeClusterSearch } from "./cluster";

const OBSERVED_AT = "2026-08-04T12:00:00.000Z";

function pod(overrides: Partial<PodSummary> = {}): PodSummary {
  return {
    name: "yootoob-mp3-api-7c9d8",
    namespace: "yootoob-mp3",
    status: "warning",
    ready: false,
    restartCount: 3,
    node: "dumachine",
    image: "ghcr.io/isolumi/yootoob-mp3-api:development",
    imageTag: "development",
    imageDigest: `sha256:${"a".repeat(64)}`,
    containerImages: [
      {
        name: "api",
        repository: "ghcr.io/isolumi/yootoob-mp3-api",
        reference: "ghcr.io/isolumi/yootoob-mp3-api:development",
        tag: "development",
        digest: `sha256:${"a".repeat(64)}`,
      },
    ],
    createdAt: "2026-08-04T10:30:00.000Z",
    ...overrides,
  };
}

function clusterSnapshot(overrides: Partial<ClusterSnapshot> = {}): ClusterSnapshot {
  return {
    status: "warning",
    observedAt: OBSERVED_AT,
    stale: false,
    issues: [],
    sources: [
      {
        source: "kubernetes",
        status: "healthy",
        observedAt: OBSERVED_AT,
        stale: false,
      },
      {
        source: "prometheus",
        status: "healthy",
        observedAt: OBSERVED_AT,
        stale: false,
      },
    ],
    data: {
      nodes: [
        {
          name: "dumachine",
          ready: true,
          status: "healthy",
          conditions: ["Ready=True", "MemoryPressure=False", "DiskPressure=False"],
        },
      ],
      namespaces: [
        {
          name: "yootoob-mp3",
          status: "warning",
          workloadCount: 2,
          podCount: 2,
        },
        {
          name: "monitoring",
          status: "healthy",
          workloadCount: 1,
          podCount: 1,
        },
      ],
      workloads: [
        {
          kind: "Deployment",
          name: "yootoob-mp3-api",
          namespace: "yootoob-mp3",
          status: "warning",
          desiredReplicas: 2,
          availableReplicas: 1,
          failureReason: "Replica unavailable",
          restartIncrease15m: true,
          createdAt: "2026-08-04T09:00:00.000Z",
          revision: "7",
        },
        {
          kind: "Deployment",
          name: "yootoob-mp3-frontend",
          namespace: "yootoob-mp3",
          status: "healthy",
          desiredReplicas: 1,
          availableReplicas: 1,
          failureReason: null,
          restartIncrease15m: false,
          createdAt: "2026-08-04T09:05:00.000Z",
          revision: "12",
        },
      ],
      pods: [
        pod(),
        pod({
          name: "yootoob-mp3-frontend-584f6",
          status: "healthy",
          ready: true,
          restartCount: 0,
          image: "ghcr.io/isolumi/yootoob-mp3-frontend:development",
          imageTag: "development",
          imageDigest: `sha256:${"b".repeat(64)}`,
          containerImages: [
            {
              name: "frontend",
              repository: "ghcr.io/isolumi/yootoob-mp3-frontend",
              reference: "ghcr.io/isolumi/yootoob-mp3-frontend:development",
              tag: "development",
              digest: `sha256:${"b".repeat(64)}`,
            },
          ],
        }),
        pod({
          name: "prometheus-0",
          namespace: "monitoring",
          status: "healthy",
          ready: true,
          restartCount: 0,
          image: "quay.io/prometheus/prometheus:v3.5.0",
          imageTag: "v3.5.0",
          imageDigest: `sha256:${"c".repeat(64)}`,
          containerImages: [
            {
              name: "prometheus",
              repository: "quay.io/prometheus/prometheus",
              reference: "quay.io/prometheus/prometheus:v3.5.0",
              tag: "v3.5.0",
              digest: `sha256:${"c".repeat(64)}`,
            },
          ],
        }),
      ],
      events: [
        {
          id: "older",
          namespace: "yootoob-mp3",
          resource: "Pod/yootoob-mp3-api-7c9d8",
          status: "warning",
          reason: "BackOff",
          message: "Back-off restarting failed container.",
          observedAt: "2026-08-04T11:55:00.000Z",
        },
        {
          id: "healthy-event",
          namespace: "yootoob-mp3",
          resource: "Deployment/yootoob-mp3-frontend",
          status: "healthy",
          reason: "Available",
          message: "Deployment is available.",
          observedAt: "2026-08-04T11:59:30.000Z",
        },
        {
          id: "newer",
          namespace: "yootoob-mp3",
          resource: "Deployment/yootoob-mp3-api",
          status: "critical",
          reason: "FailedCreate",
          message: "Failed to create a replacement pod.",
          observedAt: "2026-08-04T11:59:00.000Z",
        },
      ],
      resources: {
        current: [
          { resource: "cpu", usagePercent: 33.2, observedAt: OBSERVED_AT },
          { resource: "memory", usagePercent: 64.5, observedAt: OBSERVED_AT },
          { resource: "disk", usagePercent: 52, observedAt: OBSERVED_AT },
        ],
        history: ["cpu", "memory"].map((resource) => ({
          resource: resource as "cpu" | "memory",
          points: [
            { timestamp: "2026-08-04T11:30:00.000Z", value: 31 },
            { timestamp: "2026-08-03T13:00:00.000Z", value: 25 },
            { timestamp: "2026-08-04T07:00:00.000Z", value: 29 },
            { timestamp: "2026-08-03T11:00:00.000Z", value: 23 },
            { timestamp: "2026-07-29T12:00:00.000Z", value: 18 },
            { timestamp: OBSERVED_AT, value: resource === "cpu" ? 33.2 : 64.5 },
          ],
        })),
      },
    },
    ...overrides,
  };
}

function podDetail(): PodDetail {
  return {
    ...pod(),
    containers: [
      {
        name: "api",
        image: "ghcr.io/isolumi/yootoob-mp3-api:development",
        imageId: `docker-pullable://ghcr.io/isolumi/yootoob-mp3-api@sha256:${"a".repeat(64)}`,
        ready: false,
        restartCount: 3,
        state: "waiting",
        reason: "CrashLoopBackOff",
      },
      {
        name: "sidecar",
        image: "docker.io/library/busybox:1.37",
        imageId: `docker-pullable://docker.io/library/busybox@sha256:${"d".repeat(64)}`,
        ready: true,
        restartCount: 0,
        state: "running",
        reason: null,
      },
    ],
    conditions: [
      {
        type: "Ready",
        status: "False",
        reason: "ContainersNotReady",
        message: "containers with unready status: [api]",
        lastTransitionAt: "2026-08-04T11:58:00.000Z",
      },
    ],
    rawStatus: {
      phase: "Running",
      containerStatuses: [{ name: "api", restartCount: 3, reason: "CrashLoopBackOff" }],
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("Cluster summary", () => {
  it("renders node conditions, health summaries, and current CPU, memory, and disk values", () => {
    render(<ClusterSummary data={clusterSnapshot().data!} />);

    expect(screen.getByRole("heading", { name: "dumachine" })).toBeTruthy();
    expect(screen.getByText("Ready=True")).toBeTruthy();
    expect(screen.getByText("MemoryPressure=False")).toBeTruthy();
    expect(screen.getByText("2 namespaces")).toBeTruthy();
    expect(screen.getByText("Healthy namespaces: 1/2 · 3 pods")).toBeTruthy();
    expect(screen.getByText("1 of 2 workloads healthy")).toBeTruthy();
    expect(screen.getAllByText("33.2%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("64.5%").length).toBeGreaterThan(0);
    expect(screen.getByText("52%")).toBeTruthy();
    expect(screen.getByText("Replica unavailable")).toBeTruthy();
  });

  it("filters timestamped history into the selected 1h, 6h, 24h, and 7d windows", () => {
    render(<ClusterSummary data={clusterSnapshot().data!} />);

    expect(screen.getByRole("img", { name: "CPU usage over 24 hours" })).toBeTruthy();
    expect(within(screen.getByTestId("cpu-history")).getByText("4 samples")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show 1 hour" }));
    expect(screen.getByRole("img", { name: "CPU usage over 1 hour" })).toBeTruthy();
    expect(within(screen.getByTestId("cpu-history")).getByText("2 samples")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show 6 hours" }));
    expect(screen.getByRole("img", { name: "CPU usage over 6 hours" })).toBeTruthy();
    expect(within(screen.getByTestId("cpu-history")).getByText("3 samples")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show 7 days" }));
    expect(screen.getByRole("img", { name: "CPU usage over 7 days" })).toBeTruthy();
    expect(within(screen.getByTestId("cpu-history")).getByText("6 samples")).toBeTruthy();
  });

  it("orders warning events newest first and excludes healthy noise", () => {
    render(<ClusterSummary data={clusterSnapshot().data!} />);

    const rows = within(
      screen.getByRole("list", { name: "Recent Kubernetes warnings" }),
    ).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("FailedCreate"),
      expect.stringContaining("BackOff"),
    ]);
    expect(screen.queryByText("Deployment is available.")).toBeNull();
  });
});

describe("Pod inventory and selection", () => {
  it("filters by namespace and search while exposing restart warnings", () => {
    const onSelect = vi.fn();
    render(<PodTable pods={clusterSnapshot().data!.pods} onSelectPod={onSelect} />);

    expect(screen.getByRole("button", { name: /yootoob-mp3-api-7c9d8/ })).toBeTruthy();
    expect(screen.getByLabelText("3 restarts")).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: "Filter pods by namespace" }), {
      target: { value: "monitoring" },
    });
    expect(screen.getByRole("button", { name: /prometheus-0/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /yootoob-mp3-api-7c9d8/ })).toBeNull();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search pods" }), {
      target: { value: "no-match" },
    });
    expect(screen.getByText("No pods match these filters.")).toBeTruthy();
  });

  it("selects a pod with both namespace and pod identity", () => {
    const onSelect = vi.fn();
    render(<PodTable pods={clusterSnapshot().data!.pods} onSelectPod={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /yootoob-mp3-api-7c9d8/ }));

    expect(onSelect).toHaveBeenCalledWith({
      namespace: "yootoob-mp3",
      pod: "yootoob-mp3-api-7c9d8",
    });
  });
});

describe("Cluster route composition", () => {
  it("safely drops malformed or incomplete URL search selections", () => {
    expect(
      normalizeClusterSearch({
        namespace: "../../secrets",
        pod: ["api-0"],
        container: "api/../../token",
        ignored: "value",
      }),
    ).toEqual({});
    expect(normalizeClusterSearch({ pod: "api-0", container: "api" })).toEqual({});
    expect(
      normalizeClusterSearch({
        namespace: "yootoob-mp3",
        pod: "yootoob-mp3-api-7c9d8",
        container: "api",
      }),
    ).toEqual({
      namespace: "yootoob-mp3",
      pod: "yootoob-mp3-api-7c9d8",
      container: "api",
    });
  });

  it("loads selected pod detail, corrects an invalid container, and renders raw evidence", async () => {
    const onSearchChange = vi.fn();
    const detailFetcher = vi.fn().mockResolvedValue(podDetail());
    render(
      <ClusterView
        initialSnapshot={clusterSnapshot()}
        fetcher={vi.fn().mockResolvedValue(clusterSnapshot())}
        detailFetcher={detailFetcher}
        search={{
          namespace: "yootoob-mp3",
          pod: "yootoob-mp3-api-7c9d8",
          container: "removed-container",
        }}
        onSearchChange={onSearchChange}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Pod details" })).toBeTruthy();
    expect(detailFetcher).toHaveBeenCalledWith(
      {
        namespace: "yootoob-mp3",
        pod: "yootoob-mp3-api-7c9d8",
      },
      expect.any(AbortSignal),
    );
    await waitFor(() => {
      expect(onSearchChange).toHaveBeenCalledWith({
        namespace: "yootoob-mp3",
        pod: "yootoob-mp3-api-7c9d8",
        container: "api",
      });
    });
    expect(screen.getByText("CrashLoopBackOff")).toBeTruthy();
    expect(screen.getByText("ContainersNotReady")).toBeTruthy();
    expect(screen.getByText(`sha256:${"a".repeat(64)}`, { exact: false })).toBeTruthy();

    const rawEvidence = screen.getByText("Raw status evidence").closest("details");
    expect(rawEvidence?.hasAttribute("open")).toBe(false);
    fireEvent.click(screen.getByText("Raw status evidence"));
    expect(rawEvidence?.hasAttribute("open")).toBe(true);
    expect(within(rawEvidence!).getByText(/containerStatuses/)).toBeTruthy();
  });

  it("clears a vanished pod selection while preserving a namespace that still exists", async () => {
    vi.useFakeTimers();
    const onSearchChange = vi.fn();
    const withoutSelectedPod = clusterSnapshot();
    withoutSelectedPod.observedAt = "2026-08-04T12:00:10.000Z";
    withoutSelectedPod.data!.pods = withoutSelectedPod.data!.pods.filter(
      (item) => item.name !== "yootoob-mp3-api-7c9d8",
    );
    const fetcher = vi.fn().mockResolvedValue(withoutSelectedPod);

    render(
      <ClusterView
        initialSnapshot={clusterSnapshot()}
        fetcher={fetcher}
        detailFetcher={vi.fn().mockResolvedValue(podDetail())}
        search={{
          namespace: "yootoob-mp3",
          pod: "yootoob-mp3-api-7c9d8",
          container: "api",
        }}
        onSearchChange={onSearchChange}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(onSearchChange).toHaveBeenCalledWith({ namespace: "yootoob-mp3" });
    expect(screen.getByRole("status", { name: "Selection update" }).textContent).toContain(
      "no longer available",
    );
  });

  it("keeps loading, unavailable, stale, and detail-error states explicit", async () => {
    const pending = new Promise<ClusterSnapshot>(() => undefined);
    render(
      <ClusterView
        initialSnapshot={null}
        fetcher={() => pending}
        detailFetcher={vi.fn()}
        search={{}}
        onSearchChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("status", { name: "Loading cluster data" })).toBeTruthy();

    cleanup();
    render(
      <ClusterView
        initialSnapshot={clusterSnapshot({ data: null, status: "unknown", stale: true })}
        fetcher={vi.fn().mockResolvedValue(clusterSnapshot())}
        detailFetcher={vi.fn()}
        search={{}}
        onSearchChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Cluster data is unavailable");
    expect(screen.getByText("Stale")).toBeTruthy();

    cleanup();
    render(
      <ClusterView
        initialSnapshot={clusterSnapshot()}
        fetcher={vi.fn().mockResolvedValue(clusterSnapshot())}
        detailFetcher={vi.fn().mockRejectedValue(new Error("private gateway details"))}
        search={{ namespace: "yootoob-mp3", pod: "yootoob-mp3-api-7c9d8" }}
        onSearchChange={vi.fn()}
      />,
    );
    expect((await screen.findByRole("alert")).textContent).toBe("Pod details unavailable.");
    expect(screen.queryByText("private gateway details")).toBeNull();
  });

  it("shows an unavailable retry state after the initial load fails and recovers automatically", async () => {
    vi.useFakeTimers();
    const recovered = clusterSnapshot({ observedAt: "2026-08-04T12:00:10.000Z" });
    const fetcher = vi
      .fn<() => Promise<ClusterSnapshot>>()
      .mockRejectedValueOnce(new Error("private gateway failure"))
      .mockResolvedValueOnce(recovered);

    render(
      <ClusterView
        initialSnapshot={null}
        fetcher={fetcher}
        detailFetcher={vi.fn()}
        search={{}}
        onSearchChange={vi.fn()}
      />,
    );

    await act(flushPromises);
    expect(screen.getByRole("alert").textContent).toContain("Cluster data is unavailable");
    expect(screen.getByRole("status", { name: "Cluster retry status" }).textContent).toContain(
      "Retrying automatically",
    );

    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { name: "Cluster health" })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Cluster retry status" })).toBeNull();
  });

  it("loads selected history windows server-side, cancels superseded reads, and keeps last-good history", async () => {
    vi.useFakeTimers();
    const sevenDay = deferred<ClusterSnapshot>();
    const oneHour = deferred<ClusterSnapshot>();
    const sixHour = deferred<ClusterSnapshot>();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn((window: string, signal?: AbortSignal) => {
      if (signal) signals.push(signal);
      if (window === "7d") return sevenDay.promise;
      if (window === "1h") return oneHour.promise;
      if (window === "6h") return sixHour.promise;
      return Promise.resolve(clusterSnapshot());
    });

    render(
      <ClusterView
        initialSnapshot={clusterSnapshot()}
        fetcher={fetcher}
        detailFetcher={vi.fn()}
        search={{}}
        onSearchChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show 7 days" }));
    expect(fetcher).toHaveBeenCalledWith("7d", expect.any(AbortSignal));
    expect(screen.getByRole("status", { name: "Resource history request" }).textContent).toContain(
      "Loading 7 days",
    );

    fireEvent.click(screen.getByRole("button", { name: "Show 1 hour" }));
    expect(signals[0]?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledWith("1h", expect.any(AbortSignal));

    await act(async () =>
      sevenDay.resolve(clusterSnapshot({ observedAt: "2026-08-04T12:00:07.000Z" })),
    );
    await act(async () => oneHour.reject(new Error("private Prometheus URL")));

    expect(screen.getByRole("img", { name: "CPU usage over 24 hours" })).toBeTruthy();
    expect(screen.getByRole("alert", { name: "Resource history error" }).textContent).toContain(
      "1 hour history unavailable. Showing the last successful 24 hour history.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Show 6 hours" }));
    const recovered = clusterSnapshot({ observedAt: "2026-08-04T12:00:20.000Z" });
    await act(async () => sixHour.resolve(recovered));

    expect(fetcher).toHaveBeenCalledWith("6h", expect.any(AbortSignal));
    expect(screen.getByRole("img", { name: "CPU usage over 6 hours" })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Resource history request" })).toBeNull();
  });

  it("refreshes selected pod details with cluster snapshots, preserves last-good data, and recovers", async () => {
    vi.useFakeTimers();
    const initialDetail = podDetail();
    const recoveredDetail = podDetail();
    recoveredDetail.containers[0] = {
      ...recoveredDetail.containers[0]!,
      state: "running",
      reason: null,
      ready: true,
      restartCount: 4,
    };
    const detailFetcher = vi
      .fn()
      .mockResolvedValueOnce(initialDetail)
      .mockRejectedValueOnce(new Error("private pod detail failure"))
      .mockResolvedValueOnce(recoveredDetail);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(clusterSnapshot({ observedAt: "2026-08-04T12:00:10.000Z" }))
      .mockResolvedValueOnce(clusterSnapshot({ observedAt: "2026-08-04T12:00:20.000Z" }));

    render(
      <ClusterView
        initialSnapshot={clusterSnapshot()}
        fetcher={fetcher}
        detailFetcher={detailFetcher}
        search={{ namespace: "yootoob-mp3", pod: "yootoob-mp3-api-7c9d8", container: "api" }}
        onSearchChange={vi.fn()}
      />,
    );

    await act(flushPromises);
    expect(screen.getByText("CrashLoopBackOff")).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    expect(detailFetcher).toHaveBeenCalledTimes(2);
    expect(screen.getByText("CrashLoopBackOff")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Could not refresh pod details. Showing the last successful details.",
    );
    expect(screen.getByText("Stale pod details")).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    expect(detailFetcher).toHaveBeenCalledTimes(3);
    expect(screen.queryByText("CrashLoopBackOff")).toBeNull();
    expect(screen.getByText(/4 restarts/)).toBeTruthy();
    expect(screen.queryByText("Stale pod details")).toBeNull();
  });

  it("aborts superseded pod-detail reads and ignores a late result after the pod disappears", async () => {
    vi.useFakeTimers();
    const pendingRefresh = deferred<PodDetail>();
    const signals: AbortSignal[] = [];
    let detailCalls = 0;
    const detailFetcher = vi.fn((_: unknown, signal?: AbortSignal) => {
      detailCalls += 1;
      if (signal) signals.push(signal);
      return detailCalls === 1 ? Promise.resolve(podDetail()) : pendingRefresh.promise;
    });
    const refreshed = clusterSnapshot({ observedAt: "2026-08-04T12:00:10.000Z" });
    const disappeared = clusterSnapshot({ observedAt: "2026-08-04T12:00:20.000Z" });
    disappeared.data!.pods = disappeared.data!.pods.filter(
      ({ name }) => name !== "yootoob-mp3-api-7c9d8",
    );
    const fetcher = vi.fn().mockResolvedValueOnce(refreshed).mockResolvedValueOnce(disappeared);
    const onSearchChange = vi.fn();

    render(
      <ClusterView
        initialSnapshot={clusterSnapshot()}
        fetcher={fetcher}
        detailFetcher={detailFetcher}
        search={{ namespace: "yootoob-mp3", pod: "yootoob-mp3-api-7c9d8", container: "api" }}
        onSearchChange={onSearchChange}
      />,
    );
    await act(flushPromises);
    expect(screen.getByText("CrashLoopBackOff")).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(detailFetcher).toHaveBeenCalledTimes(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(signals[1]?.aborted).toBe(true);
    expect(onSearchChange).toHaveBeenCalledWith({ namespace: "yootoob-mp3" });

    const lateDetail = podDetail();
    lateDetail.containers[0] = { ...lateDetail.containers[0]!, reason: "LATE_RESULT" };
    await act(async () => pendingRefresh.resolve(lateDetail));

    expect(screen.queryByText("LATE_RESULT")).toBeNull();
    expect(screen.getByRole("heading", { name: "Pod details" })).toBeTruthy();
    expect(screen.getByText(/Select a pod to inspect/)).toBeTruthy();
  });
});
