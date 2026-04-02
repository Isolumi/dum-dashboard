import { useCallback, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { Input } from "#/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { cn } from "#/lib/utils";
import type { TodoPriority } from "#/lib/database.types";

export interface AddTodoRowProps {
  onCreate: (fields: {
    name: string;
    priority: "high" | "medium" | "low";
    due_date: string | null;
  }) => void;
}

const PRIORITY_STYLES: Record<TodoPriority, string> = {
  high: "bg-destructive/20 text-destructive",
  medium: "bg-amber-400/20 text-amber-400",
  low: "bg-muted text-muted-foreground",
};

const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function AddTodoRow({ onCreate }: AddTodoRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("low");
  const [dueDate, setDueDate] = useState("");
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const priorityButtonRef = useRef<HTMLButtonElement>(null);

  const resetForm = useCallback(() => {
    setName("");
    setPriority("low");
    setDueDate("");
    setIsExpanded(false);
    setIsPriorityOpen(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (name.trim().length === 0) return;
    onCreate({
      name: name.trim(),
      priority,
      due_date: dueDate || null,
    });
    resetForm();
  }, [name, priority, dueDate, onCreate, resetForm]);

  if (!isExpanded) {
    return (
      <div
        className="flex cursor-pointer items-center gap-2 px-4 min-h-[44px] transition-colors hover:bg-accent"
        onClick={() => {
          setIsExpanded(true);
        }}
        onKeyDown={(e) => {
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            setName(e.key);
            setIsExpanded(true);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Add a new todo"
      >
        <Plus className="text-muted-foreground" />
        <span className="text-sm italic text-muted-foreground">Add a todo...</span>
      </div>
    );
  }

  return (
    <div className="bg-accent/50 rounded-md">
      <div className="flex items-center gap-2 px-4 min-h-[44px]">
        {/* Status icon placeholder spacer — new todos are always not_started */}
        <div className="size-8 shrink-0" />

        {/* Name input */}
        <Input
          ref={nameInputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              resetForm();
            } else if (e.key === "Tab" && !e.shiftKey) {
              e.preventDefault();
              priorityButtonRef.current?.focus();
            }
          }}
          placeholder="Todo name..."
          autoFocus
          className="h-auto flex-1 border-0 p-0 text-base shadow-none focus-visible:ring-1 focus-visible:ring-ring/50"
          aria-label="New todo name"
        />

        {/* Priority selector */}
        <Popover open={isPriorityOpen} onOpenChange={setIsPriorityOpen}>
          <PopoverTrigger
            render={
              <button
                ref={priorityButtonRef}
                className={cn(
                  "shrink-0 cursor-pointer rounded-sm px-2 py-1 text-sm font-medium",
                  PRIORITY_STYLES[priority],
                )}
                onKeyDown={(e) => {
                  if (e.key === "Tab" && !e.shiftKey) {
                    e.preventDefault();
                    dateInputRef.current?.focus();
                  } else if (e.key === "Tab" && e.shiftKey) {
                    e.preventDefault();
                    nameInputRef.current?.focus();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    if (isPriorityOpen) {
                      setIsPriorityOpen(false);
                    } else {
                      resetForm();
                    }
                  } else if (e.key === "Enter" && !isPriorityOpen) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                aria-haspopup="listbox"
                aria-expanded={isPriorityOpen}
                aria-label="Select priority"
              />
            }
          >
            {PRIORITY_LABELS[priority]}
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
                  setPriority(p);
                  setIsPriorityOpen(false);
                }}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Date input — uses shadcn Input inside w-24 shrink-0 wrapper matching TodoRow */}
        <div className="w-24 shrink-0">
          <Input
            ref={dateInputRef}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                resetForm();
              } else if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                nameInputRef.current?.focus();
              } else if (e.key === "Tab" && e.shiftKey) {
                e.preventDefault();
                priorityButtonRef.current?.focus();
              }
            }}
            className="h-auto border-0 p-0 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-ring/50"
            aria-label="Due date"
          />
        </div>

        {/* Delete column spacer to match TodoRow layout */}
        <div className="size-8 shrink-0" />
      </div>

      {/* Keyboard hint */}
      <div className="flex justify-end px-4 pb-1.5">
        <span className="text-xs text-muted-foreground">
          Enter to save &middot; Esc to cancel
        </span>
      </div>
    </div>
  );
}
