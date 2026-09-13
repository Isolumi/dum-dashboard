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

function dueDateSortValue(todo: Todo): number | null {
  if (!todo.due_date) return null;

  const timestamp = Date.parse(todo.due_date);
  if (Number.isNaN(timestamp)) return null;

  const hasTime = todo.due_date_has_time ?? !DATE_ONLY_PATTERN.test(todo.due_date);
  if (hasTime) return timestamp;

  const utcDate = getTodoDueDateCalendarKey(todo.due_date);
  return Date.parse(`${utcDate}T00:00:00.000Z`);
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

export function groupAndSortTodos(todos: Todo[]): TodoGroups {
  const groups: TodoGroups = { today: [], high: [], low: [] };
  for (const todo of todos) {
    groups[todo.today_date ? "today" : todo.priority].push(todo);
  }
  for (const key of TODO_SECTION_ORDER) {
    groups[key].sort((a, b) => {
      const aOrder = key === "today" ? (a.today_sort_order ?? 0) : (a.sort_order ?? 0);
      const bOrder = key === "today" ? (b.today_sort_order ?? 0) : (b.sort_order ?? 0);
      const sortOrderDifference = aOrder - bOrder;
      if (sortOrderDifference !== 0) return sortOrderDifference;

      const aComplete = a.status === "complete" ? 1 : 0;
      const bComplete = b.status === "complete" ? 1 : 0;
      if (aComplete !== bComplete) return aComplete - bComplete;
      const aDueDate = dueDateSortValue(a);
      const bDueDate = dueDateSortValue(b);
      if (aDueDate !== bDueDate) {
        if (aDueDate === null) return 1;
        if (bDueDate === null) return -1;
        return aDueDate - bDueDate;
      }
      return 0;
    });
  }
  return groups;
}
