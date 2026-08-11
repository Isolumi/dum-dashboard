import type { ReactElement } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { cn } from "#/lib/utils";
import { AddTodoRow } from "./-AddTodoRow";
import { PrioritySection } from "./-PrioritySection";
import { PRIORITY_LABELS, PRIORITY_ORDER } from "./-todoUtils";
import type { TodoController } from "./-useTodoController";

export interface TodoBoardProps {
  controller: TodoController;
  variant: "compact" | "full";
}

function TodoBoardSkeleton({ compact }: { compact: boolean }) {
  return (
    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
      {Array.from({ length: compact ? 3 : 5 }).map((_, index) => (
        <div key={index} className={cn("flex items-center gap-2", compact ? "px-2" : "px-4")}>
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-14 rounded-sm" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function TodoBoard({ controller, variant }: TodoBoardProps): ReactElement {
  const compact = variant === "compact";
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const sourceTodo = controller.todos.find((todo) => todo.id === activeId);
    if (!sourceTodo) return;

    const destinationTodo = controller.todos.find((todo) => todo.id === overId);
    const priorityDropTarget = /^priority-(high|low)(?:-end)?$/.exec(overId)?.[1];
    const targetPriority = destinationTodo?.priority ?? priorityDropTarget ?? null;
    if (targetPriority !== "high" && targetPriority !== "low") return;

    const targetTodos = controller.grouped[targetPriority];
    const targetIndex = destinationTodo
      ? targetTodos.findIndex((todo) => todo.id === destinationTodo.id)
      : targetTodos.length;
    if (targetIndex < 0) return;

    if (sourceTodo.priority !== targetPriority) {
      void controller.move(activeId, targetPriority, targetIndex);
      return;
    }

    const sourceIndex = targetTodos.findIndex((todo) => todo.id === activeId);
    const destinationIndex = destinationTodo ? targetIndex : targetTodos.length - 1;
    if (sourceIndex < 0 || destinationIndex < 0 || sourceIndex === destinationIndex) return;

    void controller.reorder(
      targetPriority,
      arrayMove(targetTodos, sourceIndex, destinationIndex).map((todo) => todo.id),
    );
  }

  return (
    <section
      aria-label="Todo board"
      className={cn("flex flex-col gap-2", compact && "max-h-[32rem] overflow-y-auto")}
    >
      {controller.status === "loading" ? (
        <TodoBoardSkeleton compact={compact} />
      ) : (
        <>
          {controller.loadError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{controller.loadError}</span>
                <Button size="sm" variant="outline" onClick={() => void controller.retry()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
              {PRIORITY_ORDER.map((priority) => (
                <PrioritySection
                  key={priority}
                  compact={compact}
                  priority={priority}
                  label={PRIORITY_LABELS[priority]}
                  todos={controller.grouped[priority]}
                  onUpdate={controller.update}
                  onDelete={controller.remove}
                  isPending={(id) => controller.pendingIds.has(id)}
                />
              ))}
              <AddTodoRow compact={compact} onCreate={controller.create} />
            </div>
          </DndContext>
          {controller.mutationError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{controller.mutationError}</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </section>
  );
}
