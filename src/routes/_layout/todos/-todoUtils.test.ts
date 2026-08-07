import { describe, expect, it } from "vitest";

import type { Todo } from "#/lib/database.types";
import { groupAndSortTodos, PRIORITY_ORDER } from "./-todoUtils";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID(),
    name: "Test todo",
    status: "not_started",
    priority: "low",
    due_date: null,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("groupAndSortTodos", () => {
  it("returns only high and low groups and sorts active todos before completed todos", () => {
    const grouped = groupAndSortTodos([
      makeTodo({ id: "high-complete", priority: "high", status: "complete", sort_order: 0 }),
      makeTodo({ id: "high-active", priority: "high", status: "not_started", sort_order: 1 }),
      makeTodo({ id: "low-active", priority: "low", status: "started", sort_order: 0 }),
    ]);

    expect(PRIORITY_ORDER).toEqual(["high", "low"]);
    expect(Object.keys(grouped)).toEqual(["high", "low"]);
    expect(grouped.high.map((todo) => todo.id)).toEqual(["high-active", "high-complete"]);
    expect(grouped.low.map((todo) => todo.id)).toEqual(["low-active"]);
  });
});
