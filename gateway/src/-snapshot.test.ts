import { describe, expect, it } from "vitest";
import type { ClusterData, DeploymentSnapshot } from "../../shared/homelab/contracts";
import type { ArgoApplicationState } from "./providers/argocd";
import type { Provider } from "./providers/provider";
import { collectDeploymentSnapshot, collectProviders } from "./snapshot";

const now = () => new Date("2026-08-04T00:00:00.000Z");

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

describe("collectDeploymentSnapshot", () => {
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
});
