import type { z } from "zod";

import { assertValidToolTokenConfig, hasValidToolBearer } from "#/lib/tool-api-auth";
import { JobDomainError, type saveJobRecord } from "#/routes/jobs/job.domain";
import { CreateToolJobSchema } from "./-schemas";

export type JobToolHandlers = {
  create(request: Request): Promise<Response>;
};

type ToolErrorCode = "database_unavailable" | "internal_error" | "invalid_request" | "unauthorized";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

function errorResponse(code: ToolErrorCode, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

function invalidRequest(): Response {
  return errorResponse("invalid_request", "Invalid request", 400);
}

function toolError(error: unknown): Response {
  if (error instanceof JobDomainError && error.code === "database_unavailable") {
    return errorResponse(error.code, error.message, 503);
  }
  return errorResponse("internal_error", "Internal server error", 500);
}

function hasJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

type ParseResult<T> = { success: true; data: T } | { success: false; response: Response };

async function parseJson<T>(schema: z.ZodType<T>, request: Request): Promise<ParseResult<T>> {
  if (!hasJsonContentType(request)) {
    return { success: false, response: invalidRequest() };
  }

  try {
    const result = schema.safeParse(await request.json());
    return result.success
      ? { success: true, data: result.data }
      : { success: false, response: invalidRequest() };
  } catch {
    return { success: false, response: invalidRequest() };
  }
}

export function createJobToolHandlers(options: {
  token: string;
  saveJobRecord: typeof saveJobRecord;
}): JobToolHandlers {
  assertValidToolTokenConfig(options.token);

  return {
    async create(request) {
      if (!hasValidToolBearer(request, options.token)) {
        return errorResponse("unauthorized", "Unauthorized", 401);
      }

      const parsed = await parseJson(CreateToolJobSchema, request);
      if (!parsed.success) return parsed.response;

      try {
        const result = await options.saveJobRecord(parsed.data);
        return json(result);
      } catch (error) {
        return toolError(error);
      }
    },
  };
}
