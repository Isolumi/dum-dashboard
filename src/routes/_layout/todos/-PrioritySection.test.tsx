/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { Todo } from "#/lib/database.types";

afterEach(() => {
  cleanup();
});

const { PrioritySection } = await import("./-PrioritySection");

const highTodo: Todo = {
  id: "todo-high",
  name: "Deploy app",
  priority: "high",
  status: "not_started",
  due_date: null,
  due_date_has_time: false,
  sort_order: 0,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("PrioritySection", () => {
  it("propagates compact presentation to its todo controls without rendering an add row", () => {
    const { container } = render(
      <PrioritySection
        compact
        priority="high"
        label="High priority"
        todos={[highTodo]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(container.firstElementChild?.className).toContain("gap-0.5");
    expect(
      screen.getByRole("button", { name: /change "deploy app" priority to low/i }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /add a new todo/i })).toBeNull();
  });
});
