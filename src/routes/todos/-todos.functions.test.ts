import { describe, expect, it, vi } from "vitest";

vi.mock("#/lib/server-auth", () => ({
  assertSameOrigin: vi.fn(),
  getOwnerUser: vi.fn(() => ({ id: "owner-user-id" })),
  noStore: vi.fn(),
}));

import {
  assertTodoMutationRequest,
  CreateTodoSchema,
  CreateTodoInputSchema,
  DeleteTodoSchema,
  GetTodoSchema,
  GetTodosInputSchema,
  normalizeCreateTodoFields,
  normalizeUpdateTodoFields,
  ReorderTodosSchema,
  UpdateTodoSchema,
} from "./todos.functions";
import { assertSameOrigin } from "#/lib/server-auth";

const TODO_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("CreateTodoSchema", () => {
  it("rejects empty name", () => {
    const result = CreateTodoSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("trims whitespace-only names before validating", () => {
    const result = CreateTodoSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("accepts valid todo with all fields", () => {
    const result = CreateTodoSchema.safeParse({
      name: "Buy groceries",
      priority: "high",
      status: "not_started",
      due_date: "2026-04-01",
    });
    expect(result.success).toBe(true);
  });

  it("uses default priority of low when omitted", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test todo" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("low");
    }
  });

  it("uses default status of not_started when omitted", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test todo" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("not_started");
    }
  });

  it("leaves due date precision open for server-side normalization", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test todo" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.due_date_has_time).toBeUndefined();
    }
  });

  it("accepts valid priority values", () => {
    const priorities = ["high", "low"] as const;
    for (const priority of priorities) {
      const result = CreateTodoSchema.safeParse({ name: "Test", priority });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid priority value", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test", priority: "urgent" });
    expect(result.success).toBe(false);
  });

  it("rejects the retired medium priority", () => {
    expect(CreateTodoSchema.safeParse({ name: "Test", priority: "medium" }).success).toBe(false);
    expect(UpdateTodoSchema.safeParse({ id: TODO_ID, priority: "medium" }).success).toBe(false);
  });

  it("accepts valid status values", () => {
    const statuses = ["not_started", "started", "complete"] as const;
    for (const status of statuses) {
      const result = CreateTodoSchema.safeParse({ name: "Test", status });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status value", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test", status: "done" });
    expect(result.success).toBe(false);
  });

  it("accepts null due_date", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test", due_date: null });
    expect(result.success).toBe(true);
  });

  it("accepts omitted due_date", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format for due_date", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test", due_date: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("accepts an ISO timestamp with an offset for due_date", () => {
    expect(
      CreateTodoSchema.safeParse({
        name: "Timed todo",
        due_date: "2026-08-09T15:30:00.000Z",
        due_date_has_time: true,
      }).success,
    ).toBe(true);
  });

  it("normalizes timestamp due dates to time-aware metadata when omitted", () => {
    const result = CreateTodoSchema.safeParse({
      name: "Timed todo",
      due_date: "2026-08-09T15:30:00.000Z",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(normalizeCreateTodoFields(result.data).due_date_has_time).toBe(true);
  });

  it("normalizes a cleared create due date to time-free metadata", () => {
    const result = CreateTodoSchema.safeParse({
      name: "No due date",
      due_date: null,
      due_date_has_time: true,
    });

    expect(result.success).toBe(true);
    if (result.success)
      expect(normalizeCreateTodoFields(result.data).due_date_has_time).toBe(false);
  });

  it("rejects non-boolean due date precision metadata", () => {
    expect(
      CreateTodoSchema.safeParse({
        name: "Timed todo",
        due_date: "2026-08-09T15:30:00.000Z",
        due_date_has_time: "yes",
      }).success,
    ).toBe(false);
  });
});

describe("single-owner todo function inputs", () => {
  it("accepts reads without a browser access token", () => {
    expect(GetTodosInputSchema.safeParse({}).success).toBe(true);
    expect(GetTodosInputSchema.safeParse({ supabase_access_token: "session-token" }).success).toBe(
      false,
    );
  });

  it("rejects browser access tokens for todo writes", () => {
    const result = CreateTodoInputSchema.safeParse({
      supabase_access_token: "session-token",
      name: "Secure todo",
    });
    expect(result.success).toBe(false);
  });

  it("checks same-origin protection before every todo mutation", async () => {
    assertTodoMutationRequest();

    expect(assertSameOrigin).toHaveBeenCalledOnce();
  });
});

describe("UpdateTodoSchema", () => {
  it("requires valid UUID for id", () => {
    const result = UpdateTodoSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts valid UUID with no other fields", () => {
    const result = UpdateTodoSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with only name", () => {
    const result = UpdateTodoSchema.safeParse({
      id: TODO_ID,
      name: "Updated name",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name if provided", () => {
    const result = UpdateTodoSchema.safeParse({
      id: TODO_ID,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid priority update", () => {
    const result = UpdateTodoSchema.safeParse({
      id: TODO_ID,
      priority: "low",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid priority in update", () => {
    const result = UpdateTodoSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      priority: "critical",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an ISO timestamp in UpdateTodoSchema", () => {
    expect(
      UpdateTodoSchema.safeParse({
        id: "00000000-0000-0000-0000-000000000001",
        due_date: "2026-08-09T11:30:00-04:00",
      }).success,
    ).toBe(true);
  });

  it("normalizes a timestamp update to time-aware metadata when omitted", () => {
    const result = UpdateTodoSchema.safeParse({
      id: TODO_ID,
      due_date: "2026-08-09T11:30:00-04:00",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(normalizeUpdateTodoFields(result.data).due_date_has_time).toBe(true);
  });

  it("normalizes a cleared update due date to time-free metadata", () => {
    const result = UpdateTodoSchema.safeParse({
      id: TODO_ID,
      due_date: null,
      due_date_has_time: true,
    });

    expect(result.success).toBe(true);
    if (result.success)
      expect(normalizeUpdateTodoFields(result.data).due_date_has_time).toBe(false);
  });

  it("accepts an explicit due date time flag in updates", () => {
    expect(
      UpdateTodoSchema.safeParse({
        id: TODO_ID,
        due_date: "2026-08-09T11:30:00-04:00",
        due_date_has_time: true,
      }).success,
    ).toBe(true);
  });

  it("rejects non-boolean due date precision metadata in updates", () => {
    expect(
      UpdateTodoSchema.safeParse({
        id: TODO_ID,
        due_date_has_time: 1,
      }).success,
    ).toBe(false);
  });
});

describe("DeleteTodoSchema", () => {
  it("requires valid UUID", () => {
    const result = DeleteTodoSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts valid UUID", () => {
    const result = DeleteTodoSchema.safeParse({ id: TODO_ID });
    expect(result.success).toBe(true);
  });

  it("rejects missing id", () => {
    const result = DeleteTodoSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("ReorderTodosSchema", () => {
  it("rejects empty reorder batches", () => {
    const result = ReorderTodosSchema.safeParse({ updates: [] });
    expect(result.success).toBe(false);
  });

  it("rejects negative sort order values", () => {
    const result = ReorderTodosSchema.safeParse({
      updates: [{ id: TODO_ID, sort_order: -1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("GetTodoSchema", () => {
  it("requires valid UUID", () => {
    const result = GetTodoSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts valid UUID", () => {
    const result = GetTodoSchema.safeParse({ id: TODO_ID });
    expect(result.success).toBe(true);
  });

  it("rejects missing id", () => {
    const result = GetTodoSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
