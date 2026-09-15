import { describe, expect, it } from "vitest";

import {
  CreateToolTodoSchema,
  DeleteToolTodoSchema,
  ListTodosQuerySchema,
  MoveToolTodoSchema,
  UpdateToolTodoSchema,
} from "./-schemas";

const TODO_ID = "550e8400-e29b-41d4-a716-446655440000";
const DELETE_SNAPSHOT = {
  id: TODO_ID,
  name: "Pay hydro",
  section: "low",
  status: "not_started",
  due_date: null,
  due_date_has_time: false,
  sort_order: 4,
  today_date: null,
  today_sort_order: null,
  created_at: "2026-09-14T12:00:00.000Z",
} as const;

describe("ListTodosQuerySchema", () => {
  it("defaults to incomplete todos with a limit of 50", () => {
    expect(ListTodosQuerySchema.parse({})).toEqual({ status: "incomplete", limit: 50 });
  });

  it("trims and accepts the supported filters", () => {
    expect(
      ListTodosQuerySchema.parse({
        query: "  hydro  ",
        section: "today",
        status: "all",
        limit: "10",
      }),
    ).toEqual({ query: "hydro", section: "today", status: "all", limit: 10 });
  });

  it.each(["a", "a".repeat(100)])("accepts inclusive query boundary %s", (query) => {
    expect(ListTodosQuerySchema.safeParse({ query }).success).toBe(true);
  });

  it.each([1, 50])("accepts inclusive limit boundary %i", (limit) => {
    expect(ListTodosQuerySchema.safeParse({ limit }).success).toBe(true);
  });

  it("rejects invalid query and limit boundaries", () => {
    expect(ListTodosQuerySchema.safeParse({ query: "   " }).success).toBe(false);
    expect(ListTodosQuerySchema.safeParse({ query: "a".repeat(101) }).success).toBe(false);
    expect(ListTodosQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(ListTodosQuerySchema.safeParse({ limit: 1.5 }).success).toBe(false);
    expect(ListTodosQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
  });

  it("rejects unsupported filters and unknown fields", () => {
    expect(ListTodosQuerySchema.safeParse({ section: "medium" }).success).toBe(false);
    expect(ListTodosQuerySchema.safeParse({ status: "started" }).success).toBe(false);
    expect(ListTodosQuerySchema.safeParse({ offset: 1 }).success).toBe(false);
  });
});

describe("CreateToolTodoSchema", () => {
  it("defaults a new todo to not_started", () => {
    expect(CreateToolTodoSchema.parse({ name: "Pay hydro" })).toEqual({
      name: "Pay hydro",
      status: "not_started",
    });
  });

  it("uses the shared due-date formats", () => {
    expect(
      CreateToolTodoSchema.safeParse({ name: "Pay hydro", due_date: "2026-09-30" }).success,
    ).toBe(true);
    expect(
      CreateToolTodoSchema.safeParse({
        name: "Pay hydro",
        due_date: "2026-09-30T09:15:00-04:00",
        due_date_has_time: true,
      }).success,
    ).toBe(true);
    expect(
      CreateToolTodoSchema.safeParse({ name: "Pay hydro", due_date: "September 30" }).success,
    ).toBe(false);
  });

  it.each(["not_started", "started", "complete"] as const)("accepts the %s status", (status) => {
    expect(CreateToolTodoSchema.parse({ name: "Pay hydro", status })).toEqual({
      name: "Pay hydro",
      status,
    });
  });

  it("rejects an unsupported status", () => {
    expect(CreateToolTodoSchema.safeParse({ name: "Pay hydro", status: "done" }).success).toBe(
      false,
    );
  });

  it("rejects unknown fields", () => {
    expect(CreateToolTodoSchema.safeParse({ name: "Pay hydro", priority: "high" }).success).toBe(
      false,
    );
  });
});

describe("UpdateToolTodoSchema", () => {
  it("requires at least one supplied field", () => {
    expect(UpdateToolTodoSchema.safeParse({}).success).toBe(false);
  });

  it("accepts only mutable tool fields", () => {
    expect(
      UpdateToolTodoSchema.parse({
        name: "Pay hydro bill",
        status: "complete",
        due_date: null,
        due_date_has_time: false,
      }),
    ).toEqual({
      name: "Pay hydro bill",
      status: "complete",
      due_date: null,
      due_date_has_time: false,
    });
    expect(UpdateToolTodoSchema.safeParse({ priority: "high" }).success).toBe(false);
    expect(UpdateToolTodoSchema.safeParse({ due_date: "September 30" }).success).toBe(false);
  });

  it.each(["not_started", "started", "complete"] as const)("accepts the %s status", (status) => {
    expect(UpdateToolTodoSchema.parse({ status })).toEqual({ status });
  });

  it("rejects an unsupported status", () => {
    expect(UpdateToolTodoSchema.safeParse({ status: "done" }).success).toBe(false);
  });
});

describe("MoveToolTodoSchema", () => {
  it("accepts a supported section", () => {
    expect(MoveToolTodoSchema.parse({ section: "today" })).toEqual({ section: "today" });
  });

  it("rejects unsupported sections and unknown fields", () => {
    expect(MoveToolTodoSchema.safeParse({ section: "medium" }).success).toBe(false);
    expect(MoveToolTodoSchema.safeParse({ section: "today", position: 1 }).success).toBe(false);
  });
});

describe("DeleteToolTodoSchema", () => {
  it("requires the complete expected projected todo snapshot", () => {
    expect(DeleteToolTodoSchema.parse(DELETE_SNAPSHOT)).toEqual(DELETE_SNAPSHOT);
    expect(
      DeleteToolTodoSchema.safeParse({
        id: TODO_ID,
        name: "Pay hydro",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown snapshot fields", () => {
    expect(
      DeleteToolTodoSchema.safeParse({
        ...DELETE_SNAPSHOT,
        priority: "low",
      }).success,
    ).toBe(false);
  });

  it("requires section and Today date semantics to agree", () => {
    expect(
      DeleteToolTodoSchema.safeParse({
        ...DELETE_SNAPSHOT,
        section: "today",
      }).success,
    ).toBe(false);
    expect(
      DeleteToolTodoSchema.safeParse({
        ...DELETE_SNAPSHOT,
        section: "high",
        today_date: "2026-09-15",
      }).success,
    ).toBe(false);
  });
});
