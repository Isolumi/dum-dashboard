import { describe, expect, it, vi } from "vitest";
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
        status: "healthy" as const,
        desiredReplicas: 1,
        availableReplicas: apiAvailable,
      },
      {
        kind: "Deployment",
        name: "yootoob-mp3-frontend",
        namespace: "yootoob-mp3",
        status: "healthy" as const,
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
              status: "healthy" as const,
              ready: apiAvailable > 0,
              imageTag: options?.apiSidecarFirst ? null : apiImage.reference,
              imageDigest: options?.apiSidecarFirst ? null : apiImage.digest,
              containerImages: apiContainerImages,
            },
          ]),
      {
        name: "yootoob-mp3-frontend-abc",
        namespace: "yootoob-mp3",
        status: "healthy" as const,
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

type MutableKubernetesEvidence = { workloads: unknown; pods: unknown };

function firstRecord(value: unknown): Record<string, unknown> {
  return (value as Array<Record<string, unknown>>)[0]!;
}

function withLeadingHole<T>(values: readonly T[]): T[] {
  const sparse: T[] = [];
  sparse.length = values.length + 1;
  for (let index = 0; index < values.length; index += 1) sparse[index + 1] = values[index]!;
  return sparse;
}

function expectInvalidKubernetesEvidence(
  result: ReturnType<typeof correlateDeployment>,
  secret?: string,
) {
  expect(result).toMatchObject({
    status: "unknown",
    rollout: { status: "unknown" },
    workloads: [
      { status: "unknown", desiredReplicas: 0, availableReplicas: 0 },
      { status: "unknown", desiredReplicas: 0, availableReplicas: 0 },
    ],
  });
  expect(result.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        ruleId: "deployment-kubernetes-evidence-invalid",
        status: "unknown",
        reason: "Kubernetes deployment evidence is invalid.",
        source: "kubernetes",
        resource: "yootoob-mp3",
      }),
    ]),
  );
  expect(result.issues.some(({ status }) => status === "critical")).toBe(false);
  if (secret) expect(JSON.stringify(result)).not.toContain(secret);
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
    {
      name: "empty workload and pod arrays",
      evidence: () => ({ workloads: [], pods: [] }),
      missingTargets: ["yootoob-mp3-api", "yootoob-mp3-frontend"],
    },
    {
      name: "unrelated workloads only",
      evidence: () => ({
        workloads: [
          {
            kind: "Deployment",
            name: "unrelated-service",
            namespace: "yootoob-mp3",
            status: "healthy" as const,
            desiredReplicas: 1,
            availableReplicas: 1,
          },
        ],
        pods: [],
      }),
      missingTargets: ["yootoob-mp3-api", "yootoob-mp3-frontend"],
    },
    {
      name: "a target workload absent while its pod is present",
      evidence: () => {
        const valid = kubernetes();
        return { ...valid, workloads: valid.workloads.slice(1) };
      },
      missingTargets: ["yootoob-mp3-api"],
    },
  ])("reports explicit Unknown missing evidence for $name", ({ evidence, missingTargets }) => {
    const result = correlate({ kubernetes: evidence() as ReturnType<typeof kubernetes> });

    expect(result.status).toBe("unknown");
    for (const targetName of missingTargets) {
      expect(result.workloads.find(({ name }) => name === targetName)).toMatchObject({
        status: "unknown",
        desiredReplicas: null,
        availableReplicas: null,
      });
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId: "deployment-workload-unavailable",
            status: "unknown",
            resource: `Deployment/${targetName}`,
            evidence: { desiredReplicas: null, availableReplicas: null },
          }),
        ]),
      );
    }
    expect(result.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: "deployment-unavailable" })]),
    );
    expect(result.issues.some(({ status }) => status === "critical")).toBe(false);
  });

  it.each([
    { name: "valid control", mutate: null, expectedStatus: "healthy" },
    {
      name: "null workloads",
      mutate: (evidence: MutableKubernetesEvidence) => (evidence.workloads = null),
      expectedStatus: "unknown",
    },
    {
      name: "non-array workloads",
      mutate: (evidence: MutableKubernetesEvidence) => (evidence.workloads = {}),
      expectedStatus: "unknown",
    },
    {
      name: "null pods",
      mutate: (evidence: MutableKubernetesEvidence) => (evidence.pods = null),
      expectedStatus: "unknown",
    },
    {
      name: "non-array pods",
      mutate: (evidence: MutableKubernetesEvidence) => (evidence.pods = {}),
      expectedStatus: "unknown",
    },
    {
      name: "malformed workload record",
      mutate: (evidence: MutableKubernetesEvidence) =>
        ((evidence.workloads as unknown[])[0] = null),
      expectedStatus: "unknown",
    },
    {
      name: "malformed workload kind",
      mutate: (evidence: MutableKubernetesEvidence) => (firstRecord(evidence.workloads).kind = 42),
      expectedStatus: "unknown",
    },
    {
      name: "malformed workload name",
      mutate: (evidence: MutableKubernetesEvidence) => (firstRecord(evidence.workloads).name = 42),
      expectedStatus: "unknown",
    },
    {
      name: "malformed workload namespace",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.workloads).namespace = null),
      expectedStatus: "unknown",
    },
    {
      name: "malformed workload status",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.workloads).status = 42),
      expectedStatus: "unknown",
    },
    {
      name: "malformed pod record",
      mutate: (evidence: MutableKubernetesEvidence) => ((evidence.pods as unknown[])[0] = null),
      expectedStatus: "unknown",
    },
    {
      name: "malformed pod name",
      mutate: (evidence: MutableKubernetesEvidence) => (firstRecord(evidence.pods).name = 42),
      expectedStatus: "unknown",
    },
    {
      name: "malformed pod namespace",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.pods).namespace = null),
      expectedStatus: "unknown",
    },
    {
      name: "malformed pod status",
      mutate: (evidence: MutableKubernetesEvidence) => (firstRecord(evidence.pods).status = 42),
      expectedStatus: "unknown",
    },
    {
      name: "NaN desired replicas",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.workloads).desiredReplicas = Number.NaN),
      expectedStatus: "unknown",
    },
    {
      name: "string desired replicas",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.workloads).desiredReplicas = "1"),
      expectedStatus: "unknown",
    },
    {
      name: "negative desired replicas",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.workloads).desiredReplicas = -1),
      expectedStatus: "unknown",
    },
    {
      name: "fractional desired replicas below one",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.workloads).desiredReplicas = 0.5),
      expectedStatus: "unknown",
    },
    {
      name: "fractional desired replicas above one",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.workloads).desiredReplicas = 1.5),
      expectedStatus: "unknown",
    },
    {
      name: "NaN available replicas",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.workloads).availableReplicas = Number.NaN),
      expectedStatus: "unknown",
    },
    {
      name: "string available replicas",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.workloads).availableReplicas = "1"),
      expectedStatus: "unknown",
    },
    {
      name: "negative available replicas",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.workloads).availableReplicas = -1),
      expectedStatus: "unknown",
    },
    {
      name: "fractional available replicas below one",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.workloads).availableReplicas = 0.5),
      expectedStatus: "unknown",
    },
    {
      name: "fractional available replicas above one",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.workloads).availableReplicas = 1.5),
      expectedStatus: "unknown",
    },
    {
      name: "null container images",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.pods).containerImages = null),
      expectedStatus: "unknown",
    },
    {
      name: "non-array container images",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(evidence.pods).containerImages = { legacy: true }),
      expectedStatus: "unknown",
    },
    {
      name: "malformed nested image",
      mutate: (evidence: MutableKubernetesEvidence) =>
        (firstRecord(firstRecord(evidence.pods).containerImages).repository = 42),
      expectedStatus: "unknown",
    },
  ])("is runtime-total for $name", ({ mutate, expectedStatus }) => {
    const kubernetesEvidence = structuredClone(
      kubernetes(),
    ) as unknown as MutableKubernetesEvidence;
    mutate?.(kubernetesEvidence);
    let result: ReturnType<typeof correlateDeployment> | undefined;

    expect(() => {
      result = correlateDeployment({
        workflow: workflow(),
        application: application(),
        kubernetes: kubernetesEvidence as unknown as ReturnType<typeof kubernetes>,
        observedAt: "2026-08-04T12:02:00Z",
      });
    }).not.toThrow();

    expect(result?.status).toBe(expectedStatus);
    if (expectedStatus === "healthy") {
      expect(result?.issues).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ruleId: "deployment-kubernetes-evidence-invalid" }),
        ]),
      );
      return;
    }

    expect(result).toMatchObject({
      status: "unknown",
      rollout: { status: "unknown" },
      workloads: [
        { status: "unknown", desiredReplicas: 0, availableReplicas: 0 },
        { status: "unknown", desiredReplicas: 0, availableReplicas: 0 },
      ],
    });
    expect(result?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "deployment-kubernetes-evidence-invalid",
          status: "unknown",
          reason: "Kubernetes deployment evidence is invalid.",
          source: "kubernetes",
          resource: "yootoob-mp3",
        }),
      ]),
    );
    expect(result?.issues.some(({ status }) => status === "critical")).toBe(false);
  });

  it("does not invoke a throwing Kubernetes evidence accessor", () => {
    const secret = "getter-secret-stack";
    let getterCalls = 0;
    const hostile = Object.defineProperty({ pods: kubernetes().pods }, "workloads", {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error(secret);
      },
    });
    let result: ReturnType<typeof correlateDeployment> | undefined;

    expect(() => {
      result = correlateDeployment({
        workflow: workflow(),
        application: application(),
        kubernetes: hostile as unknown as ReturnType<typeof kubernetes>,
        observedAt: "2026-08-04T12:02:00Z",
      });
    }).not.toThrow();

    expect(getterCalls).toBe(0);
    expectInvalidKubernetesEvidence(result!, secret);
  });

  it("inspects each raw Kubernetes pod record exactly once", () => {
    const evidence = kubernetes();
    const pod = evidence.pods[0]!;
    const expectedDescriptorReads = Reflect.ownKeys(pod).length;
    const descriptorReads = vi.spyOn(Object, "getOwnPropertyDescriptor");
    let actualDescriptorReads = 0;

    try {
      correlate({ kubernetes: evidence });
      actualDescriptorReads = descriptorReads.mock.calls.filter(([value]) => value === pod).length;
    } finally {
      descriptorReads.mockRestore();
    }

    expect(actualDescriptorReads).toBe(expectedDescriptorReads);
  });

  it("does not invoke a throwing top-level correlation accessor", () => {
    const secret = "top-level-getter-secret";
    let getterCalls = 0;
    const hostile = Object.defineProperties(
      {},
      {
        workflow: { enumerable: true, value: workflow() },
        application: { enumerable: true, value: application() },
        kubernetes: {
          enumerable: true,
          get() {
            getterCalls += 1;
            throw new Error(secret);
          },
        },
        observedAt: { enumerable: true, value: "2026-08-04T12:02:00Z" },
      },
    );
    let result: ReturnType<typeof correlateDeployment> | undefined;

    expect(() => {
      result = correlateDeployment(hostile as Parameters<typeof correlateDeployment>[0]);
    }).not.toThrow();

    expect(getterCalls).toBe(0);
    expectInvalidKubernetesEvidence(result!, secret);
  });

  it.each([
    {
      name: "workflow accessor",
      input: () => {
        const secret = "nested-source-getter-secret";
        let getterCalls = 0;
        const value = Object.defineProperty({ ...workflow() }, "status", {
          enumerable: true,
          get() {
            getterCalls += 1;
            throw new Error(secret);
          },
        });
        return { workflow: value, application: application(), getterCalls: () => getterCalls };
      },
      stage: "workflow" as const,
    },
    {
      name: "Argo application accessor",
      input: () => {
        const secret = "nested-source-getter-secret";
        let getterCalls = 0;
        const value = Object.defineProperty({ ...application() }, "images", {
          enumerable: true,
          get() {
            getterCalls += 1;
            throw new Error(secret);
          },
        });
        return { workflow: workflow(), application: value, getterCalls: () => getterCalls };
      },
      stage: "argo" as const,
    },
  ])("does not invoke a hostile $name", ({ input, stage }) => {
    const hostile = input();
    let result: ReturnType<typeof correlateDeployment> | undefined;

    expect(() => {
      result = correlateDeployment({
        workflow: hostile.workflow,
        application: hostile.application,
        kubernetes: kubernetes(),
        observedAt: "2026-08-04T12:02:00Z",
      });
    }).not.toThrow();

    expect(hostile.getterCalls()).toBe(0);
    expect(result?.status).toBe("unknown");
    expect(result?.[stage].status).toBe("unknown");
    expect(result?.issues.some(({ status }) => status === "critical")).toBe(false);
    expect(JSON.stringify(result)).not.toContain("nested-source-getter-secret");
  });

  it.each([
    {
      name: "inherited-only collections",
      evidence: () => Object.create(kubernetes()) as unknown,
    },
    {
      name: "a custom object prototype",
      evidence: () => Object.assign(Object.create({ custom: true }), kubernetes()) as unknown,
    },
    {
      name: "a sparse workload array",
      evidence: () => {
        const valid = kubernetes();
        return { ...valid, workloads: withLeadingHole(valid.workloads) };
      },
    },
    {
      name: "a sparse pod array",
      evidence: () => {
        const valid = kubernetes();
        return { ...valid, pods: withLeadingHole(valid.pods) };
      },
    },
    {
      name: "a sparse container-image array",
      evidence: () => {
        const valid = kubernetes();
        const apiPod = valid.pods[0]!;
        return {
          ...valid,
          pods: [
            { ...apiPod, containerImages: withLeadingHole(apiPod.containerImages) },
            ...valid.pods.slice(1),
          ],
        };
      },
    },
    {
      name: "a proxy that throws during prototype introspection",
      evidence: () =>
        new Proxy(kubernetes(), {
          getPrototypeOf() {
            throw new Error("proxy-introspection-secret");
          },
        }),
    },
    {
      name: "a proxy that throws during descriptor introspection",
      evidence: () =>
        new Proxy(kubernetes(), {
          getOwnPropertyDescriptor() {
            throw new Error("proxy-introspection-secret");
          },
        }),
    },
  ])("rejects $name as fixed Unknown Kubernetes evidence", ({ evidence }) => {
    let result: ReturnType<typeof correlateDeployment> | undefined;

    expect(() => {
      result = correlateDeployment({
        workflow: workflow(),
        application: application(),
        kubernetes: evidence() as ReturnType<typeof kubernetes>,
        observedAt: "2026-08-04T12:02:00Z",
      });
    }).not.toThrow();

    expectInvalidKubernetesEvidence(result!, "proxy-introspection-secret");
  });

  it("accepts valid null-prototype Kubernetes evidence without mutating it", () => {
    const valid = kubernetes();
    const evidence = Object.assign(Object.create(null), valid) as ReturnType<typeof kubernetes>;
    const workloads = evidence.workloads;
    const pods = evidence.pods;

    const result = correlate({ kubernetes: evidence });

    expect(result.status).toBe("healthy");
    expect(evidence.workloads).toBe(workloads);
    expect(evidence.pods).toBe(pods);
  });

  it.each([
    { name: "missing", containerImages: undefined },
    { name: "non-array", containerImages: { legacyImage: `${API_REPOSITORY}:${SOURCE_SHA}` } },
    { name: "an invalid entry", containerImages: [{ name: "api", repository: 42 }] },
  ])(
    "preserves Round 2 Unknown evidence when pod containerImages is $name",
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
      desiredReplicas: 1,
      availableReplicas: 0,
    });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "deployment-unavailable",
          status: "critical",
          resource: "Deployment/yootoob-mp3-frontend",
          evidence: { desiredReplicas: 1, availableReplicas: 0 },
        }),
      ]),
    );
  });

  it.each([
    {
      name: "zero available replicas",
      desiredReplicas: 1,
      availableReplicas: 0,
      status: "critical",
    },
    { name: "one replica", desiredReplicas: 1, availableReplicas: 1, status: "healthy" },
    {
      name: "partially available larger replica count",
      desiredReplicas: 3,
      availableReplicas: 2,
      status: "warning",
    },
  ] as const)(
    "retains $status correlation behavior for $name",
    ({ desiredReplicas, availableReplicas, status }) => {
      const evidence = kubernetes();
      evidence.workloads[0] = {
        ...evidence.workloads[0],
        desiredReplicas,
        availableReplicas,
      };
      evidence.pods[0] = { ...evidence.pods[0], ready: availableReplicas > 0 };

      const result = correlate({ kubernetes: evidence });

      expect(result.status).toBe(status);
      expect(result.workloads[0]).toMatchObject({
        status,
        desiredReplicas,
        availableReplicas,
      });
    },
  );
});
