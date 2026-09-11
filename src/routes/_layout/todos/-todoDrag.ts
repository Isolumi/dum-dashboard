import type { Todo, TodoPriority } from "#/lib/database.types";

export type TodoGroups = Record<TodoPriority, Todo[]>;

const PRIORITY_TARGET_PATTERN = /^priority-(high|low)(?:-end)?$/;

export function findTodoPriority(groups: TodoGroups, id: string): TodoPriority | null {
  if (groups.high.some((todo) => todo.id === id)) return "high";
  if (groups.low.some((todo) => todo.id === id)) return "low";
  return null;
}

function getTargetPriority(groups: TodoGroups, overId: string): TodoPriority | null {
  const todoPriority = findTodoPriority(groups, overId);
  if (todoPriority) return todoPriority;

  const priority = PRIORITY_TARGET_PATTERN.exec(overId)?.[1];
  return priority === "high" || priority === "low" ? priority : null;
}

export function moveTodoPreview(
  groups: TodoGroups,
  activeId: string,
  overId: string,
  placeAfter: boolean,
): TodoGroups {
  const sourcePriority = findTodoPriority(groups, activeId);
  const targetPriority = getTargetPriority(groups, overId);
  if (!sourcePriority || !targetPriority || activeId === overId) return groups;

  const sourceTodos = groups[sourcePriority];
  const sourceIndex = sourceTodos.findIndex((todo) => todo.id === activeId);
  if (sourceIndex < 0) return groups;

  const targetTodos = groups[targetPriority];
  const isTrailingTarget = overId === `priority-${targetPriority}-end`;
  const isSectionTarget = overId === `priority-${targetPriority}`;

  const activeTodo = sourceTodos[sourceIndex];
  if (!activeTodo) return groups;

  const nextSourceTodos = sourceTodos.filter((todo) => todo.id !== activeId);
  const nextTargetTodos =
    sourcePriority === targetPriority
      ? nextSourceTodos
      : targetTodos.filter((todo) => todo.id !== activeId);
  const overIndex = nextTargetTodos.findIndex((todo) => todo.id === overId);
  const targetIndex =
    isTrailingTarget || isSectionTarget
      ? nextTargetTodos.length
      : Math.max(0, overIndex + (placeAfter ? 1 : 0));
  const nextTargetWithActive = [...nextTargetTodos];
  nextTargetWithActive.splice(targetIndex, 0, { ...activeTodo, priority: targetPriority });

  if (
    sourcePriority === targetPriority &&
    sourceTodos.every((todo, index) => todo.id === nextTargetWithActive[index]?.id)
  ) {
    return groups;
  }

  if (sourcePriority === targetPriority) {
    return { ...groups, [sourcePriority]: nextTargetWithActive };
  }

  return {
    ...groups,
    [sourcePriority]: nextSourceTodos,
    [targetPriority]: nextTargetWithActive,
  };
}
