import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, ArrowUp, CheckSquare, Circle, CircleCheck, CircleDot } from "lucide-react";

import type { Todo } from "#/lib/database.types";
import type { ToolEntry } from "#/tools/registry";

export function TodoBentoCard({ tool, data }: { tool: ToolEntry; data: unknown }) {
  const todos = Array.isArray(data) ? (data as Todo[]) : [];

  const today = new Date(new Date().toISOString().split("T")[0]);

  const notStartedCount = todos.filter((t) => t.status === "not_started").length;
  const startedCount = todos.filter((t) => t.status === "started").length;
  const completeCount = todos.filter((t) => t.status === "complete").length;
  const overdueCount = todos.filter(
    (t) => t.due_date !== null && new Date(t.due_date) < today && t.status !== "complete",
  ).length;
  const highPriorityCount = todos.filter(
    (t) => t.priority === "high" && t.status !== "complete",
  ).length;

  const hasAttention = overdueCount > 0 || highPriorityCount > 0;

  return (
    <Link
      to="/todos"
      aria-label="Open Todos tool"
      className="block rounded-lg border border-border bg-card p-6 transition-colors duration-150 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="mb-4 flex items-center gap-2">
        <CheckSquare className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 text-sm font-normal text-foreground">Todos</span>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="flex items-center gap-4">
        <div
          role="group"
          aria-label={`Not started: ${notStartedCount}`}
          className="flex items-center gap-2"
        >
          <Circle className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="tabular-nums text-sm text-foreground">{notStartedCount}</span>
        </div>

        <div
          role="group"
          aria-label={`Started: ${startedCount}`}
          className="flex items-center gap-2"
        >
          <CircleDot className="size-4 text-primary" aria-hidden="true" />
          <span className="tabular-nums text-sm text-foreground">{startedCount}</span>
        </div>

        <div
          role="group"
          aria-label={`Complete: ${completeCount}`}
          className="flex items-center gap-2"
        >
          <CircleCheck className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="tabular-nums text-sm text-foreground">{completeCount}</span>
        </div>
      </div>

      {hasAttention && (
        <div className="mt-3 flex items-center gap-3">
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 rounded-sm bg-destructive/10 px-2 py-1 text-sm font-medium text-destructive">
              <AlertCircle className="size-3" aria-hidden="true" />
              {overdueCount} overdue
            </span>
          )}
          {highPriorityCount > 0 && (
            <span className="flex items-center gap-1 rounded-sm bg-amber-400/10 px-2 py-1 text-sm font-medium text-amber-400">
              <ArrowUp className="size-3" aria-hidden="true" />
              {highPriorityCount} high
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
