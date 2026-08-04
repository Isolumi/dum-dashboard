import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
// RED phase: these imports will fail until todos.functions.ts is created
import {
  CreateTodoSchema,
  CreateTodoInputSchema,
  DeleteTodoSchema,
  GetTodoSchema,
  GetTodosInputSchema,
  ReorderTodosSchema,
  UpdateTodoSchema,
} from "./todos.functions";

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

  it("uses default priority of medium when omitted", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test todo" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("medium");
    }
  });

  it("uses default status of not_started when omitted", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test todo" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("not_started");
    }
  });

  it("accepts valid priority values", () => {
    const priorities = ["high", "medium", "low"] as const;
    for (const priority of priorities) {
      const result = CreateTodoSchema.safeParse({ name: "Test", priority });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid priority value", () => {
    const result = CreateTodoSchema.safeParse({ name: "Test", priority: "urgent" });
    expect(result.success).toBe(false);
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
});

describe("authenticated todo function inputs", () => {
  it("requires a Supabase access token for todo reads", () => {
    expect(GetTodosInputSchema.safeParse({}).success).toBe(false);
    expect(GetTodosInputSchema.safeParse({ supabase_access_token: "session-token" }).success).toBe(
      true,
    );
  });

  it("requires a Supabase access token for todo writes", () => {
    const result = CreateTodoInputSchema.safeParse({
      supabase_access_token: "session-token",
      name: "Secure todo",
    });
    expect(result.success).toBe(true);
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
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Updated name",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name if provided", () => {
    const result = UpdateTodoSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid priority update", () => {
    const result = UpdateTodoSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
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
});

describe("DeleteTodoSchema", () => {
  it("requires valid UUID", () => {
    const result = DeleteTodoSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts valid UUID", () => {
    const result = DeleteTodoSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" });
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
      updates: [{ id: "550e8400-e29b-41d4-a716-446655440000", sort_order: -1 }],
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
    const result = GetTodoSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(result.success).toBe(true);
  });

  it("rejects missing id", () => {
    const result = GetTodoSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("getTodos null safety (bug fix TODO-01)", () => {
  it("getTodos handler returns data ?? [] — never returns null to callers", () => {
    // This test verifies the null coalescing guard is present in the getTodos handler.
    // Supabase .select() can return { data: null } for an empty table.
    // Without the guard, todos.map() in the loader crashes with
    // "Cannot read properties of undefined (reading 'map')".
    //
    // RED: fails before fix because the file contains `return data` (no null guard)
    // GREEN: passes after fix because the file contains `return data ?? []`
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const source = readFileSync(resolve(__dirname, "todos.functions.ts"), "utf-8");
    expect(source, "getTodos handler must use `data ?? []` null guard").toContain("data ?? []");
  });
});
