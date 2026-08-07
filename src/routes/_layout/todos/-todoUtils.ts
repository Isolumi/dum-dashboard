import type { Todo, TodoPriority } from "#/lib/database.types";

export const PRIORITY_ORDER: TodoPriority[] = ["high", "low"];
export const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: "High",
  low: "Low",
};

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
      if (a.due_date !== b.due_date) {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date < b.due_date ? -1 : 1;
      }
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }
  return groups;
}
