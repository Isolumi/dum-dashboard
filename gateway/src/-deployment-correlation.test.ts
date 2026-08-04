import { describe, expect, it } from "vitest";
import argoFixture from "./providers/fixtures/argocd.json";
import githubFixture from "./providers/fixtures/github.json";
import { correlateDeployment } from "./deployment-correlation";

const SHA = githubFixture.commit.sha;
const API_DIGEST = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FRONTEND_DIGEST = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function workflow(conclusion: "success" | "failure" = "success") {
  return {
    repository: "Isolumi/youtube-mp3",
    branch: "main",
    name: "Build images",
    status: "completed",
    conclusion,
    commit: {
      sha: SHA,
      message: githubFixture.commit.commit.message,
      author: githubFixture.commit.author.login,
      committedAt: githubFixture.commit.commit.author.date,
      url: githubFixture.commit.html_url,
    },
    startedAt: "2026-08-04T11:58:00Z",
    completedAt: "2026-08-04T12:00:30Z",
    durationMs: 150000,
    url: githubFixture.workflowRuns.workflow_runs[0]!.html_url,
  };
}

function application(
  syncStatus: "Synced" | "OutOfSync" = "Synced",
  healthStatus: "Healthy" | "Degraded" = "Healthy",
) {
  return {
    name: "yootoob-mp3-dumachine",
    namespace: "argocd",
    sync: { status: syncStatus, revision: SHA },
    health: {
      status: healthStatus,
      message: argoFixture.status.health.message,
      lastTransitionAt: argoFixture.status.health.lastTransitionTime,
    },
    operation: {
      phase: argoFixture.status.operationState.phase,
      message: argoFixture.status.operationState.message,
      revision: SHA,
      startedAt: argoFixture.status.operationState.startedAt,
      finishedAt: argoFixture.status.operationState.finishedAt,
    },
    resources: argoFixture.status.resources.map((resource) => ({
      group: resource.group,
      version: resource.version,
      kind: resource.kind,
      namespace: resource.namespace,
      name: resource.name,
      syncStatus: resource.status,
      healthStatus: resource.health.status,
      healthMessage: resource.health.message,
    })),
    images: [...argoFixture.status.summary.images],
  };
}

function kubernetes(options?: {
  apiAvailable?: number;
  frontendAvailable?: number;
  apiTag?: string;
  frontendTag?: string;
  apiDigest?: string;
  frontendDigest?: string;
}) {
  const apiAvailable = options?.apiAvailable ?? 1;
  const frontendAvailable = options?.frontendAvailable ?? 1;
  return {
    workloads: [
      {
        kind: "Deployment",
        name: "yootoob-mp3-api",
        namespace: "yootoob-mp3",
        desiredReplicas: 1,
        availableReplicas: apiAvailable,
      },
      {
        kind: "Deployment",
        name: "yootoob-mp3-frontend",
        namespace: "yootoob-mp3",
        desiredReplicas: 1,
        availableReplicas: frontendAvailable,
      },
    ],
    pods: [
      {
        name: "yootoob-mp3-api-abc",
        namespace: "yootoob-mp3",
        ready: apiAvailable > 0,
        imageTag: options?.apiTag ?? "ghcr.io/isolumi/youtube-mp3-api:sha-0123456",
        imageDigest: options?.apiDigest ?? API_DIGEST,
      },
      {
        name: "yootoob-mp3-frontend-abc",
        namespace: "yootoob-mp3",
        ready: frontendAvailable > 0,
        imageTag: options?.frontendTag ?? "ghcr.io/isolumi/youtube-mp3-frontend:sha-0123456",
        imageDigest: options?.frontendDigest ?? FRONTEND_DIGEST,
      },
    ],
  };
}

function correlate(overrides?: {
  workflow?: ReturnType<typeof workflow>;
  application?: ReturnType<typeof application>;
  kubernetes?: ReturnType<typeof kubernetes>;
}) {
  return correlateDeployment({
    workflow: overrides?.workflow ?? workflow(),
    application: overrides?.application ?? application(),
    kubernetes: overrides?.kubernetes ?? kubernetes(),
    observedAt: "2026-08-04T12:02:00Z",
  });
}

describe("correlateDeployment", () => {
  it("is Healthy when commit, image tags, live digests, Argo, and replicas match", () => {
    const result = correlate();

    expect(result.status).toBe("healthy");
    expect(result.commit?.sha).toBe(SHA);
    expect(result.workloads).toEqual([
      expect.objectContaining({
        name: "yootoob-mp3-api",
        status: "healthy",
        expectedImage: argoFixture.status.summary.images[0],
        liveImage: "ghcr.io/isolumi/youtube-mp3-api:sha-0123456",
        liveDigests: [API_DIGEST],
      }),
      expect.objectContaining({
        name: "yootoob-mp3-frontend",
        status: "healthy",
        expectedImage: argoFixture.status.summary.images[1],
        liveImage: "ghcr.io/isolumi/youtube-mp3-frontend:sha-0123456",
        liveDigests: [FRONTEND_DIGEST],
      }),
    ]);
  });

  it("is Warning when the latest workflow failed but the previous live version is available", () => {
    const previous = kubernetes({
      apiTag: "ghcr.io/isolumi/youtube-mp3-api:sha-7654321",
      frontendTag: "ghcr.io/isolumi/youtube-mp3-frontend:sha-7654321",
      apiDigest: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      frontendDigest: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    });

    const result = correlate({ workflow: workflow("failure"), kubernetes: previous });

    expect(result.status).toBe("warning");
    expect(result.workflow).toMatchObject({ status: "warning", url: workflow("failure").url });
    expect(result.workloads.every(({ availableReplicas }) => availableReplicas === 1)).toBe(true);
  });

  it("is Warning when Argo is OutOfSync and both workloads remain available", () => {
    const result = correlate({ application: application("OutOfSync") });

    expect(result.status).toBe("warning");
    expect(result.argo.status).toBe("warning");
  });

  it("is Critical when Argo reports Degraded", () => {
    const result = correlate({ application: application("Synced", "Degraded") });

    expect(result.status).toBe("critical");
    expect(result.argo.status).toBe("critical");
  });

  it("is Warning when an expected image tag differs from the live pods", () => {
    const result = correlate({
      kubernetes: kubernetes({ apiTag: "ghcr.io/isolumi/youtube-mp3-api:sha-7654321" }),
    });

    expect(result.status).toBe("warning");
    expect(result.workloads[0]).toMatchObject({
      name: "yootoob-mp3-api",
      status: "warning",
      tagMatches: false,
    });
    expect(result.workloads[1]?.status).toBe("healthy");
  });

  it("is Critical when either expected deployment has zero available replicas", () => {
    const result = correlate({ kubernetes: kubernetes({ frontendAvailable: 0 }) });

    expect(result.status).toBe("critical");
    expect(result.workloads[1]).toMatchObject({
      name: "yootoob-mp3-frontend",
      status: "critical",
      availableReplicas: 0,
    });
  });
});
