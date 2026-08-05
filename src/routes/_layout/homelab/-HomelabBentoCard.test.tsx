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
import { cleanup, render, screen } from "@testing-library/react";
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

  it("shows an explicit unavailable state when the dashboard loader has no snapshot", async () => {
    await renderCard(null);

    expect(screen.getByRole("status", { name: "Status: Unknown" })).toBeTruthy();
    expect(screen.getByText("Homelab snapshot unavailable")).toBeTruthy();
    expect(screen.queryByText("0 / 0")).toBeNull();
  });
});
