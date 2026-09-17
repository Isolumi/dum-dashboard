import { memo, useMemo, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  usePresence,
  usePresenceData,
  useReducedMotion,
} from "motion/react";

import type { Todo } from "#/lib/database.types";
import { cn } from "#/lib/utils";
import type { TodoRowProps } from "./-TodoRow";
import { TodoRow } from "./-TodoRow";
import { getTodoSectionTargetId } from "./-todoDrag";
import type { TodoSection } from "./-todoUtils";

export interface PrioritySectionProps {
  priority: TodoSection;
  label: string;
  todos: Todo[];
  onUpdate: TodoRowProps["onUpdate"];
  onDelete: TodoRowProps["onDelete"];
  compact?: boolean;
  isPending?: (id: string) => boolean;
  animateRemoval?: boolean;
}

const SECTION_LABEL_STYLES: Record<TodoSection, string> = {
  today: "text-foreground",
  high: "text-muted-foreground",
  low: "text-muted-foreground",
};

function RegisteredTodoRow({
  todo,
  onUpdate,
  onDelete,
  compact,
  isPending,
  dragDisabled,
}: TodoRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: todo.id,
    disabled: isPending || dragDisabled,
    data: { section: todo.today_date ? "today" : todo.priority },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "relative z-10 opacity-0")}>
      <TodoRow
        todo={todo}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragListeners={isPending || dragDisabled ? undefined : listeners}
        dragAttributes={isPending || dragDisabled ? undefined : attributes}
        dragActivatorRef={setActivatorNodeRef}
        compact={compact}
        isPending={isPending}
        dragDisabled={dragDisabled}
      />
    </div>
  );
}

function AnimatedTodoRow(props: TodoRowProps) {
  const [isPresent, safeToRemove] = usePresence();
  const animateRemoval = usePresenceData() !== false;
  const reducedMotion = useReducedMotion();
  const skipExit = !animateRemoval || reducedMotion;
  useEffect(() => {
    if (!isPresent && skipExit) safeToRemove?.();
  }, [isPresent, skipExit, safeToRemove]);
  if (!isPresent && skipExit) return null;

  return (
    <m.div
      initial={false}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      onAnimationComplete={() => {
        if (!isPresent) safeToRemove?.();
      }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      inert={!isPresent}
      aria-hidden={!isPresent || undefined}
      className={cn(!isPresent && "pointer-events-none overflow-hidden")}
    >
      {/* Unregister the sortable immediately; the exit copy is visual only. */}
      {isPresent ? <RegisteredTodoRow {...props} /> : <TodoRow {...props} dragDisabled isPending />}
    </m.div>
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
  animateRemoval = true,
}: PrioritySectionProps) {
  const reducedMotion = useReducedMotion();
  const todoIds = useMemo(() => todos.map((t) => t.id), [todos]);
  const hasPendingTodo = todos.some((todo) => isPending?.(todo.id));
  const { setNodeRef: setDroppableNodeRef } = useDroppable({
    id: getTodoSectionTargetId(priority),
  });
  const { isOver: isTrailingDropTargetActive, setNodeRef: setTrailingDropTargetRef } = useDroppable(
    {
      id: getTodoSectionTargetId(priority, true),
    },
  );

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
        <LazyMotion features={domAnimation}>
          <div role="list" className="relative min-h-11">
            {todos.length === 0 && (
              <m.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reducedMotion ? 0 : 0.1, delay: reducedMotion ? 0 : 0.18 }}
                className={cn(
                  "absolute inset-0 flex min-h-11 items-center text-sm text-muted-foreground",
                  compact ? "px-5" : "px-4",
                )}
              >
                No items
              </m.p>
            )}
            <AnimatePresence initial={false} custom={animateRemoval}>
              {todos.map((todo) => (
                <AnimatedTodoRow
                  key={todo.id}
                  todo={todo}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  compact={compact}
                  isPending={isPending?.(todo.id)}
                  dragDisabled={hasPendingTodo}
                />
              ))}
            </AnimatePresence>
          </div>
        </LazyMotion>
        {todos.length > 0 && (
          <div
            ref={setTrailingDropTargetRef}
            aria-hidden="true"
            className={cn(
              "rounded-sm transition-colors",
              compact ? "h-2" : "h-3",
              isTrailingDropTargetActive && "bg-accent",
            )}
          />
        )}
      </SortableContext>
    </div>
  );
}

export const PrioritySection = memo(PrioritySectionComponent);
