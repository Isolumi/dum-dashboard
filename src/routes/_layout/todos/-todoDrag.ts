import type { TodoGroups, TodoSection } from "./-todoUtils";

export type { TodoGroups } from "./-todoUtils";

const SECTION_TARGET_PATTERN = /^(?:section-(today)|priority-(high|low))(?:-end)?$/;

export function findTodoSection(groups: TodoGroups, id: string): TodoSection | null {
  if (groups.today.some((todo) => todo.id === id)) return "today";
  if (groups.high.some((todo) => todo.id === id)) return "high";
  if (groups.low.some((todo) => todo.id === id)) return "low";
  return null;
}

function getTargetSection(groups: TodoGroups, overId: string): TodoSection | null {
  const todoSection = findTodoSection(groups, overId);
  if (todoSection) return todoSection;

  const match = SECTION_TARGET_PATTERN.exec(overId);
  return match?.[1] === "today"
    ? "today"
    : match?.[2] === "high" || match?.[2] === "low"
      ? match[2]
      : null;
}

export function getTodoSectionTargetId(section: TodoSection, trailing = false): string {
  return `${section === "today" ? "section" : "priority"}-${section}${trailing ? "-end" : ""}`;
}

export function moveTodoPreview(
  groups: TodoGroups,
  activeId: string,
  overId: string,
  placeAfter: boolean,
): TodoGroups {
  const sourceSection = findTodoSection(groups, activeId);
  const targetSection = getTargetSection(groups, overId);
  if (!sourceSection || !targetSection || activeId === overId) return groups;

  const sourceTodos = groups[sourceSection];
  const sourceIndex = sourceTodos.findIndex((todo) => todo.id === activeId);
  if (sourceIndex < 0) return groups;

  const targetTodos = groups[targetSection];
  const isTrailingTarget = overId === getTodoSectionTargetId(targetSection, true);
  const isSectionTarget = overId === getTodoSectionTargetId(targetSection);

  const activeTodo = sourceTodos[sourceIndex];
  if (!activeTodo) return groups;

  const nextSourceTodos = sourceTodos.filter((todo) => todo.id !== activeId);
  const nextTargetTodos =
    sourceSection === targetSection
      ? nextSourceTodos
      : targetTodos.filter((todo) => todo.id !== activeId);
  const overIndex = nextTargetTodos.findIndex((todo) => todo.id === overId);
  const targetIndex =
    isTrailingTarget || isSectionTarget
      ? nextTargetTodos.length
      : Math.max(0, overIndex + (placeAfter ? 1 : 0));
  const nextTargetWithActive = [...nextTargetTodos];
  nextTargetWithActive.splice(
    targetIndex,
    0,
    targetSection === "today"
      ? activeTodo
      : { ...activeTodo, priority: targetSection, today_date: null, today_sort_order: null },
  );

  if (
    sourceSection === targetSection &&
    sourceTodos.every((todo, index) => todo.id === nextTargetWithActive[index]?.id)
  ) {
    return groups;
  }

  if (sourceSection === targetSection) {
    return { ...groups, [sourceSection]: nextTargetWithActive };
  }

  return {
    ...groups,
    [sourceSection]: nextSourceTodos,
    [targetSection]: nextTargetWithActive,
  };
}
