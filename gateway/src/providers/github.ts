import fetch, { type RequestInit, type Response } from "node-fetch";
import type { DeploymentCommitSummary } from "../../../shared/homelab/contracts";
import {
  readDenseArray,
  readOwnDataProperties,
  readOwnDataRecord,
  RUNTIME_COLLECTION_LIMITS,
} from "../runtime-validation";
import type { Provider, ProviderObservation } from "./provider";

const GITHUB_API_VERSION = "2022-11-28";
const REPOSITORY_COMPONENT = /^[A-Za-z0-9_.-]+$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/i;
const RUN_ID = /^[1-9][0-9]*$/;
const PUBLIC_CACHE_TTL_MS = 5 * 60_000;
const AUTHENTICATED_CACHE_TTL_MS = 10_000;
const PUBLIC_FAILURE_BACKOFF_MS = 60_000;
const PUBLIC_MAX_FAILURE_BACKOFF_MS = 15 * 60_000;

type FetchApi = (url: string, options: RequestInit) => Promise<Response>;

class GitHubRequestError extends Error {
  constructor(readonly retryAt?: number) {
    super("GitHub request failed");
  }
}

function retryAtFromResponse(response: Response, now = Date.now()): number | undefined {
  const candidates: number[] = [];
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const retryAt = Number.isFinite(seconds)
      ? now + Math.max(0, seconds) * 1_000
      : Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) candidates.push(retryAt);
  }
  const resetSeconds = Number(response.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(resetSeconds) && resetSeconds > 0) candidates.push(resetSeconds * 1_000);
  const future = candidates.filter((candidate) => candidate > now);
  return future.length > 0 ? Math.max(...future) : undefined;
}

