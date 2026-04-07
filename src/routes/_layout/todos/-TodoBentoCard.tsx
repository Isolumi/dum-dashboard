import { Link } from "@tanstack/react-router";
import { Circle, CircleCheck } from "lucide-react";

import type { Todo, TodoPriority } from "#/lib/database.types";
import type { ToolEntry } from "#/tools/registry";

const PRIORITY_ORDER: TodoPriority[] = ["high", "medium", "low"];
const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function formatDueDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function TodoRow({ todo, today }: { todo: Todo; today: Date }) {
  const isComplete = todo.status === "complete";
  const isOverdue =
    !isComplete && todo.due_date !== null && new Date(todo.due_date) < today;

  return (
    <div className="flex items-center gap-2 border-b border-border/40 py-1 last:border-0">
      {todo.status === "not_started" && (
        <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      {todo.status === "started" && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-primary"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
        </svg>
      )}
      {todo.status === "complete" && (
        <CircleCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}

      {isComplete ? (
        <s className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{todo.name}</s>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{todo.name}</span>
      )}

      <span
        className={`shrink-0 text-sm ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}
        aria-label={isOverdue ? `Overdue: ${formatDueDate(todo.due_date!)}` : undefined}
      >
        {todo.due_date ? formatDueDate(todo.due_date) : "—"}
      </span>
    </div>
  );
}

export function TodoBentoCard({ tool: _tool, data }: { tool: ToolEntry; data: unknown }) {
  const todos = Array.isArray(data) ? (data as Todo[]) : [];
  const today = new Date(new Date().toISOString().split("T")[0]);

  const grouped = PRIORITY_ORDER.reduce<Record<TodoPriority, Todo[]>>(
    (acc, p) => {
      acc[p] = todos
        .filter((t) => t.priority === p)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      return acc;
    },
    { high: [], medium: [], low: [] },
  );

  return (
    <Link
      to="/todos"
      aria-label="Open Todos tool"
      className="block rounded-lg border border-border bg-card transition-colors duration-150 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="max-h-96 overflow-y-auto p-4">
        {todos.length === 0 ? (
          <p className="text-xs text-muted-foreground">No todos yet.</p>
        ) : (
          PRIORITY_ORDER.map((priority) => {
            const items = grouped[priority];
            if (items.length === 0) return null;
            return (
              <div key={priority} className="mb-3 last:mb-0">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {PRIORITY_LABELS[priority]}
                </div>
                {items.map((todo) => (
                  <TodoRow key={todo.id} todo={todo} today={today} />
                ))}
              </div>
            );
          })
        )}
      </div>
    </Link>
  );
}
