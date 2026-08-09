import type { Todo, TodoPriority } from "#/lib/database.types";
import { getTodoDueDateCalendarKey } from "./-todoDueDate";

export const PRIORITY_ORDER: TodoPriority[] = ["high", "low"];
export const PRIORITY_LABELS: Record<TodoPriority, string> = {
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

export function groupAndSortTodos(todos: Todo[]): Record<TodoPriority, Todo[]> {
  const groups: Record<TodoPriority, Todo[]> = { high: [], low: [] };
  for (const todo of todos) {
    groups[todo.priority].push(todo);
  }
  for (const key of PRIORITY_ORDER) {
    groups[key].sort((a, b) => {
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
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }
  return groups;
}
