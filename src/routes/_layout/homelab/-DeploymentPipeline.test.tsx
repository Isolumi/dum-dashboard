import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ApplicationPipelineSummary } from "@shared/homelab/contracts";
import { DeploymentSnapshotSchema } from "#/lib/homelab-schemas";
import { DeploymentPipeline } from "./-DeploymentPipeline";

const application: ApplicationPipelineSummary = {
  application: "yootoob-mp3-dumachine",
  namespace: "yootoob-mp3",
  repository: "Isolumi/youtube-mp3",
  branch: "development",
  status: "healthy",
  commit: {
    sha: "1829d6ba3b55e66a2134ae64161b9e48ad39a197",
    message: "Ship dashboard evidence",
    author: "Isolumi",
    committedAt: "2026-08-04T11:57:00Z",
    url: "https://github.com/Isolumi/youtube-mp3/commit/1829d6b",
  },
  argoRevision: "feedfacefeedfacefeedfacefeedfacefeedface",
  workflow: {
    status: "healthy",
    summary: "Workflow succeeded.",
    observedAt: "2026-08-04T12:00:30Z",
    url: "https://github.com/Isolumi/youtube-mp3/actions/runs/123",
    conclusion: "success",
    durationMs: 150000,
  },
  argo: {
    status: "healthy",
    summary: "Application is Synced and Healthy.",
    observedAt: "2026-08-04T12:01:00Z",
    url: null,
    revision: "feedfacefeedfacefeedfacefeedfacefeedface",
    syncStatus: "Synced",
    healthStatus: "Healthy",
    operationResult: "Succeeded",
    lastTransitionAt: "2026-08-04T12:00:45Z",
  },
  rollout: {
    status: "healthy",
    summary: "Deployment is available.",
    observedAt: "2026-08-04T12:01:30Z",
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
      liveImage: "ghcr.io/isolumi/yootoob-mp3-api:1829d6b",
      liveDigests: [`sha256:${"a".repeat(64)}`],
      tagMatches: true,
      digestMatches: true,
      revision: "7",
      createdAt: "2026-08-04T11:59:00Z",
    },
  ],
  issues: [],
};

afterEach(cleanup);

