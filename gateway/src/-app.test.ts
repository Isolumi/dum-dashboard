import { describe, expect, it } from "vitest";
import { createGateway } from "./app";

const SOURCE_SHA = "1829d6ba3b55e66a2134ae64161b9e48ad39a197";
const API_REPOSITORY = "ghcr.io/isolumi/yootoob-mp3-api";
const FRONTEND_REPOSITORY = "ghcr.io/isolumi/yootoob-mp3-frontend";
const invalidReplicaValues = [-1, -0.5, 0.5, 1.5, Number.NaN, Infinity, "1", null];
const SECRET_REPLICA_MARKER = "SECRET_REPLICA_MARKER";

function validWorkflowSource() {
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
      committedAt: "2026-08-04T11:58:00Z",
      url: `https://github.com/Isolumi/youtube-mp3/commit/${SOURCE_SHA}`,
    },
    startedAt: "2026-08-04T11:58:00Z",
    completedAt: "2026-08-04T12:00:30Z",
    durationMs: 150_000,
    url: "https://github.com/Isolumi/youtube-mp3/actions/runs/987654321",
  };
}

function validArgoSource() {
  return {
    name: "yootoob-mp3-dumachine",
    namespace: "argocd",
    sync: { status: "Synced", revision: "feedfacefeedfacefeedfacefeedfacefeedface" },
    health: {
      status: "Healthy",
      message: "Application is healthy",
      lastTransitionAt: "2026-08-04T12:01:00Z",
    },
    operation: {
      phase: "Succeeded",
      message: "successfully synced",
      revision: "feedfacefeedfacefeedfacefeedfacefeedface",
      startedAt: "2026-08-04T12:00:00Z",
      finishedAt: "2026-08-04T12:01:00Z",
    },
    resources: [],
    images: [`${API_REPOSITORY}:${SOURCE_SHA}`, `${FRONTEND_REPOSITORY}:${SOURCE_SHA}`],
  };
}

function validArgoResource(index: number) {
  return {
    group: "apps",
    version: "v1",
    kind: "Deployment",
    namespace: "yootoob-mp3",
    name: `resource-${index}`,
    syncStatus: "Synced",
    healthStatus: "Healthy",
    healthMessage: null,
  };
}

function withLeadingHole<T>(values: readonly T[]): T[] {
  const sparse: T[] = [];
  sparse.length = values.length + 1;
  for (let index = 0; index < values.length; index += 1) sparse[index + 1] = values[index]!;
  return sparse;
}

function validClusterSource() {
  const workload = (name: string) => ({
    kind: "Deployment",
    name,
    namespace: "yootoob-mp3",
    status: "healthy",
    desiredReplicas: 1,
    availableReplicas: 1,
    failureReason: null,
    restartIncrease15m: false,
  });
  const pod = (name: "api" | "frontend", repository: string) => ({
    name: `yootoob-mp3-${name}-abc`,
    namespace: "yootoob-mp3",
    status: "healthy",
    ready: true,
    restartCount: 0,
    node: "dumachine",
    image: `${repository}:${SOURCE_SHA}`,
    imageTag: `${repository}:${SOURCE_SHA}`,
    imageDigest: `sha256:${name === "api" ? "a".repeat(64) : "b".repeat(64)}`,
    containerImages: [
      {
        name,
        repository,
        reference: `${repository}:${SOURCE_SHA}`,
        tag: SOURCE_SHA,
        digest: `sha256:${name === "api" ? "a".repeat(64) : "b".repeat(64)}`,
      },
    ],
    createdAt: "2026-08-04T11:59:00Z",
  });

  return {
    nodes: [],
    namespaces: [],
    workloads: [workload("yootoob-mp3-api"), workload("yootoob-mp3-frontend")],
    pods: [pod("api", API_REPOSITORY), pod("frontend", FRONTEND_REPOSITORY)],
    events: [],
    resources: { current: [], history: [] },
  };
}

type DeploymentSource = "github" | "argocd" | "kubernetes";

function hostileDeploymentApp(source: DeploymentSource, value: unknown) {
  const values: Record<DeploymentSource, unknown> = {
    github: validWorkflowSource(),
    argocd: validArgoSource(),
    kubernetes: validClusterSource(),
  };
  values[source] = value;

  return createGateway({
    now: () => new Date("2026-08-04T12:02:00.000Z"),
    providers: {
      deployments: (["github", "argocd", "kubernetes"] as const).map((providerSource) => ({
        source: providerSource,
        collect: async () => values[providerSource],
      })),
    },
  });
}

