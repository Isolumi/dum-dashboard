/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";

import type { Todo } from "#/lib/database.types";
import type { ToolEntry } from "#/tools/registry";

afterEach(() => {
  cleanup();
});

// Mock @tanstack/react-router Link as a simple <a> tag
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href: to, ...props }, children),
}));

const { TodoBentoCard } = await import("./-TodoBentoCard");

// Helper to create valid Todo objects with overridable fields
function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID(),
    name: "Test todo",
    status: "not_started" as const,
    priority: "medium" as const,
    due_date: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// A past date (definitely overdue)
const PAST_DATE = "2020-01-01";
// A future date (not overdue)
const FUTURE_DATE = "2099-12-31";

const mockTool = {
  id: "todos",
  label: "Todos",
  route: "/todos",
  icon: () => null,
  BentoCard: () => null,
} as unknown as ToolEntry;

describe("TodoBentoCard", () => {
  it("Test 1: renders three status badge groups with correct counts from fixture", () => {
    const todos: Todo[] = [
      makeTodo({ status: "not_started" }),
      makeTodo({ status: "not_started" }),
      makeTodo({ status: "started" }),
      makeTodo({ status: "complete" }),
      makeTodo({ status: "complete" }),
      makeTodo({ status: "complete" }),
    ];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    // not_started count = 2
    const notStartedGroup = screen.getByRole("group", { name: /not started: 2/i });
    expect(notStartedGroup).toBeTruthy();

    // started count = 1
    const startedGroup = screen.getByRole("group", { name: /started: 1/i });
    expect(startedGroup).toBeTruthy();

    // complete count = 3
    const completeGroup = screen.getByRole("group", { name: /complete: 3/i });
    expect(completeGroup).toBeTruthy();
  });

  it("Test 2: renders overdue count badge when overdue items exist", () => {
    const todos: Todo[] = [
      makeTodo({ due_date: PAST_DATE, status: "not_started" }),
      makeTodo({ due_date: PAST_DATE, status: "started" }),
      makeTodo({ due_date: FUTURE_DATE, status: "not_started" }),
    ];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    expect(screen.getByText(/2 overdue/i)).toBeTruthy();
  });

  it("Test 3: overdue count excludes complete todos", () => {
    const todos: Todo[] = [
      makeTodo({ due_date: PAST_DATE, status: "complete" }),
      makeTodo({ due_date: PAST_DATE, status: "not_started" }),
    ];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    // Only 1 overdue (not the complete one)
    expect(screen.getByText(/1 overdue/i)).toBeTruthy();
  });

  it("Test 4: renders high-priority count badge when high-priority items exist", () => {
    const todos: Todo[] = [
      makeTodo({ priority: "high", status: "not_started" }),
      makeTodo({ priority: "high", status: "started" }),
      makeTodo({ priority: "high", status: "not_started" }),
      makeTodo({ priority: "medium", status: "not_started" }),
    ];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    expect(screen.getByText(/3 high/i)).toBeTruthy();
  });

  it("Test 5: high-priority count excludes complete todos", () => {
    const todos: Todo[] = [
      makeTodo({ priority: "high", status: "complete" }),
      makeTodo({ priority: "high", status: "not_started" }),
    ];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    // Only 1 high (not the complete one)
    expect(screen.getByText(/1 high/i)).toBeTruthy();
  });

  it("Test 6: attention row absent from DOM when no overdue or high-priority items", () => {
    const todos: Todo[] = [
      makeTodo({ status: "not_started", priority: "low" }),
      makeTodo({ status: "complete", priority: "medium" }),
    ];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    // No overdue or high text should appear
    expect(screen.queryByText(/overdue/i)).toBeNull();
    expect(screen.queryByText(/\d+ high/i)).toBeNull();
  });

  it("Test 7: card renders as a Link with href to /todos", () => {
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: [] }));

    const link = screen.getByRole("link");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/todos");
  });

  it("Test 8: handles null data gracefully -- renders all counts as 0", () => {
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: null }));

    const notStartedGroup = screen.getByRole("group", { name: /^not started: 0$/i });
    expect(notStartedGroup).toBeTruthy();

    const startedGroup = screen.getByRole("group", { name: /^started: 0$/i });
    expect(startedGroup).toBeTruthy();

    const completeGroup = screen.getByRole("group", { name: /^complete: 0$/i });
    expect(completeGroup).toBeTruthy();

    // No attention row
    expect(screen.queryByText(/overdue/i)).toBeNull();
    expect(screen.queryByText(/\d+ high/i)).toBeNull();
  });
});
