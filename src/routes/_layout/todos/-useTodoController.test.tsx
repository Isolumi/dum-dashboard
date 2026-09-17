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
  moveTodo,
  reorderTodos,
  updateTodo,
} from "#/routes/todos/todos.functions";
import { useTodoController } from "./-useTodoController";

vi.mock("#/routes/todos/todos.functions", () => ({
  createTodo: vi.fn(),
  deleteTodo: vi.fn(),
  getTodos: vi.fn(),
  moveTodo: vi.fn(),
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
    today_date: null,
    today_sort_order: null,
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
  vi.mocked(moveTodo).mockResolvedValue(undefined);
  vi.mocked(reorderTodos).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("useTodoController", () => {
  it.each([true, false])(
    "keeps pending ownership when completion and reorder overlap (reorder first: %s)",
    async (reorderFirst) => {
      const a = makeTodo({ id: "a", status: "started", sort_order: 0 });
      const b = makeTodo({ id: "b", sort_order: 1 });
      const c = makeTodo({ id: "c", sort_order: 2 });
      const completion = deferred<Todo>();
      const ordering = deferred<void>();
      vi.mocked(updateTodo).mockReturnValue(completion.promise);
      vi.mocked(reorderTodos).mockReturnValue(ordering.promise);
      const { result } = renderHook(() => useTodoController([a, b, c]));
      let save!: Promise<void>;
      let reorder!: Promise<void>;
      act(() => {
        save = result.current.update({ id: "a", status: "complete" });
      });
      act(() => {
        reorder = result.current.reorder("high", ["c", "b"]);
      });
      const finishSave = async () => {
        completion.resolve({ ...a, status: "complete" });
        await save;
      };
      const finishOrder = async () => {
        ordering.resolve();
        await reorder;
      };
      await act(reorderFirst ? finishOrder : finishSave);
      expect(result.current.pendingIds.has("a")).toBe(true);
      await act(reorderFirst ? finishSave : finishOrder);
      expect(result.current.pendingIds.has("a")).toBe(false);
      expect(result.current.todos.find((todo) => todo.id === "a")?.sort_order).toBe(2);
    },
  );
  it("prevents delete while completion is saving and clears pending after failure", async () => {
    const todo = makeTodo({ status: "started" });
    const save = deferred<Todo>();
    vi.mocked(updateTodo).mockReturnValue(save.promise);
    const { result } = renderHook(() => useTodoController([todo]));
    let request!: Promise<void>;
    act(() => {
      request = result.current.update({ id: todo.id, status: "complete" });
    });
    expect(result.current.pendingIds.has(todo.id)).toBe(true);
    await act(async () => result.current.remove(todo.id));
    expect(deleteTodo).not.toHaveBeenCalled();
    await act(async () => {
      save.reject(new Error("offline"));
      await request;
    });
    expect(result.current.grouped.high).toEqual([todo]);
    expect(result.current.pendingIds.has(todo.id)).toBe(false);
  });
  it("restores archived sort orders when a reorder fails", async () => {
    const archive = makeTodo({ id: "archive", status: "complete", sort_order: 0 });
    const active = makeTodo({ id: "active", sort_order: 1 });
    vi.mocked(reorderTodos).mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useTodoController([archive, active]));
    await act(async () => result.current.reorder("high", ["active"]));
    expect(result.current.todos).toEqual([archive, active]);
  });

  it("keeps archived source and target members in an atomic move", async () => {
    const sourceArchive = makeTodo({ id: "source-archive", status: "complete", sort_order: 0 });
    const active = makeTodo({ id: "active", sort_order: 1 });
    const targetArchive = makeTodo({
      id: "target-archive",
      status: "complete",
      priority: "low",
      sort_order: 0,
    });
    const { result } = renderHook(() => useTodoController([sourceArchive, active, targetArchive]));
    await act(async () => result.current.move("active", "low", 0));
    expect(moveTodo).toHaveBeenCalledWith({
      data: {
        id: "active",
        target_section: "low",
        source_ids: ["source-archive"],
        target_ids: ["target-archive", "active"],
      },
    });
    expect(result.current.grouped.high).toEqual([]);
    expect(result.current.grouped.low.map((todo) => todo.id)).toEqual(["active"]);
    expect(result.current.todos.filter((todo) => todo.status === "complete")).toHaveLength(2);
  });
  it("archives optimistically and restores the active item when saving fails", async () => {
    const todo = makeTodo({ status: "started", today_date: "2026-09-17" });
    const save = deferred<Todo>();
    vi.mocked(updateTodo).mockReturnValue(save.promise);
    const { result } = renderHook(() => useTodoController([todo]));
    let request!: Promise<void>;
    act(() => {
      request = result.current.update({ id: todo.id, status: "complete" });
    });
    expect(result.current.grouped.today).toEqual([]);
    expect(result.current.todos[0]?.status).toBe("complete");
    await act(async () => {
      save.reject(new Error("offline"));
      await request;
    });
    expect(result.current.grouped.today).toEqual([todo]);
  });

  it("restores an archived item with its original section and due date", async () => {
    const todo = makeTodo({ status: "complete", today_date: "2026-09-17", due_date: "2026-09-18" });
    vi.mocked(updateTodo).mockResolvedValue({ ...todo, status: "not_started" });
    const { result } = renderHook(() => useTodoController([todo]));
    expect(result.current.grouped.today).toEqual([]);
    await act(async () => result.current.update({ id: todo.id, status: "not_started" }));
    expect(result.current.grouped.today).toEqual([{ ...todo, status: "not_started" }]);
  });

  it("keeps archived records in the database reorder payload", async () => {
    const archive = makeTodo({ id: "archive", status: "complete", sort_order: 0 });
    const a = makeTodo({ id: "a", sort_order: 1 });
    const b = makeTodo({ id: "b", sort_order: 2 });
    const { result } = renderHook(() => useTodoController([archive, a, b]));
    await act(async () => result.current.reorder("high", ["b", "a"]));
    expect(reorderTodos).toHaveBeenCalledWith({
      data: {
        section: "high",
        expected_ids: ["archive", "a", "b"],
        ordered_ids: ["b", "a", "archive"],
      },
    });
    expect(result.current.grouped.high.map((todo) => todo.id)).toEqual(["b", "a"]);
  });
  it.each(["today", "high", "low"] as const)(
    "keeps equal-deadline drop placement in %s",
    async (section) => {
      const fields = section === "today" ? { today_date: "2026-09-16" } : { priority: section };
      const later = makeTodo({
        ...fields,
        id: "later",
        due_date: "2026-09-20",
        sort_order: 0,
        today_sort_order: 0,
      });
      const a = makeTodo({
        ...fields,
        id: "a",
        due_date: "2026-09-17",
        sort_order: 1,
        today_sort_order: 1,
      });
      const b = makeTodo({
        ...fields,
        id: "b",
        due_date: "2026-09-17",
        sort_order: 2,
        today_sort_order: 2,
      });
      const moved = makeTodo({
        id: "moved",
        priority: section === "high" ? "low" : "high",
        due_date: "2026-09-17",
      });
      const { result } = renderHook(() => useTodoController([later, a, b, moved]));
      await act(async () => result.current.move(moved.id, section, 2));
      expect(result.current.grouped[section].map((todo) => todo.id)).toEqual([
        "a",
        "b",
        "moved",
        "later",
      ]);
      expect(
        vi.mocked(moveTodo).mock.calls[0][0].data.target_ids.filter((id) => id !== "moved"),
      ).toEqual(["later", "a", "b"]);
    },
  );
  it.each(["today", "high", "low"] as const)(
    "uses saved order for the %s reorder concurrency check",
    async (section) => {
      const fields = section === "today" ? { today_date: "2026-09-16" } : { priority: section };
      const later = makeTodo({
        ...fields,
        id: "later",
        due_date: "2026-09-20",
        sort_order: 0,
        today_sort_order: 0,
      });
      const earlier = makeTodo({
        ...fields,
        id: "earlier",
        due_date: "2026-09-17",
        sort_order: 1,
        today_sort_order: 1,
      });
      vi.mocked(reorderTodos).mockImplementationOnce(async ({ data }) => {
        if (data.expected_ids.join() !== "later,earlier") throw new Error("Todo order is stale");
      });
      const { result } = renderHook(() => useTodoController([later, earlier]));
      await act(async () => result.current.reorder(section, ["earlier", "later"]));
      expect(result.current.mutationError).toBeNull();
      expect(
        result.current.todos.find((todo) => todo.id === "earlier")?.[
          section === "today" ? "today_sort_order" : "sort_order"
        ],
      ).toBe(0);
    },
  );

  it.each(["today", "high", "low"] as const)(
    "preserves saved source and target order when moving into %s",
    async (targetSection) => {
      const sourceSection = targetSection === "high" ? "low" : "high";
      const targetFields =
        targetSection === "today" ? { today_date: "2026-09-16" } : { priority: targetSection };
      const moved = makeTodo({
        id: "moved",
        priority: sourceSection,
        due_date: "2026-09-19",
        sort_order: 2,
      });
      const sourceLater = makeTodo({
        id: "source-later",
        priority: sourceSection,
        due_date: "2026-09-20",
        sort_order: 0,
      });
      const sourceEarlier = makeTodo({
        id: "source-earlier",
        priority: sourceSection,
        due_date: "2026-09-17",
        sort_order: 1,
      });
      const undated = makeTodo({
        ...targetFields,
        id: "undated",
        sort_order: 0,
        today_sort_order: 0,
      });
      const targetLater = makeTodo({
        ...targetFields,
        id: "target-later",
        due_date: "2026-09-20",
        sort_order: 1,
        today_sort_order: 1,
      });
      const targetEarlier = makeTodo({
        ...targetFields,
        id: "target-earlier",
        due_date: "2026-09-17",
        sort_order: 2,
        today_sort_order: 2,
      });
      vi.mocked(moveTodo).mockImplementationOnce(async ({ data }) => {
        if (
          data.source_ids.join() !== "source-later,source-earlier" ||
          data.target_ids.filter((id) => id !== "moved").join() !==
            "undated,target-later,target-earlier"
        )
          throw new Error("Source or target Todo order is stale");
      });
      const { result } = renderHook(() =>
        useTodoController([moved, sourceLater, sourceEarlier, undated, targetLater, targetEarlier]),
      );
      await act(async () => result.current.move(moved.id, targetSection, 1));
      expect(result.current.mutationError).toBeNull();
      expect(result.current.grouped[targetSection].map((todo) => todo.id)).toEqual([
        "target-earlier",
        "moved",
        "target-later",
        "undated",
      ]);
      expect(
        result.current.todos.find((todo) => todo.id === "moved")?.[
          targetSection === "today" ? "today_sort_order" : "sort_order"
        ],
      ).toBe(1);
    },
  );

  it.each(["today", "high", "low"] as const)(
    "keeps a cross-section move in date order in %s",
    async (targetSection) => {
      const targetFields =
        targetSection === "today"
          ? { today_date: "2026-09-16", priority: "low" as const }
          : { priority: targetSection };
      const moved = makeTodo({
        id: "moved",
        priority: targetSection === "high" ? "low" : "high",
        due_date: "2026-09-20",
      });
      const earlier = makeTodo({ ...targetFields, id: "earlier", due_date: "2026-09-17" });
      const undated = makeTodo({
        ...targetFields,
        id: "undated",
        sort_order: 1,
        today_sort_order: 1,
      });
      const pendingMove = deferred<void>();
      vi.mocked(moveTodo).mockReturnValueOnce(pendingMove.promise);
      const { result } = renderHook(() => useTodoController([moved, earlier, undated]));
      let mutation!: Promise<void>;
      act(() => {
        mutation = result.current.move(moved.id, targetSection, 0);
      });
      expect(result.current.grouped[targetSection].map((todo) => todo.id)).toEqual([
        "earlier",
        "moved",
        "undated",
      ]);
      await act(async () => {
        pendingMove.resolve();
        await mutation;
      });
      expect(result.current.grouped[targetSection].map((todo) => todo.id)).toEqual([
        "earlier",
        "moved",
        "undated",
      ]);
      expect(result.current.mutationError).toBeNull();
    },
  );

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

  it("marks same-priority reorder rows pending until persistence finishes", async () => {
    const first = makeTodo({ id: "first", name: "First", sort_order: 0 });
    const second = makeTodo({ id: "second", name: "Second", sort_order: 1 });
    const pendingReorder = deferred<void>();
    vi.mocked(reorderTodos).mockReturnValueOnce(pendingReorder.promise);
    const { result } = renderHook(() => useTodoController([first, second]));
    let mutation!: Promise<void>;

    act(() => {
      mutation = result.current.reorder("high", [second.id, first.id]);
    });

    expect(result.current.pendingIds).toEqual(new Set([second.id, first.id]));

    await act(async () => {
      pendingReorder.resolve();
      await mutation;
    });

    expect(result.current.pendingIds.size).toBe(0);
  });

  it("persists the expected and requested orders in one reorder call", async () => {
    const first = makeTodo({ id: "first", name: "First", sort_order: 0 });
    const second = makeTodo({ id: "second", name: "Second", sort_order: 1 });
    const { result } = renderHook(() => useTodoController([first, second]));

    await act(async () => result.current.reorder("high", [second.id, first.id]));

    expect(reorderTodos).toHaveBeenCalledWith({
      data: {
        section: "high",
        expected_ids: [first.id, second.id],
        ordered_ids: [second.id, first.id],
      },
    });
  });

  it("starts an atomic move only after an earlier reorder write finishes", async () => {
    const first = makeTodo({ id: "first", name: "First", sort_order: 0 });
    const second = makeTodo({ id: "second", name: "Second", sort_order: 1 });
    const lowTodo = makeTodo({ id: "low", name: "Low", priority: "low", sort_order: 0 });
    const pendingReorder = deferred<void>();
    const pendingMove = deferred<void>();
    vi.mocked(reorderTodos).mockReturnValueOnce(pendingReorder.promise);
    vi.mocked(moveTodo).mockReturnValueOnce(pendingMove.promise);
    const { result } = renderHook(() => useTodoController([first, second, lowTodo]));
    let reorderMutation!: Promise<void>;
    let moveMutation!: Promise<void>;

    act(() => {
      reorderMutation = result.current.reorder("high", [second.id, first.id]);
      moveMutation = result.current.move(first.id, "low", 1);
    });

    await waitFor(() => expect(reorderTodos).toHaveBeenCalledOnce());
    expect(moveTodo).not.toHaveBeenCalled();

    await act(async () => {
      pendingReorder.resolve();
      await reorderMutation;
    });
    await waitFor(() => expect(moveTodo).toHaveBeenCalledOnce());
    expect(moveTodo).toHaveBeenCalledWith({
      data: {
        id: first.id,
        target_section: "low",
        source_ids: [second.id],
        target_ids: [lowTodo.id, first.id],
      },
    });

    await act(async () => {
      pendingMove.resolve();
      await moveMutation;
    });
  });

  it("moves optimistically across priorities and restores both lists when persistence fails", async () => {
    const first = makeTodo({ id: "first", name: "First", sort_order: 0 });
    const second = makeTodo({ id: "second", name: "Second", sort_order: 1 });
    const lowTodo = makeTodo({ id: "low", name: "Low", priority: "low", sort_order: 0 });
    vi.mocked(moveTodo).mockRejectedValueOnce(new Error("offline"));
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

  it("persists a cross-priority move with one atomic server call", async () => {
    const first = makeTodo({ id: "first", name: "First", sort_order: 0 });
    const second = makeTodo({ id: "second", name: "Second", sort_order: 1 });
    const lowTodo = makeTodo({ id: "low", name: "Low", priority: "low", sort_order: 0 });
    const pendingMove = deferred<void>();
    vi.mocked(moveTodo).mockReturnValueOnce(pendingMove.promise);
    vi.mocked(reorderTodos).mockReturnValueOnce(pendingMove.promise);
    const { result } = renderHook(() => useTodoController([first, second, lowTodo]));
    let mutation!: Promise<void>;

    act(() => {
      mutation = result.current.move(first.id, "low", 0);
    });

    expect(moveTodo).toHaveBeenCalledOnce();
    expect(moveTodo).toHaveBeenCalledWith({
      data: {
        id: first.id,
        target_section: "low",
        source_ids: [second.id],
        target_ids: [first.id, lowTodo.id],
      },
    });
    expect(reorderTodos).not.toHaveBeenCalled();
    expect(updateTodo).not.toHaveBeenCalled();

    await act(async () => {
      pendingMove.resolve();
      await mutation;
    });
  });

  it("moves a todo into Today without changing its saved priority", async () => {
    const high = makeTodo({ id: "high", priority: "high", sort_order: 0 });
    const { result } = renderHook(() => useTodoController([high]));

    await act(async () => result.current.move(high.id, "today", 0));

    expect(result.current.grouped.today).toHaveLength(1);
    expect(result.current.grouped.today[0]).toMatchObject({
      id: high.id,
      priority: "high",
      today_sort_order: 0,
    });
    expect(result.current.grouped.today[0]?.today_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(moveTodo).toHaveBeenCalledWith({
      data: {
        id: high.id,
        target_section: "today",
        source_ids: [],
        target_ids: [high.id],
      },
    });
  });

  it("moves a Today todo to Low and clears its Today fields", async () => {
    const today = makeTodo({
      id: "today",
      priority: "high",
      today_date: "2026-09-12",
      today_sort_order: 0,
    });
    const { result } = renderHook(() => useTodoController([today]));

    await act(async () => result.current.move(today.id, "low", 0));

    expect(result.current.grouped.today).toHaveLength(0);
    expect(result.current.grouped.low[0]).toMatchObject({
      id: today.id,
      priority: "low",
      today_date: null,
      today_sort_order: null,
      sort_order: 0,
    });
  });

  it("reorders Today with its independent order field", async () => {
    const first = makeTodo({ id: "first", today_date: "2026-09-12", today_sort_order: 0 });
    const second = makeTodo({ id: "second", today_date: "2026-09-13", today_sort_order: 1 });
    const { result } = renderHook(() => useTodoController([first, second]));

    await act(async () => result.current.reorder("today", [second.id, first.id]));

    expect(result.current.grouped.today.map((todo) => todo.id)).toEqual([second.id, first.id]);
    expect(result.current.grouped.today.map((todo) => todo.today_sort_order)).toEqual([0, 1]);
    expect(reorderTodos).toHaveBeenCalledWith({
      data: {
        section: "today",
        expected_ids: [first.id, second.id],
        ordered_ids: [second.id, first.id],
      },
    });
  });

  it("keeps affected todos pending and rejects overlapping affected mutations", async () => {
    const first = makeTodo({ id: "first", name: "First", sort_order: 0 });
    const second = makeTodo({ id: "second", name: "Second", sort_order: 1 });
    const lowTodo = makeTodo({ id: "low", name: "Low", priority: "low", sort_order: 0 });
    const pendingMove = deferred<void>();
    vi.mocked(moveTodo).mockReturnValueOnce(pendingMove.promise);
    vi.mocked(reorderTodos).mockReturnValueOnce(pendingMove.promise);
    const { result } = renderHook(() => useTodoController([first, second, lowTodo]));
    let mutation!: Promise<void>;

    act(() => {
      mutation = result.current.move(first.id, "low", 0);
    });

    expect([...result.current.pendingIds]).toEqual([second.id, first.id, lowTodo.id]);

    await act(async () => {
      await result.current.update({ id: second.id, status: "complete" });
      await result.current.remove(lowTodo.id);
      await result.current.reorder("low", [lowTodo.id, first.id]);
      await result.current.move(lowTodo.id, "high", 0);
    });

    expect(result.current.grouped.high.map((todo) => todo.id)).toEqual([second.id]);
    expect(result.current.grouped.low.map((todo) => todo.id)).toEqual([first.id, lowTodo.id]);
    expect(result.current.todos.find((todo) => todo.id === second.id)?.status).toBe("not_started");
    expect(deleteTodo).not.toHaveBeenCalled();
    expect(moveTodo).toHaveBeenCalledTimes(1);
    expect(reorderTodos).not.toHaveBeenCalled();
    expect(updateTodo).not.toHaveBeenCalled();

    await act(async () => {
      pendingMove.resolve();
      await mutation;
    });

    expect(moveTodo).toHaveBeenCalledTimes(1);
    expect(result.current.pendingIds.size).toBe(0);
  });

  it("preserves an unrelated concurrent todo when a failed move rolls back", async () => {
    const first = makeTodo({ id: "first", name: "First", sort_order: 0 });
    const second = makeTodo({ id: "second", name: "Second", sort_order: 1 });
    const lowTodo = makeTodo({ id: "low", name: "Low", priority: "low", sort_order: 0 });
    const createdTodo = makeTodo({
      id: "created",
      name: "Created during move",
      priority: "low",
      sort_order: 2,
    });
    const pendingMove = deferred<void>();
    vi.mocked(moveTodo).mockReturnValueOnce(pendingMove.promise);
    vi.mocked(reorderTodos).mockReturnValueOnce(pendingMove.promise);
    vi.mocked(createTodo).mockResolvedValueOnce(createdTodo);
    const { result } = renderHook(() => useTodoController([first, second, lowTodo]));
    let mutation!: Promise<void>;

    act(() => {
      mutation = result.current.move(first.id, "low", 0);
    });
    await act(async () =>
      result.current.create({
        name: createdTodo.name,
        priority: "low",
        due_date: null,
        due_date_has_time: false,
      }),
    );

    await act(async () => {
      pendingMove.reject(new Error("move failed"));
      await mutation;
    });

    expect(result.current.grouped.high.map((todo) => todo.id)).toEqual([first.id, second.id]);
    expect(result.current.grouped.low.map((todo) => todo.id)).toEqual([lowTodo.id, createdTodo.id]);
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
    expect(result.current.grouped.high.map((todo) => todo.id)).toEqual([first.id]);
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

  it("pauses polling while a todo is being dragged", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTodoController([highTodo]));

    act(() => result.current.setDragging(true));
    await act(async () => vi.advanceTimersByTimeAsync(6_000));

    expect(getTodos).not.toHaveBeenCalled();

    act(() => result.current.setDragging(false));
    await act(async () => vi.advanceTimersByTimeAsync(3_000));

    expect(getTodos).toHaveBeenCalledOnce();
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
