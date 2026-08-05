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
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HealthIssue, OverviewSnapshot } from "@shared/homelab/contracts";
import { AppSidebar } from "#/components/AppSidebar";
import { SidebarProvider } from "#/components/ui/sidebar";
import { TooltipProvider } from "#/components/ui/tooltip";
import { tools } from "#/tools/registry";
import { HomelabTabs } from "./-HomelabTabs";
import { IssueList } from "./-IssueList";
import { StatusBadge } from "./-StatusBadge";
import { HomelabOverview, HomelabOverviewLoading } from "./index";

const { getHomelabOverviewMock } = vi.hoisted(() => ({
  getHomelabOverviewMock: vi.fn(),
}));

vi.mock("#/homelab/homelab.functions", () => ({
  getHomelabOverview: getHomelabOverviewMock,
}));

const NOW = "2026-08-04T12:00:12.000Z";
const OBSERVED_AT = "2026-08-04T12:00:00.000Z";

function issue(status: HealthIssue["status"], reason: string, resource: string): HealthIssue {
  return {
    ruleId: `${status}-${resource}`,
    status,
    reason,
    source: status === "unknown" ? "prometheus" : "kubernetes",
    resource,
    observedAt: OBSERVED_AT,
    evidence: {
      resource,
      observedValue: status === "unknown" ? null : 87,
      confirmed: status !== "unknown",
    },
  };
}

const warningIssue = issue("warning", "Certificate expires within 14 days.", "grafana");

function overviewSnapshot(overrides: Partial<OverviewSnapshot> = {}): OverviewSnapshot {
  return {
    status: "warning",
    observedAt: OBSERVED_AT,
    stale: false,
    issues: [warningIssue],
    sources: [
      {
        source: "prometheus",
        status: "unknown",
        observedAt: OBSERVED_AT,
        stale: true,
        error: "Metrics source did not respond.",
      },
    ],
    data: {
      cluster: { status: "warning", readyNodes: 1, totalNodes: 2 },
      workloads: { healthy: 4, warning: 1, critical: 0, unknown: 1, total: 6 },
      argo: { status: "healthy", syncedApplications: 3, totalApplications: 3 },
      resources: {
        current: [
          { resource: "cpu", usagePercent: 42.5, observedAt: OBSERVED_AT },
          { resource: "memory", usagePercent: 68.1, observedAt: OBSERVED_AT },
        ],
        history: [
          {
            resource: "cpu",
            points: [
              { timestamp: "2026-08-03T12:00:00.000Z", value: 35 },
              { timestamp: OBSERVED_AT, value: 42.5 },
            ],
          },
          {
            resource: "memory",
            points: [
              { timestamp: "2026-08-03T12:00:00.000Z", value: 61 },
              { timestamp: OBSERVED_AT, value: 68.1 },
            ],
          },
        ],
      },
      activeIssues: [warningIssue],
      recentActivity: [
        {
          id: "activity-1",
          resource: "dum-dashboard",
          message: "Rollout is waiting for one replica.",
          status: "warning",
          occurredAt: OBSERVED_AT,
          source: "argocd",
          url: "https://argocd.doh.lumilumi.xyz/applications/dum-dashboard",
        },
      ],
      services: [
        {
          name: "Grafana",
          description: "Metrics and dashboards",
          status: "healthy",
          url: "https://grafana.doh.lumilumi.xyz",
          reachable: true,
          reason: "Service probe, Argo CD, and workloads are healthy.",
          certificateExpiresAt: "2026-10-01T00:00:00.000Z",
          probeLatencyMs: 24,
          namespace: "monitoring",
          workload: "grafana",
          image: "grafana/grafana:12",
          argoApplication: "grafana-dumachine",
          argoStatus: "healthy",
          relatedPodCount: 1,
          workloads: [],
          observedAt: OBSERVED_AT,
        },
      ],
    },
    ...overrides,
  };
}

