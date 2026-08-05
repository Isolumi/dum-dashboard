/**
 * @vitest-environment jsdom
 */
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OverviewSnapshot } from "@shared/homelab/contracts";
import { tools } from "#/tools/registry";
import { HomelabBentoCard } from "./-HomelabBentoCard";

const { getHomelabOverviewMock } = vi.hoisted(() => ({
  getHomelabOverviewMock: vi.fn(),
}));

vi.mock("#/homelab/homelab.functions", () => ({
  getHomelabOverview: getHomelabOverviewMock,
}));

const NOW = "2026-08-04T12:00:12.000Z";
const OBSERVED_AT = "2026-08-04T12:00:00.000Z";

function overviewSnapshot(overrides: Partial<OverviewSnapshot> = {}): OverviewSnapshot {
  return {
    status: "warning",
    observedAt: OBSERVED_AT,
    stale: false,
    issues: [],
    sources: [],
    data: {
      cluster: { status: "warning", readyNodes: 1, totalNodes: 2 },
      workloads: { healthy: 4, warning: 1, critical: 0, unknown: 1, total: 6 },
      argo: { status: "healthy", syncedApplications: 3, totalApplications: 3 },
      resources: { current: [], history: [] },
      activeIssues: [
        {
          ruleId: "certificate-expiring",
          status: "warning",
          reason: "Certificate expires within 14 days.",
          source: "service-probe",
          resource: "grafana",
          observedAt: OBSERVED_AT,
          evidence: { daysRemaining: 10 },
        },
      ],
      recentActivity: [],
      services: [],
    },
    ...overrides,
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

async function renderCard(data: unknown) {
  const homelabTool = tools.find((tool) => tool.id === "homelab");
  if (!homelabTool) throw new Error("Homelab tool is not registered");

  const rootRoute = createRootRoute({
    component: () => <HomelabBentoCard tool={homelabTool} data={data} />,
  });
  const homelabRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "homelab",
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([homelabRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await router.load();
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(NOW) });
  getHomelabOverviewMock.mockResolvedValue(overviewSnapshot());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("HomelabBentoCard", () => {
  it("catches the production break where a missing initial snapshot never retries and recovers", async () => {
    const firstRequest = deferred<OverviewSnapshot>();
    const secondRequest = deferred<OverviewSnapshot>();
    getHomelabOverviewMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const view = await renderCard(null);

    const loading = screen.getByRole("status", { name: "Loading Homelab overview" });
    expect(loading.textContent).toContain("Loading Homelab overview");
    for (const skeleton of view.container.querySelectorAll('[data-slot="skeleton"]')) {
      expect(skeleton.className).toContain("motion-reduce:animate-none");
    }
    expect(getHomelabOverviewMock).toHaveBeenCalledTimes(1);

    await act(async () => firstRequest.reject(new Error("temporary gateway failure")));
    expect(screen.getByText("Homelab snapshot unavailable")).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    await act(async () => secondRequest.resolve(overviewSnapshot()));

    expect(getHomelabOverviewMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("4 / 6")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Status: Warning" })).toBeTruthy();
  });

  it("summarizes the validated snapshot and links the whole card to /homelab", async () => {
    await renderCard(overviewSnapshot());

    const card = screen.getByRole("link", { name: "Open Homelab overview" });
    expect(card.getAttribute("href")).toBe("/homelab");
    expect(screen.getByRole("status", { name: "Status: Warning" })).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(screen.getByText("nodes ready")).toBeTruthy();
    expect(screen.getByText("4 / 6")).toBeTruthy();
    expect(screen.getByText("healthy workloads")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("active issue")).toBeTruthy();
    expect(screen.getByText("Updated 12s ago")).toBeTruthy();
  });

  it("marks retained stale data Unknown without dropping its useful counts", async () => {
    await renderCard(overviewSnapshot({ status: "unknown", stale: true }));

    expect(screen.getByRole("status", { name: "Status: Unknown" })).toBeTruthy();
    expect(screen.getByText("Stale snapshot")).toBeTruthy();
    expect(screen.getByText("4 / 6")).toBeTruthy();
  });

  it("catches the production break where stale freshness overwrites proven Warning health", async () => {
    await renderCard(overviewSnapshot({ status: "warning", stale: true }));

    expect(screen.getByRole("status", { name: "Status: Warning" })).toBeTruthy();
    expect(screen.getByText("Stale snapshot")).toBeTruthy();
  });

  it("shows an explicit unavailable state after the initial dashboard request fails", async () => {
    const request = deferred<OverviewSnapshot>();
    getHomelabOverviewMock.mockReturnValueOnce(request.promise);
    await renderCard(null);
    await act(async () => request.reject(new Error("gateway unavailable")));

    expect(screen.getByRole("status", { name: "Status: Unknown" })).toBeTruthy();
    expect(screen.getByText("Homelab snapshot unavailable")).toBeTruthy();
    expect(screen.queryByText("0 / 0")).toBeNull();
  });
});
