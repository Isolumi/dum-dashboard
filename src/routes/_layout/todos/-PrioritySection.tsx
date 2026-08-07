import { memo, useId, useMemo } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Todo, TodoPriority } from "#/lib/database.types";
import { cn } from "#/lib/utils";
import type { AddTodoRowProps } from "./-AddTodoRow";
import { AddTodoRow } from "./-AddTodoRow";
import type { TodoRowProps } from "./-TodoRow";
import { TodoRow } from "./-TodoRow";

export interface PrioritySectionProps {
  priority: TodoPriority;
  label: string;
  todos: Todo[];
  onUpdate: TodoRowProps["onUpdate"];
  onDelete: TodoRowProps["onDelete"];
  onCreate: AddTodoRowProps["onCreate"];
  onReorder: (priority: TodoPriority, orderedIds: string[]) => void;
  compact?: boolean;
  isPending?: (id: string) => boolean;
}

const SECTION_LABEL_STYLES: Record<TodoPriority, string> = {
  high: "text-destructive",
  low: "text-muted-foreground",
};

function SortableTodoRow({
  todo,
  onUpdate,
  onDelete,
  compact,
  isPending,
  dragDisabled,
}: TodoRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
    disabled: isPending || dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(isDragging && "relative z-10 opacity-50")}
    >
      <TodoRow
        todo={todo}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragListeners={isPending || dragDisabled ? undefined : listeners}
        compact={compact}
        isPending={isPending}
        dragDisabled={dragDisabled}
      />
    </div>
  );
}

function PrioritySectionComponent({
  priority,
  label,
  todos,
  onUpdate,
  onDelete,
  onCreate,
  onReorder,
  compact = false,
  isPending,
}: PrioritySectionProps) {
  const dndId = useId();
  const todoIds = useMemo(() => todos.map((t) => t.id), [todos]);
  const hasPendingTodo = todos.some((todo) => isPending?.(todo.id));
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    if (hasPendingTodo) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = todos.findIndex((t) => t.id === active.id);
    const newIndex = todos.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...todos];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    onReorder(
      priority,
      reordered.map((t) => t.id),
    );
  }

  return (
    <div className={cn("flex flex-col", compact ? "gap-0.5" : "gap-1")}>
      {/* Section header */}
      <div
        className={cn(
          "flex items-center",
          compact ? "gap-1 px-2 pt-2 pb-0.5" : "gap-2 px-4 pt-4 pb-1",
        )}
      >
        <span
          className={cn(
            "font-medium uppercase tracking-wider",
            compact ? "text-xs" : "text-sm",
            SECTION_LABEL_STYLES[priority],
          )}
        >
          {label}
        </span>
        <span className="text-xs text-muted-foreground">({todos.length})</span>
      </div>

      {/* Todo rows */}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={todoIds} strategy={verticalListSortingStrategy}>
          <div role="list">
            {todos.map((todo) => (
              <SortableTodoRow
                key={todo.id}
                todo={todo}
                onUpdate={onUpdate}
                onDelete={onDelete}
                compact={compact}
                isPending={isPending?.(todo.id)}
                dragDisabled={hasPendingTodo}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add todo row — defaultPriority pre-set to this section's priority */}
      <AddTodoRow onCreate={onCreate} defaultPriority={priority} compact={compact} />
    </div>
  );
}

export const PrioritySection = memo(PrioritySectionComponent);
