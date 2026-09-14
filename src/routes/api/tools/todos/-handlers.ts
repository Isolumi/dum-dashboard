import { z } from "zod";

import type { Todo } from "#/lib/database.types";
import { assertValidToolTokenConfig, hasValidToolBearer } from "#/lib/tool-api-auth";
import {
  TodoDomainError,
  type createTodoRecord,
  type deleteTodoRecord,
  type getTodoRecord,
  type listTodoRecords,
  type moveTodoRecordToSectionEnd,
  type updateTodoRecord,
} from "#/routes/todos/todo.domain";
import { GetTodoSchema } from "#/routes/todos/todo.schemas";
import {
  CreateToolTodoSchema,
  ListTodosQuerySchema,
  MoveToolTodoSchema,
  UpdateToolTodoSchema,
} from "./-schemas";

type TodoToolDomain = {
  createTodoRecord: typeof createTodoRecord;
  deleteTodoRecord: typeof deleteTodoRecord;
  getTodoRecord: typeof getTodoRecord;
  listTodoRecords: typeof listTodoRecords;
  moveTodoRecordToSectionEnd: typeof moveTodoRecordToSectionEnd;
  updateTodoRecord: typeof updateTodoRecord;
};

export type TodoToolHandlers = {
  create(request: Request): Promise<Response>;
  delete(request: Request, id: string): Promise<Response>;
  get(request: Request, id: string): Promise<Response>;
  list(request: Request): Promise<Response>;
  move(request: Request, id: string): Promise<Response>;
  update(request: Request, id: string): Promise<Response>;
};

type ToolErrorCode =
  | "conflict"
  | "database_unavailable"
  | "internal_error"
  | "invalid_request"
  | "not_found"
  | "unauthorized";

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
  if (error instanceof TodoDomainError) {
    const status = error.code === "not_found" ? 404 : error.code === "conflict" ? 409 : 503;
    return errorResponse(error.code, error.message, status);
  }
  return errorResponse("internal_error", "Internal server error", 500);
}

function toToolTodo(todo: Todo) {
  return {
    id: todo.id,
    name: todo.name,
    section: todo.today_date !== null ? "today" : todo.priority,
    status: todo.status,
    due_date: todo.due_date,
    due_date_has_time: todo.due_date_has_time,
    sort_order: todo.sort_order,
    today_date: todo.today_date,
    today_sort_order: todo.today_sort_order,
    created_at: todo.created_at,
  } as const;
}

type ParseResult<T> = { success: true; data: T } | { success: false; response: Response };

function parse<T>(schema: z.ZodType<T>, value: unknown): ParseResult<T> {
  const result = schema.safeParse(value);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, response: invalidRequest() };
}

async function parseJson<T>(schema: z.ZodType<T>, request: Request): Promise<ParseResult<T>> {
  try {
    return parse(schema, await request.json());
  } catch {
    return { success: false, response: invalidRequest() };
  }
}

export function createTodoToolHandlers(options: {
  token: string;
  domain: TodoToolDomain;
}): TodoToolHandlers {
  assertValidToolTokenConfig(options.token);

  function authorize(request: Request): Response | undefined {
    return hasValidToolBearer(request, options.token)
      ? undefined
      : errorResponse("unauthorized", "Unauthorized", 401);
  }

  return {
    async list(request) {
      const unauthorized = authorize(request);
      if (unauthorized) return unauthorized;

      const parsed = parse(
        ListTodosQuerySchema,
        Object.fromEntries(new URL(request.url).searchParams),
      );
      if (!parsed.success) return parsed.response;

      try {
        const todos = await options.domain.listTodoRecords(parsed.data);
        return json({ todos: todos.map(toToolTodo) });
      } catch (error) {
        return toolError(error);
      }
    },

    async get(request, id) {
      const unauthorized = authorize(request);
      if (unauthorized) return unauthorized;

      const parsed = parse(GetTodoSchema, { id });
      if (!parsed.success) return parsed.response;

      try {
        const todo = await options.domain.getTodoRecord(parsed.data.id);
        return json({ todo: toToolTodo(todo) });
      } catch (error) {
        return toolError(error);
      }
    },

    async create(request) {
      const unauthorized = authorize(request);
      if (unauthorized) return unauthorized;

      const parsed = await parseJson(CreateToolTodoSchema, request);
      if (!parsed.success) return parsed.response;

      try {
        const todo = await options.domain.createTodoRecord({ ...parsed.data, priority: "low" });
        return json({ todo: toToolTodo(todo) });
      } catch (error) {
        return toolError(error);
      }
    },

    async update(request, id) {
      const unauthorized = authorize(request);
      if (unauthorized) return unauthorized;

      const parsedId = parse(GetTodoSchema, { id });
      if (!parsedId.success) return parsedId.response;
      const parsedBody = await parseJson(UpdateToolTodoSchema, request);
      if (!parsedBody.success) return parsedBody.response;

      try {
        const todo = await options.domain.updateTodoRecord({
          id: parsedId.data.id,
          ...parsedBody.data,
        });
        return json({ todo: toToolTodo(todo) });
      } catch (error) {
        return toolError(error);
      }
    },

    async move(request, id) {
      const unauthorized = authorize(request);
      if (unauthorized) return unauthorized;

      const parsedId = parse(GetTodoSchema, { id });
      if (!parsedId.success) return parsedId.response;
      const parsedBody = await parseJson(MoveToolTodoSchema, request);
      if (!parsedBody.success) return parsedBody.response;

      try {
        const todo = await options.domain.moveTodoRecordToSectionEnd(
          parsedId.data.id,
          parsedBody.data.section,
        );
        return json({ todo: toToolTodo(todo) });
      } catch (error) {
        return toolError(error);
      }
    },

    async delete(request, id) {
      const unauthorized = authorize(request);
      if (unauthorized) return unauthorized;

      const parsed = parse(GetTodoSchema, { id });
      if (!parsed.success) return parsed.response;

      try {
        const todo = await options.domain.deleteTodoRecord(parsed.data.id);
        return json({ deleted: { id: todo.id } });
      } catch (error) {
        return toolError(error);
      }
    },
  };
}
