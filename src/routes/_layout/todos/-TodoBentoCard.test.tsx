/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import React from "react";

import type { Todo } from "#/lib/database.types";
import type { ToolEntry } from "#/tools/registry";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

vi.mock("#/routes/todos/todos.functions", () => ({
  getTodos: vi.fn(),
}));

const { TodoBentoCard } = await import("./-TodoBentoCard");
const { getTodos } = await import("#/routes/todos/todos.functions");

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID(),
    name: "Test todo",
    status: "not_started" as const,
    priority: "medium" as const,
    due_date: null,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const PAST_DATE = "2020-01-01";

const mockTool = {
  id: "todos",
  label: "Todos",
  route: "/todos",
  icon: () => null,
  BentoCard: () => null,
} as unknown as ToolEntry;

describe("TodoBentoCard", () => {
  it("renders priority section labels for non-empty sections", () => {
    const todos = [makeTodo({ priority: "high" }), makeTodo({ priority: "low" })];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText("Low")).toBeTruthy();
  });

  it("hides priority section label when section is empty", () => {
    const todos = [makeTodo({ priority: "medium" })];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    expect(screen.queryByText("High")).toBeNull();
    expect(screen.queryByText("Low")).toBeNull();
    expect(screen.getByText("Medium")).toBeTruthy();
  });

  it("renders todo names inside their priority sections", () => {
    const todos = [
      makeTodo({ priority: "high", name: "Fix auth bug" }),
      makeTodo({ priority: "low", name: "Update deps" }),
    ];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    expect(screen.getByText("Fix auth bug")).toBeTruthy();
    expect(screen.getByText("Update deps")).toBeTruthy();
  });

  it("formats due date as 'Mon D' (e.g. Jan 1)", () => {
    const todos = [makeTodo({ due_date: "2026-04-10" })];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    expect(screen.getByText("Apr 10")).toBeTruthy();
  });

  it("shows dash when due_date is null", () => {
    const todos = [makeTodo({ due_date: null })];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    expect(screen.getByText("—")).toBeTruthy();
  });

  it("marks overdue due date with aria-label for past-due incomplete todos", () => {
    const todos = [makeTodo({ due_date: PAST_DATE, status: "not_started" })];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    // Implementation adds aria-label="Overdue: Jan 1" on the date span
    expect(screen.getByLabelText(/overdue/i)).toBeTruthy();
  });

  it("does not mark completed todos as overdue even with past due date", () => {
    const todos = [makeTodo({ due_date: PAST_DATE, status: "complete" })];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    // Completed todos skip the overdue aria-label
    expect(screen.queryByLabelText(/overdue/i)).toBeNull();
  });

  it("wraps completed todo name in <s> (strikethrough)", () => {
    const todos = [makeTodo({ status: "complete", name: "Done task" })];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    const nameEl = screen.getByText("Done task");
    expect(nameEl.tagName.toLowerCase()).toBe("s");
  });

  it("renders the card as a link to /todos", () => {
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: [] }));

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/todos");
  });

  it("shows empty state message when there are no todos", () => {
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: [] }));
    expect(screen.getByText(/no todos yet/i)).toBeTruthy();
  });

  it("loads todos from the single-owner server function when data is not preloaded", async () => {
    vi.mocked(getTodos).mockResolvedValue([makeTodo({ name: "Loaded securely" })]);

    render(React.createElement(TodoBentoCard, { tool: mockTool, data: null }));

    await waitFor(() => expect(screen.getByText("Loaded securely")).toBeTruthy());
    expect(getTodos).toHaveBeenCalledWith();
  });

  it("sorts todos within a section by sort_order ascending", () => {
    const todos = [
      makeTodo({ priority: "high", name: "Second", sort_order: 1 }),
      makeTodo({ priority: "high", name: "First", sort_order: 0 }),
    ];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    const names = screen.getAllByText(/first|second/i).map((el) => el.textContent);
    expect(names[0]).toMatch(/first/i);
    expect(names[1]).toMatch(/second/i);
  });
});
