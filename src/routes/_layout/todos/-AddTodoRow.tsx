import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { cn } from "#/lib/utils";
import type { TodoPriority } from "#/lib/database.types";
import { TodoDueDatePicker } from "./-TodoDueDatePicker";

export interface AddTodoRowProps {
  onCreate: (fields: {
    name: string;
    priority: "high" | "low";
    due_date: string | null;
    due_date_has_time: boolean;
  }) => void;
  defaultPriority?: TodoPriority;
  compact?: boolean;
}

function AddTodoRowComponent({
  onCreate,
  defaultPriority = "low",
  compact = false,
}: AddTodoRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<TodoPriority>(defaultPriority);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueDateHasTime, setDueDateHasTime] = useState(false);

  const collapsedRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded) {
      collapsedRowRef.current?.focus();
    }
  }, [isExpanded]);

  const resetForm = useCallback(() => {
    setName("");
    setPriority(defaultPriority);
    setDueDate(null);
    setDueDateHasTime(false);
    setIsExpanded(false);
  }, [defaultPriority]);

  const handleSubmit = useCallback(() => {
    if (name.trim().length === 0) return;
    onCreate({
      name: name.trim(),
      priority,
      due_date: dueDate,
      due_date_has_time: dueDateHasTime,
    });
    resetForm();
  }, [name, priority, dueDate, dueDateHasTime, onCreate, resetForm]);

  if (!isExpanded) {
    return (
      <div
        ref={collapsedRowRef}
        className={cn(
          "min-h-[44px] cursor-pointer items-center rounded-md transition-colors motion-reduce:transition-none hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          compact ? "grid grid-cols-[2.75rem_minmax(0,1fr)] gap-1 px-3" : "flex gap-2 px-4",
        )}
        onClick={() => {
          setIsExpanded(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(true);
          } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            setName(e.key);
            setIsExpanded(true);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Add a new todo"
      >
        <Plus className={cn("text-muted-foreground", compact && "justify-self-center")} />
        <span className={cn("italic text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          Add a todo...
        </span>
      </div>
    );
  }

  return (
    <form
      className="rounded-md bg-accent/30 ring-1 ring-inset ring-border/50"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        resetForm();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <div
        className={cn(
          "min-h-[44px] items-center",
          compact
            ? "grid grid-cols-[2.75rem_minmax(5rem,1fr)_auto_auto_auto] gap-1 px-3"
            : "flex gap-2 px-4",
        )}
      >
        {compact && <span aria-hidden="true" />}
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              resetForm();
            }
          }}
          placeholder="Todo name..."
          autoFocus
          className={cn(
            "h-9 flex-1 rounded-lg border border-input/40 bg-input/20 px-3 shadow-none transition-colors motion-reduce:transition-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:bg-input/30 focus-visible:ring-2 focus-visible:ring-ring/30",
            compact ? "text-sm" : "text-base",
          )}
          aria-label="New todo name"
        />

        <label className="relative inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full focus-within:outline-none">
          <input
            type="checkbox"
            role="switch"
            aria-label="High priority"
            aria-checked={priority === "high"}
            checked={priority === "high"}
            onChange={(event) => setPriority(event.target.checked ? "high" : "low")}
            className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
          />
          <span
            data-slot="priority-switch-track"
            className="relative block h-7 w-16 rounded-full border border-border/80 bg-muted/70 text-[10px] font-semibold text-muted-foreground shadow-inner transition-colors motion-reduce:transition-none peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-checked:bg-primary/25 peer-checked:text-foreground"
          >
            <span
              className={cn(
                "absolute inset-y-0 flex items-center",
                priority === "high" ? "left-2" : "right-2",
              )}
            >
              {priority === "high" ? "High" : "Low"}
            </span>
            <span
              data-slot="priority-switch-thumb"
              aria-hidden="true"
              className={cn(
                "absolute top-[3px] left-[3px] size-5 rounded-full bg-foreground/65 shadow-sm transition-[transform,background-color] motion-reduce:transition-none",
                priority === "high" && "translate-x-9 bg-primary",
              )}
            />
          </span>
        </label>

        <div className="w-11 shrink-0">
          <TodoDueDatePicker
            value={dueDate}
            onChange={(value, hasTime) => {
              setDueDate(value);
              setDueDateHasTime(hasTime);
            }}
            label="Choose date and time"
            compact={compact}
            showValue={false}
          />
        </div>

        <Button type="submit" size="sm" className="h-9 min-h-0 shrink-0">
          Add
        </Button>
      </div>
    </form>
  );
}

export const AddTodoRow = memo(AddTodoRowComponent);
