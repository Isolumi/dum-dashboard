import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Skeleton } from "#/components/ui/skeleton";
import { PrioritySection } from "./-PrioritySection";
import { PRIORITY_LABELS, PRIORITY_ORDER } from "./-todoUtils";
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

  if (controller.status === "loading") return <TodosLoading />;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Todos</h1>
      </div>
      {controller.loadError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{controller.loadError}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        {PRIORITY_ORDER.map((p) => (
          <PrioritySection
            key={p}
            priority={p}
            label={PRIORITY_LABELS[p]}
            todos={controller.grouped[p]}
            onUpdate={controller.update}
            onDelete={controller.remove}
            onCreate={controller.create}
            onReorder={controller.reorder}
          />
        ))}
      </div>
      {controller.mutationError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{controller.mutationError}</AlertDescription>
        </Alert>
      )}
    </main>
  );
}
