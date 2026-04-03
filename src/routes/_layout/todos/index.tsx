import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Skeleton } from "#/components/ui/skeleton";
import type { Todo, TodoPriority } from "#/lib/database.types";
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

export const Route = createFileRoute("/_layout/todos/")({
  loader: async () => {
    try {
      const todos = await getTodos();
      return { todos: Array.isArray(todos) ? todos : [], error: null };
    } catch {
      return {
        todos: [] as Todo[],
        error: "Could not load todos. Refresh to try again.",
      };
    }
  },
  pendingComponent: TodosLoading,
  component: TodosPage,
});

const PRIORITY_ORDER: TodoPriority[] = ["high", "medium", "low"];
const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

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
  const { todos: initialTodos, error } = Route.useLoaderData();
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    if (!mutationError) return;
    const timer = setTimeout(() => setMutationError(null), 4000);
    return () => clearTimeout(timer);
  }, [mutationError]);

  const channelStatus = useTodosRealtime(async () => {
    const fresh = await getTodos();
    setTodos(fresh);
  });

  const grouped = useMemo(() => {
    const groups: Record<TodoPriority, Todo[]> = { high: [], medium: [], low: [] };
    for (const todo of todos) {
      groups[todo.priority].push(todo);
    }
    return groups;
  }, [todos]);

  async function handleCreate(fields: {
    name: string;
    priority: "high" | "medium" | "low";
    due_date: string | null;
  }) {
    if (fields.name.trim().length === 0) return;
    try {
      const created = await createTodo({
        data: {
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
  }

  async function handleUpdate(fields: {
    id: string;
    name?: string;
    priority?: "high" | "medium" | "low";
    status?: "not_started" | "started" | "complete";
    due_date?: string | null;
  }) {
    const previous = todos;
    setTodos((prev) => prev.map((t) => (t.id === fields.id ? { ...t, ...fields } : t)));
    try {
      await updateTodo({ data: fields });
    } catch {
      setTodos(previous);
      setMutationError("Save failed — check your connection and try again.");
    }
  }

  async function handleDelete(id: string) {
    const previous = todos;
    setTodos((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteTodo({ data: { id } });
    } catch {
      setTodos(previous);
      setMutationError("Save failed — check your connection and try again.");
    }
  }

  async function handleReorder(priority: TodoPriority, orderedIds: string[]) {
    // Optimistic update
    setTodos((prev) => {
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
      await reorderTodos({
        data: { updates: orderedIds.map((id, i) => ({ id, sort_order: i })) },
      });
    } catch {
      // Revert on failure
      const fresh = await getTodos();
      setTodos(fresh);
      setMutationError("Reorder failed — check your connection and try again.");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Todos</h1>
        <LiveIndicator status={channelStatus} />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
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
