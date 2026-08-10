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
    due_date_has_time: false,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("groupAndSortTodos", () => {
  it("returns only high and low groups and follows persisted sort order before status", () => {
    const grouped = groupAndSortTodos([
      makeTodo({ id: "high-complete", priority: "high", status: "complete", sort_order: 0 }),
      makeTodo({ id: "high-active", priority: "high", status: "not_started", sort_order: 1 }),
      makeTodo({ id: "low-active", priority: "low", status: "started", sort_order: 0 }),
    ]);

    expect(PRIORITY_ORDER).toEqual(["high", "low"]);
    expect(Object.keys(grouped)).toEqual(["high", "low"]);
    expect(grouped.high.map((todo) => todo.id)).toEqual(["high-complete", "high-active"]);
    expect(grouped.low.map((todo) => todo.id)).toEqual(["low-active"]);
  });

  it("follows persisted sort order before due date", () => {
    const grouped = groupAndSortTodos([
      makeTodo({
        id: "persisted-first",
        due_date: "2026-08-12T00:00:00.000Z",
        due_date_has_time: false,
        sort_order: 0,
      }),
      makeTodo({
        id: "due-earlier",
        due_date: "2026-08-11T00:00:00.000Z",
        due_date_has_time: false,
        sort_order: 1,
      }),
    ]);

    expect(grouped.low.map((todo) => todo.id)).toEqual(["persisted-first", "due-earlier"]);
  });

  it("sorts date-only metadata by its stored calendar date and timed todos by instant", () => {
    const grouped = groupAndSortTodos([
      makeTodo({
        id: "timed-later",
        due_date: "2026-08-09T18:00:00.000Z",
        due_date_has_time: true,
      }),
      makeTodo({
        id: "date-only-earlier",
        due_date: "2026-08-09T00:00:00.000Z",
        due_date_has_time: false,
      }),
    ]);

    expect(grouped.low.map((todo) => todo.id)).toEqual(["date-only-earlier", "timed-later"]);
  });

  it("infers a legacy timestamp without precision metadata as timed", () => {
    const legacyTimedTodo = makeTodo({
      id: "legacy-timed-later",
      due_date: "2026-08-09T23:30:00-04:00",
    });
    delete (legacyTimedTodo as Partial<Todo>).due_date_has_time;

    const grouped = groupAndSortTodos([
      legacyTimedTodo,
      makeTodo({
        id: "timed-earlier",
        due_date: "2026-08-10T01:00:00.000Z",
        due_date_has_time: true,
      }),
    ]);

    expect(grouped.low.map((todo) => todo.id)).toEqual(["timed-earlier", "legacy-timed-later"]);
  });

  it("sorts date-only metadata by the timestamp's UTC calendar date", () => {
    const grouped = groupAndSortTodos([
      makeTodo({
        id: "date-only-next-day",
        due_date: "2026-08-09T23:30:00-04:00",
        due_date_has_time: false,
      }),
      makeTodo({
        id: "timed-previous-day",
        due_date: "2026-08-09T12:00:00.000Z",
        due_date_has_time: true,
      }),
    ]);

    expect(grouped.low.map((todo) => todo.id)).toEqual([
      "timed-previous-day",
      "date-only-next-day",
    ]);
  });
});
