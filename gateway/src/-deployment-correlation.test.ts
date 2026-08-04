import { describe, expect, it } from "vitest";
import argoFixture from "./providers/fixtures/argocd.json";
import githubFixture from "./providers/fixtures/github.json";
import { correlateDeployment } from "./deployment-correlation";

const SOURCE_SHA = githubFixture.commit.sha;
const ARGO_REVISION = argoFixture.status.sync.revision;
const API_REPOSITORY = "ghcr.io/isolumi/yootoob-mp3-api";
const FRONTEND_REPOSITORY = "ghcr.io/isolumi/yootoob-mp3-frontend";
const API_DIGEST = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FRONTEND_DIGEST = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function workflow(conclusion: "success" | "failure" = "success") {
  return {
    repository: "Isolumi/youtube-mp3",
    branch: "development",
    name: "Build and publish images",
    status: "completed",
    conclusion,
    commit: {
      sha: SOURCE_SHA,
      message: githubFixture.commit.commit.message,
      author: githubFixture.commit.author.login,
      committedAt: githubFixture.commit.commit.author.date,
      url: `https://github.com/Isolumi/youtube-mp3/commit/${SOURCE_SHA}`,
    },
    startedAt: "2026-08-04T11:58:00Z",
    completedAt: "2026-08-04T12:00:30Z",
    durationMs: 150000,
    url: "https://github.com/Isolumi/youtube-mp3/actions/runs/987654321",
  };
}

