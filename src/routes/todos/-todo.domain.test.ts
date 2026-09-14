import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Todo } from "#/lib/database.types";

const mocks = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  eqMock: vi.fn(),
  fromMock: vi.fn(),
  ilikeMock: vi.fn(),
  insertMock: vi.fn(),
  isMock: vi.fn(),
  limitMock: vi.fn(),
  listRowsMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  neqMock: vi.fn(),
  notMock: vi.fn(),
  orderMock: vi.fn(),
  rpcMock: vi.fn(),
  selectMock: vi.fn(),
  singleMock: vi.fn(),
  updateMock: vi.fn(),
}));

const query = {
  delete() {
    mocks.deleteMock();
    return query;
  },
  eq(column: string, value: unknown) {
    mocks.eqMock(column, value);
    return query;
  },
  ilike(column: string, value: string) {
    mocks.ilikeMock(column, value);
    return query;
  },
  insert(value: unknown) {
    mocks.insertMock(value);
    return query;
  },
  is(column: string, value: unknown) {
    mocks.isMock(column, value);
    return query;
  },
  limit(value: number) {
    mocks.limitMock(value);
    return query;
  },
  maybeSingle() {
    return mocks.maybeSingleMock();
  },
  neq(column: string, value: unknown) {
    mocks.neqMock(column, value);
    return query;
  },
  not(column: string, operator: string, value: unknown) {
    mocks.notMock(column, operator, value);
    return query;
  },
  order(column: string, options: unknown) {
    mocks.orderMock(column, options);
    return query;
  },
  select(columns: string) {
    mocks.selectMock(columns);
    return query;
  },
  single() {
    return mocks.singleMock();
  },
  // oxlint-disable-next-line unicorn/no-thenable -- Supabase query builders are thenable.
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Todo[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return mocks
      .listRowsMock()
      .then((rows: Todo[]) => onfulfilled?.({ data: rows, error: null }), onrejected);
  },
  update(value: unknown) {
    mocks.updateMock(value);
    return query;
  },
};

vi.mock("#/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mocks.fromMock.mockImplementation(() => query),
    rpc: mocks.rpcMock,
  })),
}));

const {
  CreateTodoSchema,
  MoveTodoSchema,
  ReorderTodosSchema,
  normalizeCreateTodoFields,
  normalizeUpdateTodoFields,
} = await import("./todo.schemas");
const {
  TodoDomainError,
  createTodoRecord,
  deleteTodoRecord,
  getTodoRecord,
  listTodoRecords,
  moveTodoRecord,
  moveTodoRecordToSectionEnd,
  reorderTodoRecords,
  updateTodoRecord,
} = await import("./todo.domain");

const TODO_ID = "550e8400-e29b-41d4-a716-446655440000";
const HIGH_ID = "11111111-1111-4111-8111-111111111111";
const LOW_ID = "22222222-2222-4222-8222-222222222222";

function makeTodo(id: string, priority: Todo["priority"], overrides: Partial<Todo> = {}): Todo {
  return {
    created_at: "2026-09-14T12:00:00.000Z",
    due_date: null,
    due_date_has_time: false,
    id,
    name: `Todo ${id}`,
    priority,
    sort_order: 0,
    status: "not_started",
    today_date: null,
    today_sort_order: null,
    ...overrides,
  };
}

const highTodo = makeTodo(HIGH_ID, "high");
const lowTodo = makeTodo(TODO_ID, "low");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listRowsMock.mockResolvedValue([]);
  mocks.maybeSingleMock.mockResolvedValue({ data: null, error: null });
  mocks.singleMock.mockResolvedValue({ data: null, error: null });
  mocks.rpcMock.mockResolvedValue({ data: null, error: null });
});