describe("DeploymentPipeline", () => {
  it("keeps the normalized evidence accepted by the browser boundary schema", () => {
    const snapshot = DeploymentSnapshotSchema.parse({
      data: { applications: [application] },
      status: "healthy",
      observedAt: "2026-08-04T12:02:00Z",
      stale: false,
      issues: [],
      sources: [
        {
          source: "kubernetes",
          status: "healthy",
          observedAt: "2026-08-04T12:02:00Z",
          stale: false,
        },
      ],
    });

    expect(snapshot.data?.applications[0]?.workflow.durationMs).toBe(150000);
    expect(snapshot.data?.applications[0]?.argo.operationResult).toBe("Succeeded");
    expect(snapshot.data?.applications[0]?.workloads[0]?.revision).toBe("7");
  });

  it("rejects non-HTTPS deployment links at the browser boundary", () => {
    const unsafe = structuredClone(application);
    unsafe.workflow.url = "javascript:alert(1)";

    expect(
      DeploymentSnapshotSchema.safeParse({
        data: { applications: [unsafe] },
        status: "healthy",
        observedAt: "2026-08-04T12:02:00Z",
        stale: false,
        issues: [],
        sources: [],
      }).success,
    ).toBe(false);
  });

  it("renders complete commit-to-live evidence", () => {
    render(<DeploymentPipeline application={application} />);

    const pipeline = screen.getByRole("article", {
      name: "yootoob-mp3-dumachine pipeline",
    });
    expect(within(pipeline).getByText("Aug 4, 2026, 11:57 UTC")).toBeTruthy();
    expect(within(pipeline).getByText("Duration: 2m 30s")).toBeTruthy();
    expect(within(pipeline).getByText("Conclusion: success")).toBeTruthy();
    expect(within(pipeline).getByText("Operation: Succeeded")).toBeTruthy();
    expect(within(pipeline).getByText("Sync: Synced · Health: Healthy")).toBeTruthy();
    expect(within(pipeline).getByText("Revision: feedfac")).toBeTruthy();
    expect(within(pipeline).getByText("Last transition: Aug 4, 2026, 12:00 UTC")).toBeTruthy();
    expect(within(pipeline).getByText("Kubernetes revision: 7")).toBeTruthy();
    const liveImages = within(pipeline).getByRole("list", { name: "Live workload images" });
    expect(within(liveImages).getByText("ghcr.io/isolumi/yootoob-mp3-api:1829d6b")).toBeTruthy();
    expect(within(liveImages).getByText(`sha256:${"a".repeat(64)}`)).toBeTruthy();
  });

  it("renders an Argo-only application without fake GitHub stages", () => {
    const monitoring: ApplicationPipelineSummary = {
      ...application,
      application: "kube-prometheus-stack",
      namespace: "monitoring",
      repository: null,
      branch: null,
      commit: null,
      workflow: null,
    };

    const parsed = DeploymentSnapshotSchema.parse({
      data: { applications: [monitoring] },
      status: "healthy",
      observedAt: "2026-08-04T12:02:00Z",
      stale: false,
      issues: [],
      sources: [],
    });
    render(<DeploymentPipeline application={parsed.data!.applications[0]!} />);

    const pipeline = screen.getByRole("article", {
      name: "kube-prometheus-stack pipeline",
    });
    expect(within(pipeline).queryByRole("heading", { name: "Commit" })).toBeNull();
    expect(within(pipeline).queryByRole("heading", { name: "GitHub Actions" })).toBeNull();
    expect(within(pipeline).getByText("Argo CD managed")).toBeTruthy();
    expect(within(pipeline).getByRole("heading", { name: "Container images" })).toBeTruthy();
  });

  it("marks the image stage unknown when live tag and digest evidence are missing", () => {
    const missingLiveEvidence: ApplicationPipelineSummary = {
      ...application,
      workloads: [
        {
          ...application.workloads[0]!,
          liveImage: null,
          liveDigests: [],
          tagMatches: null,
          digestMatches: null,
        },
      ],
    };

    render(<DeploymentPipeline application={missingLiveEvidence} />);

    const heading = screen.getByRole("heading", { name: "Container images" });
    const stage = heading.closest("section");
    expect(stage).not.toBeNull();
    expect(within(stage!).getByRole("status", { name: "Status: Unknown" })).toBeTruthy();
  });

  it("keeps a tag-based image healthy when its live digest exists without an expected digest", () => {
    const tagBased: ApplicationPipelineSummary = {
      ...application,
      workloads: [{ ...application.workloads[0]!, digestMatches: null }],
    };

    render(<DeploymentPipeline application={tagBased} />);

    const heading = screen.getByRole("heading", { name: "Container images" });
    const stage = heading.closest("section");
    expect(stage).not.toBeNull();
    expect(within(stage!).getByRole("status", { name: "Status: Healthy" })).toBeTruthy();
  });

  it("marks partial live digest evidence unknown even when one digest is present", () => {
    const partialDigestEvidence: ApplicationPipelineSummary = {
      ...application,
      issues: [
        {
          ruleId: "deployment-live-digest-unavailable",
          status: "unknown",
          reason: "A live image digest is unavailable for yootoob-mp3-api.",
          source: "kubernetes",
          resource: "Deployment/yootoob-mp3-api",
          observedAt: "2026-08-04T12:02:00Z",
          evidence: { containerCount: 2 },
        },
      ],
    };

    render(<DeploymentPipeline application={partialDigestEvidence} />);

    const heading = screen.getByRole("heading", { name: "Container images" });
    const stage = heading.closest("section");
    expect(stage).not.toBeNull();
    expect(within(stage!).getByRole("status", { name: "Status: Unknown" })).toBeTruthy();
  });

  it("labels missing replica evidence as unknown instead of displaying 0 of 0", () => {
    const unknown: ApplicationPipelineSummary = {
      ...application,
      status: "unknown",
      workloads: [
        {
          ...application.workloads[0]!,
          status: "unknown",
          desiredReplicas: null,
          availableReplicas: null,
          revision: null,
          createdAt: null,
        },
      ],
    };

    render(<DeploymentPipeline application={unknown} />);

    expect(screen.getByText("Replica evidence unavailable")).toBeTruthy();
    expect(screen.queryByText("0 of 0 replicas available")).toBeNull();
    expect(screen.getByText("Kubernetes revision unknown")).toBeTruthy();
  });
});
