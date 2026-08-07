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
      });
    });

    expect(result.current.todos).toHaveLength(2);
    expect(result.current.todos[1]).toMatchObject({
      name: "Canonical server name",
      priority: "low",
      status: "not_started",
      due_date: "2026-08-09",
    });

    await act(async () => {
      pendingCreate.resolve(serverTodo);
      await mutation;
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
