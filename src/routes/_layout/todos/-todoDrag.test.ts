import { describe, expect, it } from "vitest";

import type { Todo } from "#/lib/database.types";
import { findTodoPriority, moveTodoPreview } from "./-todoDrag";

function makeTodo(id: string, priority: "high" | "low", sort_order: number): Todo {
  return {
    id,
    name: id,
    priority,
    status: "not_started",
    due_date: null,
    due_date_has_time: false,
    sort_order,
    created_at: "2026-08-10T00:00:00.000Z",
  };
}

describe("todo drag preview", () => {
  const first = makeTodo("first", "high", 0);
  const second = makeTodo("second", "high", 1);
  const low = makeTodo("low", "low", 0);
  const groups = { high: [first, second], low: [low] };

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

    expect(findTodoPriority(next, first.id)).toBe("low");
  });
});
