/**
 * @vitest-environment jsdom
 */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Todo } from "#/lib/database.types";
import {
  createTodo,
  deleteTodo,
  getTodos,
  reorderTodos,
  updateTodo,
} from "#/routes/todos/todos.functions";
import { useTodoController } from "./-useTodoController";

vi.mock("#/routes/todos/todos.functions", () => ({
  createTodo: vi.fn(),
  deleteTodo: vi.fn(),
  getTodos: vi.fn(),
  reorderTodos: vi.fn(),
  updateTodo: vi.fn(),
}));

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Ship dashboard",
    status: "not_started",
    priority: "high",
    due_date: null,
    due_date_has_time: false,
    sort_order: 0,
    created_at: "2026-08-06T12:00:00.000Z",
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const highTodo = makeTodo();

beforeEach(() => {
  vi.mocked(getTodos).mockResolvedValue([]);
  vi.mocked(deleteTodo).mockResolvedValue(undefined);
  vi.mocked(reorderTodos).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("useTodoController", () => {
  it("uses initial todos without showing a loading state", () => {
    const { result } = renderHook(() => useTodoController([highTodo]));

    expect(result.current.status).toBe("ready");
    expect(result.current.todos).toEqual([highTodo]);
    expect(result.current.grouped.high).toEqual([highTodo]);
  });

  it("recovers when retry succeeds after the initial load fails", async () => {
    vi.mocked(getTodos)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([highTodo]);
    const { result } = renderHook(() => useTodoController());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.loadError).toMatch(/could not load todos/i);

    await act(async () => result.current.retry());

    expect(result.current.status).toBe("ready");
    expect(result.current.loadError).toBeNull();
    expect(result.current.todos).toEqual([highTodo]);
  });

  it("adds an optimistic create and replaces it with the server-returned todo", async () => {
    const pendingCreate = deferred<Todo>();
    const serverTodo = makeTodo({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Canonical server name",
      sort_order: 7,
    });
    vi.mocked(createTodo).mockReturnValueOnce(pendingCreate.promise);
    const { result } = renderHook(() => useTodoController([highTodo]));
    let mutation!: Promise<void>;

    act(() => {
      mutation = result.current.create({
        name: "  Canonical server name  ",
        priority: "low",
        due_date: "2026-08-09",
        due_date_has_time: false,
      });
    });

    expect(result.current.todos).toHaveLength(2);
    expect(result.current.todos[1]).toMatchObject({
      name: "Canonical server name",
      priority: "low",
      status: "not_started",
      due_date: "2026-08-09",
      due_date_has_time: false,
    });
    expect(createTodo).toHaveBeenCalledWith({
      data: {
        name: "Canonical server name",
        priority: "low",
        status: "not_started",
        due_date: "2026-08-09",
        due_date_has_time: false,
      },
    });

    await act(async () => {
      pendingCreate.resolve(serverTodo);
      await mutation;
    });

    expect(result.current.todos).toEqual([highTodo, serverTodo]);
  });

  it("keeps a newly created todo when delete is requested before it has a canonical id", async () => {
    const pendingCreate = deferred<Todo>();
    const serverTodo = makeTodo({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Saved todo",
      priority: "low",
    });
    vi.mocked(createTodo).mockReturnValueOnce(pendingCreate.promise);
    const { result } = renderHook(() => useTodoController([highTodo]));
    let createMutation!: Promise<void>;

    act(() => {
      createMutation = result.current.create({
        name: "Saved todo",
        priority: "low",
        due_date: null,
        due_date_has_time: false,
      });
    });
    const optimisticId = result.current.todos[1]?.id;

    await act(async () => result.current.remove(optimisticId!));

    expect(deleteTodo).not.toHaveBeenCalled();
    expect(result.current.todos[1]?.id).toBe(optimisticId);

    await act(async () => {
      pendingCreate.resolve(serverTodo);
      await createMutation;
    });

    expect(result.current.todos).toEqual([highTodo, serverTodo]);
  });

  it("does not persist an update for a todo before create returns its canonical id", async () => {
    const pendingCreate = deferred<Todo>();
    const serverTodo = makeTodo({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Saved todo",
      priority: "low",
    });
    vi.mocked(createTodo).mockReturnValueOnce(pendingCreate.promise);
    const { result } = renderHook(() => useTodoController([highTodo]));
    let createMutation!: Promise<void>;

    act(() => {
      createMutation = result.current.create({
        name: "Saved todo",
        priority: "low",
        due_date: null,
        due_date_has_time: false,
      });
    });
    const optimisticId = result.current.todos[1]?.id;

    await act(async () => result.current.update({ id: optimisticId!, status: "complete" }));

    expect(updateTodo).not.toHaveBeenCalled();
    expect(result.current.todos[1]?.status).toBe("not_started");

    await act(async () => {
      pendingCreate.resolve(serverTodo);
      await createMutation;
    });

    expect(result.current.todos).toEqual([highTodo, serverTodo]);
  });

  it("rolls an optimistic update back when the server rejects it", async () => {
    vi.mocked(updateTodo).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useTodoController([highTodo]));

    await act(async () => result.current.update({ id: highTodo.id, status: "complete" }));

    expect(result.current.todos[0]?.status).toBe("not_started");
    expect(result.current.mutationError).toMatch(/save failed/i);
  });

  it("rolls due date precision metadata back with a rejected due date update", async () => {
    const dueDate = new Date(2026, 7, 9, 15, 30).toISOString();
    vi.mocked(updateTodo).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useTodoController([highTodo]));

    await act(async () =>
      result.current.update({
        id: highTodo.id,
        due_date: dueDate,
        due_date_has_time: true,
      }),
    );

    expect(updateTodo).toHaveBeenCalledWith({
      data: {
        id: highTodo.id,
        due_date: dueDate,
        due_date_has_time: true,
      },
    });
    expect(result.current.todos[0]?.due_date).toBeNull();
    expect(result.current.todos[0]?.due_date_has_time).toBe(false);
  });

  it("replaces an optimistic update with the server-returned todo", async () => {
    const pendingUpdate = deferred<Todo>();
    const serverTodo = makeTodo({ name: "Trimmed by server", status: "started", sort_order: 9 });
    vi.mocked(updateTodo).mockReturnValueOnce(pendingUpdate.promise);
    const { result } = renderHook(() => useTodoController([highTodo]));
    let mutation!: Promise<void>;

    act(() => {
      mutation = result.current.update({ id: highTodo.id, name: "  Trimmed by server  " });
    });
    expect(result.current.todos[0]?.name).toBe("  Trimmed by server  ");

    await act(async () => {
      pendingUpdate.resolve(serverTodo);
      await mutation;
    });

    expect(result.current.todos).toEqual([serverTodo]);
  });

  it("keeps a newer successful update when an older update fails last", async () => {
    const olderUpdate = deferred<Todo>();
    const newerUpdate = deferred<Todo>();
    const newerTodo = makeTodo({ name: "Newest server name" });
    vi.mocked(updateTodo)
      .mockReturnValueOnce(olderUpdate.promise)
      .mockReturnValueOnce(newerUpdate.promise);
    const { result } = renderHook(() => useTodoController([highTodo]));
    let olderMutation!: Promise<void>;
    let newerMutation!: Promise<void>;

    act(() => {
      olderMutation = result.current.update({ id: highTodo.id, status: "started" });
      newerMutation = result.current.update({ id: highTodo.id, name: "Newest server name" });
    });
    await act(async () => {
      newerUpdate.resolve(newerTodo);
      olderUpdate.reject(new Error("older update failed"));
      await Promise.all([olderMutation, newerMutation]);
    });

    expect(result.current.todos).toEqual([newerTodo]);
  });

  it("keeps a newer successful update when an older update succeeds last", async () => {
    const olderUpdate = deferred<Todo>();
    const newerUpdate = deferred<Todo>();
    const olderTodo = makeTodo({ status: "started" });
    const newerTodo = makeTodo({ name: "Newest server name", status: "started" });
    vi.mocked(updateTodo)
      .mockReturnValueOnce(olderUpdate.promise)
      .mockReturnValueOnce(newerUpdate.promise);
    const { result } = renderHook(() => useTodoController([highTodo]));
    let olderMutation!: Promise<void>;
    let newerMutation!: Promise<void>;

    act(() => {
      olderMutation = result.current.update({ id: highTodo.id, status: "started" });
      newerMutation = result.current.update({ id: highTodo.id, name: "Newest server name" });
    });
    await act(async () => {
      newerUpdate.resolve(newerTodo);
      olderUpdate.resolve(olderTodo);
      await Promise.all([olderMutation, newerMutation]);
    });

    expect(result.current.todos).toEqual([newerTodo]);
  });

  it("rolls a newer failed update back after an older failure", async () => {
    const olderUpdate = deferred<Todo>();
    const newerUpdate = deferred<Todo>();
    vi.mocked(updateTodo)
      .mockReturnValueOnce(olderUpdate.promise)
      .mockReturnValueOnce(newerUpdate.promise);
    const { result } = renderHook(() => useTodoController([highTodo]));
    let olderMutation!: Promise<void>;
    let newerMutation!: Promise<void>;

    act(() => {
      olderMutation = result.current.update({ id: highTodo.id, status: "started" });
      newerMutation = result.current.update({ id: highTodo.id, name: "Unsaved name" });
    });
    await act(async () => {
      olderUpdate.reject(new Error("older update failed"));
      newerUpdate.reject(new Error("newer update failed"));
      await Promise.all([olderMutation, newerMutation]);
    });

    expect(result.current.todos).toEqual([highTodo]);
  });

  it("rolls a newer failed update back to an older canonical success", async () => {
    const olderUpdate = deferred<Todo>();
    const newerUpdate = deferred<Todo>();
    const olderTodo = makeTodo({ name: "Canonical older name", status: "started" });
    vi.mocked(updateTodo)
      .mockReturnValueOnce(olderUpdate.promise)
      .mockReturnValueOnce(newerUpdate.promise);
    const { result } = renderHook(() => useTodoController([highTodo]));
    let olderMutation!: Promise<void>;
    let newerMutation!: Promise<void>;

    act(() => {
      olderMutation = result.current.update({ id: highTodo.id, status: "started" });
      newerMutation = result.current.update({ id: highTodo.id, name: "Unsaved name" });
    });
    await act(async () => {
      olderUpdate.resolve(olderTodo);
      newerUpdate.reject(new Error("newer update failed"));
      await Promise.all([olderMutation, newerMutation]);
    });

    expect(result.current.todos).toEqual([olderTodo]);
  });

  it("removes optimistically and restores the todo when delete fails", async () => {
    const pendingDelete = deferred<void>();
    vi.mocked(deleteTodo).mockReturnValueOnce(pendingDelete.promise);
    const { result } = renderHook(() => useTodoController([highTodo]));
    let mutation!: Promise<void>;

    act(() => {
      mutation = result.current.remove(highTodo.id);
    });
    expect(result.current.todos).toEqual([]);

    await act(async () => {
      pendingDelete.reject(new Error("offline"));
      await mutation;
    });

    expect(result.current.todos).toEqual([highTodo]);
    expect(result.current.mutationError).toMatch(/save failed/i);
  });

  it("reorders optimistically and restores the prior order when persistence fails", async () => {
    const first = makeTodo({ id: "first", name: "First", sort_order: 0 });
    const second = makeTodo({ id: "second", name: "Second", sort_order: 1 });
    const pendingReorder = deferred<void>();
    vi.mocked(reorderTodos).mockReturnValueOnce(pendingReorder.promise);
    const { result } = renderHook(() => useTodoController([first, second]));
    let mutation!: Promise<void>;

    act(() => {
      mutation = result.current.reorder("high", [second.id, first.id]);
    });
    expect(result.current.grouped.high.map((todo) => todo.id)).toEqual([second.id, first.id]);

    await act(async () => {
      pendingReorder.reject(new Error("offline"));
      await mutation;
    });

    expect(result.current.grouped.high.map((todo) => todo.id)).toEqual([first.id, second.id]);
    expect(result.current.mutationError).toMatch(/reorder failed/i);
  });

  it("moves optimistically across priorities and restores both lists when persistence fails", async () => {
    const first = makeTodo({ id: "first", name: "First", sort_order: 0 });
    const second = makeTodo({ id: "second", name: "Second", sort_order: 1 });
    const lowTodo = makeTodo({ id: "low", name: "Low", priority: "low", sort_order: 0 });
    vi.mocked(updateTodo).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useTodoController([first, second, lowTodo]));
    let mutation!: Promise<void>;

    act(() => {
      mutation = result.current.move(first.id, "low", 0);
    });

    expect(result.current.grouped.high.map((todo) => todo.id)).toEqual([second.id]);
    expect(result.current.grouped.low.map((todo) => todo.id)).toEqual([first.id, lowTodo.id]);

    await act(async () => mutation);

    expect(result.current.grouped.high.map((todo) => todo.id)).toEqual([first.id, second.id]);
    expect(result.current.grouped.low.map((todo) => todo.id)).toEqual([lowTodo.id]);
    expect(result.current.mutationError).toMatch(/reorder failed/i);
  });

  it("does not erase a concurrent successful update when reorder rolls back", async () => {
    const first = makeTodo({ id: "first", name: "First", sort_order: 0 });
    const second = makeTodo({ id: "second", name: "Second", sort_order: 1 });
    const pendingReorder = deferred<void>();
    const pendingUpdate = deferred<Todo>();
    vi.mocked(reorderTodos).mockReturnValueOnce(pendingReorder.promise);
    vi.mocked(updateTodo).mockReturnValueOnce(pendingUpdate.promise);
    const { result } = renderHook(() => useTodoController([first, second]));
    let reorderMutation!: Promise<void>;
    let updateMutation!: Promise<void>;

    act(() => {
      reorderMutation = result.current.reorder("high", [second.id, first.id]);
      updateMutation = result.current.update({ id: second.id, status: "complete" });
    });
    await act(async () => {
      pendingUpdate.resolve({ ...second, status: "complete" });
      await updateMutation;
    });
    await act(async () => {
      pendingReorder.reject(new Error("offline"));
      await reorderMutation;
    });

    expect(result.current.todos.find((todo) => todo.id === second.id)?.status).toBe("complete");
    expect(result.current.grouped.high.map((todo) => todo.id)).toEqual([first.id, second.id]);
  });

  it("keeps a newer successful reorder when an older reorder fails last", async () => {
    const first = makeTodo({ id: "first", name: "First", sort_order: 0 });
    const second = makeTodo({ id: "second", name: "Second", sort_order: 1 });
    const third = makeTodo({ id: "third", name: "Third", sort_order: 2 });
    const olderReorder = deferred<void>();
    const newerReorder = deferred<void>();
    vi.mocked(reorderTodos)
      .mockReturnValueOnce(olderReorder.promise)
      .mockReturnValueOnce(newerReorder.promise);
    const { result } = renderHook(() => useTodoController([first, second, third]));
    let olderMutation!: Promise<void>;
    let newerMutation!: Promise<void>;

    act(() => {
      olderMutation = result.current.reorder("high", [second.id, first.id, third.id]);
      newerMutation = result.current.reorder("high", [third.id, second.id, first.id]);
    });
    await act(async () => {
      newerReorder.resolve();
      olderReorder.reject(new Error("older reorder failed"));
      await Promise.all([olderMutation, newerMutation]);
    });

    expect(result.current.grouped.high.map((todo) => todo.id)).toEqual([
      third.id,
      second.id,
      first.id,
    ]);
  });

  it("does not let a stale polling response overwrite an optimistic mutation", async () => {
    vi.useFakeTimers();
    const pendingUpdate = deferred<Todo>();
    vi.mocked(updateTodo).mockReturnValueOnce(pendingUpdate.promise);
    vi.mocked(getTodos).mockResolvedValueOnce([highTodo]);
    const { result } = renderHook(() => useTodoController([highTodo]));
    let mutation!: Promise<void>;

    act(() => {
      mutation = result.current.update({ id: highTodo.id, status: "complete" });
    });
    await act(async () => vi.advanceTimersByTimeAsync(3_000));

    expect(result.current.todos[0]?.status).toBe("complete");

    const savedTodo = makeTodo({ status: "complete" });
    await act(async () => {
      pendingUpdate.resolve(savedTodo);
      await mutation;
    });
    expect(result.current.todos).toEqual([savedTodo]);
  });

  it("discards a poll that started during a mutation even when it resolves afterward", async () => {
    vi.useFakeTimers();
    const pendingUpdate = deferred<Todo>();
    const pendingPoll = deferred<Todo[]>();
    vi.mocked(updateTodo).mockReturnValueOnce(pendingUpdate.promise);
    vi.mocked(getTodos).mockReturnValueOnce(pendingPoll.promise);
    const { result } = renderHook(() => useTodoController([highTodo]));
    let mutation!: Promise<void>;

    act(() => {
      mutation = result.current.update({ id: highTodo.id, status: "complete" });
    });
    await act(async () => vi.advanceTimersByTimeAsync(3_000));

    const savedTodo = makeTodo({ name: "Canonical result", status: "complete" });
    await act(async () => {
      pendingUpdate.resolve(savedTodo);
      await mutation;
    });
    expect(result.current.todos).toEqual([savedTodo]);

    await act(async () => pendingPoll.resolve([highTodo]));

    expect(result.current.todos).toEqual([savedTodo]);
  });

  it("ignores an older polling response that resolves after a newer response", async () => {
    vi.useFakeTimers();
    const olderPoll = deferred<Todo[]>();
    const newerPoll = deferred<Todo[]>();
    const newerTodo = makeTodo({ name: "Newest poll" });
    vi.mocked(getTodos)
      .mockReturnValueOnce(olderPoll.promise)
      .mockReturnValueOnce(newerPoll.promise);
    const { result } = renderHook(() => useTodoController([highTodo]));

    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    await act(async () => newerPoll.resolve([newerTodo]));
    expect(result.current.todos).toEqual([newerTodo]);

    await act(async () => olderPoll.resolve([highTodo]));

    expect(result.current.todos).toEqual([newerTodo]);
  });

  it("keeps polling responses stale until every concurrent mutation finishes", async () => {
    vi.useFakeTimers();
    const first = makeTodo({ id: "first", name: "First" });
    const second = makeTodo({ id: "second", name: "Second", sort_order: 1 });
    const firstUpdate = deferred<Todo>();
    const secondUpdate = deferred<Todo>();
    vi.mocked(updateTodo)
      .mockReturnValueOnce(firstUpdate.promise)
      .mockReturnValueOnce(secondUpdate.promise);
    vi.mocked(getTodos).mockResolvedValueOnce([first, second]);
    const { result } = renderHook(() => useTodoController([first, second]));
    let firstMutation!: Promise<void>;
    let secondMutation!: Promise<void>;

    act(() => {
      firstMutation = result.current.update({ id: first.id, status: "complete" });
      secondMutation = result.current.update({ id: second.id, status: "complete" });
    });
    await act(async () => {
      firstUpdate.resolve({ ...first, status: "complete" });
      await firstMutation;
    });
    await act(async () => vi.advanceTimersByTimeAsync(3_000));

    expect(result.current.todos.map((todo) => todo.status)).toEqual(["complete", "complete"]);

    await act(async () => {
      secondUpdate.resolve({ ...second, status: "complete" });
      await secondMutation;
    });
  });

  it("clears a mutation error after four seconds", async () => {
    vi.useFakeTimers();
    vi.mocked(updateTodo).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useTodoController([highTodo]));

    await act(async () => result.current.update({ id: highTodo.id, status: "complete" }));
    expect(result.current.mutationError).toMatch(/save failed/i);

    await act(async () => vi.advanceTimersByTimeAsync(4_000));

    expect(result.current.mutationError).toBeNull();
  });
});
