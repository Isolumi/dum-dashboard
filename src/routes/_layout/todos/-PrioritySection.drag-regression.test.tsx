/** @vitest-environment jsdom */
import { DndContext, useDndContext } from "@dnd-kit/core";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Todo } from "#/lib/database.types";
import { PrioritySection } from "./-PrioritySection";

afterEach(cleanup);

it("keeps the visible row registered after a quick cross-section drag and cancel", async () => {
  let registry: ReturnType<typeof useDndContext>;
  function Probe() {
    registry = useDndContext();
    return null;
  }
  const todo: Todo = {
    id: "drag-test",
    name: "Drag regression task",
    status: "not_started",
    priority: "high",
    created_at: "2026-09-17",
    sort_order: 0,
    today_date: null,
    today_sort_order: null,
    due_date: null,
    due_date_has_time: false,
  };
  function Board({ inHigh }: { inHigh: boolean }) {
    return (
      <DndContext>
        <Probe />
        <PrioritySection
          priority="high"
          label="High"
          todos={inHigh ? [todo] : []}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
          animateRemoval={false}
        />
        <PrioritySection
          priority="low"
          label="Low"
          todos={inHigh ? [] : [{ ...todo, priority: "low" }]}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
          animateRemoval={false}
        />
      </DndContext>
    );
  }
  const { rerender } = render(<Board inHigh />);
  rerender(<Board inHigh={false} />);
  rerender(<Board inHigh />);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 220));
  });
  const handle = screen.getByRole("button", { name: 'Drag to move "Drag regression task"' });
  expect(registry!.draggableNodes.get("drag-test")?.node.current?.contains(handle)).toBe(true);
  expect(registry!.droppableContainers.get("drag-test")?.node.current?.contains(handle)).toBe(true);
  expect(screen.getAllByText("Drag regression task")).toHaveLength(1);
});
