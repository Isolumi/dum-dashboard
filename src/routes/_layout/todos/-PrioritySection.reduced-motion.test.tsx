/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Todo } from "#/lib/database.types";

vi.stubGlobal(
  "matchMedia",
  vi.fn(() => ({
    matches: true,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
);
const { PrioritySection } = await import("./-PrioritySection");
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("removes completed rows without an animation when reduced motion is requested", () => {
  const todo: Todo = {
    id: "test",
    name: "Reduced motion task",
    status: "started",
    priority: "low",
    created_at: "2026-09-17",
    sort_order: 0,
    today_date: null,
    today_sort_order: null,
    due_date: null,
    due_date_has_time: false,
  };
  const props = { priority: "low" as const, label: "Low", onUpdate: vi.fn(), onDelete: vi.fn() };
  const { rerender } = render(<PrioritySection {...props} todos={[todo]} />);
  rerender(<PrioritySection {...props} todos={[]} />);
  expect(screen.queryByText("Reduced motion task")).toBeNull();
  expect(screen.getByText("No items")).toBeTruthy();
});
