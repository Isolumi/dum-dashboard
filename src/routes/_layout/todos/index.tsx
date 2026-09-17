import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Archive } from "lucide-react";
import { Button } from "#/components/ui/button";

import { Skeleton } from "#/components/ui/skeleton";
import { TodoBoard } from "./-TodoBoard";
import { TodoArchive } from "./-TodoArchive";
import { useTodoController } from "./-useTodoController";

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
  const controller = useTodoController();
  const [showArchive, setShowArchive] = useState(false);
  const archiveButtonRef = useRef<HTMLButtonElement>(null);
  const archiveCount = controller.todos.filter((todo) => todo.status === "complete").length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{showArchive ? "Archive" : "Todos"}</h1>
        <Button
          ref={archiveButtonRef}
          variant="ghost"
          size="sm"
          onClick={() => setShowArchive(!showArchive)}
        >
          {!showArchive && <Archive />}
          {showArchive ? "Back to todos" : `Archive (${archiveCount})`}
        </Button>
      </div>
      {showArchive ? (
        <TodoArchive
          controller={controller}
          onReturnFocus={() => archiveButtonRef.current?.focus({ preventScroll: true })}
        />
      ) : (
        <TodoBoard controller={controller} variant="full" />
      )}
    </main>
  );
}
