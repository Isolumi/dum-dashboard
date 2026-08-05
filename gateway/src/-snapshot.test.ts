import { describe, expect, it } from "vitest";
import type { ClusterData, DeploymentSnapshot } from "../../shared/homelab/contracts";
import type { ArgoApplicationState } from "./providers/argocd";
import type { WorkflowRun } from "./providers/github";
import type { Provider } from "./providers/provider";
import { collectDeploymentSnapshot, collectProviders, collectServiceSnapshot } from "./snapshot";

const now = () => new Date("2026-08-04T00:00:00.000Z");
const SOURCE_SHA = "1829d6ba3b55e66a2134ae64161b9e48ad39a197";
const API_REPOSITORY = "ghcr.io/isolumi/yootoob-mp3-api";
const FRONTEND_REPOSITORY = "ghcr.io/isolumi/yootoob-mp3-frontend";
const invalidReplicaValues = [-1, -0.5, 0.5, 1.5, Number.NaN, Infinity, "1", null];

function validWorkflow(): WorkflowRun {
  return {
    repository: "Isolumi/youtube-mp3",
    branch: "development",
    name: "Build and publish images",
    status: "completed",
    conclusion: "success",
    commit: {
      sha: SOURCE_SHA,
      message: "Build production images",
      author: "Isolumi",
      committedAt: "2026-08-03T23:58:00.000Z",
      url: `https://github.com/Isolumi/youtube-mp3/commit/${SOURCE_SHA}`,
    },
    startedAt: "2026-08-03T23:58:00.000Z",
    completedAt: "2026-08-04T00:00:00.000Z",
    durationMs: 120_000,
    url: "https://github.com/Isolumi/youtube-mp3/actions/runs/987654321",
  };
}

function validApplication(): ArgoApplicationState {
  return {
    name: "yootoob-mp3-dumachine",
    namespace: "argocd",
    sync: { status: "Synced", revision: "feedfacefeedfacefeedfacefeedfacefeedface" },
    health: {
      status: "Healthy",
      message: "Application is healthy",
      lastTransitionAt: "2026-08-04T00:00:00.000Z",
    },
    operation: {
      phase: "Succeeded",
      message: "successfully synced",
      revision: "feedfacefeedfacefeedfacefeedfacefeedface",
      startedAt: "2026-08-03T23:59:00.000Z",
      finishedAt: "2026-08-04T00:00:00.000Z",
    },
    resources: [],
    images: [`${API_REPOSITORY}:${SOURCE_SHA}`, `${FRONTEND_REPOSITORY}:${SOURCE_SHA}`],
  };
}

function validCluster(): ClusterData {
  const workload = (name: string) => ({
    kind: "Deployment",
    name,
    namespace: "yootoob-mp3",
    status: "healthy" as const,
    desiredReplicas: 1,
    availableReplicas: 1,
    failureReason: null,
    restartIncrease15m: false,
  });
  const pod = (name: "api" | "frontend", repository: string, digestCharacter: string) => ({
    name: `yootoob-mp3-${name}-abc`,
    namespace: "yootoob-mp3",
    status: "healthy" as const,
    ready: true,
    restartCount: 0,
    node: "dumachine",
    image: `${repository}@sha256:${digestCharacter.repeat(64)}`,
    imageTag: `${repository}:${SOURCE_SHA}`,
    imageDigest: `sha256:${digestCharacter.repeat(64)}`,
    containerImages: [
      {
        name,
        repository,
        reference: `${repository}:${SOURCE_SHA}`,
        tag: SOURCE_SHA,
        digest: `sha256:${digestCharacter.repeat(64)}`,
      },
    ],
    createdAt: "2026-08-03T23:59:30.000Z",
  });

  return {
    nodes: [],
    namespaces: [],
    workloads: [workload("yootoob-mp3-api"), workload("yootoob-mp3-frontend")],
    pods: [pod("api", API_REPOSITORY, "a"), pod("frontend", FRONTEND_REPOSITORY, "b")],
    events: [],
    resources: { current: [], history: [] },
  };
}

function deploymentProviders(
  cluster: unknown,
  application: ArgoApplicationState = validApplication(),
): Provider<unknown>[] {
  return [
    { source: "github", collect: async () => validWorkflow() },
    { source: "argocd", collect: async () => application },
    { source: "kubernetes", collect: async () => cluster },
  ];
}