describe("gateway routes", () => {
  it("reports process health without contacting providers", async () => {
    let calls = 0;
    const app = createGateway({
      providers: {
        overview: [
          {
            source: "kubernetes",
            collect: async () => {
              calls += 1;
              return { ignored: true };
            },
          },
        ],
      },
    });

    const response = await app.request("/healthz");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
    expect(calls).toBe(0);
  });

  it("returns a partial snapshot from the overview aggregator", async () => {
    const app = createGateway({
      now: () => new Date("2026-08-04T00:00:00.000Z"),
      providers: {
        overview: [
          { source: "kubernetes", collect: async () => ({ value: "cluster" }) },
          {
            source: "github",
            collect: async () => {
              throw new Error("credential=private");
            },
          },
        ],
      },
    });

    const response = await app.request("/overview");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [{ value: "cluster" }],
      status: "unknown",
      stale: true,
      issues: [],
      sources: [
        { source: "kubernetes", status: "healthy", stale: false },
        {
          source: "github",
          status: "unknown",
          stale: true,
          error: "GitHub unavailable",
        },
      ],
    });
  });

  it("returns a safe partial deployment snapshot for a legacy Kubernetes pod", async () => {
    const sourceSha = "1829d6ba3b55e66a2134ae64161b9e48ad39a197";
    const app = createGateway({
      now: () => new Date("2026-08-04T12:02:00.000Z"),
      providers: {
        deployments: [
          {
            source: "github",
            collect: async () => ({
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
            }),
          },
          {
            source: "kubernetes",
            collect: async () => ({
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
                {
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
                },
              ],
            }),
          },
        ],
      },
    });

    const response = await app.request("/deployments");
    const responseBody = await response.text();

    expect(response.status).toBe(200);
    expect(responseBody).not.toContain("credential=private");
    expect(responseBody).not.toContain("/secret/provider.ts");
    expect(JSON.parse(responseBody)).toMatchObject({
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
  });

  it.each([
    {
      name: "a WorkflowRun accessor",
      source: "github" as const,
      create: () => {
        let calls = 0;
        const value = Object.defineProperty(validWorkflowSource(), "status", {
          get() {
            calls += 1;
            throw new Error("workflow-getter-secret");
          },
        });
        return { value, calls: () => calls };
      },
    },
    {
      name: "an Argo accessor",
      source: "argocd" as const,
      create: () => {
        let calls = 0;
        const value = Object.defineProperty(validArgoSource(), "images", {
          get() {
            calls += 1;
            throw new Error("argo-getter-secret");
          },
        });
        return { value, calls: () => calls };
      },
    },
    {
      name: "a transparent WorkflowRun proxy",
      source: "github" as const,
      create: () => ({ value: new Proxy(validWorkflowSource(), {}), calls: () => 0 }),
    },
    {
      name: "a transparent Argo proxy",
      source: "argocd" as const,
      create: () => ({ value: new Proxy(validArgoSource(), {}), calls: () => 0 }),
    },
    {
      name: "a transparent ClusterData proxy",
      source: "kubernetes" as const,
      create: () => ({ value: new Proxy(validClusterSource(), {}), calls: () => 0 }),
    },
    {
      name: "an unknown WorkflowRun accessor",
      source: "github" as const,
      create: () => {
        let calls = 0;
        const value = Object.defineProperty(validWorkflowSource(), "unknown", {
          get() {
            calls += 1;
            throw new Error("workflow-extra-getter-secret");
          },
        });
        return { value, calls: () => calls };
      },
    },
    {
      name: "a sparse Argo image array",
      source: "argocd" as const,
      create: () => {
        const value = validArgoSource();
        value.images = withLeadingHole(value.images);
        return { value, calls: () => 0 };
      },
    },
    {
      name: "a revoked WorkflowRun proxy",
      source: "github" as const,
      create: () => {
        const revoked = Proxy.revocable(validWorkflowSource(), {});
        revoked.revoke();
        return { value: revoked.proxy, calls: () => 0 };
      },
    },
    {
      name: "a revoked Argo proxy",
      source: "argocd" as const,
      create: () => {
        const revoked = Proxy.revocable(validArgoSource(), {});
        revoked.revoke();
        return { value: revoked.proxy, calls: () => 0 };
      },
    },
    {
      name: "a revoked ClusterData proxy",
      source: "kubernetes" as const,
      create: () => {
        const revoked = Proxy.revocable(validClusterSource(), {});
        revoked.revoke();
        return { value: revoked.proxy, calls: () => 0 };
      },
    },
  ])("returns HTTP 200 Unknown for $name", async ({ source, create }) => {
    const hostile = create();
    const response = await hostileDeploymentApp(source, hostile.value).request("/deployments");
    const body = await response.text();
    const error = {
      github: "GitHub unavailable",
      argocd: "Argo CD unavailable",
      kubernetes: "Kubernetes unavailable",
    }[source];

    expect(response.status).toBe(200);
    expect(hostile.calls()).toBe(0);
    expect(body).not.toContain("getter-secret");
    expect(JSON.parse(body)).toMatchObject({
      status: "unknown",
      stale: true,
      sources: expect.arrayContaining([
        expect.objectContaining({ source, status: "unknown", stale: true, error }),
      ]),
    });
  });

  it("returns fixed Unknown Argo evidence for a whitespace-only revision", async () => {
    const whitespaceMarker = "\t \n";
    const malformed = validArgoSource();
    malformed.sync.revision = whitespaceMarker;
    const response = await hostileDeploymentApp("argocd", malformed).request("/deployments");
    const body = await response.text();
    const snapshot = JSON.parse(body);

    expect(response.status).toBe(200);
    expect(body).not.toContain(JSON.stringify(whitespaceMarker));
    expect(body).not.toContain("invalid source payload");
    expect(snapshot).toMatchObject({
      status: "unknown",
      stale: true,
      sources: expect.arrayContaining([
        expect.objectContaining({
          source: "argocd",
          status: "unknown",
          stale: true,
          error: "Argo CD unavailable",
        }),
      ]),
    });
  });

  it.each(
    (["desiredReplicas", "availableReplicas"] as const).flatMap((field) =>
      invalidReplicaValues.map((value) => ({ field, value })),
    ),
  )("returns HTTP 200 Unknown for an invalid Kubernetes $field value", async ({ field, value }) => {
    const cluster = validClusterSource();
    (cluster.workloads[0] as Record<typeof field, unknown>)[field] = value;

    const response = await hostileDeploymentApp("kubernetes", cluster).request("/deployments");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("unknown");
    expect(body.sources).toContainEqual(
      expect.objectContaining({ source: "kubernetes", status: "unknown" }),
    );
    expect(body.issues).toEqual(
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

  it.each(["desiredReplicas", "availableReplicas"] as const)(
    "does not expose a non-number Kubernetes %s value",
    async (field) => {
      const cluster = validClusterSource();
      (cluster.workloads[0] as Record<typeof field, unknown>)[field] = SECRET_REPLICA_MARKER;

      const response = await hostileDeploymentApp("kubernetes", cluster).request("/deployments");
      const body = await response.text();
      const snapshot = JSON.parse(body);

      expect(response.status).toBe(200);
      expect(body).not.toContain(SECRET_REPLICA_MARKER);
      expect(snapshot.status).toBe("unknown");
      expect(snapshot.sources).toContainEqual(
        expect.objectContaining({ source: "kubernetes", status: "unknown" }),
      );
    },
  );

  it.each([
    {
      name: "Argo resources at the limit",
      value: () => ({
        ...validArgoSource(),
        resources: Array.from({ length: 256 }, (_, index) => validArgoResource(index)),
      }),
      expectedStatus: "healthy",
    },
    {
      name: "Argo resources at max plus one",
      value: () => ({
        ...validArgoSource(),
        resources: Array.from({ length: 257 }, (_, index) => validArgoResource(index)),
      }),
      expectedStatus: "unknown",
    },
    {
      name: "Argo images at the limit",
      value: () => ({
        ...validArgoSource(),
        images: Array.from({ length: 64 }, (_, index) =>
          index % 2 === 0
            ? `${API_REPOSITORY}:${SOURCE_SHA}`
            : `${FRONTEND_REPOSITORY}:${SOURCE_SHA}`,
        ),
      }),
      expectedStatus: "healthy",
    },
    {
      name: "Argo images at max plus one",
      value: () => ({
        ...validArgoSource(),
        images: Array.from({ length: 65 }, (_, index) =>
          index % 2 === 0
            ? `${API_REPOSITORY}:${SOURCE_SHA}`
            : `${FRONTEND_REPOSITORY}:${SOURCE_SHA}`,
        ),
      }),
      expectedStatus: "unknown",
    },
  ])("enforces the $name bound", async ({ value, expectedStatus }) => {
    const response = await hostileDeploymentApp("argocd", value()).request("/deployments");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      sources: expect.arrayContaining([
        expect.objectContaining({ source: "argocd", status: expectedStatus }),
      ]),
    });
  });

  it.each([
    { source: "github" as const, value: () => validWorkflowSource() },
    { source: "argocd" as const, value: () => validArgoSource() },
    { source: "kubernetes" as const, value: () => validClusterSource() },
  ])("accepts a valid null-prototype $source source", async ({ source, value }) => {
    const sourceValue = Object.assign(Object.create(null), value());
    const response = await hostileDeploymentApp(source, sourceValue).request("/deployments");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      sources: expect.arrayContaining([
        expect.objectContaining({ source, status: "healthy", stale: false }),
      ]),
    });
  });

  it.each(["/cluster", "/deployments", "/services"])(
    "returns an empty unknown snapshot before providers are configured for %s",
    async (path) => {
      const response = await createGateway().request(path);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: null,
        status: "unknown",
        stale: true,
        issues: [],
        sources: [],
      });
    },
  );
});
