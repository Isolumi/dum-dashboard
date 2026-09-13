import { describe, expect, it } from "vitest";

import type { Todo } from "#/lib/database.types";
import { findTodoSection, moveTodoPreview } from "./-todoDrag";

function makeTodo(id: string, priority: "high" | "low", sort_order: number): Todo {
  return {
    id,
    name: id,
    priority,
    status: "not_started",
    due_date: null,
    due_date_has_time: false,
    today_date: null,
    today_sort_order: null,
    sort_order,
    created_at: "2026-08-10T00:00:00.000Z",
  };
}

describe("todo drag preview", () => {
  const first = makeTodo("first", "high", 0);
  const second = makeTodo("second", "high", 1);
  const low = makeTodo("low", "low", 0);
  const groups = { today: [], high: [first, second], low: [low] };

  it("previews moving a todo into Today without changing its saved priority", () => {
    const next = moveTodoPreview(groups, first.id, "section-today", false);

    expect(next.high.map((todo) => todo.id)).toEqual([second.id]);
    expect(next.today.map((todo) => todo.id)).toEqual([first.id]);
    expect(next.today[0]?.priority).toBe("high");
  });

  it("previews moving a Today todo back to Low", () => {
    const inToday = moveTodoPreview(groups, first.id, "section-today", false);
    const next = moveTodoPreview(inToday, first.id, low.id, false);

    expect(next.today).toEqual([]);
    expect(next.low.map((todo) => todo.id)).toEqual([first.id, low.id]);
    expect(next.low[0]?.priority).toBe("low");
  });

  it("previews a cross-priority move before the server write", () => {
    const next = moveTodoPreview(groups, first.id, low.id, false);

    expect(next.high.map((todo) => todo.id)).toEqual([second.id]);
    expect(next.low.map((todo) => todo.id)).toEqual([first.id, low.id]);
    expect(next.low[0]?.priority).toBe("low");
  });

  it("previews appending to a priority through its trailing target", () => {
    const next = moveTodoPreview(groups, first.id, "priority-low-end", false);

    expect(next.low.map((todo) => todo.id)).toEqual([low.id, first.id]);
  });

  it("repositions the preview inside its current priority", () => {
    const moved = moveTodoPreview(groups, first.id, low.id, false);
    const reordered = moveTodoPreview(moved, first.id, low.id, true);

    expect(reordered.low.map((todo) => todo.id)).toEqual([low.id, first.id]);
  });

  it("finds the preview priority after a cross-priority move", () => {
    const next = moveTodoPreview(groups, first.id, low.id, false);

    expect(findTodoSection(next, first.id)).toBe("low");
  });
});
