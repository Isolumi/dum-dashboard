import fetch, { type RequestInit, type Response } from "node-fetch";
import type { DeploymentCommitSummary } from "../../../shared/homelab/contracts";
import type { Provider } from "./provider";

const GITHUB_API_VERSION = "2022-11-28";
const DEFAULT_REPOSITORY = "Isolumi/youtube-mp3";
const DEFAULT_BRANCH = "main";

type FetchApi = (url: string, options: RequestInit) => Promise<Response>;

export interface WorkflowRun {
  repository: string;
  branch: string;
  name: string;
  status: string;
  conclusion: string | null;
  commit: DeploymentCommitSummary;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  url: string;
}

export interface GitHubProviderOptions {
  token?: string;
  environment?: NodeJS.ProcessEnv;
  fetchApi?: FetchApi;
  baseUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new Error("invalid value");
  return value;
}

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return requiredString(value);
}

function duration(startedAt: string, completedAt: string | null): number | null {
  if (!completedAt) return null;
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  return Number.isNaN(started) || Number.isNaN(completed) ? null : Math.max(0, completed - started);
}

function repositoryPath(repository: string): string {
  const parts = repository.split("/");
  if (parts.length !== 2 || parts.some((part) => !part)) {
    throw new Error("GitHub repository invalid");
  }
  return parts.map(encodeURIComponent).join("/");
}

export class GitHubProvider implements Provider<WorkflowRun> {
  readonly source = "github" as const;

  private readonly token: string | undefined;
  private readonly fetchApi: FetchApi;
  private readonly baseUrl: URL;

  constructor(options: GitHubProviderOptions = {}) {
    this.token =
      options.token ?? options.environment?.GITHUB_READ_TOKEN ?? process.env.GITHUB_READ_TOKEN;
    this.fetchApi = options.fetchApi ?? fetch;
    this.baseUrl = new URL(options.baseUrl ?? "https://api.github.com/");
  }

  private async request(path: string, signal?: AbortSignal): Promise<unknown> {
    if (!this.token) throw new Error("GitHub is not configured");

    try {
      const response = await this.fetchApi(new URL(path, this.baseUrl).toString(), {
        method: "GET",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${this.token}`,
          "x-github-api-version": GITHUB_API_VERSION,
        },
        signal,
      });
      if (!response.ok) throw new Error("non-2xx response");
      return await response.json();
    } catch {
      throw new Error("GitHub request failed");
    }
  }

  private async latestWorkflow(
    repository: string,
    branch: string,
    signal?: AbortSignal,
  ): Promise<WorkflowRun> {
    const path = repositoryPath(repository);
    const runsUrl = new URL(`repos/${path}/actions/runs`, this.baseUrl);
    runsUrl.searchParams.set("branch", branch);
    runsUrl.searchParams.set("per_page", "1");
    const runsPayload = await this.request(`${runsUrl.pathname}${runsUrl.search}`, signal);

    try {
      if (!isRecord(runsPayload) || !Array.isArray(runsPayload.workflow_runs)) {
        throw new Error("invalid workflow response");
      }
      const run = runsPayload.workflow_runs[0];
      if (!isRecord(run)) throw new Error("missing workflow run");

      const sha = requiredString(run.head_sha);
      const commitPayload = await this.request(
        `repos/${path}/commits/${encodeURIComponent(sha)}`,
        signal,
      );
      if (!isRecord(commitPayload) || !isRecord(commitPayload.commit)) {
        throw new Error("invalid commit response");
      }
      const commit = commitPayload.commit;
      const commitAuthor = isRecord(commit.author) ? commit.author : undefined;
      const user = isRecord(commitPayload.author) ? commitPayload.author : undefined;
      const startedAt = requiredString(run.run_started_at);
      const completedAt = optionalString(run.updated_at);

      return {
        repository,
        branch,
        name: requiredString(run.name),
        status: requiredString(run.status),
        conclusion: optionalString(run.conclusion),
        commit: {
          sha,
          message: requiredString(commit.message),
          author:
            (typeof user?.login === "string" && user.login) || requiredString(commitAuthor?.name),
          committedAt: requiredString(commitAuthor?.date),
          url: requiredString(commitPayload.html_url),
        },
        startedAt,
        completedAt,
        durationMs: duration(startedAt, completedAt),
        url: requiredString(run.html_url),
      };
    } catch (error) {
      if (error instanceof Error && error.message === "GitHub request failed") throw error;
      throw new Error("GitHub response invalid");
    }
  }

  getLatestWorkflow(repository: string, branch: string): Promise<WorkflowRun> {
    return this.latestWorkflow(repository, branch);
  }

  collect(signal: AbortSignal): Promise<WorkflowRun> {
    return this.latestWorkflow(DEFAULT_REPOSITORY, DEFAULT_BRANCH, signal);
  }
}
