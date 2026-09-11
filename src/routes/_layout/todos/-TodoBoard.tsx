import { useCallback, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { AlertCircle, Circle, GripVertical } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import type { Todo, TodoPriority } from "#/lib/database.types";
import { cn } from "#/lib/utils";
import { AddTodoRow } from "./-AddTodoRow";
import { PrioritySection } from "./-PrioritySection";
import { findTodoPriority, moveTodoPreview } from "./-todoDrag";
import type { TodoGroups } from "./-todoDrag";
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

function cloneGroups(groups: TodoGroups): TodoGroups {
  return { high: [...groups.high], low: [...groups.low] };
}

function getDropPriority(groups: TodoGroups, overId: string): TodoPriority | null {
  const todoPriority = findTodoPriority(groups, overId);
  if (todoPriority) return todoPriority;

  const priority = /^priority-(high|low)(?:-end)?$/.exec(overId)?.[1];
  return priority === "high" || priority === "low" ? priority : null;
}

function isBelowTarget({ active, over }: DragOverEvent | DragEndEvent): boolean {
  const translated = active.rect?.current?.translated;
  if (!translated || !over?.rect) return false;
  return translated.top > over.rect.top + over.rect.height / 2;
}

function TodoDragPreview({ todo, compact }: { todo: Todo; compact: boolean }) {
  return (
    <div
      data-testid="todo-drag-overlay"
      aria-hidden="true"
      className={cn(
        "flex min-h-11 w-full items-center rounded-md bg-card px-2 text-foreground shadow-lg ring-1 ring-border",
        compact ? "gap-1 text-sm" : "gap-2 text-base",
      )}
    >
      <GripVertical className="size-4 shrink-0 text-muted-foreground" />
      <Circle className="size-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate">{todo.name}</span>
    </div>
  );
}

export function TodoBoard({ controller, variant }: TodoBoardProps): ReactElement {
  const compact = variant === "compact";
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewGroups, setPreviewGroups] = useState<TodoGroups | null>(null);
  const initialGroupsRef = useRef<TodoGroups | null>(null);
  const previewGroupsRef = useRef<TodoGroups | null>(null);
  const lastOverIdRef = useRef<UniqueIdentifier | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const displayedGroups = previewGroups ?? controller.grouped;
  const activeTodo = activeId
    ? (controller.todos.find((todo) => todo.id === activeId) ?? null)
    : null;
  const collisionDetectionStrategy: CollisionDetection = useCallback(
    (args) => {
      const pointerCollisions = pointerWithin(args);
      const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
      let overId = getFirstCollision(collisions, "id");

      if (overId !== null) {
        const sectionPriority = /^priority-(high|low)$/.exec(String(overId))?.[1];
        if (sectionPriority === "high" || sectionPriority === "low") {
          const sectionIds = new Set(displayedGroups[sectionPriority].map((todo) => todo.id));
          if (sectionIds.size > 0) {
            overId =
              getFirstCollision(
                closestCenter({
                  ...args,
                  droppableContainers: args.droppableContainers.filter((container) =>
                    sectionIds.has(String(container.id)),
                  ),
                }),
                "id",
              ) ?? overId;
          }
        }

        lastOverIdRef.current = overId;
        return [{ id: overId }];
      }

      return lastOverIdRef.current === null ? [] : [{ id: lastOverIdRef.current }];
    },
    [displayedGroups],
  );

  function updatePreview(next: TodoGroups) {
    previewGroupsRef.current = next;
    setPreviewGroups(next);
  }

  function finishDrag() {
    controller.setDragging(false);
    initialGroupsRef.current = null;
    previewGroupsRef.current = null;
    lastOverIdRef.current = null;
    setPreviewGroups(null);
    setActiveId(null);
  }

  function handleDragStart({ active }: DragStartEvent) {
    const id = String(active.id);
    if (!controller.todos.some((todo) => todo.id === id)) return;

    const initial = cloneGroups(controller.grouped);
    initialGroupsRef.current = initial;
    lastOverIdRef.current = null;
    updatePreview(cloneGroups(initial));
    setActiveId(id);
    controller.setDragging(true);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !previewGroupsRef.current) return;

    const next = moveTodoPreview(
      previewGroupsRef.current,
      String(active.id),
      String(over.id),
      isBelowTarget(event),
    );
    if (next !== previewGroupsRef.current) updatePreview(next);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeId = String(active.id);
    const initial = initialGroupsRef.current;
    let finalGroups = previewGroupsRef.current;

    if (!over || !initial || !finalGroups) {
      finishDrag();
      return;
    }

    const overId = String(over.id);
    const sourcePriority = findTodoPriority(initial, activeId);
    const currentPriority = findTodoPriority(finalGroups, activeId);
    const targetPriority = getDropPriority(finalGroups, overId);

    if (!sourcePriority || !currentPriority || !targetPriority) {
      finishDrag();
      return;
    }

    if (sourcePriority === targetPriority && currentPriority === sourcePriority) {
      const sourceTodos = initial[sourcePriority];
      const sourceIndex = sourceTodos.findIndex((todo) => todo.id === activeId);
      const overIndex = sourceTodos.findIndex((todo) => todo.id === overId);
      const destinationIndex =
        overId === `priority-${sourcePriority}-end` ? sourceTodos.length - 1 : overIndex;

      if (sourceIndex >= 0 && destinationIndex >= 0 && sourceIndex !== destinationIndex) {
        void controller.reorder(
          sourcePriority,
          arrayMove(sourceTodos, sourceIndex, destinationIndex).map((todo) => todo.id),
        );
      }
      finishDrag();
      return;
    }

    finalGroups = moveTodoPreview(finalGroups, activeId, overId, isBelowTarget(event));
    const finalPriority = findTodoPriority(finalGroups, activeId);

    if (finalPriority && finalPriority !== sourcePriority) {
      const targetIndex = finalGroups[finalPriority].findIndex((todo) => todo.id === activeId);
      if (targetIndex >= 0) void controller.move(activeId, finalPriority, targetIndex);
    } else if (finalPriority) {
      const originalIds = initial[finalPriority].map((todo) => todo.id);
      const finalIds = finalGroups[finalPriority].map((todo) => todo.id);
      if (originalIds.some((id, index) => id !== finalIds[index])) {
        void controller.reorder(finalPriority, finalIds);
      }
    }

    finishDrag();
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
            collisionDetection={collisionDetectionStrategy}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={finishDrag}
          >
            <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
              {PRIORITY_ORDER.map((priority) => (
                <PrioritySection
                  key={priority}
                  compact={compact}
                  priority={priority}
                  label={PRIORITY_LABELS[priority]}
                  todos={displayedGroups[priority]}
                  onUpdate={controller.update}
                  onDelete={controller.remove}
                  isPending={(id) => controller.pendingIds.has(id)}
                />
              ))}
              <AddTodoRow compact={compact} onCreate={controller.create} />
            </div>
            <DragOverlay>
              {activeTodo && <TodoDragPreview todo={activeTodo} compact={compact} />}
            </DragOverlay>
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