async function renderAtPath(ui: ReactNode, initialPath: string) {
  const rootRoute = createRootRoute({ component: () => ui });
  const homelabRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "homelab",
  });
  const homelabIndexRoute = createRoute({
    getParentRoute: () => homelabRoute,
    path: "/",
  });
  const clusterRoute = createRoute({
    getParentRoute: () => homelabRoute,
    path: "cluster",
  });
  const deploymentsRoute = createRoute({
    getParentRoute: () => homelabRoute,
    path: "deployments",
  });
  const servicesRoute = createRoute({
    getParentRoute: () => homelabRoute,
    path: "services",
  });
  const routeTree = rootRoute.addChildren([
    homelabRoute.addChildren([homelabIndexRoute, clusterRoute, deploymentsRoute, servicesRoute]),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  await router.load();
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(NOW) });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  getHomelabOverviewMock.mockResolvedValue(overviewSnapshot());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("grouped Homelab navigation", () => {
  it("keeps one registry entry with the four approved internal routes", () => {
    const homelabEntries = tools.filter((tool) => tool.id === "homelab");

    expect(homelabEntries).toHaveLength(1);
    expect(homelabEntries[0]?.children).toEqual([
      { id: "overview", label: "Overview", route: "/homelab" },
      { id: "cluster", label: "Cluster", route: "/homelab/cluster" },
      { id: "deployments", label: "Deployments", route: "/homelab/deployments" },
      { id: "services", label: "Services", route: "/homelab/services" },
    ]);
  });

  it("keeps Homelab active on a child route without leaking child links into the sidebar", async () => {
    await renderAtPath(
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </TooltipProvider>,
      "/homelab/cluster",
    );

    const primaryNavigation = screen.getByRole("navigation", { name: "Primary" });
    const homelabLinks = within(primaryNavigation).getAllByRole("link", { name: "Homelab" });

    expect(homelabLinks).toHaveLength(1);
    expect(homelabLinks[0]?.getAttribute("aria-current")).toBe("page");
    expect(within(primaryNavigation).queryByRole("link", { name: "Cluster" })).toBeNull();
    expect(within(primaryNavigation).queryByRole("link", { name: "Deployments" })).toBeNull();
    expect(within(primaryNavigation).queryByRole("link", { name: "Services" })).toBeNull();
  });

  it("makes /homelab the active Overview tab and exposes all children in one internal tab list", async () => {
    await renderAtPath(<HomelabTabs />, "/homelab");

    const tabs = screen.getByRole("navigation", { name: "Homelab sections" });
    const expectedLinks = [
      ["Overview", "/homelab"],
      ["Cluster", "/homelab/cluster"],
      ["Deployments", "/homelab/deployments"],
      ["Services", "/homelab/services"],
    ] as const;

    for (const [label, href] of expectedLinks) {
      expect(within(tabs).getByRole("link", { name: label }).getAttribute("href")).toBe(href);
    }
    expect(within(tabs).getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });
});

describe("Homelab status and issue semantics", () => {
  it("keeps every health state explicit with both an icon and visible text", () => {
    render(
      <div>
        <StatusBadge status="healthy" />
        <StatusBadge status="warning" />
        <StatusBadge status="critical" />
        <StatusBadge status="unknown" />
      </div>,
    );

    for (const label of ["Healthy", "Warning", "Critical", "Unknown"]) {
      const badge = screen.getByRole("status", { name: `Status: ${label}` });
      expect(badge.textContent).toContain(label);
      expect(badge.querySelector("svg")).not.toBeNull();
    }
  });

  it("keeps proven Critical first, then Warning before Unknown, without mutating input", () => {
    const issues = [
      issue("unknown", "Metrics status cannot be confirmed.", "prometheus"),
      issue("warning", "Memory usage is above the warning threshold.", "memory"),
      issue("critical", "Node dumachine is not ready.", "dumachine"),
    ];

    render(<IssueList issues={issues} />);

    const rows = within(screen.getByRole("list", { name: "Active issues" })).getAllByRole(
      "listitem",
    );
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Node dumachine is not ready."),
      expect.stringContaining("Memory usage is above the warning threshold."),
      expect.stringContaining("Metrics status cannot be confirmed."),
    ]);
    expect(issues.map((item) => item.status)).toEqual(["unknown", "warning", "critical"]);
  });

  it("keeps issue evidence keyboard-native and expandable", () => {
    render(<IssueList issues={[warningIssue]} />);

    const toggle = screen.getByText("Evidence");
    const disclosure = toggle.closest("details");
    expect(disclosure?.hasAttribute("open")).toBe(false);

    fireEvent.click(toggle);

    expect(disclosure?.hasAttribute("open")).toBe(true);
    expect(screen.getByText("observed value")).toBeTruthy();
    expect(screen.getByText("87")).toBeTruthy();
  });

  it("keeps expanded evidence open when polling updates the same issue observation", () => {
    const { rerender } = render(<IssueList issues={[warningIssue]} />);
    const toggle = screen.getByText("Evidence");
    fireEvent.click(toggle);
    expect(toggle.closest("details")?.hasAttribute("open")).toBe(true);

    rerender(
      <IssueList
        issues={[
          {
            ...warningIssue,
            observedAt: "2026-08-04T12:00:10.000Z",
            evidence: { ...warningIssue.evidence, observedValue: 88 },
          },
        ]}
      />,
    );

    expect(screen.getByText("Evidence").closest("details")?.hasAttribute("open")).toBe(true);
    expect(screen.getByText("88")).toBeTruthy();
  });

  it('keeps the empty triage area visible with exactly "Nothing needs attention"', () => {
    render(<IssueList issues={[]} />);

    expect(screen.getByText("Nothing needs attention").textContent).toBe("Nothing needs attention");
  });
});

