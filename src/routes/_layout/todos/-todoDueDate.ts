import { format, parseISO, startOfDay } from "date-fns";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_TODO_DUE_TIME = "09:00";

function hasTimeValue(value: string, hasTime?: boolean): boolean {
  return hasTime ?? !DATE_ONLY_PATTERN.test(value);
}

export function getTodoDueDateCalendarKey(value: string): string {
  if (DATE_ONLY_PATTERN.test(value)) return value;

  return parseISO(value).toISOString().slice(0, 10);
}

export function formatTodoDueDate(value: string | null, hasTime?: boolean): string {
  if (!value) return "";

  if (!hasTimeValue(value, hasTime)) {
    return format(parseISO(getTodoDueDateCalendarKey(value)), "MMM d");
  }

  return format(parseISO(value), "MMM d, h:mm a");
}

export function toTodoDueDate(dateValue: string, timeValue: string): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = (timeValue || DEFAULT_TODO_DUE_TIME).split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

export function isTodoDueDateOverdue(
  value: string | null,
  hasTimeOrNow: boolean | Date = !value || DATE_ONLY_PATTERN.test(value) ? false : true,
  now = new Date(),
): boolean {
  if (!value) return false;

  const hasTime =
    hasTimeOrNow instanceof Date ? hasTimeValue(value) : hasTimeValue(value, hasTimeOrNow);
  const comparisonNow = hasTimeOrNow instanceof Date ? hasTimeOrNow : now;

  if (!hasTime) {
    return parseISO(getTodoDueDateCalendarKey(value)) < startOfDay(comparisonNow);
  }

  return parseISO(value) < comparisonNow;
}

export function getTodoDueDateInputValues(
  value: string | null,
  hasTime?: boolean,
): {
  dateValue: string;
  timeValue: string;
} {
  if (!value) return { dateValue: "", timeValue: "" };
  if (!hasTimeValue(value, hasTime)) {
    return { dateValue: getTodoDueDateCalendarKey(value), timeValue: "" };
  }

  const date = parseISO(value);
  return {
    dateValue: format(date, "yyyy-MM-dd"),
    timeValue: format(date, "HH:mm"),
  };
}
