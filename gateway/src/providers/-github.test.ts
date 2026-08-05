import { Response, type RequestInit } from "node-fetch";
import { describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/github.json";
import { GitHubProvider, parseWorkflowRun } from "./github";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("GitHubProvider", () => {
  it("reads a public repository anonymously and caches the result", async () => {
    const fetchApi = vi.fn(async (url: string, _options: RequestInit) =>
      jsonResponse(url.includes("/actions/") ? fixture.workflowRuns : fixture.commit),
    );
    const provider = new GitHubProvider({ fetchApi, environment: {} });

    const [first, concurrent] = await Promise.all([
      provider.collect(new AbortController().signal),
      provider.collect(new AbortController().signal),
    ]);
    expect(first).toMatchObject({ repository: "Isolumi/youtube-mp3", conclusion: "success" });
    expect(concurrent).toEqual(first);
    await expect(provider.collect(new AbortController().signal)).resolves.toEqual(first);

    expect(fetchApi).toHaveBeenCalledTimes(2);
    expect(provider.observation()).toMatchObject({ stale: false });
    expect(fetchApi.mock.calls[0]![1]).toMatchObject({
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "dum-dashboard",
        "x-github-api-version": "2022-11-28",
      },
    });
    expect(fetchApi.mock.calls[0]![1]?.headers).not.toHaveProperty("authorization");
  });

  it("serves stale public evidence with bounded retry after an upstream failure", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-04T00:00:00.000Z"));
    try {
      const fetchApi = vi.fn(async (url: string, _options: RequestInit) =>
        jsonResponse(url.includes("/actions/") ? fixture.workflowRuns : fixture.commit),
      );
      const provider = new GitHubProvider({ fetchApi, environment: {} });
      const initial = await provider.collect(new AbortController().signal);

      vi.advanceTimersByTime(31_000);
      await expect(provider.collect(new AbortController().signal)).resolves.toEqual(initial);
      expect(provider.observation()).toMatchObject({ stale: false });
      expect(fetchApi).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(5 * 60_000 - 31_000 + 1);
      fetchApi.mockRejectedValueOnce(new Error("rate limited"));
      await expect(provider.collect(new AbortController().signal)).resolves.toEqual(initial);
      expect(provider.observation()).toEqual({
        observedAt: "2026-08-04T00:00:00.000Z",
        stale: true,
        error: "GitHub observation is stale",
      });
      expect(fetchApi).toHaveBeenCalledTimes(3);

      vi.advanceTimersByTime(60_001);
      fetchApi.mockRejectedValueOnce(new Error("still unavailable"));
      await expect(provider.collect(new AbortController().signal)).resolves.toEqual(initial);
      expect(fetchApi).toHaveBeenCalledTimes(4);

      vi.advanceTimersByTime(60_001);
      await expect(provider.collect(new AbortController().signal)).resolves.toEqual(initial);
      expect(fetchApi).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("honors GitHub rate-limit reset headers before retrying", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-04T00:00:00.000Z"));
    try {
      const fetchApi = vi.fn(async (url: string, _options: RequestInit) =>
        jsonResponse(url.includes("/actions/") ? fixture.workflowRuns : fixture.commit),
      );
      const provider = new GitHubProvider({ fetchApi, environment: {} });
      const initial = await provider.collect(new AbortController().signal);
      const resetAt = Date.now() + 10 * 60_000;

      vi.advanceTimersByTime(5 * 60_000 + 1);
      fetchApi.mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "x-ratelimit-reset": String(Math.ceil(resetAt / 1_000)) },
        }),
      );
      await expect(provider.collect(new AbortController().signal)).resolves.toEqual(initial);
      expect(fetchApi).toHaveBeenCalledTimes(3);

      vi.advanceTimersByTime(60_001);
      await expect(provider.collect(new AbortController().signal)).resolves.toEqual(initial);
      expect(fetchApi).toHaveBeenCalledTimes(3);

      vi.setSystemTime(resetAt + 1);
      await expect(provider.collect(new AbortController().signal)).resolves.toEqual(initial);
      expect(fetchApi).toHaveBeenCalledTimes(5);
      expect(provider.observation()).toMatchObject({ stale: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reads the latest workflow and commit metadata with read-only GitHub headers", async () => {
    const fetchApi = vi.fn(async (url: string, _options: RequestInit) =>
      jsonResponse(url.includes("/actions/") ? fixture.workflowRuns : fixture.commit),
    );
    const provider = new GitHubProvider({ token: "read-only-secret", fetchApi });

    await expect(provider.collect(new AbortController().signal)).resolves.toEqual({
      repository: "Isolumi/youtube-mp3",
      branch: "development",
      name: "Build and publish images",
      status: "completed",
      conclusion: "success",
      commit: {
        sha: "1829d6ba3b55e66a2134ae64161b9e48ad39a197",
        message: "Ship API and frontend changes",
        author: "Isolumi",
        committedAt: "2026-08-04T11:57:00Z",
        url: "https://github.com/Isolumi/youtube-mp3/commit/1829d6ba3b55e66a2134ae64161b9e48ad39a197",
      },
      startedAt: "2026-08-04T11:58:00Z",
      completedAt: "2026-08-04T12:00:30Z",
      durationMs: 150000,
      url: "https://github.com/Isolumi/youtube-mp3/actions/runs/987654321",
    });

    expect(fetchApi).toHaveBeenCalledTimes(2);
    expect(fetchApi.mock.calls[0]![0]).toBe(
      "https://api.github.com/repos/Isolumi/youtube-mp3/actions/workflows/build-images.yml/runs?branch=development&per_page=1",
    );
    expect(fetchApi.mock.calls[0]![1]).toMatchObject({
      method: "GET",
      headers: {
        accept: "application/vnd.github+json",
        authorization: "Bearer read-only-secret",
        "x-github-api-version": "2022-11-28",
      },
    });
    expect(fetchApi.mock.calls[1]![0]).toBe(
      "https://api.github.com/repos/Isolumi/youtube-mp3/commits/1829d6ba3b55e66a2134ae64161b9e48ad39a197",
    );
    expect(
      JSON.stringify(await provider.getLatestWorkflow("Isolumi/youtube-mp3", "development")),
    ).not.toContain("evil.example");
    expect(fetchApi).toHaveBeenCalledTimes(4);
  });

  it.each([
    { id: "987/../../evil", sha: fixture.commit.sha },
    { id: 987654321, sha: "../../evil" },
  ])(
    "rejects untrusted workflow identity fields before constructing evidence URLs",
    async (run) => {
      const fetchApi = vi.fn(async (url: string) =>
        jsonResponse(
          url.includes("/workflows/")
            ? {
                ...fixture.workflowRuns,
                workflow_runs: [
                  { ...fixture.workflowRuns.workflow_runs[0], ...run, head_sha: run.sha },
                ],
              }
            : fixture.commit,
        ),
      );
      const provider = new GitHubProvider({ token: "read-only-secret", fetchApi });

      await expect(
        provider.getLatestWorkflow("Isolumi/youtube-mp3", "development"),
      ).rejects.toThrow(/^GitHub response invalid$/);
    },
  );

  it("rejects workflow_runs at max plus one before reading commit metadata", async () => {
    const fetchApi = vi.fn(async () =>
      jsonResponse({
        ...fixture.workflowRuns,
        workflow_runs: [
          fixture.workflowRuns.workflow_runs[0],
          fixture.workflowRuns.workflow_runs[0],
        ],
      }),
    );
    const provider = new GitHubProvider({ token: "read-only-secret", fetchApi });

    await expect(provider.getLatestWorkflow("Isolumi/youtube-mp3", "development")).rejects.toThrow(
      /^GitHub response invalid$/,
    );
    expect(fetchApi).toHaveBeenCalledOnce();
  });

  it("parses a null-prototype WorkflowRun into one fresh normalized copy", async () => {
    const fetchApi = vi.fn(async (url: string) =>
      jsonResponse(url.includes("/actions/") ? fixture.workflowRuns : fixture.commit),
    );
    const normalized = await new GitHubProvider({
      token: "read-only-secret",
      fetchApi,
    }).collect(new AbortController().signal);
    const value = Object.assign(Object.create(null), normalized, {
      commit: Object.assign(Object.create(null), normalized.commit),
    });

    const parsed = parseWorkflowRun(value);

    expect(parsed).toEqual(normalized);
    expect(parsed).not.toBe(value);
    expect(parsed?.commit).not.toBe(value.commit);
  });

  it("preserves null defaults when optional GitHub fields are absent", async () => {
    const workflowRuns = structuredClone(fixture.workflowRuns);
    const run = workflowRuns.workflow_runs[0] as unknown as Record<string, unknown>;
    delete run.conclusion;
    delete run.updated_at;
    const commit = structuredClone(fixture.commit);
    delete (commit as unknown as Record<string, unknown>).author;
    const fetchApi = vi.fn(async (url: string) =>
      jsonResponse(url.includes("/actions/") ? workflowRuns : commit),
    );
    const provider = new GitHubProvider({ token: "read-only-secret", fetchApi });

    await expect(provider.collect(new AbortController().signal)).resolves.toMatchObject({
      conclusion: null,
      completedAt: null,
      durationMs: null,
      commit: { author: "Isolumi" },
    });
  });

  it("rejects a present transparent proxy in optional GitHub author evidence", async () => {
    const commit = structuredClone(fixture.commit);
    commit.author = new Proxy(commit.author, {});
    const fetchApi = vi.fn(
      async (url: string) =>
        ({
          ok: true,
          json: async () => (url.includes("/actions/") ? fixture.workflowRuns : commit),
        }) as unknown as Response,
    );
    const provider = new GitHubProvider({ token: "read-only-secret", fetchApi });

    await expect(provider.collect(new AbortController().signal)).rejects.toThrow(
      /^GitHub response invalid$/,
    );
  });

  it("uses the configured repository and contains upstream secrets", async () => {
    const failed = new GitHubProvider({
      token: "read-only-secret",
      fetchApi: vi.fn(async () => {
        throw new Error("authorization=Bearer read-only-secret stack=/private/path");
      }),
    });

    await expect(failed.getLatestWorkflow("Isolumi/youtube-mp3", "development")).rejects.toThrow(
      /^GitHub request failed$/,
    );
  });
});
