import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_TODO_DUE_TIME = "09:00";

function hasTimeValue(value: string, hasTime?: boolean): boolean {
  return hasTime ?? !DATE_ONLY_PATTERN.test(value);
}

export function getTodoDueDateCalendarKey(value: string): string {
  if (DATE_ONLY_PATTERN.test(value)) return value;

  return parseISO(value).toISOString().slice(0, 10);
}

export function formatTodoDueDate(value: string | null, hasTime?: boolean, now?: Date): string {
  if (!value) return "";

  const timed = hasTimeValue(value, hasTime);
  const date = parseISO(timed ? value : getTodoDueDateCalendarKey(value));
  const pattern = now && date.getFullYear() !== now.getFullYear() ? "MMM d, yyyy" : "MMM d";
  return format(date, `${pattern}${timed ? ", HH:mm" : ""}`);
}

function getTodoDueDateDisplayDate(value: string, hasTime?: boolean): Date {
  return parseISO(hasTimeValue(value, hasTime) ? value : getTodoDueDateCalendarKey(value));
}

export function formatTodoDueDateLabel(
  value: string | null,
  hasTime?: boolean,
  now = new Date(),
): string {
  if (!value) return "";
  const date = getTodoDueDateDisplayDate(value, hasTime);
  const daysAway = differenceInCalendarDays(date, now);
  const label =
    daysAway === 0
      ? "today"
      : daysAway === 1
        ? "tomorrow"
        : daysAway >= 2 && daysAway < 7
          ? format(date, "EEEE")
          : format(date, date.getFullYear() === now.getFullYear() ? "MMM d" : "MMM d, yyyy");
  return `Due ${label}${hasTimeValue(value, hasTime) ? `, ${format(date, "HH:mm")}` : ""}`;
}

export function getTodoDueDateUrgency(
  value: string | null,
  hasTime?: boolean,
  now = new Date(),
): "overdue" | "soon" | "later" {
  if (!value) return "later";
  if (isTodoDueDateOverdue(value, hasTimeValue(value, hasTime), now)) return "overdue";
  const daysAway = differenceInCalendarDays(getTodoDueDateDisplayDate(value, hasTime), now);
  return daysAway >= 0 && daysAway <= 1 ? "soon" : "later";
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
