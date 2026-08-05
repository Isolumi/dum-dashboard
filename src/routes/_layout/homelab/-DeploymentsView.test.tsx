import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApplicationPipelineSummary, DeploymentSnapshot } from "@shared/homelab/contracts";
import { DeploymentsView } from "./deployments";

const NOW = "2026-08-05T00:00:00.000Z";

function application(
  overrides: Partial<ApplicationPipelineSummary> = {},
): ApplicationPipelineSummary {
  return {
    application: "yootoob-mp3-dumachine",
    namespace: "argocd",
    repository: "Isolumi/youtube-mp3",
    branch: "development",
    status: "warning",
    commit: {
      sha: "1829d6ba3b55e66a2134ae64161b9e48ad39a197",
      message: "Add download queue",
      author: "Isolumi",
      committedAt: "2026-08-04T23:30:00.000Z",
      url: "https://github.com/Isolumi/youtube-mp3/commit/1829d6b",
    },
    argoRevision: "feedfacefeedfacefeedfacefeedfacefeedface",
    workflow: {
      status: "warning",
      summary: "Latest GitHub Actions build failed; the previous release remains live.",
      observedAt: "2026-08-04T23:35:00.000Z",
      url: "https://github.com/Isolumi/youtube-mp3/actions/runs/123",
    },
    argo: {
      status: "healthy",
      summary: "Application is Synced and Healthy.",
      observedAt: "2026-08-04T23:40:00.000Z",
      url: null,
    },
    rollout: {
      status: "healthy",
      summary: "2 of 2 workloads are available.",
      observedAt: "2026-08-04T23:41:00.000Z",
      url: null,
    },
    workloads: [
      {
        name: "yootoob-mp3-api",
        namespace: "yootoob-mp3",
        status: "healthy",
        desiredReplicas: 1,
        availableReplicas: 1,
        expectedImage: "ghcr.io/isolumi/yootoob-mp3-api:1829d6b",
        liveImage: "ghcr.io/isolumi/yootoob-mp3-api:previous",
        liveDigests: [`sha256:${"a".repeat(64)}`],
        tagMatches: false,
        digestMatches: null,
      },
      {
        name: "yootoob-mp3-frontend",
        namespace: "yootoob-mp3",
        status: "healthy",
        desiredReplicas: 1,
        availableReplicas: 1,
        expectedImage: "ghcr.io/isolumi/yootoob-mp3-frontend:1829d6b",
        liveImage: "ghcr.io/isolumi/yootoob-mp3-frontend:1829d6b",
        liveDigests: [`sha256:${"b".repeat(64)}`],
        tagMatches: true,
        digestMatches: true,
      },
    ],
    issues: [
      {
        ruleId: "workflow-failed",
        status: "warning",
        reason: "The latest build failed, but healthy pods are still serving the previous image.",
        source: "github",
        resource: "Isolumi/youtube-mp3",
        observedAt: "2026-08-04T23:35:00.000Z",
        evidence: { conclusion: "failure" },
      },
      {
        ruleId: "tag-mismatch",
        status: "warning",
        reason: "yootoob-mp3-api is still running the previous image tag.",
        source: "kubernetes",
        resource: "yootoob-mp3-api",
        observedAt: "2026-08-04T23:41:00.000Z",
        evidence: { expected: "1829d6b", live: "previous" },
      },
    ],
    ...overrides,
  };
}

function snapshot(apps = [application()]): DeploymentSnapshot {
  return {
    data: { applications: apps },
    status: apps[0]?.status ?? "unknown",
    observedAt: NOW,
    stale: false,
    issues: apps.flatMap((app) => app.issues),
    sources: [
      { source: "github", status: "healthy", observedAt: NOW, stale: false },
      { source: "argocd", status: "healthy", observedAt: NOW, stale: false },
      { source: "kubernetes", status: "healthy", observedAt: NOW, stale: false },
    ],
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DeploymentsView", () => {
  it("renders the commit-to-live stages in order and keeps failed CI with healthy pods at Warning", () => {
    render(<DeploymentsView initialSnapshot={snapshot()} fetcher={vi.fn()} />);

    const pipeline = screen.getByRole("article", { name: "yootoob-mp3-dumachine pipeline" });
    const stages = within(pipeline)
      .getAllByRole("heading", { level: 3 })
      .slice(0, 6)
      .map((heading) => heading.textContent);
    expect(stages).toEqual([
      "Commit",
      "GitHub Actions",
      "GHCR image",
      "Argo CD",
      "K3s rollout",
      "Live pods",
    ]);
    expect(
      within(pipeline).getAllByRole("status", { name: "Status: Warning" }).length,
    ).toBeGreaterThan(0);
    expect(within(pipeline).queryByRole("status", { name: "Status: Critical" })).toBeNull();
    expect(within(pipeline).getByText("1829d6b")).toBeTruthy();
    expect(within(pipeline).getByText("Add download queue")).toBeTruthy();
    expect(within(pipeline).getByText(/previous image tag/)).toBeTruthy();
    expect(within(pipeline).getByText(/healthy pods are still serving/)).toBeTruthy();

    const workflowLink = within(pipeline).getByRole("link", { name: /GitHub Actions source/i });
    expect(workflowLink.getAttribute("href")).toBe(
      "https://github.com/Isolumi/youtube-mp3/actions/runs/123",
    );
  });

  it("renders missing commit and source evidence as Unknown without unsafe external links", () => {
    const unknown = application({
      status: "unknown",
      commit: null,
      workflow: {
        status: "unknown",
        summary: "GitHub workflow data is unavailable.",
        observedAt: "1970-01-01T00:00:00.000Z",
        url: "javascript:alert(1)",
      },
      argo: {
        status: "unknown",
        summary: "Argo CD data is unavailable.",
        observedAt: "1970-01-01T00:00:00.000Z",
        url: null,
      },
      rollout: {
        status: "unknown",
        summary: "Kubernetes rollout data is unavailable.",
        observedAt: "1970-01-01T00:00:00.000Z",
        url: null,
      },
      workloads: [],
      issues: [],
    });

    render(<DeploymentsView initialSnapshot={snapshot([unknown])} fetcher={vi.fn()} />);

    expect(screen.getAllByRole("status", { name: "Status: Unknown" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Commit data unavailable")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /GitHub Actions source/i })).toBeNull();
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
  });

  it("shows an explicit empty state", () => {
    render(<DeploymentsView initialSnapshot={snapshot([])} fetcher={vi.fn()} />);
    expect(screen.getByText("No applications reported.")).toBeTruthy();
  });
});
