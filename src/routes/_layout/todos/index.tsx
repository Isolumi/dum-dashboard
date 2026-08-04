import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Skeleton } from "#/components/ui/skeleton";
import type { Todo, TodoPriority } from "#/lib/database.types";
import { getAccessToken } from "#/lib/auth";
import { useTodosRealtime } from "#/hooks/useTodosRealtime";
import {
  createTodo,
  deleteTodo,
  getTodos,
  reorderTodos,
  updateTodo,
} from "#/routes/todos/todos.functions";
import { LiveIndicator } from "./-LiveIndicator";
import { PrioritySection } from "./-PrioritySection";
import { PRIORITY_ORDER, PRIORITY_LABELS, groupAndSortTodos } from "./-todoUtils";

export const Route = createFileRoute("/_layout/todos/")({
  pendingComponent: TodosLoading,
  component: TodosPage,
});

function TodosLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <h1 className="text-xl font-semibold">Todos</h1>
      <div className="flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-4 min-h-[44px]">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-14 rounded-sm" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </main>
  );
}

function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const todosRef = useRef<Todo[]>([]);

  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  useEffect(() => {
    if (!mutationError) return;
    const timer = setTimeout(() => setMutationError(null), 4000);
    return () => clearTimeout(timer);
  }, [mutationError]);

  const loadTodos = useCallback(async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    if (showLoading) setLoading(true);
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setLoadError("Your session expired. Sign in again to load todos.");
      setLoading(false);
      return;
    }

    try {
      const fresh = await getTodos({
        data: { supabase_access_token: accessToken },
      });
      setTodos(fresh);
      setLoadError(null);
    } catch {
      setLoadError("Could not load todos. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTodos();
  }, [loadTodos]);

  const channelStatus = useTodosRealtime(() => {
    void loadTodos({ showLoading: false });
  });

  const grouped = useMemo(() => groupAndSortTodos(todos), [todos]);

  const requireAccessToken = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("missing-session");
    return accessToken;
  }, []);

  const handleCreate = useCallback(
    async (fields: {
      name: string;
      priority: "high" | "medium" | "low";
      due_date: string | null;
    }) => {
      if (fields.name.trim().length === 0) return;
      try {
        const accessToken = await requireAccessToken();
        const created = await createTodo({
          data: {
            supabase_access_token: accessToken,
            name: fields.name.trim(),
            priority: fields.priority,
            status: "not_started",
            due_date: fields.due_date,
          },
        });
        setTodos((prev) => [...prev, created]);
      } catch {
        setMutationError("Save failed — check your connection and try again.");
      }
    },
    [requireAccessToken],
  );

  const handleUpdate = useCallback(
    async (fields: {
      id: string;
      name?: string;
      priority?: "high" | "medium" | "low";
      status?: "not_started" | "started" | "complete";
      due_date?: string | null;
    }) => {
      const previous = todosRef.current;
      setTodos((prev) => prev.map((t) => (t.id === fields.id ? { ...t, ...fields } : t)));
      try {
        const accessToken = await requireAccessToken();
        await updateTodo({ data: { ...fields, supabase_access_token: accessToken } });
      } catch {
        setTodos(previous);
        setMutationError("Save failed — check your connection and try again.");
      }
    },
    [requireAccessToken],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const previous = todosRef.current;
      setTodos((prev) => prev.filter((t) => t.id !== id));
      try {
        const accessToken = await requireAccessToken();
        await deleteTodo({ data: { id, supabase_access_token: accessToken } });
      } catch {
        setTodos(previous);
        setMutationError("Save failed — check your connection and try again.");
      }
    },
    [requireAccessToken],
  );

  const handleReorder = useCallback(
    async (priority: TodoPriority, orderedIds: string[]) => {
      let previous = todosRef.current;
      // Optimistic update
      setTodos((prev) => {
        previous = prev;
        const otherTodos = prev.filter((t) => t.priority !== priority);
        const reordered = orderedIds
          .map((id, i) => {
            const todo = prev.find((t) => t.id === id);
            return todo ? { ...todo, sort_order: i } : null;
          })
          .filter(Boolean) as Todo[];
        return [...otherTodos, ...reordered];
      });

      // Persist
      try {
        const accessToken = await requireAccessToken();
        await reorderTodos({
          data: {
            supabase_access_token: accessToken,
            updates: orderedIds.map((id, i) => ({ id, sort_order: i })),
          },
        });
      } catch {
        setTodos(previous);
        setMutationError("Reorder failed — check your connection and try again.");
      }
    },
    [requireAccessToken],
  );

  if (loading) return <TodosLoading />;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Todos</h1>
        <LiveIndicator status={channelStatus} />
      </div>
      {loadError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        {PRIORITY_ORDER.map((p) => (
          <PrioritySection
            key={p}
            priority={p}
            label={PRIORITY_LABELS[p]}
            todos={grouped[p]}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onCreate={handleCreate}
            onReorder={handleReorder}
          />
        ))}
      </div>
      {mutationError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{mutationError}</AlertDescription>
        </Alert>
      )}
    </main>
  );
}
