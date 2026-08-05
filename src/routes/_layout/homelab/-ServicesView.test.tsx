import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServiceSnapshot, ServiceSummary } from "@shared/homelab/contracts";
import { ServicesView } from "./services";

const NOW = "2026-08-05T00:00:00.000Z";

function service(overrides: Partial<ServiceSummary> = {}): ServiceSummary {
  return {
    name: "yootoob-mp3",
    description: "Private YouTube MP3 downloader",
    status: "healthy",
    url: "https://yootoob.doh.lumilumi.xyz",
    certificateExpiresAt: "2026-09-01T00:00:00.000Z",
    probeLatencyMs: 42,
    namespace: "yootoob-mp3",
    workload: "Deployment/yootoob-mp3-api, Deployment/yootoob-mp3-frontend",
    image: "ghcr.io/isolumi/yootoob-mp3-api:1829d6b",
    observedAt: NOW,
    reachable: true,
    reason: "Endpoint, certificate, Argo CD, and workloads are healthy.",
    argoApplication: "yootoob-mp3-dumachine",
    argoStatus: "healthy",
    relatedPodCount: 2,
    workloads: [
      {
        kind: "Deployment",
        name: "yootoob-mp3-api",
        status: "healthy",
        version: "ghcr.io/isolumi/yootoob-mp3-api:1829d6b",
        createdAt: "2026-08-04T22:00:00.000Z",
        desiredReplicas: 1,
        availableReplicas: 1,
        podCount: 1,
      },
      {
        kind: "Deployment",
        name: "yootoob-mp3-frontend",
        status: "healthy",
        version: "ghcr.io/isolumi/yootoob-mp3-frontend:1829d6b",
        createdAt: "2026-08-04T22:00:00.000Z",
        desiredReplicas: 1,
        availableReplicas: 1,
        podCount: 1,
      },
    ],
    ...overrides,
  };
}

function snapshot(services = [service()]): ServiceSnapshot {
  return {
    data: { services },
    status: services[0]?.status ?? "unknown",
    observedAt: NOW,
    stale: false,
    issues: [],
    sources: [
      { source: "service-probe", status: "healthy", observedAt: NOW, stale: false },
      { source: "kubernetes", status: "healthy", observedAt: NOW, stale: false },
      { source: "argocd", status: "healthy", observedAt: NOW, stale: false },
    ],
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ServicesView", () => {
  it("renders the private URL, certificate, latency, Argo app, pod count, age, and both workload versions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    render(<ServicesView initialSnapshot={snapshot()} fetcher={vi.fn()} />);

    const card = screen.getByRole("article", { name: "yootoob-mp3 service" });
    const link = within(card).getByRole("link", { name: /Open yootoob-mp3/i });
    expect(link.getAttribute("href")).toBe("https://yootoob.doh.lumilumi.xyz");
    expect(within(card).getByText("42 ms")).toBeTruthy();
    expect(within(card).getByText(/Certificate expires Sep 1, 2026/)).toBeTruthy();
    expect(within(card).getByRole("heading", { name: "yootoob-mp3" })).toBeTruthy();
    expect(within(card).getByText("yootoob-mp3-dumachine")).toBeTruthy();
    expect(within(card).getByText("2 related pods")).toBeTruthy();
    expect(within(card).getAllByText("Deployed 2h ago")).toHaveLength(2);
    expect(within(card).getByText("yootoob-mp3-api")).toBeTruthy();
    expect(within(card).getByText("yootoob-mp3-frontend")).toBeTruthy();
    expect(within(card).getByText("ghcr.io/isolumi/yootoob-mp3-api:1829d6b")).toBeTruthy();
    expect(within(card).getByText("ghcr.io/isolumi/yootoob-mp3-frontend:1829d6b")).toBeTruthy();
  });

  it("shows unknown deployment evidence explicitly and refuses unsafe service links", () => {
    const unknown = service({
      status: "unknown",
      url: "javascript:alert(1)",
      reachable: false,
      reason: "Deployment state is unavailable.",
      certificateExpiresAt: null,
      probeLatencyMs: null,
      argoStatus: "unknown",
      relatedPodCount: null,
      workloads: [
        {
          kind: "Deployment",
          name: "yootoob-mp3-api",
          status: "unknown",
          version: null,
          createdAt: null,
          desiredReplicas: null,
          availableReplicas: null,
          podCount: null,
        },
      ],
    });

    render(<ServicesView initialSnapshot={snapshot([unknown])} fetcher={vi.fn()} />);

    expect(screen.getAllByRole("status", { name: "Status: Unknown" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Deployment state is unavailable.")).toBeTruthy();
    expect(screen.getByText("Version unknown")).toBeTruthy();
    expect(screen.getAllByText("Pod count unknown")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /Open yootoob-mp3/i })).toBeNull();
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
  });

  it("shows an explicit empty state", () => {
    render(<ServicesView initialSnapshot={snapshot([])} fetcher={vi.fn()} />);
    expect(screen.getByText("No private services reported.")).toBeTruthy();
  });
});