describe("Homelab Overview", () => {
  it("keeps the application layout as the only main landmark", () => {
    render(
      <main>
        <HomelabOverview initialSnapshot={overviewSnapshot()} fetcher={getHomelabOverviewMock} />
      </main>,
    );

    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("renders the real triage snapshot instead of generic dashboard placeholders", () => {
    render(
      <HomelabOverview initialSnapshot={overviewSnapshot()} fetcher={getHomelabOverviewMock} />,
    );

    expect(screen.getByRole("heading", { name: "Some systems need attention." })).toBeTruthy();
    expect(screen.getByText("Updated 12s ago")).toBeTruthy();
    expect(screen.getByText("1 of 2 nodes ready")).toBeTruthy();
    expect(screen.getByText("4 of 6 healthy")).toBeTruthy();
    expect(screen.getByText("3 of 3 synced")).toBeTruthy();
    expect(screen.getByText("Certificate expires within 14 days.")).toBeTruthy();
    expect(screen.getByRole("img", { name: "CPU usage over 24 hours" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Memory usage over 24 hours" })).toBeTruthy();
    expect(screen.getByText("42.5%")).toBeTruthy();
    expect(screen.getByText("68.1%")).toBeTruthy();
    expect(screen.getByText("Rollout is waiting for one replica.")).toBeTruthy();
    expect(screen.getByText("Metrics source did not respond.")).toBeTruthy();
    const activityLink = screen.getByRole("link", { name: /Open activity for dum-dashboard/ });
    expect(activityLink.getAttribute("href")).toBe(
      "https://argocd.doh.lumilumi.xyz/applications/dum-dashboard",
    );
    const grafanaLink = screen.getByRole("link", { name: /Open Grafana/ });
    expect(grafanaLink.getAttribute("href")).toBe("https://grafana.doh.lumilumi.xyz");
  });

  it("catches the production break where defensive activity and service rows link unsafe schemes", () => {
    const unsafeUrls = [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "ftp://private-host/file",
    ];
    const snapshot = overviewSnapshot();
    snapshot.data!.recentActivity = unsafeUrls.map((url, index) => ({
      id: `unsafe-activity-${index}`,
      resource: `unsafe-activity-${index}`,
      message: "Unsafe activity URL",
      status: "unknown",
      occurredAt: OBSERVED_AT,
      source: "argocd",
      url,
    }));
    snapshot.data!.services = unsafeUrls.map((url, index) => ({
      name: `unsafe-service-${index}`,
      description: "Unsafe service URL",
      status: "unknown",
      url,
      reachable: false,
      reason: "Service evidence is unavailable.",
      certificateExpiresAt: null,
      probeLatencyMs: null,
      namespace: null,
      workload: null,
      image: null,
      argoApplication: null,
      argoStatus: "unknown",
      relatedPodCount: null,
      workloads: [],
      observedAt: OBSERVED_AT,
    }));

    render(<HomelabOverview initialSnapshot={snapshot} fetcher={getHomelabOverviewMock} />);

    for (const [index] of unsafeUrls.entries()) {
      expect(screen.getByText(`unsafe-activity-${index}`)).toBeTruthy();
      expect(screen.getByText(`unsafe-service-${index}`)).toBeTruthy();
      expect(
        screen.queryByRole("link", {
          name: `Open activity for unsafe-activity-${index} in a new tab`,
        }),
      ).toBeNull();
      expect(
        screen.queryByRole("link", { name: `Open unsafe-service-${index} in a new tab` }),
      ).toBeNull();
    }
  });

  it("shows an explicit stale Unknown state while preserving the last good values", () => {
    render(
      <HomelabOverview
        initialSnapshot={overviewSnapshot({ status: "unknown", stale: true })}
        fetcher={getHomelabOverviewMock}
      />,
    );

    const systemStatus = screen
      .getByRole("heading", { name: "Current health cannot be confirmed." })
      .closest("section");
    expect(systemStatus).not.toBeNull();
    expect(within(systemStatus!).getByText("Stale")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Status: Unknown" })).toBeTruthy();
    expect(screen.getByText("1 of 2 nodes ready")).toBeTruthy();
  });

  it("catches the production break where stale freshness overwrites proven Warning health", () => {
    render(
      <HomelabOverview
        initialSnapshot={overviewSnapshot({ status: "warning", stale: true })}
        fetcher={getHomelabOverviewMock}
      />,
    );

    const systemStatus = screen
      .getByRole("heading", { name: "Some systems need attention." })
      .closest("section");
    expect(systemStatus).not.toBeNull();
    expect(within(systemStatus!).getByRole("status", { name: "Status: Warning" })).toBeTruthy();
    expect(within(systemStatus!).getByText("Stale")).toBeTruthy();
  });

  it("catches the production break where stale source freshness replaces Unknown health", () => {
    render(
      <HomelabOverview initialSnapshot={overviewSnapshot()} fetcher={getHomelabOverviewMock} />,
    );

    const sourceNotice = screen.getByText("prometheus").closest("li");
    expect(sourceNotice).not.toBeNull();
    expect(within(sourceNotice!).getByText("Unknown")).toBeTruthy();
    expect(within(sourceNotice!).getByText("Stale")).toBeTruthy();
  });

  it("explains an unavailable snapshot instead of rendering zeroes as healthy", () => {
    render(
      <HomelabOverview
        initialSnapshot={overviewSnapshot({
          status: "unknown",
          stale: true,
          data: null,
        })}
        fetcher={getHomelabOverviewMock}
      />,
    );

    expect(screen.getByText("Overview data is unavailable.")).toBeTruthy();
    expect(screen.queryByText("0 of 0 nodes ready")).toBeNull();
    expect(screen.getByRole("status", { name: "Status: Unknown" })).toBeTruthy();
  });

  it("catches the production break where pending skeletons are not announced or reduced-motion safe", () => {
    const view = render(<HomelabOverviewLoading />);

    const loading = screen.getByRole("status", { name: "Loading Homelab overview" });
    expect(loading.textContent).toContain("Loading Homelab overview");
    for (const skeleton of view.container.querySelectorAll('[data-slot="skeleton"]')) {
      expect(skeleton.className).toContain("motion-reduce:animate-none");
    }
  });
});
