import type { Todo } from "#/lib/database.types";
import type { ToolEntry } from "#/tools/registry";
import { TodoBoard } from "./-TodoBoard";
import { useTodoController } from "./-useTodoController";

export function TodoBentoCard({ tool: _tool, data }: { tool: ToolEntry; data: unknown }) {
  const initialTodos = Array.isArray(data) ? (data as Todo[]) : undefined;
  const controller = useTodoController(initialTodos);

  return (
    <section aria-label="Todos" className="rounded-lg border border-border bg-card">
      <div className="p-2">
        <TodoBoard controller={controller} variant="compact" />
      </div>
    </section>
  );
}
