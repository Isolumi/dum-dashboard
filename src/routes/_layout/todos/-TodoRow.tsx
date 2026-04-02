import { useRef, useState } from "react";
import { Circle, CircleCheck, CircleDot, CalendarIcon, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";

import { Button } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
import { Input } from "#/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import type { Todo, TodoPriority, TodoStatus } from "#/lib/database.types";
import { cn } from "#/lib/utils";

export interface TodoRowProps {
  todo: Todo;
  onUpdate: (fields: {
    id: string;
    name?: string;
    priority?: "high" | "medium" | "low";
    status?: "not_started" | "started" | "complete";
    due_date?: string | null;
  }) => void;
  onDelete: (id: string) => void;
}

const STATUS_CYCLE: Record<TodoStatus, TodoStatus> = {
  not_started: "started",
  started: "complete",
  complete: "not_started",
};

const STATUS_ICONS: Record<TodoStatus, React.ReactNode> = {
  not_started: <Circle className="text-muted-foreground" />,
  started: <CircleDot className="text-primary" />,
  complete: <CircleCheck className="text-muted-foreground" />,
};

const STATUS_NEXT_LABEL: Record<TodoStatus, string> = {
  not_started: "started",
  started: "complete",
  complete: "not started",
};

const PRIORITY_STYLES: Record<TodoPriority, string> = {
  high: "bg-destructive/20 text-destructive",
  medium: "bg-amber-400/20 text-amber-400",
  low: "text-muted-foreground",
};

const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function TodoRow({ todo, onUpdate, onDelete }: TodoRowProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(todo.name);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isOverdue =
    todo.due_date &&
    todo.status !== "complete" &&
    new Date(todo.due_date) < new Date(new Date().toISOString().split("T")[0]);

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
        "group flex min-h-[44px] items-center gap-2 px-4 transition-colors hover:bg-accent",
        todo.status === "complete" && "opacity-60",
      )}
    >
      {/* Status icon button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onUpdate({ id: todo.id, status: STATUS_CYCLE[todo.status] })}
        aria-label={`Mark "${todo.name}" as ${STATUS_NEXT_LABEL[todo.status]}`}
        className="shrink-0"
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
          aria-label="Edit todo name"
          className="h-auto flex-1 border-0 p-0 text-base shadow-none focus-visible:ring-1 focus-visible:ring-ring/50"
        />
      ) : (
        <span
          className={cn(
            "flex-1 cursor-pointer text-base",
            todo.status === "complete" && "text-muted-foreground line-through",
          )}
          onClick={() => setIsEditingName(true)}
        >
          {todo.name}
        </span>
      )}

      {/* Priority badge popover */}
      <Popover open={isPriorityOpen} onOpenChange={setIsPriorityOpen}>
        <PopoverTrigger
          render={
            <button
              className={cn(
                "cursor-pointer rounded-sm px-2 py-1 text-sm font-medium shrink-0",
                PRIORITY_STYLES[todo.priority],
              )}
              aria-expanded={isPriorityOpen}
              aria-haspopup="listbox"
              aria-label={`Change priority for "${todo.name}"`}
            />
          }
        >
          {PRIORITY_LABELS[todo.priority]}
        </PopoverTrigger>
        <PopoverContent className="w-32 p-1" align="end">
          {(["high", "medium", "low"] as const).map((p) => (
            <button
              key={p}
              className={cn(
                "w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                PRIORITY_STYLES[p],
              )}
              onClick={() => {
                onUpdate({ id: todo.id, priority: p });
                setIsPriorityOpen(false);
              }}
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Due date — calendar popover */}
      <div className="w-24 shrink-0 text-right">
        <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
          <PopoverTrigger
            render={
              <button
                aria-label={`Edit due date for "${todo.name}"`}
                className="w-full text-right"
              />
            }
          >
            {todo.due_date ? (
              <span
                className={cn(
                  "text-sm",
                  isOverdue ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {format(parseISO(todo.due_date), "MMM d")}
              </span>
            ) : (
              <CalendarIcon className="ml-auto size-4 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground" />
            )}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={todo.due_date ? parseISO(todo.due_date) : undefined}
              onSelect={(date) => {
                onUpdate({
                  id: todo.id,
                  due_date: date ? format(date, "yyyy-MM-dd") : null,
                });
                setIsDateOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(todo.id)}
        aria-label={`Delete "${todo.name}"`}
        className="shrink-0 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 />
      </Button>
    </div>
  );
}
