import { memo, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Todo, TodoPriority } from "#/lib/database.types";
import { cn } from "#/lib/utils";
import type { TodoRowProps } from "./-TodoRow";
import { TodoRow } from "./-TodoRow";

export interface PrioritySectionProps {
  priority: TodoPriority;
  label: string;
  todos: Todo[];
  onUpdate: TodoRowProps["onUpdate"];
  onDelete: TodoRowProps["onDelete"];
  compact?: boolean;
  isPending?: (id: string) => boolean;
}

const SECTION_LABEL_STYLES: Record<TodoPriority, string> = {
  high: "text-muted-foreground",
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
    data: { priority: todo.priority },
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
  compact = false,
  isPending,
}: PrioritySectionProps) {
  const todoIds = useMemo(() => todos.map((t) => t.id), [todos]);
  const hasPendingTodo = todos.some((todo) => isPending?.(todo.id));
  const { setNodeRef: setDroppableNodeRef } = useDroppable({ id: `priority-${priority}` });

  return (
    <div ref={setDroppableNodeRef} className={cn("flex flex-col", compact ? "gap-0.5" : "gap-1")}>
      {/* Section header */}
      <div
        className={cn(
          "flex items-center",
          compact ? "gap-1 pr-2 pl-5 pt-2 pb-0.5" : "gap-2 px-4 pt-4 pb-1",
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
    </div>
  );
}

export const PrioritySection = memo(PrioritySectionComponent);