function application(options?: {
  syncStatus?: "Synced" | "OutOfSync";
  healthStatus?: "Healthy" | "Degraded";
  revision?: string;
  images?: string[];
}) {
  return {
    name: "yootoob-mp3-dumachine",
    namespace: "argocd",
    sync: {
      status: options?.syncStatus ?? "Synced",
      revision: options?.revision ?? ARGO_REVISION,
    },
    health: {
      status: options?.healthStatus ?? "Healthy",
      message: argoFixture.status.health.message,
      lastTransitionAt: argoFixture.status.health.lastTransitionTime,
    },
    operation: {
      phase: argoFixture.status.operationState.phase,
      message: argoFixture.status.operationState.message,
      revision: options?.revision ?? ARGO_REVISION,
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
    images: options?.images ?? [...argoFixture.status.summary.images],
  };
}

function valueOrDefault<T>(value: T | null | undefined, fallback: T): T | null {
  return value === undefined ? fallback : value;
}

function imageEvidence(
  name: string,
  repository: string,
  tag: string | null,
  digest: string | null,
) {
  return {
    name,
    repository,
    reference: tag ? `${repository}:${tag}` : repository,
    tag,
    digest,
  };
}

function kubernetes(options?: {
  apiAvailable?: number;
  frontendAvailable?: number;
  apiTag?: string | null;
  frontendTag?: string | null;
  apiDigest?: string | null;
  frontendDigest?: string | null;
  omitApiPod?: boolean;
  apiSidecarFirst?: boolean;
}) {
  const apiAvailable = options?.apiAvailable ?? 1;
  const frontendAvailable = options?.frontendAvailable ?? 1;
  const apiTag = valueOrDefault(options?.apiTag, SOURCE_SHA);
  const frontendTag = valueOrDefault(options?.frontendTag, SOURCE_SHA);
  const apiDigest = valueOrDefault(options?.apiDigest, API_DIGEST);
  const frontendDigest = valueOrDefault(options?.frontendDigest, FRONTEND_DIGEST);
  const apiImage = imageEvidence("api", API_REPOSITORY, apiTag, apiDigest);
  const frontendImage = imageEvidence("frontend", FRONTEND_REPOSITORY, frontendTag, frontendDigest);
  const apiContainerImages = options?.apiSidecarFirst
    ? [
        imageEvidence(
          "metrics",
          "ghcr.io/isolumi/metrics-sidecar",
          "v1.2.3",
          "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        ),
        apiImage,
      ]
    : [apiImage];

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
      ...(options?.omitApiPod
        ? []
        : [
            {
              name: "yootoob-mp3-api-abc",
              namespace: "yootoob-mp3",
              ready: apiAvailable > 0,
              imageTag: options?.apiSidecarFirst ? null : apiImage.reference,
              imageDigest: options?.apiSidecarFirst ? null : apiImage.digest,
              containerImages: apiContainerImages,
            },
          ]),
      {
        name: "yootoob-mp3-frontend-abc",
        namespace: "yootoob-mp3",
        ready: frontendAvailable > 0,
        imageTag: frontendImage.reference,
        imageDigest: frontendImage.digest,
        containerImages: [frontendImage],
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
  it("is Healthy when source SHA, desired image tags, live tags/digests, Argo, and replicas match", () => {
    const result = correlate({
      application: application({ revision: ARGO_REVISION }),
      kubernetes: kubernetes({ apiSidecarFirst: true }),
    });

    expect(SOURCE_SHA).not.toBe(ARGO_REVISION);
    expect(result.status).toBe("healthy");
    expect(result).toMatchObject({ argoRevision: ARGO_REVISION });
    expect(result.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: "deployment-revision-mismatch" })]),
    );
    expect(result.workloads).toEqual([
      expect.objectContaining({
        name: "yootoob-mp3-api",
        status: "healthy",
        expectedImage: `${API_REPOSITORY}:${SOURCE_SHA}`,
        liveImage: `${API_REPOSITORY}:${SOURCE_SHA}`,
        liveDigests: [API_DIGEST],
        tagMatches: true,
      }),
      expect.objectContaining({
        name: "yootoob-mp3-frontend",
        status: "healthy",
        expectedImage: `${FRONTEND_REPOSITORY}:${SOURCE_SHA}`,
        liveImage: `${FRONTEND_REPOSITORY}:${SOURCE_SHA}`,
        liveDigests: [FRONTEND_DIGEST],
        tagMatches: true,
      }),
    ]);
  });

  it("is Warning when the latest workflow failed but the previous desired/live version is available", () => {
    const previousSha = "7654321765432176543217654321765432176543";
    const previousImages = [
      `${API_REPOSITORY}:${previousSha}`,
      `${FRONTEND_REPOSITORY}:${previousSha}`,
    ];
    const previous = kubernetes({ apiTag: previousSha, frontendTag: previousSha });

    const result = correlate({
      workflow: workflow("failure"),
      application: application({ images: previousImages }),
      kubernetes: previous,
    });

    expect(result.status).toBe("warning");
    expect(result.workflow).toMatchObject({ status: "warning", url: workflow("failure").url });
    expect(result.workloads.every(({ availableReplicas }) => availableReplicas === 1)).toBe(true);
  });

  it("is Warning when a successful workflow source SHA has not reached the desired image tag", () => {
    const previousSha = "7654321765432176543217654321765432176543";
    const result = correlate({
      application: application({
        images: [`${API_REPOSITORY}:${previousSha}`, `${FRONTEND_REPOSITORY}:${previousSha}`],
      }),
      kubernetes: kubernetes({ apiTag: previousSha, frontendTag: previousSha }),
    });

    expect(result.status).toBe("warning");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "deployment-source-tag-mismatch",
          status: "warning",
          source: null,
        }),
      ]),
    );
  });

  it("is Warning when Argo is OutOfSync and both workloads remain available", () => {
    const result = correlate({ application: application({ syncStatus: "OutOfSync" }) });

    expect(result.status).toBe("warning");
    expect(result.argo.status).toBe("warning");
  });

  it("is Critical when Argo reports Degraded", () => {
    const result = correlate({ application: application({ healthStatus: "Degraded" }) });

    expect(result.status).toBe("critical");
    expect(result.argo.status).toBe("critical");
  });

  it("is Warning only when comparable expected and live image tags differ", () => {
    const result = correlate({
      kubernetes: kubernetes({ apiTag: "7654321765432176543217654321765432176543" }),
    });

    expect(result.status).toBe("warning");
    expect(result.workloads[0]).toMatchObject({
      name: "yootoob-mp3-api",
      status: "warning",
      tagMatches: false,
    });
    expect(result.workloads[1]?.status).toBe("healthy");
  });

  it("is Warning only when comparable expected and live digests differ", () => {
    const expectedDigest =
      "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
    const result = correlate({
      application: application({
        images: [
          `${API_REPOSITORY}:${SOURCE_SHA}@${expectedDigest}`,
          `${FRONTEND_REPOSITORY}:${SOURCE_SHA}`,
        ],
      }),
    });

    expect(result.status).toBe("warning");
    expect(result.workloads[0]).toMatchObject({ status: "warning", digestMatches: false });
  });

  it.each([
    {
      name: "expected Argo image",
      application: application({ images: [`${FRONTEND_REPOSITORY}:${SOURCE_SHA}`] }),
      kubernetes: kubernetes(),
      ruleId: "deployment-expected-image-unavailable",
    },
    {
      name: "live pod",
      application: application(),
      kubernetes: kubernetes({ omitApiPod: true }),
      ruleId: "deployment-pod-unavailable",
    },
    {
      name: "live image tag",
      application: application(),
      kubernetes: kubernetes({ apiTag: null }),
      ruleId: "deployment-live-tag-unavailable",
    },
    {
      name: "live image digest",
      application: application(),
      kubernetes: kubernetes({ apiDigest: null }),
      ruleId: "deployment-live-digest-unavailable",
    },
  ])(
    "is Unknown with explicit evidence when $name is missing",
    ({ application, kubernetes, ruleId }) => {
      const result = correlate({ application, kubernetes });

      expect(result.status).toBe("unknown");
      expect(result.workloads[0]?.status).toBe("unknown");
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId,
            status: "unknown",
            resource: "Deployment/yootoob-mp3-api",
          }),
        ]),
      );
      expect(result.issues).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ruleId: "deployment-image-tag-mismatch" }),
          expect.objectContaining({ ruleId: "deployment-image-digest-mismatch" }),
          expect.objectContaining({ ruleId: "deployment-source-tag-mismatch" }),
        ]),
      );
    },
  );

  it.each([
    { name: "missing", containerImages: undefined },
    { name: "non-array", containerImages: { legacyImage: `${API_REPOSITORY}:${SOURCE_SHA}` } },
    { name: "an invalid entry", containerImages: [{ name: "api", repository: 42 }] },
  ])(
    "is Unknown when pod containerImages is $name at the defensive boundary",
    ({ containerImages }) => {
      const valid = kubernetes();
      const apiPod = valid.pods[0]!;
      const malformedApiPod = { ...apiPod, containerImages };
      if (containerImages === undefined) {
        delete (malformedApiPod as { containerImages?: unknown }).containerImages;
      }

      const result = correlate({
        kubernetes: {
          ...valid,
          pods: [malformedApiPod, ...valid.pods.slice(1)],
        } as unknown as ReturnType<typeof kubernetes>,
      });

      expect(result.status).toBe("unknown");
      expect(result.workloads[0]).toMatchObject({
        name: "yootoob-mp3-api",
        status: "unknown",
        tagMatches: null,
        digestMatches: null,
      });
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId: "deployment-container-images-unavailable",
            status: "unknown",
            source: "kubernetes",
            resource: "Deployment/yootoob-mp3-api",
          }),
        ]),
      );
      expect(result.issues).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ruleId: "deployment-image-tag-mismatch" }),
          expect.objectContaining({ ruleId: "deployment-image-digest-mismatch" }),
        ]),
      );
    },
  );

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
