import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import { Button } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "#/components/ui/popover";
import { cn } from "#/lib/utils";

import {
  DEFAULT_TODO_DUE_TIME,
  formatTodoDueDate,
  getTodoDueDateInputValues,
  toTodoDueDate,
} from "./-todoDueDate";

export interface TodoDueDatePickerProps {
  value: string | null;
  onChange: (value: string | null, hasTime: boolean) => void;
  label: string;
  compact?: boolean;
  disabled?: boolean;
  hasTime?: boolean;
  showValue?: boolean;
  presentation?: TodoDueDatePickerPresentation;
}

export type TodoDueDatePickerPresentation = "popover" | "dialog";

interface DueDatePanelProps {
  dateInputId: string;
  dateValue: string;
  disabled: boolean;
  label: string;
  onClear: () => void;
  onDateChange: (value: string) => void;
  onDateSelect: (date: Date | undefined) => void;
  onTimeChange: (value: string) => void;
  selectedDate: Date | undefined;
  timeInputId: string;
  timeValue: string;
  value: string | null;
}

function DueDatePanel({
  dateInputId,
  dateValue,
  disabled,
  label,
  onClear,
  onDateChange,
  onDateSelect,
  onTimeChange,
  selectedDate,
  timeInputId,
  timeValue,
  value,
}: DueDatePanelProps) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <Calendar mode="single" selected={selectedDate} onSelect={onDateSelect} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id={dateInputId}
          type="date"
          value={dateValue}
          disabled={disabled}
          aria-label={`${label} date`}
          onChange={(event) => onDateChange(event.target.value)}
        />

        <Input
          id={timeInputId}
          type="time"
          value={timeValue}
          disabled={disabled || !dateValue}
          aria-label={`${label} time`}
          onChange={(event) => onTimeChange(event.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || (!dateValue && !value)}
          onClick={onClear}
          aria-label="Clear due date"
        >
          Clear
        </Button>
      </div>
    </div>
  );
}

export function TodoDueDatePicker({
  value,
  onChange,
  label,
  compact = false,
  disabled = false,
  hasTime,
  showValue = true,
  presentation = "popover",
}: TodoDueDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const dateInputId = useId();
  const timeInputId = useId();
  const titleId = useId();

  useEffect(() => {
    const next = getTodoDueDateInputValues(value, hasTime);
    setDateValue(next.dateValue);
    setTimeValue(next.timeValue);
  }, [hasTime, value]);

  const selectedDate = useMemo(
    () => (dateValue ? new Date(`${dateValue}T00:00:00`) : undefined),
    [dateValue],
  );

  const displayValue = useMemo(() => {
    if (!dateValue) return "";
    if (!timeValue) return formatTodoDueDate(dateValue);
    return formatTodoDueDate(toTodoDueDate(dateValue, timeValue), true);
  }, [dateValue, timeValue]);

  const compactIconOnly = compact && showValue && !value;

  function updateDueDate(nextDateValue: string, nextTimeValue: string) {
    setDateValue(nextDateValue);
    setTimeValue(nextTimeValue);

    if (!nextDateValue) {
      onChange(null, false);
      return;
    }

    onChange(toTodoDueDate(nextDateValue, nextTimeValue), true);
  }

  function renderTrigger() {
    return (
      <Button
        type="button"
        variant="ghost"
        aria-label={label}
        disabled={disabled}
        className={cn(
          "group/date w-full min-w-0 overflow-hidden text-inherit hover:text-inherit",
          compactIconOnly
            ? "size-9 min-h-0 justify-center px-0 [@media(pointer:coarse)]:size-11"
            : showValue
              ? "min-h-11 justify-end px-2 text-right"
              : "h-9 min-h-0 justify-center px-0",
        )}
      />
    );
  }

  const triggerContents =
    showValue && displayValue ? (
      <span className={cn("min-w-0 truncate", compact ? "text-xs" : "text-sm")}>
        {displayValue}
      </span>
    ) : (
      <CalendarIcon
        className={cn(
          "size-4 text-muted-foreground",
          showValue && !compactIconOnly && "ml-auto",
          showValue &&
            "opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-visible/date:opacity-100 [@media(pointer:coarse)]:opacity-100",
          compact && "group-focus-within:opacity-100",
        )}
      />
    );

  const panel = (
    <DueDatePanel
      dateInputId={dateInputId}
      dateValue={dateValue}
      disabled={disabled}
      label={label}
      onClear={() => updateDueDate("", "")}
      onDateChange={(nextDateValue) => {
        if (!nextDateValue) {
          updateDueDate("", "");
          return;
        }

        updateDueDate(nextDateValue, timeValue || DEFAULT_TODO_DUE_TIME);
      }}
      onDateSelect={(date) => {
        if (!date) {
          updateDueDate("", "");
          return;
        }

        updateDueDate(format(date, "yyyy-MM-dd"), timeValue || DEFAULT_TODO_DUE_TIME);
      }}
      onTimeChange={(nextTimeValue) => {
        const nextValue = nextTimeValue || DEFAULT_TODO_DUE_TIME;
        setTimeValue(nextValue);

        if (!dateValue) return;
        onChange(toTodoDueDate(dateValue, nextValue), true);
      }}
      selectedDate={selectedDate}
      timeInputId={timeInputId}
      timeValue={timeValue}
      value={value}
    />
  );

  const closeOnEscape = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  if (presentation === "dialog") {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={renderTrigger()}>{triggerContents}</DialogTrigger>
        <DialogContent
          data-testid="due-date-dialog"
          aria-labelledby={titleId}
          closeLabel="Close date and time picker"
        >
          <DialogTitle id={titleId} className="sr-only">
            {label}
          </DialogTitle>
          {panel}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={renderTrigger()}>{triggerContents}</PopoverTrigger>
      <PopoverContent
        data-testid="due-date-popover"
        aria-labelledby={titleId}
        className="w-auto p-0"
        align="end"
        onKeyDown={closeOnEscape}
      >
        <PopoverTitle id={titleId} className="sr-only">
          {label}
        </PopoverTitle>
        {panel}
      </PopoverContent>
    </Popover>
  );
}
