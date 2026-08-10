import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePollingRefresh } from "#/hooks/usePollingRefresh";
import type { Todo, TodoPriority, TodoStatus } from "#/lib/database.types";
import {
  createTodo,
  deleteTodo,
  getTodos,
  moveTodo,
  reorderTodos,
  updateTodo,
} from "#/routes/todos/todos.functions";
import { groupAndSortTodos } from "./-todoUtils";

const POLL_INTERVAL_MS = 3_000;
const MUTATION_ERROR_DURATION_MS = 4_000;
const SAVE_ERROR = "Save failed — check your connection and try again.";
const REORDER_ERROR = "Reorder failed — check your connection and try again.";
const LOAD_ERROR = "Could not load todos. Refresh to try again.";

export type TodoUpdateFields = {
  id: string;
  name?: string;
  priority?: TodoPriority;
  status?: TodoStatus;
  due_date?: string | null;
  due_date_has_time?: boolean;
};

type TodoUpdateState = Pick<
  Todo,
  "name" | "priority" | "status" | "due_date" | "due_date_has_time"
>;

function getTodoUpdateState(todo: Todo): TodoUpdateState {
  return {
    name: todo.name,
    priority: todo.priority,
    status: todo.status,
    due_date: todo.due_date,
    due_date_has_time: todo.due_date_has_time,
  };
}

export interface TodoController {
  todos: Todo[];
  grouped: Record<TodoPriority, Todo[]>;
  pendingIds: ReadonlySet<string>;
  status: "loading" | "ready" | "error";
  loadError: string | null;
  mutationError: string | null;
  retry(): Promise<void>;
  create(fields: {
    name: string;
    priority: TodoPriority;
    due_date: string | null;
    due_date_has_time: boolean;
  }): Promise<void>;
  update(fields: TodoUpdateFields): Promise<void>;
  remove(id: string): Promise<void>;
  reorder(priority: TodoPriority, orderedIds: string[]): Promise<void>;
  move(id: string, targetPriority: TodoPriority, targetIndex: number): Promise<void>;
}

