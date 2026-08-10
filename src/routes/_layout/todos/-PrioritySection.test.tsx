/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { Todo } from "#/lib/database.types";

const dndTestState = vi.hoisted(() => ({
  useDroppable: vi.fn(() => ({ setNodeRef: () => undefined })),
}));

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return { ...actual, useDroppable: dndTestState.useDroppable };
});

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
      />,
    );

    expect(container.firstElementChild?.className).toContain("gap-0.5");
    expect(screen.getByText("High priority").parentElement?.className).toContain("pl-5");
    const row = screen.getByRole("listitem");
    const dragHandle = screen.getByRole("button", { name: /drag to move "deploy app"/i });
    const statusControl = screen.getByRole("button", {
      name: /mark "deploy app" as started/i,
    });

    expect(screen.queryAllByRole("button", { name: /^change/i })).toHaveLength(0);
    expect(row.firstElementChild).toBe(dragHandle);
    expect(row.children[1]).toBe(statusControl);
    expect(screen.queryByRole("button", { name: /add a new todo/i })).toBeNull();
  });

  it("registers the priority container as a drop target", () => {
    render(
      <PrioritySection
        priority="high"
        label="High priority"
        todos={[highTodo]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(dndTestState.useDroppable).toHaveBeenCalledWith({ id: "priority-high" });
  });
});
