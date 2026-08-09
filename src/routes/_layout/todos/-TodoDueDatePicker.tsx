import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import { Button } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
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
}

export function TodoDueDatePicker({
  value,
  onChange,
  label,
  compact = false,
  disabled = false,
  hasTime,
  showValue = true,
}: TodoDueDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const dateInputId = useId();
  const timeInputId = useId();
  const popoverTitleId = useId();

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

  function updateDueDate(nextDateValue: string, nextTimeValue: string) {
    setDateValue(nextDateValue);
    setTimeValue(nextTimeValue);

    if (!nextDateValue) {
      onChange(null, false);
      return;
    }

    onChange(toTodoDueDate(nextDateValue, nextTimeValue), true);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            aria-label={label}
            disabled={disabled}
            className={cn(
              "group/date w-full min-w-0 overflow-hidden text-inherit hover:text-inherit",
              showValue
                ? "min-h-11 justify-end px-2 text-right"
                : "h-9 min-h-0 justify-center px-0",
            )}
          />
        }
      >
        {showValue && displayValue ? (
          <span className={cn("min-w-0 truncate", compact ? "text-xs" : "text-sm")}>
            {displayValue}
          </span>
        ) : (
          <CalendarIcon
            className={cn(
              "size-4 text-muted-foreground",
              showValue &&
                "ml-auto opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-visible/date:opacity-100 [@media(pointer:coarse)]:opacity-100",
            )}
          />
        )}
      </PopoverTrigger>

      <PopoverContent
        aria-labelledby={popoverTitleId}
        className="w-auto p-0"
        align="end"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
      >
        <div className="flex flex-col gap-3 p-3">
          <PopoverTitle id={popoverTitleId} className="sr-only">
            {label}
          </PopoverTitle>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (!date) {
                updateDueDate("", "");
                return;
              }

              updateDueDate(format(date, "yyyy-MM-dd"), timeValue || DEFAULT_TODO_DUE_TIME);
            }}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id={dateInputId}
              type="date"
              value={dateValue}
              disabled={disabled}
              aria-label={`${label} date`}
              onChange={(event) => {
                const nextDateValue = event.target.value;
                if (!nextDateValue) {
                  updateDueDate("", "");
                  return;
                }

                updateDueDate(nextDateValue, timeValue || DEFAULT_TODO_DUE_TIME);
              }}
            />

            <Input
              id={timeInputId}
              type="time"
              value={timeValue}
              disabled={disabled || !dateValue}
              aria-label={`${label} time`}
              onChange={(event) => {
                const nextTimeValue = event.target.value || DEFAULT_TODO_DUE_TIME;
                setTimeValue(nextTimeValue);

                if (!dateValue) return;
                onChange(toTodoDueDate(dateValue, nextTimeValue), true);
              }}
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={disabled || (!dateValue && !value)}
              onClick={() => updateDueDate("", "")}
              aria-label="Clear due date"
            >
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