export function useTodoController(initialTodos?: Todo[]): TodoController {
  const hasInitialTodos = initialTodos !== undefined;
  const [todos, setTodos] = useState<Todo[]>(() => initialTodos ?? []);
  const [status, setStatus] = useState<TodoController["status"]>(() =>
    hasInitialTodos ? "ready" : "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const todosRef = useRef(initialTodos ?? []);
  const pendingIdsRef = useRef(new Set<string>());
  const mutationCountRef = useRef(0);
  const mutationRevisionRef = useRef(0);
  const loadRequestRef = useRef(0);
  const updateQueuesRef = useRef(new Map<string, Promise<void>>());
  const updateVersionsRef = useRef(new Map<string, number>());
  const updateCommittedRef = useRef(new Map<string, TodoUpdateState>());
  const reorderQueuesRef = useRef(new Map<TodoPriority, Promise<void>>());
  const reorderVersionsRef = useRef(new Map<TodoPriority, number>());
  const reorderCommittedRef = useRef(new Map<TodoPriority, Map<string, number>>());
  const shouldLoadInitiallyRef = useRef(!hasInitialTodos);

  const replaceTodos = useCallback((replace: (current: Todo[]) => Todo[]) => {
    const next = replace(todosRef.current);
    todosRef.current = next;
    setTodos(next);
  }, []);

  const markPending = useCallback((id: string) => {
    pendingIdsRef.current.add(id);
    setPendingIds(new Set(pendingIdsRef.current));
  }, []);

  const clearPending = useCallback((id: string) => {
    pendingIdsRef.current.delete(id);
    setPendingIds(new Set(pendingIdsRef.current));
  }, []);

  const markPendingIds = useCallback((ids: string[]) => {
    for (const id of ids) pendingIdsRef.current.add(id);
    setPendingIds(new Set(pendingIdsRef.current));
  }, []);

  const clearPendingIds = useCallback((ids: string[]) => {
    for (const id of ids) pendingIdsRef.current.delete(id);
    setPendingIds(new Set(pendingIdsRef.current));
  }, []);

  useEffect(() => {
    if (!mutationError) return;
    const timer = setTimeout(() => setMutationError(null), MUTATION_ERROR_DURATION_MS);
    return () => clearTimeout(timer);
  }, [mutationError]);

  const loadTodos = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}): Promise<void> => {
      const requestId = ++loadRequestRef.current;
      const revisionAtRequestStart = mutationRevisionRef.current;
      const mutationActiveAtRequestStart = mutationCountRef.current > 0;
      if (showLoading) setStatus("loading");

      try {
        const fresh = await getTodos();
        if (requestId !== loadRequestRef.current) return;
        const mutationOverlappedRequest =
          mutationActiveAtRequestStart ||
          mutationCountRef.current > 0 ||
          mutationRevisionRef.current !== revisionAtRequestStart;
        if (!mutationOverlappedRequest) {
          replaceTodos(() => fresh);
          setLoadError(null);
        }
        setStatus("ready");
      } catch {
        if (requestId !== loadRequestRef.current) return;
        setLoadError(LOAD_ERROR);
        setStatus((current) => (showLoading || current === "loading" ? "error" : current));
      }
    },
    [replaceTodos],
  );

  useEffect(() => {
    if (!shouldLoadInitiallyRef.current) return;
    shouldLoadInitiallyRef.current = false;
    void loadTodos();
  }, [loadTodos]);

  usePollingRefresh(() => loadTodos({ showLoading: false }), POLL_INTERVAL_MS);

  const beginMutation = useCallback(() => {
    mutationCountRef.current += 1;
    mutationRevisionRef.current += 1;
  }, []);

  const endMutation = useCallback(() => {
    mutationCountRef.current = Math.max(0, mutationCountRef.current - 1);
  }, []);

  const create = useCallback(
    async (fields: {
      name: string;
      priority: TodoPriority;
      due_date: string | null;
      due_date_has_time: boolean;
    }): Promise<void> => {
      const name = fields.name.trim();
      if (name.length === 0) return;

      beginMutation();
      const priorityTodos = todosRef.current.filter((todo) => todo.priority === fields.priority);
      const optimisticTodo: Todo = {
        id: crypto.randomUUID(),
        name,
        priority: fields.priority,
        status: "not_started",
        due_date: fields.due_date,
        due_date_has_time: fields.due_date_has_time,
        sort_order: Math.max(-1, ...priorityTodos.map((todo) => todo.sort_order)) + 1,
        created_at: new Date().toISOString(),
      };
      replaceTodos((current) => [...current, optimisticTodo]);
      markPending(optimisticTodo.id);

      try {
        const created = await createTodo({
          data: {
            name,
            priority: fields.priority,
            status: "not_started",
            due_date: fields.due_date,
            due_date_has_time: fields.due_date_has_time,
          },
        });
        replaceTodos((current) =>
          current.map((todo) => (todo.id === optimisticTodo.id ? created : todo)),
        );
      } catch {
        replaceTodos((current) => current.filter((todo) => todo.id !== optimisticTodo.id));
        setMutationError(SAVE_ERROR);
      } finally {
        clearPending(optimisticTodo.id);
        endMutation();
      }
    },
    [beginMutation, clearPending, endMutation, markPending, replaceTodos],
  );

  const update = useCallback(
    async (fields: TodoUpdateFields): Promise<void> => {
      if (pendingIdsRef.current.has(fields.id)) return;
      const previous = todosRef.current.find((todo) => todo.id === fields.id);
      if (!updateQueuesRef.current.has(fields.id) && previous) {
        updateCommittedRef.current.set(fields.id, getTodoUpdateState(previous));
      }
      const version = (updateVersionsRef.current.get(fields.id) ?? 0) + 1;
      updateVersionsRef.current.set(fields.id, version);
      beginMutation();
      replaceTodos((current) =>
        current.map((todo) => (todo.id === fields.id ? { ...todo, ...fields } : todo)),
      );

      const previousRequest = updateQueuesRef.current.get(fields.id) ?? Promise.resolve();
      const request = previousRequest.then(() => updateTodo({ data: fields }));
      const queueTail = request.then(
        () => undefined,
        () => undefined,
      );
      updateQueuesRef.current.set(fields.id, queueTail);

      try {
        const updated = await request;
        updateCommittedRef.current.set(fields.id, getTodoUpdateState(updated));
        if (updateVersionsRef.current.get(fields.id) === version) {
          replaceTodos((current) =>
            current.map((todo) => (todo.id === fields.id ? updated : todo)),
          );
        }
      } catch {
        const committed = updateCommittedRef.current.get(fields.id);
        if (committed && updateVersionsRef.current.get(fields.id) === version) {
          replaceTodos((current) =>
            current.map((todo) => (todo.id === fields.id ? { ...todo, ...committed } : todo)),
          );
        }
        setMutationError(SAVE_ERROR);
      } finally {
        endMutation();
        if (updateQueuesRef.current.get(fields.id) === queueTail) {
          updateQueuesRef.current.delete(fields.id);
          updateVersionsRef.current.delete(fields.id);
          updateCommittedRef.current.delete(fields.id);
        }
      }
    },
    [beginMutation, endMutation, replaceTodos],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      if (pendingIdsRef.current.has(id)) return;
      const previousIndex = todosRef.current.findIndex((todo) => todo.id === id);
      const previous = todosRef.current[previousIndex];
      beginMutation();
      replaceTodos((current) => current.filter((todo) => todo.id !== id));

      try {
        await deleteTodo({ data: { id } });
      } catch {
        if (previous) {
          replaceTodos((current) => {
            if (current.some((todo) => todo.id === id)) return current;
            const restored = [...current];
            restored.splice(Math.min(previousIndex, restored.length), 0, previous);
            return restored;
          });
        }
        setMutationError(SAVE_ERROR);
      } finally {
        endMutation();
      }
    },
    [beginMutation, endMutation, replaceTodos],
  );

  const reorder = useCallback(
    async (priority: TodoPriority, orderedIds: string[]): Promise<void> => {
      if (orderedIds.some((id) => pendingIdsRef.current.has(id))) return;
      const orderedSortOrders = new Map(
        orderedIds.map((id, sortOrder) => [id, sortOrder] as const),
      );
      if (!reorderQueuesRef.current.has(priority)) {
        reorderCommittedRef.current.set(
          priority,
          new Map(
            todosRef.current
              .filter((todo) => todo.priority === priority)
              .map((todo) => [todo.id, todo.sort_order] as const),
          ),
        );
      }
      const version = (reorderVersionsRef.current.get(priority) ?? 0) + 1;
      reorderVersionsRef.current.set(priority, version);
      beginMutation();
      replaceTodos((current) =>
        current.map((todo) => {
          const sortOrder = orderedSortOrders.get(todo.id);
          return todo.priority === priority && sortOrder !== undefined
            ? { ...todo, sort_order: sortOrder }
            : todo;
        }),
      );

      const previousRequest = reorderQueuesRef.current.get(priority) ?? Promise.resolve();
      const request = previousRequest.then(() =>
        reorderTodos({
          data: {
            updates: orderedIds.map((id, sort_order) => ({ id, sort_order })),
          },
        }),
      );
      const queueTail = request.then(
        () => undefined,
        () => undefined,
      );
      reorderQueuesRef.current.set(priority, queueTail);

      try {
        await request;
        const committed = new Map(reorderCommittedRef.current.get(priority));
        for (const [id, sortOrder] of orderedSortOrders) committed.set(id, sortOrder);
        reorderCommittedRef.current.set(priority, committed);
      } catch {
        if (reorderVersionsRef.current.get(priority) === version) {
          const committed = reorderCommittedRef.current.get(priority);
          replaceTodos((current) =>
            current.map((todo) => {
              const sortOrder = committed?.get(todo.id);
              return sortOrder !== undefined ? { ...todo, sort_order: sortOrder } : todo;
            }),
          );
        }
        setMutationError(REORDER_ERROR);
      } finally {
        endMutation();
        if (reorderQueuesRef.current.get(priority) === queueTail) {
          reorderQueuesRef.current.delete(priority);
          reorderVersionsRef.current.delete(priority);
          reorderCommittedRef.current.delete(priority);
        }
      }
    },
    [beginMutation, endMutation, replaceTodos],
  );

  const move = useCallback(
    async (id: string, targetPriority: TodoPriority, targetIndex: number): Promise<void> => {
      if (pendingIdsRef.current.has(id)) return;
      const previousTodos = todosRef.current;
      const movedTodo = previousTodos.find((todo) => todo.id === id);
      if (!movedTodo || movedTodo.priority === targetPriority) return;

      const groupedTodos = groupAndSortTodos(previousTodos);
      const sourceTodos = groupedTodos[movedTodo.priority].filter((todo) => todo.id !== id);
      const targetTodos = [...groupedTodos[targetPriority]];
      const normalizedTargetIndex = Math.max(0, Math.min(targetIndex, targetTodos.length));
      targetTodos.splice(normalizedTargetIndex, 0, { ...movedTodo, priority: targetPriority });

      const normalizedSourceTodos = sourceTodos.map((todo, sort_order) => ({
        ...todo,
        sort_order,
      }));
      const normalizedTargetTodos = targetTodos.map((todo, sort_order) => ({
        ...todo,
        sort_order,
      }));
      const normalizedTodos = [...normalizedSourceTodos, ...normalizedTargetTodos];
      const normalizedById = new Map(normalizedTodos.map((todo) => [todo.id, todo] as const));
      const affectedIds = normalizedTodos.map((todo) => todo.id);
      if (affectedIds.some((affectedId) => pendingIdsRef.current.has(affectedId))) return;
      const previousPositions = new Map(
        affectedIds.map((affectedId) => {
          const todo = previousTodos.find((candidate) => candidate.id === affectedId)!;
          return [affectedId, { priority: todo.priority, sort_order: todo.sort_order }] as const;
        }),
      );

      markPendingIds(affectedIds);
      beginMutation();
      replaceTodos((current) => current.map((todo) => normalizedById.get(todo.id) ?? todo));

      try {
        await moveTodo({
          data: {
            id,
            target_priority: targetPriority,
            source_ids: normalizedSourceTodos.map((todo) => todo.id),
            target_ids: normalizedTargetTodos.map((todo) => todo.id),
          },
        });
      } catch {
        replaceTodos((current) =>
          current.map((todo) => {
            const previousPosition = previousPositions.get(todo.id);
            return previousPosition ? { ...todo, ...previousPosition } : todo;
          }),
        );
        setMutationError(REORDER_ERROR);
      } finally {
        clearPendingIds(affectedIds);
        endMutation();
      }
    },
    [beginMutation, clearPendingIds, endMutation, markPendingIds, replaceTodos],
  );

  const retry = useCallback(async (): Promise<void> => loadTodos(), [loadTodos]);
  const grouped = useMemo(() => groupAndSortTodos(todos), [todos]);

  return {
    todos,
    grouped,
    pendingIds,
    status,
    loadError,
    mutationError,
    retry,
    create,
    update,
    remove,
    reorder,
    move,
  };
}
