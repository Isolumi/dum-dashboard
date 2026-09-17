/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { TodoController } from "./-useTodoController";
import { TodoArchive } from "./-TodoArchive";

afterEach(cleanup);

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
