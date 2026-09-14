import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createTodoRecordMock,
  deleteTodoRecordMock,
  getTodoRecordMock,
  listTodoRecordsMock,
  moveTodoRecordMock,
  reorderTodoRecordsMock,
  updateTodoRecordMock,
} = vi.hoisted(() => ({
  createTodoRecordMock: vi.fn(),
  deleteTodoRecordMock: vi.fn(),
  getTodoRecordMock: vi.fn(),
  listTodoRecordsMock: vi.fn(),
  moveTodoRecordMock: vi.fn(),
  reorderTodoRecordsMock: vi.fn(),
  updateTodoRecordMock: vi.fn(),
}));

const todoRecord = {
  created_at: "2026-09-14T12:00:00.000Z",
  due_date: null,
  due_date_has_time: false,
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Test todo",
  priority: "low" as const,
  sort_order: 0,
  status: "not_started" as const,
  today_date: null,
  today_sort_order: null,
};

vi.mock("@tanstack/react-start", () => ({
  createServerFn: vi.fn(() => {
    let validator: { parse: (input: unknown) => unknown } | undefined;
    const builder = {
      inputValidator(nextValidator: { parse: (input: unknown) => unknown }) {
        validator = nextValidator;
        return builder;
      },
      handler(handler: (context: { data: unknown }) => unknown) {
        return (options?: { data?: unknown }) =>
          handler({ data: validator ? validator.parse(options?.data) : options?.data });
      },
    };
    return builder;
  }),
}));

vi.mock("#/lib/server-auth", () => ({
  assertSameOrigin: vi.fn(),
  getOwnerUser: vi.fn(() => ({ id: "owner-user-id" })),
  noStore: vi.fn(),
}));

vi.mock("./todo.domain", () => ({
  createTodoRecord: createTodoRecordMock,
  deleteTodoRecord: deleteTodoRecordMock,
  getTodoRecord: getTodoRecordMock,
  listTodoRecords: listTodoRecordsMock,
  moveTodoRecord: moveTodoRecordMock,
  reorderTodoRecords: reorderTodoRecordsMock,
  updateTodoRecord: updateTodoRecordMock,
}));

const {
  assertTodoMutationRequest,
  createTodo,
  CreateTodoSchema,
  CreateTodoInputSchema,
  deleteTodo,
  DeleteTodoSchema,
  getTodo,
  GetTodoSchema,
  getTodos,
  GetTodosInputSchema,
  moveTodo,
  MoveTodoInputSchema,
  normalizeCreateTodoFields,
  normalizeUpdateTodoFields,
  reorderTodos,
  ReorderTodosSchema,
  updateTodo,
  UpdateTodoSchema,
} = await import("./todos.functions");
const { assertSameOrigin, getOwnerUser, noStore } = await import("#/lib/server-auth");

const TODO_ID = "550e8400-e29b-41d4-a716-446655440000";
const SECOND_TODO_ID = "11111111-1111-4111-8111-111111111111";
const LOW_TODO_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  createTodoRecordMock.mockResolvedValue(todoRecord);
  deleteTodoRecordMock.mockResolvedValue(todoRecord);
  getTodoRecordMock.mockResolvedValue(todoRecord);
  listTodoRecordsMock.mockResolvedValue([]);
  moveTodoRecordMock.mockResolvedValue(undefined);
  reorderTodoRecordsMock.mockResolvedValue(undefined);
  updateTodoRecordMock.mockResolvedValue(todoRecord);
});