function withLeadingHole<T>(values: readonly T[]): T[] {
  const sparse: T[] = [];
  sparse.length = values.length + 1;
  for (let index = 0; index < values.length; index += 1) sparse[index + 1] = values[index]!;
  return sparse;
}

async function expectInvalidClusterResult(cluster: unknown, secret?: string) {
  const snapshot = await collectDeploymentSnapshot(deploymentProviders(cluster), 1_000, now);

  expect(snapshot).toMatchObject({
    status: "unknown",
    stale: true,
    data: { applications: [{ rollout: { status: "unknown" } }] },
    sources: [
      { source: "github", status: "healthy", stale: false },
      { source: "argocd", status: "healthy", stale: false },
      {
        source: "kubernetes",
        status: "unknown",
        stale: true,
        error: "Kubernetes unavailable",
      },
    ],
  });
  expect(snapshot.issues.some(({ status }) => status === "critical")).toBe(false);
  if (secret) expect(JSON.stringify(snapshot)).not.toContain(secret);
}

describe("collectProviders", () => {
  it("returns successful provider data when another provider fails", async () => {
    const providers: Provider<{ value: string }>[] = [
      {
        source: "kubernetes",
        collect: async () => ({ value: "cluster data" }),
      },
      {
        source: "github",
        collect: async () => {
          throw new Error("token=secret GitHub API unavailable");
        },
      },
    ];

    const results = await collectProviders(providers, 1_000, now);

    expect(results).toMatchObject([
      {
        source: "kubernetes",
        ok: true,
        data: { value: "cluster data" },
        state: {
          source: "kubernetes",
          status: "healthy",
          observedAt: "2026-08-04T00:00:00.000Z",
          stale: false,
        },
      },
      {
        source: "github",
        ok: false,
        error: "GitHub unavailable",
        state: {
          source: "github",
          status: "unknown",
          observedAt: "2026-08-04T00:00:00.000Z",
          stale: true,
          error: "GitHub unavailable",
        },
      },
    ]);
  });

  it("times out one provider without cancelling another provider", async () => {
    let timedOutSignal: AbortSignal | undefined;
    const providers: Provider<{ value: string }>[] = [
      {
        source: "prometheus",
        collect: async () => ({ value: "metrics" }),
      },
      {
        source: "github",
        collect: (signal) =>
          new Promise((_, reject) => {
            timedOutSignal = signal;
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          }),
      },
    ];

    const results = await collectProviders(providers, 5, now);

    expect(timedOutSignal?.aborted).toBe(true);
    expect(results).toMatchObject([
      { source: "prometheus", ok: true, data: { value: "metrics" } },
      { source: "github", ok: false, error: "GitHub unavailable" },
    ]);
  });
});

describe("collectServiceSnapshot", () => {
  const validServiceProbeResult = () => ({
    entry: {
      id: "yootoob-mp3",
      name: "yootoob-mp3",
      description: "Private YouTube MP3 downloader",
      url: "https://yootoob.doh.lumilumi.xyz",
      namespace: "yootoob-mp3",
      argoApplication: "yootoob-mp3-dumachine",
      workloads: [{ kind: "Deployment", name: "yootoob-mp3-api" }],
    },
    id: "yootoob-mp3",
    reachable: true,
    status: "healthy",
    latencyMs: 42,
    certificateExpiresAt: "2026-09-01T00:00:00.000Z",
    consecutiveFailures: 0,
  });

  it("contains malformed service probe results as an unknown stale source", async () => {
    const snapshot = await collectServiceSnapshot(
      [
        {
          source: "service-probe",
          collect: async () => [{ id: "service", credential: "private-value" }],
        },
      ],
      1_000,
      now,
    );

    expect(snapshot).toMatchObject({
      data: null,
      status: "unknown",
      stale: true,
      sources: [
        {
          source: "service-probe",
          status: "unknown",
          stale: true,
          error: "Service probe unavailable",
        },
      ],
    });
    expect(JSON.stringify(snapshot)).not.toContain("private-value");
  });

  it("contains a malformed optional service probe field without exposing it", async () => {
    const snapshot = await collectServiceSnapshot(
      [
        {
          source: "service-probe",
          collect: async () => [
            { ...validServiceProbeResult(), error: { credential: "private-value" } },
          ],
        },
      ],
      1_000,
      now,
    );

    expect(snapshot).toMatchObject({
      data: null,
      status: "unknown",
      stale: true,
      sources: [
        {
          source: "service-probe",
          status: "unknown",
          stale: true,
          error: "Service probe unavailable",
        },
      ],
    });
    expect(JSON.stringify(snapshot)).not.toContain("private-value");
  });
});

