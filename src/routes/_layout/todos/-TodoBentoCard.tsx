import { Link } from "@tanstack/react-router";

import type { Todo } from "#/lib/database.types";
import type { ToolEntry } from "#/tools/registry";
import { TodoBoard } from "./-TodoBoard";
import { useTodoController } from "./-useTodoController";

export function TodoBentoCard({ tool: _tool, data }: { tool: ToolEntry; data: unknown }) {
  const initialTodos = Array.isArray(data) ? (data as Todo[]) : undefined;
  const controller = useTodoController(initialTodos);

  return (
    <section aria-label="Todos" className="rounded-lg border border-border bg-card">
      <header className="border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          <Link
            to="/todos"
            className="rounded-sm underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Todos
          </Link>
        </h2>
      </header>
      <div className="p-2">
        <TodoBoard controller={controller} variant="compact" />
      </div>
    </section>
  );
}
