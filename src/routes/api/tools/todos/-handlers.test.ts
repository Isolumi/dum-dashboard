import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Todo } from "#/lib/database.types";
import { TodoDomainError } from "#/routes/todos/todo.domain";
import { createTodoToolHandlers } from "./-handlers";

const TOKEN = "tool-token-with-at-least-thirty-two-bytes";
const RAW_DATABASE_MESSAGE = "postgres password=database-secret relation todos failed";
const TODO_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_ID = "11111111-1111-4111-8111-111111111111";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    created_at: "2026-09-14T12:00:00.000Z",
    due_date: null,
    due_date_has_time: false,
    id: TODO_ID,
    name: "Pay hydro",
    priority: "low",
    sort_order: 4,
    status: "not_started",
    today_date: null,
    today_sort_order: null,
    ...overrides,
  };
}

function projectedTodo(todo = makeTodo()) {
  return {
    id: todo.id,
    name: todo.name,
    section: todo.today_date !== null ? ("today" as const) : todo.priority,
    status: todo.status,
    due_date: todo.due_date,
    due_date_has_time: todo.due_date_has_time,
    sort_order: todo.sort_order,
    today_date: todo.today_date,
    today_sort_order: todo.today_sort_order,
    created_at: todo.created_at,
  };
}

function authorizedRequest(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${TOKEN}`);
  return new Request(`http://dumq${path}`, { ...init, headers });
}

function jsonRequest(path: string, body: unknown, method = "POST"): Request {
  return authorizedRequest(path, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json; charset=utf-8" },
    method,
  });
}

async function expectJson(response: Response, status: number, body: unknown): Promise<void> {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-type")).toBe("application/json");
  await expect(response.json()).resolves.toEqual(body);
}

const domain = {
  createTodoRecord: vi.fn(),
  deleteTodoRecord: vi.fn(),
  deleteTodoRecordIfUnchanged: vi.fn(),
  getTodoRecord: vi.fn(),
  listTodoRecords: vi.fn(),
  moveTodoRecordToSectionEnd: vi.fn(),
  updateTodoRecord: vi.fn(),
};

const handlers = createTodoToolHandlers({ token: TOKEN, domain });

const jsonMutationCases = [
  {
    body: { name: "Pay hydro" },
    domainOperation: domain.createTodoRecord,
    invoke: (request: Request) => handlers.create(request),
    method: "POST",
    name: "create",
    path: "/api/tools/todos",
  },
  {
    body: { name: "Pay hydro bill" },
    domainOperation: domain.updateTodoRecord,
    invoke: (request: Request) => handlers.update(request, TODO_ID),
    method: "PATCH",
    name: "update",
    path: `/api/tools/todos/${TODO_ID}`,
  },
  {
    body: { section: "today" },
    domainOperation: domain.moveTodoRecordToSectionEnd,
    invoke: (request: Request) => handlers.move(request, TODO_ID),
    method: "POST",
    name: "move",
    path: `/api/tools/todos/${TODO_ID}/move`,
  },
  {
    body: projectedTodo(),
    domainOperation: domain.deleteTodoRecordIfUnchanged,
    invoke: (request: Request) => handlers.delete(request, TODO_ID),
    method: "DELETE",
    name: "delete",
    path: `/api/tools/todos/${TODO_ID}`,
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  domain.createTodoRecord.mockResolvedValue(makeTodo());
  domain.deleteTodoRecord.mockResolvedValue(makeTodo());
  domain.deleteTodoRecordIfUnchanged.mockResolvedValue(makeTodo());
  domain.getTodoRecord.mockResolvedValue(makeTodo());
  domain.listTodoRecords.mockResolvedValue([makeTodo()]);
  domain.moveTodoRecordToSectionEnd.mockResolvedValue(makeTodo());
  domain.updateTodoRecord.mockResolvedValue(makeTodo());
});

