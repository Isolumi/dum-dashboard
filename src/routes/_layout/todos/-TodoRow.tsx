import { ArrowDown, ArrowUp, Circle, CircleCheck, GripVertical, Trash2 } from "lucide-react";
import { memo, useRef, useState } from "react";
import type { DraggableSyntheticListeners } from "@dnd-kit/core";

import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import type { Todo, TodoPriority, TodoStatus } from "#/lib/database.types";
import { cn } from "#/lib/utils";

import { TodoDueDatePicker } from "./-TodoDueDatePicker";
import { isTodoDueDateOverdue } from "./-todoDueDate";

export interface TodoRowProps {
  todo: Todo;
  onUpdate: (fields: {
    id: string;
    name?: string;
    priority?: "high" | "low";
    status?: "not_started" | "started" | "complete";
    due_date?: string | null;
    due_date_has_time?: boolean;
  }) => void;
  onDelete: (id: string) => void;
  dragListeners?: DraggableSyntheticListeners;
  compact?: boolean;
  isPending?: boolean;
  dragDisabled?: boolean;
}

const STATUS_CYCLE: Record<TodoStatus, TodoStatus> = {
  not_started: "started",
  started: "complete",
  complete: "not_started",
};

const STATUS_ICONS: Record<TodoStatus, React.ReactNode> = {
  not_started: <Circle className="text-muted-foreground" />,
  started: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primary"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
    </svg>
  ),
  complete: <CircleCheck className="text-muted-foreground" />,
};

const STATUS_NEXT_LABEL: Record<TodoStatus, string> = {
  not_started: "started",
  started: "complete",
  complete: "not started",
};

const PRIORITY_NEXT: Record<TodoPriority, TodoPriority> = {
  high: "low",
  low: "high",
};

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  high: "High",
  low: "Low",
};

const PRIORITY_STYLES: Record<TodoPriority, string> = {
  high: "text-destructive hover:text-destructive",
  low: "text-muted-foreground",
};

const PRIORITY_ICONS: Record<TodoPriority, React.ReactNode> = {
  high: <ArrowUp className="size-4" />,
  low: <ArrowDown className="size-4" />,
};

