import { describe, expect, it } from "vitest";

import type { Todo } from "#/lib/database.types";
import {
  getTorontoDateKey,
  groupAndSortTodos,
  isTodoTodayOverdue,
  TODO_SECTION_ORDER,
} from "./-todoUtils";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID(),
    name: "Test todo",
    status: "not_started",
    priority: "low",
    due_date: null,
    due_date_has_time: false,
    today_date: null,
    today_sort_order: null,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("groupAndSortTodos", () => {
  it("puts Today todos in one exclusive section and keeps their priority", () => {
    const grouped = groupAndSortTodos([
      makeTodo({
        id: "today-low",
        priority: "low",
        today_date: "2026-09-13",
        today_sort_order: 0,
      }),
      makeTodo({ id: "high-complete", priority: "high", status: "complete", sort_order: 0 }),
      makeTodo({ id: "high-active", priority: "high", status: "not_started", sort_order: 1 }),
      makeTodo({ id: "low-active", priority: "low", status: "started", sort_order: 0 }),
    ]);

    expect(TODO_SECTION_ORDER).toEqual(["today", "high", "low"]);
    expect(Object.keys(grouped)).toEqual(["today", "high", "low"]);
    expect(grouped.today.map((todo) => todo.id)).toEqual(["today-low"]);
    expect(grouped.today[0]?.priority).toBe("low");
    expect(grouped.high.map((todo) => todo.id)).toEqual(["high-complete", "high-active"]);
    expect(grouped.low.map((todo) => todo.id)).toEqual(["low-active"]);
  });

  it("sorts the Today section by its independent order", () => {
    const grouped = groupAndSortTodos([
      makeTodo({ id: "second", today_date: "2026-09-12", today_sort_order: 1 }),
      makeTodo({ id: "first", priority: "high", today_date: "2026-09-13", today_sort_order: 0 }),
    ]);

    expect(grouped.today.map((todo) => todo.id)).toEqual(["first", "second"]);
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

describe("Today dates", () => {
  it("uses the Toronto calendar date across UTC midnight", () => {
    expect(getTorontoDateKey(new Date("2026-09-14T02:30:00.000Z"))).toBe("2026-09-13");
  });

  it("keeps an unfinished Today todo and marks it overdue after its assigned day", () => {
    const todo = makeTodo({ today_date: "2026-09-12" });

    expect(isTodoTodayOverdue(todo, new Date("2026-09-13T16:00:00.000Z"))).toBe(true);
    expect(groupAndSortTodos([todo]).today).toEqual([todo]);
  });

  it("does not mark completed or current-day Today todos overdue", () => {
    const now = new Date("2026-09-13T16:00:00.000Z");

    expect(isTodoTodayOverdue(makeTodo({ today_date: "2026-09-13" }), now)).toBe(false);
    expect(
      isTodoTodayOverdue(makeTodo({ today_date: "2026-09-12", status: "complete" }), now),
    ).toBe(false);
  });
});
