import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { cn } from "#/lib/utils";
import type { TodoPriority } from "#/lib/database.types";
import { TodoDueDatePicker } from "./-TodoDueDatePicker";

export interface AddTodoRowProps {
  onCreate: (fields: { name: string; priority: "high" | "low"; due_date: string | null }) => void;
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
    setIsExpanded(false);
  }, [defaultPriority]);

  const handleSubmit = useCallback(() => {
    if (name.trim().length === 0) return;
    onCreate({
      name: name.trim(),
      priority,
      due_date: dueDate,
    });
    resetForm();
  }, [name, priority, dueDate, onCreate, resetForm]);

  if (!isExpanded) {
    return (
      <div
        ref={collapsedRowRef}
        className={cn(
          "flex min-h-[44px] cursor-pointer items-center rounded-md transition-colors motion-reduce:transition-none hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          compact ? "gap-1 px-2" : "gap-2 px-4",
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
        <Plus className="text-muted-foreground" />
        <span className={cn("italic text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          Add a todo...
        </span>
      </div>
    );
  }

  return (
    <form
      className="rounded-md bg-accent/50"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <div
        className={cn(
          "flex min-h-[44px] items-center",
          compact ? "gap-1 px-2 py-1" : "gap-2 px-4 py-2",
        )}
      >
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
            "h-11 flex-1 rounded-lg border border-input/40 bg-input/20 px-3 shadow-none transition-colors motion-reduce:transition-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:bg-input/30 focus-visible:ring-2 focus-visible:ring-ring/30",
            compact ? "text-sm" : "text-base",
          )}
          aria-label="New todo name"
        />

        <label
          className={cn(
            "flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-muted-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          <input
            type="checkbox"
            role="switch"
            aria-label="High priority"
            checked={priority === "high"}
            onChange={(event) => setPriority(event.target.checked ? "high" : "low")}
            className="size-4 shrink-0 accent-[var(--destructive)]"
          />
          <span className="hidden sm:inline">High</span>
        </label>

        <div className={cn("shrink-0", compact ? "w-11" : "w-40")}>
          <TodoDueDatePicker
            value={dueDate}
            onChange={setDueDate}
            label="Choose date and time"
            compact={compact}
          />
        </div>

        <Button type="submit" size="sm" className="min-h-11 shrink-0">
          Add
        </Button>
      </div>
    </form>
  );
}

export const AddTodoRow = memo(AddTodoRowComponent);
