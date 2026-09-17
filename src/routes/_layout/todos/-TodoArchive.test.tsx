/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { TodoController } from "./-useTodoController";
import { TodoArchive } from "./-TodoArchive";
import { useTodoController } from "./-useTodoController";
import { updateTodo } from "#/routes/todos/todos.functions";
import type { Todo } from "#/lib/database.types";
import { useRef } from "react";

vi.mock("#/routes/todos/todos.functions", () => ({
  createTodo: vi.fn(),
  deleteTodo: vi.fn(),
  getTodos: vi.fn(),
  moveTodo: vi.fn(),
  reorderTodos: vi.fn(),
  updateTodo: vi.fn(),
}));

afterEach(cleanup);

it.each([1, 2])("preserves keyboard focus when restoring from an archive of %s items", (count) => {
  const first: Todo = {
    id: "first",
    name: "First completed",
    status: "complete",
    priority: "low",
    created_at: "2026-09-17",
    sort_order: 0,
    today_date: null,
    today_sort_order: null,
    due_date: null,
    due_date_has_time: false,
  };
  vi.mocked(updateTodo).mockResolvedValue({ ...first, status: "not_started" });
  function Harness() {
    const controller = useTodoController(
      count === 1 ? [first] : [first, { ...first, id: "second", name: "Second completed" }],
    );
    const back = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button ref={back}>Back to todos</button>
        <TodoArchive controller={controller} onReturnFocus={() => back.current?.focus()} />
      </>
    );
  }
  render(<Harness />);
  const restore = screen.getByRole("button", { name: 'Restore "First completed"' });
  restore.focus();
  fireEvent.click(restore);
  expect(screen.queryByText("First completed")).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole("button", {
      name: count === 1 ? "Back to todos" : 'Restore "Second completed"',
    }),
  );
  expect(screen.getByRole("status").textContent).toBe("Restoring First completed");
});

it("shows only completed items and supports restore and delete", () => {
  const update = vi.fn();
  const remove = vi.fn();
  const controller = {
    todos: [
      { id: "saved", name: "Finished task", status: "complete" },
      { id: "active", name: "Active task", status: "started" },
    ],
    status: "ready",
    pendingIds: new Set(),
    mutationError: null,
    update,
    remove,
  } as unknown as TodoController;
  render(<TodoArchive controller={controller} />);
  expect(screen.queryByText("Active task")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: 'Restore "Finished task"' }));
  expect(update).toHaveBeenCalledWith({ id: "saved", status: "not_started" });
  fireEvent.click(screen.getByRole("button", { name: 'Delete "Finished task"' }));
  expect(remove).toHaveBeenCalledWith("saved");
});

it("shows an empty archive without a blank page", () => {
  render(
    <TodoArchive
      controller={
        { todos: [], status: "ready", pendingIds: new Set() } as unknown as TodoController
      }
    />,
  );
  expect(screen.getByText("No completed items")).toBeTruthy();
});