describe("CreateTodoSchema", () => {
  it("rejects empty name", () => {
    const result = CreateTodoSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("trims whitespace-only names before validating", () => {
    const result = CreateTodoSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("accepts valid todo with all fields", () => {
    const result = CreateTodoSchema.safeParse({
      name: "Buy groceries",
      priority: "high",
      status: "not_started",
      due_date: "2026-04-01",
    });
    expect(result.success).toBe(true);
  });

  it("uses default priority of low when omitted", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test todo" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("low");
    }
  });

  it("uses default status of not_started when omitted", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test todo" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("not_started");
    }
  });

  it("leaves due date precision open for server-side normalization", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test todo" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.due_date_has_time).toBeUndefined();
    }
  });

  it("accepts valid priority values", () => {
    const priorities = ["high", "low"] as const;
    for (const priority of priorities) {
      const result = CreateTodoSchema.safeParse({ name: "Test", priority });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid priority value", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test", priority: "urgent" });
    expect(result.success).toBe(false);
  });

  it("rejects the retired medium priority", () => {
    expect(CreateTodoSchema.safeParse({ name: "Test", priority: "medium" }).success).toBe(false);
    expect(UpdateTodoSchema.safeParse({ id: TODO_ID, priority: "medium" }).success).toBe(false);
  });

  it("accepts valid status values", () => {
    const statuses = ["not_started", "started", "complete"] as const;
    for (const status of statuses) {
      const result = CreateTodoSchema.safeParse({ name: "Test", status });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status value", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test", status: "done" });
    expect(result.success).toBe(false);
  });

  it("accepts null due_date", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test", due_date: null });
    expect(result.success).toBe(true);
  });

  it("accepts omitted due_date", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format for due_date", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test", due_date: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("accepts an ISO timestamp with an offset for due_date", () => {
    expect(
      CreateTodoSchema.safeParse({
        name: "Timed todo",
        due_date: "2026-08-09T15:30:00.000Z",
        due_date_has_time: true,
      }).success,
    ).toBe(true);
  });

  it("normalizes timestamp due dates to time-aware metadata when omitted", () => {
    const result = CreateTodoSchema.safeParse({
      name: "Timed todo",
      due_date: "2026-08-09T15:30:00.000Z",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(normalizeCreateTodoFields(result.data).due_date_has_time).toBe(true);
  });

  it("normalizes a cleared create due date to time-free metadata", () => {
    const result = CreateTodoSchema.safeParse({
      name: "No due date",
      due_date: null,
      due_date_has_time: true,
    });

    expect(result.success).toBe(true);
    if (result.success)
      expect(normalizeCreateTodoFields(result.data).due_date_has_time).toBe(false);
  });

  it("rejects non-boolean due date precision metadata", () => {
    expect(
      CreateTodoSchema.safeParse({
        name: "Timed todo",
        due_date: "2026-08-09T15:30:00.000Z",
        due_date_has_time: "yes",
      }).success,
    ).toBe(false);
  });
});

describe("single-owner todo function inputs", () => {
  it("accepts reads without a browser access token", () => {
    expect(GetTodosInputSchema.safeParse({}).success).toBe(true);
    expect(GetTodosInputSchema.safeParse({ supabase_access_token: "session-token" }).success).toBe(
      false,
    );
  });

  it("rejects browser access tokens for todo writes", () => {
    const result = CreateTodoInputSchema.safeParse({
      supabase_access_token: "session-token",
      name: "Secure todo",
    });
    expect(result.success).toBe(false);
  });

  it("checks same-origin protection before every todo mutation", async () => {
    assertTodoMutationRequest();

    expect(assertSameOrigin).toHaveBeenCalledOnce();
  });
});

describe("UpdateTodoSchema", () => {
  it("requires valid UUID for id", () => {
    const result = UpdateTodoSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts valid UUID with no other fields", () => {
    const result = UpdateTodoSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with only name", () => {
    const result = UpdateTodoSchema.safeParse({
      id: TODO_ID,
      name: "Updated name",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name if provided", () => {
    const result = UpdateTodoSchema.safeParse({
      id: TODO_ID,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid priority update", () => {
    const result = UpdateTodoSchema.safeParse({
      id: TODO_ID,
      priority: "low",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid priority in update", () => {
    const result = UpdateTodoSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      priority: "critical",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an ISO timestamp in UpdateTodoSchema", () => {
    expect(
      UpdateTodoSchema.safeParse({
        id: "00000000-0000-0000-0000-000000000001",
        due_date: "2026-08-09T11:30:00-04:00",
      }).success,
    ).toBe(true);
  });

  it("normalizes a timestamp update to time-aware metadata when omitted", () => {
    const result = UpdateTodoSchema.safeParse({
      id: TODO_ID,
      due_date: "2026-08-09T11:30:00-04:00",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(normalizeUpdateTodoFields(result.data).due_date_has_time).toBe(true);
  });

  it("normalizes a cleared update due date to time-free metadata", () => {
    const result = UpdateTodoSchema.safeParse({
      id: TODO_ID,
      due_date: null,
      due_date_has_time: true,
    });

    expect(result.success).toBe(true);
    if (result.success)
      expect(normalizeUpdateTodoFields(result.data).due_date_has_time).toBe(false);
  });

  it("accepts an explicit due date time flag in updates", () => {
    expect(
      UpdateTodoSchema.safeParse({
        id: TODO_ID,
        due_date: "2026-08-09T11:30:00-04:00",
        due_date_has_time: true,
      }).success,
    ).toBe(true);
  });

  it("rejects non-boolean due date precision metadata in updates", () => {
    expect(
      UpdateTodoSchema.safeParse({
        id: TODO_ID,
        due_date_has_time: 1,
      }).success,
    ).toBe(false);
  });
});

describe("DeleteTodoSchema", () => {
  it("requires valid UUID", () => {
    const result = DeleteTodoSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts valid UUID", () => {
    const result = DeleteTodoSchema.safeParse({ id: TODO_ID });
    expect(result.success).toBe(true);
  });

  it("rejects missing id", () => {
    const result = DeleteTodoSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("ReorderTodosSchema", () => {
  it("rejects empty reorder batches", () => {
    const result = ReorderTodosSchema.safeParse({
      section: "today",
      expected_ids: [],
      ordered_ids: [],
    });
    expect(result.success).toBe(false);
  });

  it.each([
    ["duplicate expected id", [TODO_ID, TODO_ID], [SECOND_TODO_ID, TODO_ID]],
    ["duplicate ordered id", [TODO_ID, SECOND_TODO_ID], [TODO_ID, TODO_ID]],
    ["different Todo sets", [TODO_ID, SECOND_TODO_ID], [TODO_ID, LOW_TODO_ID]],
  ])("rejects %s", (_name, expected_ids, ordered_ids) => {
    expect(
      ReorderTodosSchema.safeParse({ section: "high", expected_ids, ordered_ids }).success,
    ).toBe(false);
  });
});

describe("reorderTodos", () => {
  it("checks the mutation boundary before it calls the shared domain", async () => {
    await expect(
      reorderTodos({
        data: {
          section: "today",
          expected_ids: [TODO_ID, SECOND_TODO_ID],
          ordered_ids: [SECOND_TODO_ID, TODO_ID],
        },
      }),
    ).resolves.toBeUndefined();

    expect(reorderTodoRecordsMock).toHaveBeenCalledWith({
      section: "today",
      expected_ids: [TODO_ID, SECOND_TODO_ID],
      ordered_ids: [SECOND_TODO_ID, TODO_ID],
    });
    expect(assertSameOrigin).toHaveBeenCalledOnce();
    expect(vi.mocked(assertSameOrigin).mock.invocationCallOrder[0]).toBeLessThan(
      reorderTodoRecordsMock.mock.invocationCallOrder[0],
    );
  });

  it("preserves a domain reorder failure", async () => {
    reorderTodoRecordsMock.mockRejectedValueOnce(new Error("Todo changed; retry the request"));

    await expect(
      reorderTodos({
        data: {
          section: "high",
          expected_ids: [TODO_ID, SECOND_TODO_ID],
          ordered_ids: [SECOND_TODO_ID, TODO_ID],
        },
      }),
    ).rejects.toThrow("Todo changed; retry the request");
  });
});

describe("MoveTodoInputSchema", () => {
  const validMove = {
    id: TODO_ID,
    target_section: "today" as const,
    source_ids: [SECOND_TODO_ID],
    target_ids: [TODO_ID, LOW_TODO_ID],
  };

  it("accepts one complete normalized source and target order", () => {
    expect(MoveTodoInputSchema.safeParse(validMove).success).toBe(true);
  });

  it.each([
    ["moved Todo missing from target", { ...validMove, target_ids: [LOW_TODO_ID] }],
    ["moved Todo left in source", { ...validMove, source_ids: [TODO_ID, SECOND_TODO_ID] }],
    ["duplicate source id", { ...validMove, source_ids: [SECOND_TODO_ID, SECOND_TODO_ID] }],
    ["duplicate target id", { ...validMove, target_ids: [TODO_ID, LOW_TODO_ID, LOW_TODO_ID] }],
    ["overlapping lists", { ...validMove, source_ids: [LOW_TODO_ID] }],
  ])("rejects %s", (_name, input) => {
    expect(MoveTodoInputSchema.safeParse(input).success).toBe(false);
  });

  it("rejects unknown input fields", () => {
    expect(
      MoveTodoInputSchema.safeParse({ ...validMove, service_role_key: "secret" }).success,
    ).toBe(false);
  });
});

describe("moveTodo", () => {
  it("checks the mutation boundary before it calls the shared domain", async () => {
    await expect(
      moveTodo({
        data: {
          id: TODO_ID,
          target_section: "today",
          source_ids: [SECOND_TODO_ID],
          target_ids: [TODO_ID, LOW_TODO_ID],
        },
      }),
    ).resolves.toBeUndefined();

    expect(moveTodoRecordMock).toHaveBeenCalledWith({
      id: TODO_ID,
      target_section: "today",
      source_ids: [SECOND_TODO_ID],
      target_ids: [TODO_ID, LOW_TODO_ID],
    });
    expect(assertSameOrigin).toHaveBeenCalledOnce();
    expect(vi.mocked(assertSameOrigin).mock.invocationCallOrder[0]).toBeLessThan(
      moveTodoRecordMock.mock.invocationCallOrder[0],
    );
  });

  it("preserves a domain move failure", async () => {
    moveTodoRecordMock.mockRejectedValueOnce(new Error("Todo changed; retry the request"));

    await expect(
      moveTodo({
        data: {
          id: TODO_ID,
          target_section: "today",
          source_ids: [SECOND_TODO_ID],
          target_ids: [TODO_ID, LOW_TODO_ID],
        },
      }),
    ).rejects.toThrow("Todo changed; retry the request");
  });
});

describe("thin browser todo functions", () => {
  it("checks the owner before it lists records through the domain", async () => {
    await expect(getTodos()).resolves.toEqual([]);

    expect(noStore).toHaveBeenCalledOnce();
    expect(getOwnerUser).toHaveBeenCalledOnce();
    expect(listTodoRecordsMock).toHaveBeenCalledWith({
      limit: Number.POSITIVE_INFINITY,
      status: "all",
    });
    expect(vi.mocked(getOwnerUser).mock.invocationCallOrder[0]).toBeLessThan(
      listTodoRecordsMock.mock.invocationCallOrder[0],
    );
  });

  it("checks the owner before it gets a record through the domain", async () => {
    await expect(getTodo({ data: { id: TODO_ID } })).resolves.toEqual(todoRecord);

    expect(getOwnerUser).toHaveBeenCalledOnce();
    expect(getTodoRecordMock).toHaveBeenCalledWith(TODO_ID);
    expect(vi.mocked(getOwnerUser).mock.invocationCallOrder[0]).toBeLessThan(
      getTodoRecordMock.mock.invocationCallOrder[0],
    );
  });

  it("checks the mutation boundary before create, update, and delete domain calls", async () => {
    await expect(createTodo({ data: { name: "New todo" } })).resolves.toEqual(todoRecord);
    await expect(updateTodo({ data: { id: TODO_ID, name: "Renamed todo" } })).resolves.toEqual(
      todoRecord,
    );
    await expect(deleteTodo({ data: { id: TODO_ID } })).resolves.toBeUndefined();

    expect(assertSameOrigin).toHaveBeenCalledTimes(3);
    expect(createTodoRecordMock).toHaveBeenCalledWith({
      name: "New todo",
      priority: "low",
      status: "not_started",
    });
    expect(updateTodoRecordMock).toHaveBeenCalledWith({ id: TODO_ID, name: "Renamed todo" });
    expect(deleteTodoRecordMock).toHaveBeenCalledWith(TODO_ID);
    expect(vi.mocked(assertSameOrigin).mock.invocationCallOrder[0]).toBeLessThan(
      createTodoRecordMock.mock.invocationCallOrder[0],
    );
    expect(vi.mocked(assertSameOrigin).mock.invocationCallOrder[1]).toBeLessThan(
      updateTodoRecordMock.mock.invocationCallOrder[0],
    );
    expect(vi.mocked(assertSameOrigin).mock.invocationCallOrder[2]).toBeLessThan(
      deleteTodoRecordMock.mock.invocationCallOrder[0],
    );
  });
});

describe("GetTodoSchema", () => {
  it("requires valid UUID", () => {
    const result = GetTodoSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts valid UUID", () => {
    const result = GetTodoSchema.safeParse({ id: TODO_ID });
    expect(result.success).toBe(true);
  });

  it("rejects missing id", () => {
    const result = GetTodoSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