function waitForCaller<T>(request: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason ?? new Error("request aborted"));

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      cleanup();
      reject(signal.reason ?? new Error("request aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    request.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}

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
  repository: string;
  branch: string;
  workflow: string;
  token?: string;
  environment?: NodeJS.ProcessEnv;
  fetchApi?: FetchApi;
  baseUrl?: string;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function parseWorkflowRun(value: unknown): WorkflowRun | null {
  const fields = readOwnDataProperties(value, [
    "repository",
    "branch",
    "name",
    "status",
    "conclusion",
    "commit",
    "startedAt",
    "completedAt",
    "durationMs",
    "url",
  ]);
  const commit = fields
    ? readOwnDataProperties(fields.commit, ["sha", "message", "author", "committedAt", "url"])
    : null;
  let repository: [string, string] | null = null;
  if (fields && isString(fields.repository)) {
    try {
      repository = repositoryParts(fields.repository);
    } catch {
      repository = null;
    }
  }
  if (
    !fields ||
    !commit ||
    !repository ||
    !isString(fields.branch) ||
    !isString(fields.name) ||
    !isString(fields.status) ||
    (fields.conclusion !== null && !isString(fields.conclusion)) ||
    !isString(fields.startedAt) ||
    (fields.completedAt !== null && !isString(fields.completedAt)) ||
    (fields.durationMs !== null &&
      (typeof fields.durationMs !== "number" || !Number.isFinite(fields.durationMs))) ||
    !isString(fields.url) ||
    !isString(commit.sha) ||
    !COMMIT_SHA.test(commit.sha) ||
    !isString(commit.message) ||
    !isString(commit.author) ||
    !isString(commit.committedAt) ||
    !isString(commit.url)
  ) {
    return null;
  }

  const [owner, name] = repository;
  let workflowUrl: URL;
  try {
    workflowUrl = new URL(fields.url);
  } catch {
    return null;
  }
  const workflowPrefix = `/${owner}/${name}/actions/runs/`;
  const workflowRunId = workflowUrl.pathname.slice(workflowPrefix.length);
  if (
    workflowUrl.protocol !== "https:" ||
    workflowUrl.hostname !== "github.com" ||
    workflowUrl.username ||
    workflowUrl.password ||
    workflowUrl.search ||
    workflowUrl.hash ||
    !workflowUrl.pathname.startsWith(workflowPrefix) ||
    !RUN_ID.test(workflowRunId) ||
    commit.url !== githubUrl(owner, name, "commit", commit.sha)
  ) {
    return null;
  }

  return {
    repository: fields.repository,
    branch: fields.branch,
    name: fields.name,
    status: fields.status,
    conclusion: fields.conclusion,
    commit: {
      sha: commit.sha,
      message: commit.message,
      author: commit.author,
      committedAt: commit.committedAt,
      url: commit.url,
    },
    startedAt: fields.startedAt,
    completedAt: fields.completedAt,
    durationMs: fields.durationMs,
    url: fields.url,
  };
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

function repositoryParts(repository: string): [string, string] {
  const parts = repository.split("/");
  if (parts.length !== 2 || parts.some((part) => !REPOSITORY_COMPONENT.test(part))) {
    throw new Error("GitHub repository invalid");
  }
  return parts as [string, string];
}

function commitSha(value: unknown): string {
  const sha = requiredString(value);
  if (!COMMIT_SHA.test(sha)) throw new Error("invalid commit SHA");
  return sha;
}

function runId(value: unknown): string {
  const id = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof id !== "string" || !RUN_ID.test(id)) throw new Error("invalid workflow run ID");
  return id;
}

function githubUrl(owner: string, repository: string, ...segments: string[]): string {
  const url = new URL("https://github.com/");
  url.pathname = [owner, repository, ...segments].map(encodeURIComponent).join("/");
  return url.toString();
}

export class GitHubProvider implements Provider<WorkflowRun> {
  readonly source = "github" as const;

  private readonly token: string | undefined;
  private readonly fetchApi: FetchApi;
  private readonly baseUrl: URL;
  private readonly repository: string;
  private readonly branch: string;
  private readonly workflow: string;
  private readonly cacheTtlMs: number;
  private cachedWorkflow: { value: WorkflowRun; observedAt: number } | undefined;
  private workflowRequest: Promise<WorkflowRun> | undefined;
  private retryAt = 0;
  private failureCount = 0;

  constructor(options: GitHubProviderOptions) {
    repositoryParts(options.repository);
    requiredString(options.branch);
    requiredString(options.workflow);
    this.repository = options.repository;
    this.branch = options.branch;
    this.workflow = options.workflow;
    this.token = options.token ?? (options.environment ?? process.env).GITHUB_READ_TOKEN;
    this.cacheTtlMs = this.token ? AUTHENTICATED_CACHE_TTL_MS : PUBLIC_CACHE_TTL_MS;
    this.fetchApi = options.fetchApi ?? fetch;
    this.baseUrl = new URL(options.baseUrl ?? "https://api.github.com/");
  }

  private async request(path: string, signal?: AbortSignal): Promise<unknown> {
    try {
      const response = await this.fetchApi(new URL(path, this.baseUrl).toString(), {
        method: "GET",
        headers: {
          accept: "application/vnd.github+json",
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
          "user-agent": "dum-dashboard",
          "x-github-api-version": GITHUB_API_VERSION,
        },
        signal,
      });
      if (!response.ok) throw new GitHubRequestError(retryAtFromResponse(response));
      return await response.json();
    } catch (error) {
      if (error instanceof GitHubRequestError) throw error;
      throw new GitHubRequestError();
    }
  }

  private async latestWorkflow(
    repository: string,
    branch: string,
    workflow: string,
    signal?: AbortSignal,
  ): Promise<WorkflowRun> {
    const [owner, name] = repositoryParts(repository);
    const path = [owner, name].map(encodeURIComponent).join("/");
    const runsUrl = new URL(
      `repos/${path}/actions/workflows/${encodeURIComponent(workflow)}/runs`,
      this.baseUrl,
    );
    runsUrl.searchParams.set("branch", branch);
    runsUrl.searchParams.set("per_page", "1");
    const runsPayload = await this.request(`${runsUrl.pathname}${runsUrl.search}`, signal);

    try {
      const runsFields = readOwnDataProperties(runsPayload, ["workflow_runs"]);
      const runs = runsFields
        ? readDenseArray(runsFields.workflow_runs, RUNTIME_COLLECTION_LIMITS.githubWorkflowRuns)
        : null;
      const run = runs?.[0];
      const runFields = readOwnDataRecord(run);
      if (
        !runFields?.has("id") ||
        !runFields.has("name") ||
        !runFields.has("head_sha") ||
        !runFields.has("status") ||
        !runFields.has("run_started_at")
      ) {
        throw new Error("missing workflow run");
      }

      const sha = commitSha(runFields.get("head_sha"));
      const id = runId(runFields.get("id"));
      const commitPayload = await this.request(
        `repos/${path}/commits/${encodeURIComponent(sha)}`,
        signal,
      );
      const commitPayloadFields = readOwnDataRecord(commitPayload);
      const commitFields = commitPayloadFields?.has("commit")
        ? readOwnDataProperties(commitPayloadFields.get("commit"), ["message", "author"])
        : null;
      const commitAuthor = commitFields
        ? readOwnDataProperties(commitFields.author, ["name", "date"])
        : null;
      let user: { login: unknown } | null = null;
      if (commitPayloadFields?.has("author") && commitPayloadFields.get("author") !== null) {
        user = readOwnDataProperties(commitPayloadFields.get("author"), ["login"]);
        if (!user) throw new Error("invalid commit author");
      }
      if (!commitPayloadFields?.has("sha") || !commitFields || !commitAuthor) {
        throw new Error("invalid commit response");
      }
      if (commitSha(commitPayloadFields.get("sha")) !== sha) throw new Error("commit SHA mismatch");
      const startedAt = requiredString(runFields.get("run_started_at"));
      const completedAt = optionalString(runFields.get("updated_at"));

      return {
        repository,
        branch,
        name: requiredString(runFields.get("name")),
        status: requiredString(runFields.get("status")),
        conclusion: optionalString(runFields.get("conclusion")),
        commit: {
          sha,
          message: requiredString(commitFields.message),
          author:
            (typeof user?.login === "string" && user.login) || requiredString(commitAuthor.name),
          committedAt: requiredString(commitAuthor.date),
          url: githubUrl(owner, name, "commit", sha),
        },
        startedAt,
        completedAt,
        durationMs: duration(startedAt, completedAt),
        url: githubUrl(owner, name, "actions", "runs", id),
      };
    } catch (error) {
      if (error instanceof GitHubRequestError) throw error;
      throw new Error("GitHub response invalid");
    }
  }

  getLatestWorkflow(
    repository: string,
    branch: string,
    workflow = this.workflow,
  ): Promise<WorkflowRun> {
    return this.latestWorkflow(repository, branch, workflow);
  }

  observation(): ProviderObservation | undefined {
    if (!this.cachedWorkflow) return undefined;
    const observedAt = this.cachedWorkflow.observedAt;
    const stale = Date.now() - observedAt > this.cacheTtlMs;
    return {
      observedAt: new Date(observedAt).toISOString(),
      stale,
      ...(stale ? { error: "GitHub observation is stale" } : {}),
    };
  }

  collect(signal: AbortSignal): Promise<WorkflowRun> {
    const now = Date.now();
    const cached = this.cachedWorkflow;
    if (cached && now - cached.observedAt < this.cacheTtlMs) {
      return waitForCaller(Promise.resolve(structuredClone(cached.value)), signal);
    }
    if (this.workflowRequest) {
      return waitForCaller(
        this.workflowRequest.then((value) => structuredClone(value)),
        signal,
      );
    }
    if (now < this.retryAt) {
      return waitForCaller(
        cached
          ? Promise.resolve(structuredClone(cached.value))
          : Promise.reject(new Error("GitHub request failed")),
        signal,
      );
    }

    const request = this.latestWorkflow(this.repository, this.branch, this.workflow)
      .then((value) => {
        this.cachedWorkflow = { value: structuredClone(value), observedAt: Date.now() };
        this.retryAt = 0;
        this.failureCount = 0;
        return value;
      })
      .catch((error: unknown) => {
        this.failureCount += 1;
        const fallback = Math.min(
          PUBLIC_FAILURE_BACKOFF_MS * 2 ** (this.failureCount - 1),
          PUBLIC_MAX_FAILURE_BACKOFF_MS,
        );
        const responseRetryAt = error instanceof GitHubRequestError ? error.retryAt : undefined;
        this.retryAt = Math.max(Date.now() + fallback, responseRetryAt ?? 0);
        if (this.cachedWorkflow) return structuredClone(this.cachedWorkflow.value);
        throw error;
      })
      .finally(() => {
        this.workflowRequest = undefined;
      });
    this.workflowRequest = request;
    return waitForCaller(
      request.then((value) => structuredClone(value)),
      signal,
    );
  }
}
