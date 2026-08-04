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

  it("uses the configured repository and contains missing credentials or upstream secrets", async () => {
    const missing = new GitHubProvider({ environment: {} });
    const failed = new GitHubProvider({
      token: "read-only-secret",
      fetchApi: vi.fn(async () => {
        throw new Error("authorization=Bearer read-only-secret stack=/private/path");
      }),
    });

    await expect(missing.collect(new AbortController().signal)).rejects.toThrow(
      /^GitHub is not configured$/,
    );
    await expect(failed.getLatestWorkflow("Isolumi/youtube-mp3", "development")).rejects.toThrow(
      /^GitHub request failed$/,
    );
  });
});