describe("shared todo schemas", () => {
  it("defaults new todos to low and not_started", () => {
    expect(CreateTodoSchema.parse({ name: "Pay hydro" })).toMatchObject({
      name: "Pay hydro",
      priority: "low",
      status: "not_started",
    });
  });

  it("keeps the 200-character todo name limit", () => {
    expect(CreateTodoSchema.safeParse({ name: "a".repeat(200) }).success).toBe(true);
    expect(CreateTodoSchema.safeParse({ name: "a".repeat(201) }).success).toBe(false);
  });

  it("keeps the 200-ID reorder and move limits", () => {
    const ids = Array.from(
      { length: 201 },
      (_, index) => `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    );

    expect(
      ReorderTodosSchema.safeParse({
        section: "high",
        expected_ids: ids,
        ordered_ids: ids,
      }).success,
    ).toBe(false);
    expect(
      MoveTodoSchema.safeParse({
        id: ids[0],
        source_ids: [],
        target_ids: ids,
        target_section: "low",
      }).success,
    ).toBe(false);
  });

  it("normalizes a date-only due date as time-free", () => {
    const input = CreateTodoSchema.parse({ name: "File return", due_date: "2026-09-30" });

    expect(normalizeCreateTodoFields(input).due_date_has_time).toBe(false);
  });

  it("normalizes an offset timestamp as time-aware", () => {
    const input = CreateTodoSchema.parse({
      name: "Call supplier",
      due_date: "2026-09-30T09:15:00-04:00",
    });

    expect(normalizeCreateTodoFields(input).due_date_has_time).toBe(true);
    expect(
      normalizeUpdateTodoFields({ id: TODO_ID, due_date: "2026-09-30T09:15:00-04:00" })
        .due_date_has_time,
    ).toBe(true);
  });
});

describe("listTodoRecords", () => {
  it("defaults to incomplete records ordered by sort_order and limits results to 50", async () => {
    mocks.listRowsMock.mockResolvedValue([highTodo]);

    await expect(listTodoRecords()).resolves.toEqual([highTodo]);

    expect(mocks.fromMock).toHaveBeenCalledWith("todos");
    expect(mocks.neqMock).toHaveBeenCalledWith("status", "complete");
    expect(mocks.orderMock).toHaveBeenCalledWith("sort_order", { ascending: true });
    expect(mocks.limitMock).toHaveBeenCalledWith(50);
  });

  it("does not permit a result limit above 50", async () => {
    await listTodoRecords({ limit: 500 });

    expect(mocks.limitMock).toHaveBeenCalledWith(50);
  });

  it("allows the browser wrapper to request all records without a limit", async () => {
    await listTodoRecords({ limit: Number.POSITIVE_INFINITY, status: "all" });

    expect(mocks.limitMock).not.toHaveBeenCalled();
    expect(mocks.eqMock).not.toHaveBeenCalledWith("status", expect.anything());
    expect(mocks.neqMock).not.toHaveBeenCalled();
  });

  it("returns only complete records for status=complete", async () => {
    await listTodoRecords({ status: "complete" });

    expect(mocks.eqMock).toHaveBeenCalledWith("status", "complete");
    expect(mocks.neqMock).not.toHaveBeenCalled();
  });

  it("does not add a status filter for status=all", async () => {
    await listTodoRecords({ status: "all" });

    expect(mocks.eqMock).not.toHaveBeenCalledWith("status", expect.anything());
    expect(mocks.neqMock).not.toHaveBeenCalled();
  });

  it("filters Today by a non-null today_date", async () => {
    await listTodoRecords({ section: "today" });

    expect(mocks.notMock).toHaveBeenCalledWith("today_date", "is", null);
  });

  it.each(["high", "low"] as const)(
    "filters %s by a null today_date and matching priority",
    async (section) => {
      await listTodoRecords({ section });

      expect(mocks.isMock).toHaveBeenCalledWith("today_date", null);
      expect(mocks.eqMock).toHaveBeenCalledWith("priority", section);
    },
  );

  it("trims and limits a name query to 100 characters before ilike", async () => {
    const queryText = `  ${"x".repeat(120)}  `;

    await listTodoRecords({ query: queryText });

    expect(mocks.ilikeMock).toHaveBeenCalledWith("name", `%${"x".repeat(100)}%`);
  });
});

describe("todo record operations", () => {
  it("gets one todo by stable ID", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({ data: highTodo, error: null });

    await expect(getTodoRecord(HIGH_ID)).resolves.toEqual(highTodo);

    expect(mocks.eqMock).toHaveBeenCalledWith("id", HIGH_ID);
  });

  it("maps a missing ID to TodoDomainError(not_found)", async () => {
    await expect(getTodoRecord(TODO_ID)).rejects.toMatchObject({
      code: "not_found",
      message: "Todo not found",
      name: "TodoDomainError",
    });
  });

  it("does not expose database messages in public domain errors", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { code: "XX000", message: "private database detail" },
    });

    const error = await getTodoRecord(TODO_ID).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TodoDomainError);
    expect(error).toMatchObject({
      code: "database_unavailable",
      message: "Todo service unavailable",
    });
    expect((error as Error).message).not.toContain("private database detail");
  });

  it("creates a normalized todo after the last priority order", async () => {
    const createdTodo = makeTodo(TODO_ID, "low", {
      due_date: "2026-09-30",
      name: "Pay hydro",
      sort_order: 5,
    });
    mocks.maybeSingleMock.mockResolvedValueOnce({ data: { sort_order: 4 }, error: null });
    mocks.singleMock.mockResolvedValueOnce({ data: createdTodo, error: null });

    await expect(
      createTodoRecord(CreateTodoSchema.parse({ name: "Pay hydro", due_date: "2026-09-30" })),
    ).resolves.toEqual(createdTodo);

    expect(mocks.eqMock).toHaveBeenCalledWith("priority", "low");
    expect(mocks.insertMock).toHaveBeenCalledWith({
      due_date: "2026-09-30",
      due_date_has_time: false,
      name: "Pay hydro",
      priority: "low",
      sort_order: 5,
      status: "not_started",
    });
  });

  it("updates normalized todo fields without writing the ID", async () => {
    const updatedTodo = makeTodo(TODO_ID, "low", {
      due_date: "2026-09-30T09:15:00-04:00",
    });
    mocks.maybeSingleMock.mockResolvedValueOnce({ data: updatedTodo, error: null });

    await expect(
      updateTodoRecord({ id: TODO_ID, due_date: "2026-09-30T09:15:00-04:00" }),
    ).resolves.toEqual(updatedTodo);

    expect(mocks.updateMock).toHaveBeenCalledWith({
      due_date: "2026-09-30T09:15:00-04:00",
      due_date_has_time: true,
    });
    expect(mocks.eqMock).toHaveBeenCalledWith("id", TODO_ID);
  });

  it("deletes with the projected row and returns the deleted record", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({ data: lowTodo, error: null });

    await expect(deleteTodoRecord(TODO_ID)).resolves.toEqual(lowTodo);

    expect(mocks.deleteMock).toHaveBeenCalledOnce();
    expect(mocks.eqMock).toHaveBeenCalledWith("id", TODO_ID);
    expect(mocks.selectMock).toHaveBeenCalledWith(
      "id,name,status,priority,due_date,due_date_has_time,sort_order,today_date,today_sort_order,created_at",
    );
    expect(mocks.maybeSingleMock).toHaveBeenCalledOnce();
  });

  it("maps a delete with no returned row to not_found", async () => {
    await expect(deleteTodoRecord(TODO_ID)).rejects.toMatchObject({
      code: "not_found",
      message: "Todo not found",
    });
  });

  it("reorders through the existing atomic RPC", async () => {
    await expect(
      reorderTodoRecords({
        expected_ids: [HIGH_ID, TODO_ID],
        ordered_ids: [TODO_ID, HIGH_ID],
        section: "high",
      }),
    ).resolves.toBeUndefined();

    expect(mocks.rpcMock).toHaveBeenCalledWith("reorder_todo_section_atomically", {
      p_expected_ids: [HIGH_ID, TODO_ID],
      p_ordered_ids: [TODO_ID, HIGH_ID],
      p_section: "high",
    });
  });

  it("moves through the existing atomic RPC", async () => {
    await expect(
      moveTodoRecord({
        id: TODO_ID,
        source_ids: [],
        target_ids: [HIGH_ID, TODO_ID],
        target_section: "high",
      }),
    ).resolves.toBeUndefined();

    expect(mocks.rpcMock).toHaveBeenCalledWith("move_todo_between_sections", {
      p_source_ids: [],
      p_target_ids: [HIGH_ID, TODO_ID],
      p_target_section: "high",
      p_todo_id: TODO_ID,
    });
  });

  it("maps a stale move RPC to TodoDomainError(conflict)", async () => {
    mocks.rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "40001", message: "Source or target Todo order is stale" },
    });

    await expect(
      moveTodoRecord({
        id: TODO_ID,
        source_ids: [],
        target_ids: [HIGH_ID, TODO_ID],
        target_section: "high",
      }),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "Todo changed; retry the request",
    });
  });
});

describe("moveTodoRecordToSectionEnd", () => {
  it("moves a todo to the end of the target section through the atomic RPC", async () => {
    mocks.listRowsMock.mockResolvedValue([highTodo, lowTodo]);
    mocks.rpcMock.mockResolvedValue({ data: null, error: null });
    const movedTodo = { ...lowTodo, priority: "high" as const };
    mocks.maybeSingleMock.mockResolvedValueOnce({ data: movedTodo, error: null });

    await expect(moveTodoRecordToSectionEnd(TODO_ID, "high")).resolves.toEqual(movedTodo);

    expect(mocks.rpcMock).toHaveBeenCalledWith("move_todo_between_sections", {
      p_todo_id: TODO_ID,
      p_target_section: "high",
      p_source_ids: [],
      p_target_ids: [HIGH_ID, TODO_ID],
    });
  });

  it("returns the current record without an RPC when the section is unchanged", async () => {
    mocks.listRowsMock.mockResolvedValue([highTodo, lowTodo]);

    await expect(moveTodoRecordToSectionEnd(HIGH_ID, "high")).resolves.toEqual(highTodo);

    expect(mocks.rpcMock).not.toHaveBeenCalled();
    expect(mocks.maybeSingleMock).not.toHaveBeenCalled();
  });

  it("maps a missing move ID to not_found before calling the RPC", async () => {
    mocks.listRowsMock.mockResolvedValue([highTodo]);

    await expect(moveTodoRecordToSectionEnd(LOW_ID, "low")).rejects.toMatchObject({
      code: "not_found",
      message: "Todo not found",
    });

    expect(mocks.rpcMock).not.toHaveBeenCalled();
  });

  it("orders the complete Today target by today_sort_order with nulls last and then ID", async () => {
    const todayFirst = makeTodo("33333333-3333-4333-8333-333333333333", "low", {
      sort_order: 8,
      today_date: "2026-09-14",
      today_sort_order: 1,
    });
    const todaySecond = makeTodo("44444444-4444-4444-8444-444444444444", "high", {
      sort_order: 0,
      today_date: "2026-09-14",
      today_sort_order: 2,
    });
    const todayNull = makeTodo("55555555-5555-4555-8555-555555555555", "high", {
      sort_order: 2,
      today_date: "2026-09-14",
      today_sort_order: null,
    });
    mocks.listRowsMock.mockResolvedValue([todaySecond, lowTodo, todayNull, todayFirst]);
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: { ...lowTodo, today_date: "2026-09-14" },
      error: null,
    });

    await moveTodoRecordToSectionEnd(TODO_ID, "today");

    expect(mocks.rpcMock).toHaveBeenCalledWith(
      "move_todo_between_sections",
      expect.objectContaining({
        p_source_ids: [],
        p_target_ids: [todayFirst.id, todaySecond.id, todayNull.id, TODO_ID],
      }),
    );
  });

  it("orders complete priority arrays by sort_order and then ID", async () => {
    const movingToday = makeTodo(TODO_ID, "low", {
      sort_order: 9,
      today_date: "2026-09-14",
      today_sort_order: 0,
    });
    const todaySecond = makeTodo("66666666-6666-4666-8666-666666666666", "high", {
      sort_order: 0,
      today_date: "2026-09-14",
      today_sort_order: 2,
    });
    const todayFirst = makeTodo("77777777-7777-4777-8777-777777777777", "low", {
      sort_order: 8,
      today_date: "2026-09-14",
      today_sort_order: 1,
    });
    const highTieLast = makeTodo("99999999-9999-4999-8999-999999999999", "high", {
      sort_order: 1,
    });
    const highTieFirst = makeTodo("88888888-8888-4888-8888-888888888888", "high", {
      sort_order: 1,
    });
    const highLast = makeTodo(HIGH_ID, "high", { sort_order: 2 });
    mocks.listRowsMock.mockResolvedValue([
      todaySecond,
      highTieLast,
      highLast,
      movingToday,
      highTieFirst,
      todayFirst,
    ]);
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: { ...movingToday, priority: "high", today_date: null, today_sort_order: null },
      error: null,
    });

    await moveTodoRecordToSectionEnd(TODO_ID, "high");

    expect(mocks.rpcMock).toHaveBeenCalledWith(
      "move_todo_between_sections",
      expect.objectContaining({
        p_source_ids: [todayFirst.id, todaySecond.id],
        p_target_ids: [highTieFirst.id, highTieLast.id, highLast.id, TODO_ID],
      }),
    );
  });
});
