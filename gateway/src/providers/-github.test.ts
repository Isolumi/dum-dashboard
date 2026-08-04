import { Response, type RequestInit } from "node-fetch";
import { describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/github.json";
import { GitHubProvider } from "./github";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("GitHubProvider", () => {
  it("reads the latest workflow and commit metadata with read-only GitHub headers", async () => {
    const fetchApi = vi.fn(async (url: string, _options: RequestInit) =>
      jsonResponse(url.includes("/actions/runs") ? fixture.workflowRuns : fixture.commit),
    );
    const provider = new GitHubProvider({ token: "read-only-secret", fetchApi });

    await expect(provider.getLatestWorkflow("Isolumi/youtube-mp3", "main")).resolves.toEqual({
      repository: "Isolumi/youtube-mp3",
      branch: "main",
      name: "Build images",
      status: "completed",
      conclusion: "success",
      commit: {
        sha: "0123456789abcdef0123456789abcdef01234567",
        message: "Deploy API and frontend",
        author: "Isolumi",
        committedAt: "2026-08-04T11:57:00Z",
        url: "https://github.com/Isolumi/youtube-mp3/commit/0123456789abcdef0123456789abcdef01234567",
      },
      startedAt: "2026-08-04T11:58:00Z",
      completedAt: "2026-08-04T12:00:30Z",
      durationMs: 150000,
      url: "https://github.com/Isolumi/youtube-mp3/actions/runs/987654321",
    });

    expect(fetchApi).toHaveBeenCalledTimes(2);
    const workflowUrl = new URL(fetchApi.mock.calls[0]![0]);
    expect(workflowUrl.pathname).toBe("/repos/Isolumi/youtube-mp3/actions/runs");
    expect(Object.fromEntries(workflowUrl.searchParams)).toEqual({ branch: "main", per_page: "1" });
    expect(fetchApi.mock.calls[0]![1]).toMatchObject({
      method: "GET",
      headers: {
        accept: "application/vnd.github+json",
        authorization: "Bearer read-only-secret",
        "x-github-api-version": "2022-11-28",
      },
    });
    expect(new URL(fetchApi.mock.calls[1]![0]).pathname).toBe(
      "/repos/Isolumi/youtube-mp3/commits/0123456789abcdef0123456789abcdef01234567",
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
    await expect(failed.getLatestWorkflow("Isolumi/youtube-mp3", "main")).rejects.toThrow(
      /^GitHub request failed$/,
    );
  });
});