function TodoRowComponent({
  todo,
  onUpdate,
  onDelete,
  dragListeners,
  compact = false,
  isPending = false,
  dragDisabled = false,
}: TodoRowProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(todo.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isOverdue =
    todo.due_date &&
    todo.status !== "complete" &&
    isTodoDueDateOverdue(todo.due_date, todo.due_date_has_time);

  function saveName() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== todo.name) {
      onUpdate({ id: todo.id, name: trimmed });
    } else {
      setNameValue(todo.name);
    }
    setIsEditingName(false);
  }

  function revertName() {
    setNameValue(todo.name);
    setIsEditingName(false);
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      saveName();
    } else if (e.key === "Escape") {
      revertName();
    }
  }

  function handleNameBlur(e: React.FocusEvent<HTMLInputElement>) {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const row = e.currentTarget.closest("[role='listitem']");
    if (row && relatedTarget && row.contains(relatedTarget)) {
      return;
    }
    saveName();
  }

  return (
    <div
      role="listitem"
      className={cn(
        "group min-h-[44px] items-center rounded-md transition-colors motion-reduce:transition-none hover:bg-accent",
        compact ? "grid grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-1 px-2" : "flex gap-2 px-4",
        todo.status === "complete" && "opacity-60",
      )}
    >
      {!compact && (
        <button
          {...dragListeners}
          disabled={dragDisabled || isPending}
          className="min-h-11 min-w-11 shrink-0 cursor-grab rounded-md text-muted-foreground opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing disabled:cursor-default"
          aria-label={`Drag to reorder "${todo.name}"`}
        >
          <GripVertical className="size-4" />
        </button>
      )}

      {/* Status icon button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onUpdate({ id: todo.id, status: STATUS_CYCLE[todo.status] })}
        disabled={isPending}
        aria-label={`Mark "${todo.name}" as ${STATUS_NEXT_LABEL[todo.status]}`}
        className="size-11 shrink-0"
      >
        {STATUS_ICONS[todo.status]}
      </Button>

      {/* Name field */}
      {isEditingName ? (
        <Input
          ref={nameInputRef}
          autoFocus
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onKeyDown={handleNameKeyDown}
          onBlur={handleNameBlur}
          disabled={isPending}
          aria-label="Edit todo name"
          className={cn(
            "min-h-11 flex-1 border-0 p-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring/50",
            compact ? "min-w-0 text-sm" : "text-base",
          )}
        />
      ) : (
        <button
          type="button"
          className={`flex min-h-11 min-w-0 flex-1 cursor-pointer items-center overflow-hidden rounded-md text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${compact ? "text-sm" : "text-base"} ${todo.status === "complete" ? "text-muted-foreground line-through" : ""}`}
          onClick={() => setIsEditingName(true)}
          disabled={isPending}
          aria-label={isPending ? `${todo.name} (saving)` : undefined}
        >
          <span className="truncate">{todo.name}</span>
          {isPending && (
            <span className="ml-2 shrink-0 text-xs text-muted-foreground">Saving…</span>
          )}
        </button>
      )}

      {compact ? (
        <div className="relative flex min-w-11 shrink-0 items-center">
          <div className="absolute right-full z-10 flex items-center rounded-md bg-accent opacity-0 transition-opacity before:pointer-events-none before:absolute before:inset-y-0 before:right-full before:w-8 before:bg-gradient-to-r before:from-transparent before:to-accent motion-reduce:transition-none group-hover:opacity-100 focus-within:opacity-100 [@media(pointer:coarse)]:static [@media(pointer:coarse)]:opacity-100 [@media(pointer:coarse)]:before:hidden">
            <button
              {...dragListeners}
              disabled={dragDisabled || isPending}
              className="min-h-11 min-w-11 shrink-0 cursor-grab rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing disabled:cursor-default"
              aria-label={`Drag to reorder "${todo.name}"`}
            >
              <GripVertical className="size-4" />
            </button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => onUpdate({ id: todo.id, priority: PRIORITY_NEXT[todo.priority] })}
              disabled={isPending}
              aria-label={`Change "${todo.name}" priority to ${PRIORITY_LABEL[PRIORITY_NEXT[todo.priority]]}`}
              className="min-h-11 min-w-11 shrink-0 justify-center px-0 font-medium text-muted-foreground hover:text-foreground"
            >
              {PRIORITY_ICONS[todo.priority]}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(todo.id)}
              disabled={isPending}
              aria-label={`Delete "${todo.name}"`}
              className="size-11 shrink-0 hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </div>

          <div
            className={cn(
              "shrink-0 text-right",
              todo.due_date ? "w-32" : "w-11",
              todo.due_date && (isOverdue ? "text-destructive" : "text-muted-foreground"),
            )}
          >
            <TodoDueDatePicker
              value={todo.due_date}
              onChange={(due_date, due_date_has_time) =>
                onUpdate({ id: todo.id, due_date, due_date_has_time })
              }
              label={`Edit due date for "${todo.name}"`}
              compact
              hasTime={todo.due_date_has_time}
              disabled={isPending}
            />
          </div>
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onUpdate({ id: todo.id, priority: PRIORITY_NEXT[todo.priority] })}
            disabled={isPending}
            aria-label={`Change "${todo.name}" priority to ${PRIORITY_LABEL[PRIORITY_NEXT[todo.priority]]}`}
            className={cn(
              "min-h-11 min-w-11 shrink-0 px-2 text-sm font-medium",
              PRIORITY_STYLES[todo.priority],
            )}
          >
            {PRIORITY_LABEL[todo.priority]}
          </Button>

          <div
            className={cn(
              "w-40 shrink-0 text-right",
              todo.due_date && (isOverdue ? "text-destructive" : "text-muted-foreground"),
            )}
          >
            <TodoDueDatePicker
              value={todo.due_date}
              onChange={(due_date, due_date_has_time) =>
                onUpdate({ id: todo.id, due_date, due_date_has_time })
              }
              label={`Edit due date for "${todo.name}"`}
              hasTime={todo.due_date_has_time}
              disabled={isPending}
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(todo.id)}
            disabled={isPending}
            aria-label={`Delete "${todo.name}"`}
            className="size-11 shrink-0 opacity-0 transition-opacity motion-reduce:transition-none hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100"
          >
            <Trash2 />
          </Button>
        </>
      )}
    </div>
  );
}

export const TodoRow = memo(TodoRowComponent);
