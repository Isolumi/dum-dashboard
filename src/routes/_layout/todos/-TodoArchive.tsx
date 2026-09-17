import { RotateCcw, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import type { TodoController } from "./-useTodoController";

export function TodoArchive({ controller }: { controller: TodoController }) {
  const completed = controller.todos.filter((todo) => todo.status === "complete");
  if (controller.status === "loading") return <Skeleton className="h-11 w-full" />;

  return (
    <section aria-label="Archived todos" className="flex flex-col gap-2">
      {controller.loadError && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3">
            {controller.loadError}
            <Button variant="outline" size="sm" onClick={() => void controller.retry()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {completed.length === 0 && !controller.loadError && (
        <p className="px-4 py-3 text-sm text-muted-foreground">No completed items</p>
      )}
      <div role="list">
        {completed.map((todo) => (
          <div key={todo.id} role="listitem" className="flex min-h-11 items-center gap-2 px-4 py-1">
            <span className="min-w-0 flex-1 break-words text-sm text-muted-foreground">
              {todo.name}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Restore "${todo.name}"`}
              title="Restore"
              disabled={controller.pendingIds.has(todo.id)}
              onClick={() => void controller.update({ id: todo.id, status: "not_started" })}
            >
              <RotateCcw />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete "${todo.name}"`}
              title="Delete"
              disabled={controller.pendingIds.has(todo.id)}
              onClick={() => void controller.remove(todo.id)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      {controller.mutationError && (
        <Alert variant="destructive">
          <AlertDescription>{controller.mutationError}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
