import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Job } from "#/lib/database.types";
import { JobDomainError } from "#/routes/jobs/job.domain";
import { createJobToolHandlers } from "./-handlers";

const TOKEN = "tool-token-with-at-least-thirty-two-bytes";
const RAW_DATABASE_MESSAGE = "postgres password=database-secret relation jobs failed";
const JOB_INPUT = {
  company: "Point72",
  title: "Quantitative Developer Intern",
  url: "https://jobs.example/point72?team=quant&source=discord",
};
const JOB: Job = {
  ...JOB_INPUT,
  id: "550e8400-e29b-41d4-a716-446655440000",
  saved_at: "2026-09-15T16:00:00.000Z",
};

function authorizedRequest(
  body: unknown,
  contentType = "application/json; charset=utf-8",
): Request {
  return new Request("http://dumq/api/tools/jobs", {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": contentType,
    },
    method: "POST",
  });
}

async function expectJson(response: Response, status: number, body: unknown): Promise<void> {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-type")).toBe("application/json");
  await expect(response.json()).resolves.toEqual(body);
}

const saveJobRecord = vi.fn();
const handlers = createJobToolHandlers({ token: TOKEN, saveJobRecord });

beforeEach(() => {
  vi.clearAllMocks();
  saveJobRecord.mockResolvedValue({ status: "created", job: JOB });
});

describe("createJobToolHandlers", () => {
  it("rejects a missing bearer before parsing or saving", async () => {
    const request = new Request("http://dumq/api/tools/jobs", {
      body: "not-json",
      method: "POST",
    });
    const jsonSpy = vi.spyOn(request, "json");

    const response = await handlers.create(request);

    await expectJson(response, 401, {
      error: { code: "unauthorized", message: "Unauthorized" },
    });
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(saveJobRecord).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer before parsing or saving", async () => {
    const request = new Request("http://dumq/api/tools/jobs", {
      body: "not-json",
      headers: { authorization: "Bearer wrong-token" },
      method: "POST",
    });
    const jsonSpy = vi.spyOn(request, "json");

    const response = await handlers.create(request);

    await expectJson(response, 401, {
      error: { code: "unauthorized", message: "Unauthorized" },
    });
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(saveJobRecord).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["wrong", "text/plain"],
  ])("rejects %s Content-Type before parsing or saving", async (_name, contentType) => {
    const request = authorizedRequest(JOB_INPUT);
    if (contentType) request.headers.set("content-type", contentType);
    else request.headers.delete("content-type");
    const jsonSpy = vi.spyOn(request, "json");

    const response = await handlers.create(request);

    await expectJson(response, 400, {
      error: { code: "invalid_request", message: "Invalid request" },
    });
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(saveJobRecord).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const request = new Request("http://dumq/api/tools/jobs", {
      body: "not-json",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
      method: "POST",
    });

    const response = await handlers.create(request);

    await expectJson(response, 400, {
      error: { code: "invalid_request", message: "Invalid request" },
    });
    expect(saveJobRecord).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown fields", { ...JOB_INPUT, status: "applied" }],
    ["an invalid URL", { ...JOB_INPUT, url: "not-a-url" }],
  ])("rejects %s", async (_name, body) => {
    const response = await handlers.create(authorizedRequest(body));

    await expectJson(response, 400, {
      error: { code: "invalid_request", message: "Invalid request" },
    });
    expect(saveJobRecord).not.toHaveBeenCalled();
  });

  it("creates a job from normalized fields and preserves URL query parameters", async () => {
    const response = await handlers.create(
      authorizedRequest({
        company: `  ${JOB_INPUT.company}  `,
        title: `  ${JOB_INPUT.title}  `,
        url: `  ${JOB_INPUT.url}  `,
      }),
    );

    expect(saveJobRecord).toHaveBeenCalledWith(JOB_INPUT);
    await expectJson(response, 200, { status: "created", job: JOB });
  });

  it("returns the existing job for a duplicate", async () => {
    saveJobRecord.mockResolvedValue({ status: "already_saved", job: JOB });

    const response = await handlers.create(authorizedRequest(JOB_INPUT));

    await expectJson(response, 200, { status: "already_saved", job: JOB });
  });

  it("maps database failures to a safe 503 response", async () => {
    saveJobRecord.mockRejectedValue(new JobDomainError("database_unavailable"));

    const response = await handlers.create(authorizedRequest(JOB_INPUT));
    const responseText = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(responseText)).toEqual({
      error: { code: "database_unavailable", message: "Job service unavailable" },
    });
    expect(responseText).not.toContain(RAW_DATABASE_MESSAGE);
  });

  it("maps unknown failures to a safe 500 without logging secrets", async () => {
    const consoleSpies = [
      vi.spyOn(console, "error").mockImplementation(() => undefined),
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
    ];
    saveJobRecord.mockRejectedValue(new Error(RAW_DATABASE_MESSAGE));

    const response = await handlers.create(authorizedRequest(JOB_INPUT));
    const responseText = await response.text();
    const consoleText = consoleSpies
      .flatMap((spy) => spy.mock.calls)
      .flat()
      .join(" ");

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(responseText)).toEqual({
      error: { code: "internal_error", message: "Internal server error" },
    });
    expect(`${responseText} ${consoleText}`).not.toContain(TOKEN);
    expect(`${responseText} ${consoleText}`).not.toContain(RAW_DATABASE_MESSAGE);
  });
});
