import { format, parseISO, startOfDay } from "date-fns";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_TODO_DUE_TIME = "09:00";

export function formatTodoDueDate(value: string | null): string {
  if (!value) return "";

  const date = parseISO(value);
  return format(date, DATE_ONLY_PATTERN.test(value) ? "MMM d" : "MMM d, h:mm a");
}

export function toTodoDueDate(dateValue: string, timeValue: string): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = (timeValue || DEFAULT_TODO_DUE_TIME).split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

export function isTodoDueDateOverdue(value: string | null, now = new Date()): boolean {
  if (!value) return false;

  const dueDate = parseISO(value);
  return DATE_ONLY_PATTERN.test(value) ? dueDate < startOfDay(now) : dueDate < now;
}

export function getTodoDueDateInputValues(
  value: string | null,
): {
  dateValue: string;
  timeValue: string;
} {
  if (!value) return { dateValue: "", timeValue: "" };
  if (DATE_ONLY_PATTERN.test(value)) return { dateValue: value, timeValue: "" };

  const date = parseISO(value);
  return {
    dateValue: format(date, "yyyy-MM-dd"),
    timeValue: format(date, "HH:mm"),
  };
}
