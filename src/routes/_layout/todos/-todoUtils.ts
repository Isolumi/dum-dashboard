import { endOfDay, parseISO } from "date-fns";
import { TZDateMini } from "@date-fns/tz";
import type { Todo, TodoPriority } from "#/lib/database.types";
import { getTodoDueDateCalendarKey } from "./-todoDueDate";

export type TodoSection = "today" | TodoPriority;
export type TodoGroups = Record<TodoSection, Todo[]>;

export const TODO_SECTION_ORDER: TodoSection[] = ["today", "high", "low"];
export const TODO_SECTION_LABELS: Record<TodoSection, string> = {
  today: "Today",
  high: "High",
  low: "Low",
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TODAY_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isTodoDueSoon(todo: Todo, now = new Date()): boolean {
  if (!todo.due_date || todo.status === "complete") return false;
  const timestamp = Date.parse(todo.due_date);
  if (Number.isNaN(timestamp)) return false;
  const hasTime = todo.due_date_has_time ?? !DATE_ONLY_PATTERN.test(todo.due_date);
  const [year, month, day] = getTodoDueDateCalendarKey(todo.due_date).split("-").map(Number);
  const deadline = hasTime
    ? timestamp
    : endOfDay(new TZDateMini(year, month - 1, day, "America/Toronto")).getTime();
  // No lower bound: unfinished overdue items must stay in Today.
  return deadline <= now.getTime() + TODAY_WINDOW_MS;
}

export function dueDateSortValue(todo: Todo): number | null {
  if (!todo.due_date) return null;

  const timestamp = Date.parse(todo.due_date);
  if (Number.isNaN(timestamp)) return null;

  const hasTime = todo.due_date_has_time ?? !DATE_ONLY_PATTERN.test(todo.due_date);
  if (hasTime) return timestamp;

  const utcDate = getTodoDueDateCalendarKey(todo.due_date);
  return parseISO(utcDate).getTime();
}

export function getTorontoDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isTodoTodayOverdue(todo: Todo, now = new Date()): boolean {
  return Boolean(
    todo.today_date && todo.status !== "complete" && todo.today_date < getTorontoDateKey(now),
  );
}

// Match the database's concurrency checks, not the date-sorted display order.
export function getTodosInSavedOrder(todos: Todo[], section: TodoSection): Todo[] {
  return todos
    .filter((todo) =>
      section === "today"
        ? Boolean(todo.today_date)
        : !todo.today_date && todo.priority === section,
    )
    .sort((a, b) => {
      const aOrder =
        section === "today" ? (a.today_sort_order ?? Number.POSITIVE_INFINITY) : a.sort_order;
      const bOrder =
        section === "today" ? (b.today_sort_order ?? Number.POSITIVE_INFINITY) : b.sort_order;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.id.localeCompare(b.id);
    });
}

export function groupAndSortTodos(todos: Todo[], now = new Date()): TodoGroups {
  const groups: TodoGroups = { today: [], high: [], low: [] };
  for (const todo of todos) {
    if (todo.status === "complete") continue;
    groups[todo.today_date || isTodoDueSoon(todo, now) ? "today" : todo.priority].push(todo);
  }
  for (const key of TODO_SECTION_ORDER) {
    groups[key].sort((a, b) => {
      const aDueDate = dueDateSortValue(a);
      const bDueDate = dueDateSortValue(b);
      if (aDueDate !== bDueDate) {
        if (aDueDate === null) return 1;
        if (bDueDate === null) return -1;
        return aDueDate - bDueDate;
      }
      const aOrder = key === "today" ? (a.today_sort_order ?? a.sort_order) : a.sort_order;
      const bOrder = key === "today" ? (b.today_sort_order ?? b.sort_order) : b.sort_order;
      const sortOrderDifference = aOrder - bOrder;
      if (sortOrderDifference !== 0) return sortOrderDifference;

      return 0;
    });
  }
  return groups;
}