describe("collectDeploymentSnapshot", () => {
  it.each([
    { name: "plain-object ClusterData", cluster: () => validCluster() },
    {
      name: "null-prototype ClusterData",
      cluster: () => Object.assign(Object.create(null), validCluster()),
    },
  ])("accepts valid $name", async ({ cluster }) => {
    const value = cluster();
    const snapshot = await collectDeploymentSnapshot(deploymentProviders(value), 1_000, now);

    expect(snapshot).toMatchObject({
      status: "healthy",
      stale: false,
      data: { applications: [{ rollout: { status: "healthy" } }] },
      sources: [
        { source: "github", status: "healthy", stale: false },
        { source: "argocd", status: "healthy", stale: false },
        { source: "kubernetes", status: "healthy", stale: false },
      ],
    });
  });

  it("downgrades a successful Argo source with a whitespace-only revision", async () => {
    const application = validApplication();
    application.sync.revision = "   ";

    const snapshot = await collectDeploymentSnapshot(
      deploymentProviders(validCluster(), application),
      1_000,
      now,
    );

    expect(snapshot.status).toBe("unknown");
    expect(snapshot.sources).toContainEqual(
      expect.objectContaining({ source: "argocd", status: "unknown" }),
    );
    expect(snapshot.data?.applications[0]?.argoRevision ?? null).toBeNull();
  });

  it.each([
    { name: "at the node limit", count: 64, expectedStatus: "healthy" },
    { name: "at node limit plus one", count: 65, expectedStatus: "unknown" },
  ])("bounds the node collection $name", async ({ count, expectedStatus }) => {
    const cluster = validCluster();
    cluster.nodes = Array.from({ length: count }, (_, index) => ({
      name: `node-${index}`,
      ready: true,
      status: "healthy",
      conditions: [],
    }));

    const snapshot = await collectDeploymentSnapshot(deploymentProviders(cluster), 1_000, now);

    expect(snapshot.sources[2]).toMatchObject({
      source: "kubernetes",
      status: expectedStatus,
      stale: expectedStatus === "unknown",
    });
  });

  it.each([
    {
      name: "namespaces",
      mutate: (cluster: ClusterData) => {
        cluster.namespaces = Array.from({ length: 257 }, (_, index) => ({
          name: `namespace-${index}`,
          status: "healthy",
          workloadCount: 0,
          podCount: 0,
        }));
      },
    },
    {
      name: "workloads",
      mutate: (cluster: ClusterData) => {
        cluster.workloads = Array.from({ length: 513 }, (_, index) => ({
          ...cluster.workloads[0]!,
          name: `workload-${index}`,
        }));
      },
    },
    {
      name: "pods",
      mutate: (cluster: ClusterData) => {
        cluster.pods = Array.from({ length: 1_025 }, (_, index) => ({
          ...cluster.pods[0]!,
          name: `pod-${index}`,
        }));
      },
    },
    {
      name: "containerImages",
      mutate: (cluster: ClusterData) => {
        cluster.pods[0]!.containerImages = Array.from({ length: 33 }, (_, index) => ({
          ...cluster.pods[0]!.containerImages[0]!,
          name: `container-${index}`,
        }));
      },
    },
    {
      name: "events",
      mutate: (cluster: ClusterData) => {
        cluster.events = Array.from({ length: 2_049 }, (_, index) => ({
          id: `event-${index}`,
          namespace: "yootoob-mp3",
          resource: `Pod/pod-${index}`,
          status: "warning",
          reason: "Warning",
          message: "bounded warning",
          observedAt: "2026-08-04T00:00:00.000Z",
        }));
      },
    },
  ])("rejects the $name collection at max plus one", async ({ mutate }) => {
    const cluster = validCluster();
    mutate(cluster);

    await expectInvalidClusterResult(cluster);
  });

  it("keeps valid zero-replica ClusterData Critical instead of rejecting it", async () => {
    const cluster = validCluster();
    cluster.workloads[1] = {
      ...cluster.workloads[1]!,
      status: "critical",
      availableReplicas: 0,
    };
    cluster.pods[1] = { ...cluster.pods[1]!, status: "critical", ready: false };

    const snapshot = await collectDeploymentSnapshot(deploymentProviders(cluster), 1_000, now);

    expect(snapshot.status).toBe("critical");
    expect(snapshot.sources[2]).toMatchObject({
      source: "kubernetes",
      status: "healthy",
      stale: false,
    });
    expect(snapshot.data?.applications[0]?.workloads[1]).toMatchObject({
      name: "yootoob-mp3-frontend",
      status: "critical",
      desiredReplicas: 1,
      availableReplicas: 0,
    });
  });

  it.each(
    (["desiredReplicas", "availableReplicas"] as const).flatMap((field) =>
      invalidReplicaValues.map((value) => ({ field, value })),
    ),
  )("rejects an invalid $field value from the Kubernetes source", async ({ field, value }) => {
    const cluster = validCluster();
    (cluster.workloads[0] as unknown as Record<typeof field, unknown>)[field] = value;

    const snapshot = await collectDeploymentSnapshot(deploymentProviders(cluster), 1_000, now);

    expect(snapshot.status).toBe("unknown");
    expect(snapshot.sources).toContainEqual(
      expect.objectContaining({ source: "kubernetes", status: "unknown" }),
    );
    expect(snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "deployment-workload-unavailable",
          status: "unknown",
          reason: "Deployment evidence for yootoob-mp3-api is unavailable.",
          evidence: { desiredReplicas: null, availableReplicas: null },
        }),
      ]),
    );
  });

  it("does not invoke a throwing ClusterData field accessor", async () => {
    const secret = "cluster-getter-secret-stack";
    const cluster = validCluster();
    let getterCalls = 0;
    Object.defineProperty(cluster.workloads[0]!, "name", {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error(secret);
      },
    });

    await expectInvalidClusterResult(cluster, secret);

    expect(getterCalls).toBe(0);
  });

  it.each([
    {
      name: "inherited-only ClusterData fields",
      cluster: () => Object.create(validCluster()) as unknown,
    },
    {
      name: "a custom ClusterData prototype",
      cluster: () => Object.assign(Object.create({ custom: true }), validCluster()) as unknown,
    },
    {
      name: "a sparse workload array",
      cluster: () => {
        const valid = validCluster();
        return { ...valid, workloads: withLeadingHole(valid.workloads) };
      },
    },
    {
      name: "a sparse pod array",
      cluster: () => {
        const valid = validCluster();
        return { ...valid, pods: withLeadingHole(valid.pods) };
      },
    },
    {
      name: "a sparse container-image array",
      cluster: () => {
        const valid = validCluster();
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
      name: "a proxy with a throwing getPrototypeOf trap",
      cluster: () =>
        new Proxy(validCluster(), {
          getPrototypeOf() {
            throw new Error("cluster-proxy-secret");
          },
        }),
    },
    {
      name: "a proxy with a throwing property-descriptor trap",
      cluster: () =>
        new Proxy(validCluster(), {
          getOwnPropertyDescriptor() {
            throw new Error("cluster-proxy-secret");
          },
        }),
    },
  ])("downgrades $name to fixed partial-source evidence", async ({ cluster }) => {
    await expectInvalidClusterResult(cluster(), "cluster-proxy-secret");
  });

  it("preserves Argo and Kubernetes deployment evidence when GitHub is unavailable", async () => {
    const application: ArgoApplicationState = {
      name: "yootoob-mp3-dumachine",
      namespace: "argocd",
      sync: { status: "Synced", revision: "feedfacefeedfacefeedfacefeedfacefeedface" },
      health: {
        status: "Healthy",
        message: "Application is healthy",
        lastTransitionAt: "2026-08-04T00:00:00.000Z",
      },
      operation: {
        phase: "Succeeded",
        message: "successfully synced",
        revision: "feedfacefeedfacefeedfacefeedfacefeedface",
        startedAt: "2026-08-03T23:59:00.000Z",
        finishedAt: "2026-08-04T00:00:00.000Z",
      },
      resources: [],
      images: [
        "ghcr.io/isolumi/yootoob-mp3-api:1829d6ba3b55e66a2134ae64161b9e48ad39a197",
        "ghcr.io/isolumi/yootoob-mp3-frontend:1829d6ba3b55e66a2134ae64161b9e48ad39a197",
      ],
    };
    const cluster: ClusterData = {
      nodes: [],
      namespaces: [],
      events: [],
      resources: { current: [], history: [] },
      workloads: [
        {
          kind: "Deployment",
          name: "yootoob-mp3-api",
          namespace: "yootoob-mp3",
          status: "healthy",
          desiredReplicas: 1,
          availableReplicas: 1,
          failureReason: null,
          restartIncrease15m: false,
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
        },
      ],
      pods: [
        {
          name: "yootoob-mp3-api-abc",
          namespace: "yootoob-mp3",
          status: "healthy",
          ready: true,
          restartCount: 0,
          node: "dumachine",
          image:
            "ghcr.io/isolumi/yootoob-mp3-api@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          imageTag: "ghcr.io/isolumi/yootoob-mp3-api:1829d6ba3b55e66a2134ae64161b9e48ad39a197",
          imageDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          containerImages: [
            {
              name: "api",
              repository: "ghcr.io/isolumi/yootoob-mp3-api",
              reference: "ghcr.io/isolumi/yootoob-mp3-api:1829d6ba3b55e66a2134ae64161b9e48ad39a197",
              tag: "1829d6ba3b55e66a2134ae64161b9e48ad39a197",
              digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            },
          ],
          createdAt: "2026-08-03T23:59:30.000Z",
        },
        {
          name: "yootoob-mp3-frontend-abc",
          namespace: "yootoob-mp3",
          status: "healthy",
          ready: true,
          restartCount: 0,
          node: "dumachine",
          image:
            "ghcr.io/isolumi/yootoob-mp3-frontend@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          imageTag: "ghcr.io/isolumi/yootoob-mp3-frontend:1829d6ba3b55e66a2134ae64161b9e48ad39a197",
          imageDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          containerImages: [
            {
              name: "frontend",
              repository: "ghcr.io/isolumi/yootoob-mp3-frontend",
              reference:
                "ghcr.io/isolumi/yootoob-mp3-frontend:1829d6ba3b55e66a2134ae64161b9e48ad39a197",
              tag: "1829d6ba3b55e66a2134ae64161b9e48ad39a197",
              digest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            },
          ],
          createdAt: "2026-08-03T23:59:30.000Z",
        },
      ],
    };
    const providers: Provider<unknown>[] = [
      {
        source: "github",
        collect: async () => {
          throw new Error("GitHub is not configured");
        },
      },
      { source: "argocd", collect: async () => application },
      { source: "kubernetes", collect: async () => cluster },
    ];

    const snapshot: DeploymentSnapshot = await collectDeploymentSnapshot(providers, 1_000, now);

    expect(snapshot).toMatchObject({
      status: "unknown",
      stale: true,
      data: {
        applications: [
          {
            application: "yootoob-mp3-dumachine",
            workflow: { status: "unknown" },
            argo: { status: "healthy" },
            rollout: { status: "healthy" },
          },
        ],
      },
      sources: [
        { source: "github", status: "unknown", stale: true, error: "GitHub unavailable" },
        { source: "argocd", status: "healthy", stale: false },
        { source: "kubernetes", status: "healthy", stale: false },
      ],
    });
    expect(snapshot.data?.applications[0]?.workloads).toHaveLength(2);
    expect(snapshot.data?.applications[0]?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "deployment-workflow-unavailable",
          source: "github",
        }),
      ]),
    );
  });

  it("downgrades malformed successful GitHub and Argo payloads to partial source failures", async () => {
    const cluster: ClusterData = {
      nodes: [],
      namespaces: [],
      events: [],
      resources: { current: [], history: [] },
      workloads: [
        {
          kind: "Deployment",
          name: "yootoob-mp3-api",
          namespace: "yootoob-mp3",
          status: "healthy",
          desiredReplicas: 1,
          availableReplicas: 1,
          failureReason: null,
          restartIncrease15m: false,
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
        },
      ],
      pods: [],
    };
    const providers: Provider<unknown>[] = [
      { source: "github", collect: async () => ({ status: "completed", commit: null }) },
      { source: "argocd", collect: async () => ({ health: { status: "Healthy" } }) },
      { source: "kubernetes", collect: async () => cluster },
    ];

    const snapshot = await collectDeploymentSnapshot(providers, 1_000, now);

    expect(snapshot.status).toBe("unknown");
    expect(snapshot.data?.applications).toHaveLength(1);
    expect(snapshot.sources).toEqual([
      expect.objectContaining({
        source: "github",
        status: "unknown",
        stale: true,
        error: "GitHub unavailable",
      }),
      expect.objectContaining({
        source: "argocd",
        status: "unknown",
        stale: true,
        error: "Argo CD unavailable",
      }),
      expect.objectContaining({ source: "kubernetes", status: "healthy", stale: false }),
    ]);
  });

  it.each([
    { name: "missing containerImages", containerImages: undefined },
    { name: "a malformed containerImages entry", containerImages: [{ name: "api" }] },
  ])("downgrades mixed legacy Kubernetes pods with $name", async ({ containerImages }) => {
    const sourceSha = "1829d6ba3b55e66a2134ae64161b9e48ad39a197";
    const workflow = {
      repository: "Isolumi/youtube-mp3",
      branch: "development",
      name: "Build and publish images",
      status: "completed",
      conclusion: "success",
      commit: {
        sha: sourceSha,
        message: "Build production images",
        author: "Isolumi",
        committedAt: "2026-08-04T11:58:00Z",
        url: `https://github.com/Isolumi/youtube-mp3/commit/${sourceSha}`,
      },
      startedAt: "2026-08-04T11:58:00Z",
      completedAt: "2026-08-04T12:00:30Z",
      durationMs: 150_000,
      url: "https://github.com/Isolumi/youtube-mp3/actions/runs/987654321",
    };
    const legacyPod = {
      name: "yootoob-mp3-api-legacy",
      namespace: "yootoob-mp3",
      status: "healthy",
      ready: true,
      restartCount: 0,
      node: "dumachine",
      image: `ghcr.io/isolumi/yootoob-mp3-api@sha256:${"a".repeat(64)}`,
      imageTag: `ghcr.io/isolumi/yootoob-mp3-api:${sourceSha}`,
      imageDigest: `sha256:${"a".repeat(64)}`,
      createdAt: "2026-08-04T11:59:00Z",
      rawPayload: "credential=private stack=/secret/provider.ts:42",
      ...(containerImages === undefined ? {} : { containerImages }),
    };
    const malformedCluster = {
      nodes: [],
      namespaces: [],
      events: [],
      resources: { current: [], history: [] },
      workloads: [
        {
          kind: "Deployment",
          name: "yootoob-mp3-api",
          namespace: "yootoob-mp3",
          status: "healthy",
          desiredReplicas: 1,
          availableReplicas: 1,
          failureReason: null,
          restartIncrease15m: false,
        },
      ],
      pods: [
        legacyPod,
        {
          name: "yootoob-mp3-frontend-current",
          namespace: "yootoob-mp3",
          status: "healthy",
          ready: true,
          restartCount: 0,
          node: "dumachine",
          image: null,
          imageTag: null,
          imageDigest: null,
          containerImages: [],
          createdAt: "2026-08-04T11:59:00Z",
        },
      ],
    };
    const providers: Provider<unknown>[] = [
      { source: "github", collect: async () => workflow },
      { source: "kubernetes", collect: async () => malformedCluster },
    ];

    const snapshot = await collectDeploymentSnapshot(providers, 1_000, now);

    expect(snapshot).toMatchObject({
      status: "unknown",
      stale: true,
      data: {
        applications: [
          {
            workflow: { status: "healthy" },
            rollout: { status: "unknown" },
          },
        ],
      },
      sources: [
        { source: "github", status: "healthy", stale: false },
        {
          source: "kubernetes",
          status: "unknown",
          stale: true,
          error: "Kubernetes unavailable",
        },
      ],
    });
    expect(snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "deployment-workload-unavailable",
          status: "unknown",
          source: "kubernetes",
        }),
      ]),
    );
    expect(JSON.stringify(snapshot)).not.toContain("credential=private");
    expect(JSON.stringify(snapshot)).not.toContain("/secret/provider.ts");
  });

  it("retains only a safe target diagnostic when containerImages is unavailable", async () => {
    const cluster = validCluster();
    delete (cluster.pods[0] as Partial<(typeof cluster.pods)[number]>).containerImages;

    const snapshot = await collectDeploymentSnapshot(deploymentProviders(cluster), 1_000, now);

    expect(snapshot.sources[2]).toMatchObject({
      source: "kubernetes",
      status: "unknown",
      stale: true,
      error: "Kubernetes unavailable",
    });
    expect(snapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "deployment-container-images-unavailable",
          status: "unknown",
          source: "kubernetes",
          resource: "Deployment/yootoob-mp3-api",
        }),
      ]),
    );
  });
});
