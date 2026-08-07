import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Plus, CalendarIcon } from "lucide-react";
import { format } from "date-fns";

import { Button } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
import { Input } from "#/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { cn } from "#/lib/utils";
import type { TodoPriority } from "#/lib/database.types";

export interface AddTodoRowProps {
  onCreate: (fields: { name: string; priority: "high" | "low"; due_date: string | null }) => void;
  defaultPriority?: TodoPriority;
  compact?: boolean;
}

const PRIORITY_STYLES: Record<TodoPriority, string> = {
  high: "bg-destructive/20 text-destructive",
  low: "bg-muted text-muted-foreground",
};

const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: "High",
  low: "Low",
};

function AddTodoRowComponent({
  onCreate,
  defaultPriority = "low",
  compact = false,
}: AddTodoRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<TodoPriority>(defaultPriority);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const priorityButtonRef = useRef<HTMLButtonElement>(null);
  const collapsedRowRef = useRef<HTMLDivElement>(null);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const expandedContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded) {
      collapsedRowRef.current?.focus();
    }
  }, [isExpanded]);

  const resetForm = useCallback(() => {
    setName("");
    setPriority(defaultPriority);
    setDueDate(undefined);
    setIsExpanded(false);
    setIsPriorityOpen(false);
    setIsDateOpen(false);
  }, [defaultPriority]);

  const handleSubmit = useCallback(() => {
    if (name.trim().length === 0) return;
    onCreate({
      name: name.trim(),
      priority,
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
    });
    resetForm();
  }, [name, priority, dueDate, onCreate, resetForm]);

  // Always-current refs so the mousedown handler doesn't go stale
  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;
  const resetFormRef = useRef(resetForm);
  resetFormRef.current = resetForm;
  const nameRef = useRef(name);
  nameRef.current = name;

  useEffect(() => {
    if (!isExpanded) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Element;
      if (expandedContainerRef.current?.contains(target)) return;
      if (target.closest?.("[data-add-todo-popover]")) return;
      if (nameRef.current.trim().length === 0) {
        resetFormRef.current();
      } else {
        handleSubmitRef.current();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isExpanded]);

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
        <span className={cn("italic text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          Add a todo...
        </span>
      </div>
    );
  }

  return (
    <div ref={expandedContainerRef} className="rounded-md bg-accent/50">
      <div className={cn("flex min-h-[44px] items-center", compact ? "gap-1 px-2" : "gap-2 px-4")}>
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
          className={cn(
            "h-11 flex-1 rounded-lg border border-input/40 bg-input/20 px-3 shadow-none transition-colors motion-reduce:transition-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:bg-input/30 focus-visible:ring-2 focus-visible:ring-ring/30",
            compact ? "text-sm" : "text-base",
          )}
          aria-label="New todo name"
        />

        {/* Priority selector */}
        <Popover open={isPriorityOpen} onOpenChange={setIsPriorityOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                ref={priorityButtonRef}
                className={cn(
                  "min-h-11 shrink-0 cursor-pointer px-2 font-medium",
                  compact ? "text-xs" : "text-sm",
                  PRIORITY_STYLES[priority],
                )}
                onKeyDown={(e) => {
                  if (e.key === "Tab" && !e.shiftKey) {
                    e.preventDefault();
                    dateTriggerRef.current?.focus();
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
          <PopoverContent role="listbox" className="w-32 p-1" align="end" data-add-todo-popover>
            {(["high", "low"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="option"
                aria-selected={priority === p}
                className={cn(
                  "min-h-11 w-full rounded-sm px-2 text-left text-sm hover:bg-accent",
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

        {/* Date picker — calendar popover */}
        <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
          <PopoverTrigger
            render={
              <Button
                ref={dateTriggerRef}
                variant="ghost"
                className={cn("min-h-11 shrink-0 gap-1.5 px-2", compact && "text-xs")}
                onKeyDown={(e) => {
                  if (e.key === "Tab" && !e.shiftKey) {
                    e.preventDefault();
                    nameInputRef.current?.focus();
                  } else if (e.key === "Tab" && e.shiftKey) {
                    e.preventDefault();
                    priorityButtonRef.current?.focus();
                  } else if (e.key === "Escape" && !isDateOpen) {
                    e.preventDefault();
                    resetForm();
                  } else if (e.key === "Enter" && !isDateOpen) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                aria-label="Select due date"
              />
            }
          >
            <CalendarIcon data-icon="inline-start" />
            <span className={cn("text-sm", dueDate ? "" : "text-muted-foreground")}>
              {dueDate ? format(dueDate, "MMM d") : "Date"}
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end" data-add-todo-popover>
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={(date) => {
                setDueDate(date);
                setIsDateOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>

        {/* Delete column spacer to match TodoRow layout */}
        <div className="size-8 shrink-0" />
      </div>

      {/* Keyboard hint */}
      <div className={cn("flex justify-end pb-1.5", compact ? "px-2" : "px-4")}>
        <span className="text-xs text-muted-foreground">Esc to cancel</span>
      </div>
    </div>
  );
}

export const AddTodoRow = memo(AddTodoRowComponent);