describe("createTodoToolHandlers", () => {
  it("authenticates before it calls the list domain operation", async () => {
    const response = await handlers.list(new Request("http://dumq/api/tools/todos"));

    await expectJson(response, 401, {
      error: { code: "unauthorized", message: "Unauthorized" },
    });
    expect(domain.listTodoRecords).not.toHaveBeenCalled();
  });

  it.each([
    [
      "list with a wrong bearer",
      () =>
        handlers.list(
          new Request("http://dumq/api/tools/todos?limit=invalid", {
            headers: { authorization: "Bearer wrong-token" },
          }),
        ),
    ],
    ["get", () => handlers.get(new Request("http://dumq/api/tools/todos/bad"), "bad")],
    [
      "create",
      () =>
        handlers.create(
          new Request("http://dumq/api/tools/todos", { body: "not-json", method: "POST" }),
        ),
    ],
    [
      "update",
      () =>
        handlers.update(
          new Request("http://dumq/api/tools/todos/bad", { body: "not-json", method: "PATCH" }),
          "bad",
        ),
    ],
    [
      "move",
      () =>
        handlers.move(
          new Request("http://dumq/api/tools/todos/bad/move", {
            body: "not-json",
            method: "POST",
          }),
          "bad",
        ),
    ],
    ["delete", () => handlers.delete(new Request("http://dumq/api/tools/todos/bad"), "bad")],
  ])("returns 401 before parsing or domain calls for %s", async (_name, invoke) => {
    const response = await invoke();

    await expectJson(response, 401, {
      error: { code: "unauthorized", message: "Unauthorized" },
    });
    expect(Object.values(domain).every((operation) => operation.mock.calls.length === 0)).toBe(
      true,
    );
  });

  it("rejects malformed list query parameters", async () => {
    const response = await handlers.list(
      authorizedRequest("/api/tools/todos?section=medium&offset=1"),
    );

    await expectJson(response, 400, {
      error: { code: "invalid_request", message: "Invalid request" },
    });
    expect(domain.listTodoRecords).not.toHaveBeenCalled();
  });

  it.each([
    ["query", "query=hydro&query=rent"],
    ["section", "section=high&section=low"],
    ["status", "status=incomplete&status=all"],
    ["limit", "limit=10&limit=20"],
  ])("rejects a repeated %s query parameter", async (_name, queryString) => {
    const response = await handlers.list(authorizedRequest(`/api/tools/todos?${queryString}`));

    await expectJson(response, 400, {
      error: { code: "invalid_request", message: "Invalid request" },
    });
    expect(domain.listTodoRecords).not.toHaveBeenCalled();
  });

  it.each([
    ["get", () => handlers.get(authorizedRequest("/api/tools/todos/bad"), "bad")],
    [
      "update",
      () => handlers.update(jsonRequest("/api/tools/todos/bad", { name: "New" }, "PATCH"), "bad"),
    ],
    [
      "move",
      () => handlers.move(jsonRequest("/api/tools/todos/bad/move", { section: "today" }), "bad"),
    ],
    ["delete", () => handlers.delete(authorizedRequest("/api/tools/todos/bad"), "bad")],
  ])("rejects a malformed ID for %s", async (_name, invoke) => {
    const response = await invoke();

    await expectJson(response, 400, {
      error: { code: "invalid_request", message: "Invalid request" },
    });
    expect(Object.values(domain).every((operation) => operation.mock.calls.length === 0)).toBe(
      true,
    );
  });

  it.each([
    [
      "create",
      () =>
        handlers.create(
          authorizedRequest("/api/tools/todos", {
            body: "not-json",
            headers: { "content-type": "application/json" },
            method: "POST",
          }),
        ),
    ],
    [
      "update",
      () =>
        handlers.update(
          authorizedRequest(`/api/tools/todos/${TODO_ID}`, {
            body: "not-json",
            headers: { "content-type": "application/json" },
            method: "PATCH",
          }),
          TODO_ID,
        ),
    ],
    [
      "move",
      () =>
        handlers.move(
          authorizedRequest(`/api/tools/todos/${TODO_ID}/move`, {
            body: "not-json",
            headers: { "content-type": "application/json" },
            method: "POST",
          }),
          TODO_ID,
        ),
    ],
    [
      "delete",
      () =>
        handlers.delete(
          authorizedRequest(`/api/tools/todos/${TODO_ID}`, {
            body: "not-json",
            headers: { "content-type": "application/json" },
            method: "DELETE",
          }),
          TODO_ID,
        ),
    ],
  ])("rejects malformed JSON for %s", async (_name, invoke) => {
    const response = await invoke();

    await expectJson(response, 400, {
      error: { code: "invalid_request", message: "Invalid request" },
    });
    expect(Object.values(domain).every((operation) => operation.mock.calls.length === 0)).toBe(
      true,
    );
  });

  describe.each(jsonMutationCases)("$name JSON media type", (mutation) => {
    it.each([
      ["missing", undefined],
      ["text/plain", "text/plain"],
    ])("rejects a %s Content-Type before body parsing or domain calls", async (_name, value) => {
      const request = authorizedRequest(mutation.path, {
        body: JSON.stringify(mutation.body),
        headers: value ? { "content-type": value } : undefined,
        method: mutation.method,
      });
      if (!value) request.headers.delete("content-type");
      const jsonSpy = vi.spyOn(request, "json");

      const response = await mutation.invoke(request);

      await expectJson(response, 400, {
        error: { code: "invalid_request", message: "Invalid request" },
      });
      expect(jsonSpy).not.toHaveBeenCalled();
      expect(mutation.domainOperation).not.toHaveBeenCalled();
    });
  });

  it.each([
    ["create", () => handlers.create(jsonRequest("/api/tools/todos", { priority: "high" }))],
    [
      "update",
      () => handlers.update(jsonRequest(`/api/tools/todos/${TODO_ID}`, {}, "PATCH"), TODO_ID),
    ],
    [
      "move",
      () =>
        handlers.move(
          jsonRequest(`/api/tools/todos/${TODO_ID}/move`, { section: "medium" }),
          TODO_ID,
        ),
    ],
    [
      "delete",
      () =>
        handlers.delete(
          jsonRequest(
            `/api/tools/todos/${TODO_ID}`,
            { ...projectedTodo(), priority: "low" },
            "DELETE",
          ),
          TODO_ID,
        ),
    ],
  ])("rejects a malformed %s body", async (_name, invoke) => {
    const response = await invoke();

    await expectJson(response, 400, {
      error: { code: "invalid_request", message: "Invalid request" },
    });
    expect(Object.values(domain).every((operation) => operation.mock.calls.length === 0)).toBe(
      true,
    );
  });

  it("passes normalized filters and returns projected todos", async () => {
    const todo = Object.assign(
      makeTodo({ priority: "high", today_date: "2026-09-14", today_sort_order: 2 }),
      { private_column: "must not leave the server" },
    );
    domain.listTodoRecords.mockResolvedValue([todo]);

    const response = await handlers.list(
      authorizedRequest(
        "/api/tools/todos?query=%20%20hydro%20%20&section=today&status=all&limit=10",
      ),
    );

    await expectJson(response, 200, {
      todos: [
        {
          created_at: todo.created_at,
          due_date: null,
          due_date_has_time: false,
          id: TODO_ID,
          name: "Pay hydro",
          section: "today",
          sort_order: 4,
          status: "not_started",
          today_date: "2026-09-14",
          today_sort_order: 2,
        },
      ],
    });
    expect(domain.listTodoRecords).toHaveBeenCalledWith({
      limit: 10,
      query: "hydro",
      section: "today",
      status: "all",
    });
  });

  it("returns one projected todo", async () => {
    const response = await handlers.get(authorizedRequest(`/api/tools/todos/${TODO_ID}`), TODO_ID);

    await expectJson(response, 200, {
      todo: {
        created_at: "2026-09-14T12:00:00.000Z",
        due_date: null,
        due_date_has_time: false,
        id: TODO_ID,
        name: "Pay hydro",
        section: "low",
        sort_order: 4,
        status: "not_started",
        today_date: null,
        today_sort_order: null,
      },
    });
    expect(domain.getTodoRecord).toHaveBeenCalledWith(TODO_ID);
  });

  it("creates Low and not_started todos by default", async () => {
    const response = await handlers.create(
      jsonRequest("/api/tools/todos", { name: " Pay hydro " }),
    );

    expect(domain.createTodoRecord).toHaveBeenCalledWith({
      name: "Pay hydro",
      priority: "low",
      status: "not_started",
    });
    await expectJson(response, 200, { todo: expect.objectContaining({ id: TODO_ID }) });
  });

  it("returns the final patched todo", async () => {
    const finalTodo = makeTodo({ name: "Pay hydro bill", status: "complete" });
    domain.updateTodoRecord.mockResolvedValue(finalTodo);

    const response = await handlers.update(
      jsonRequest(
        `/api/tools/todos/${TODO_ID}`,
        { name: " Pay hydro bill ", status: "complete" },
        "PATCH",
      ),
      TODO_ID,
    );

    expect(domain.updateTodoRecord).toHaveBeenCalledWith({
      id: TODO_ID,
      name: "Pay hydro bill",
      status: "complete",
    });
    await expectJson(response, 200, {
      todo: expect.objectContaining({ id: TODO_ID, name: "Pay hydro bill", status: "complete" }),
    });
  });

  it.each(["today", "high", "low"] as const)(
    "moves a todo to %s and returns the final todo",
    async (section) => {
      const finalTodo = makeTodo({
        priority: section === "high" ? "high" : "low",
        today_date: section === "today" ? "2026-09-14" : null,
      });
      domain.moveTodoRecordToSectionEnd.mockResolvedValue(finalTodo);

      const response = await handlers.move(
        jsonRequest(`/api/tools/todos/${TODO_ID}/move`, { section }),
        TODO_ID,
      );

      expect(domain.moveTodoRecordToSectionEnd).toHaveBeenCalledWith(TODO_ID, section);
      await expectJson(response, 200, {
        todo: expect.objectContaining({ id: TODO_ID, section }),
      });
    },
  );

  it("returns the stable ID of the deleted todo", async () => {
    const expected = projectedTodo();
    domain.deleteTodoRecordIfUnchanged.mockResolvedValue(makeTodo({ id: OTHER_ID }));

    const response = await handlers.delete(
      jsonRequest(`/api/tools/todos/${TODO_ID}`, expected, "DELETE"),
      TODO_ID,
    );

    expect(domain.deleteTodoRecordIfUnchanged).toHaveBeenCalledWith(TODO_ID, expected);
    expect(domain.deleteTodoRecord).not.toHaveBeenCalled();
    await expectJson(response, 200, { deleted: { id: OTHER_ID } });
  });

  it("requires the DELETE snapshot body", async () => {
    const request = authorizedRequest(`/api/tools/todos/${TODO_ID}`, { method: "DELETE" });
    request.headers.delete("content-type");

    const response = await handlers.delete(request, TODO_ID);

    await expectJson(response, 400, {
      error: { code: "invalid_request", message: "Invalid request" },
    });
    expect(domain.deleteTodoRecordIfUnchanged).not.toHaveBeenCalled();
    expect(domain.deleteTodoRecord).not.toHaveBeenCalled();
  });

  it("rejects a DELETE snapshot for a different stable ID", async () => {
    const response = await handlers.delete(
      jsonRequest(
        `/api/tools/todos/${TODO_ID}`,
        projectedTodo(makeTodo({ id: OTHER_ID })),
        "DELETE",
      ),
      TODO_ID,
    );

    await expectJson(response, 400, {
      error: { code: "invalid_request", message: "Invalid request" },
    });
    expect(domain.deleteTodoRecordIfUnchanged).not.toHaveBeenCalled();
    expect(domain.deleteTodoRecord).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", 404, "Todo not found"],
    ["conflict", 409, "Todo changed; retry the request"],
    ["database_unavailable", 503, "Todo service unavailable"],
  ] as const)("maps %s domain errors to %i", async (code, status, message) => {
    domain.listTodoRecords.mockRejectedValue(new TodoDomainError(code));

    const response = await handlers.list(authorizedRequest("/api/tools/todos"));

    await expectJson(response, status, { error: { code, message } });
  });

  it("maps unknown errors to a safe 500 without logging secrets", async () => {
    const consoleSpies = [
      vi.spyOn(console, "error").mockImplementation(() => undefined),
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
    ];
    domain.listTodoRecords.mockRejectedValue(new SyntaxError(RAW_DATABASE_MESSAGE));

    const response = await handlers.list(authorizedRequest("/api/tools/todos"));
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
