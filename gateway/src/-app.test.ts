import { describe, expect, it } from "vitest";
import { createGateway } from "./app";

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
