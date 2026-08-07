/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { TodoController } from "./-useTodoController";
import { TodoBoard } from "./-TodoBoard";

afterEach(() => {
  cleanup();
});

function makeController(overrides: Partial<TodoController> = {}): TodoController {
  return {
    todos: [],
    grouped: { high: [], low: [] },
    status: "ready",
    loadError: null,
    mutationError: null,
    retry: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    reorder: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("TodoBoard", () => {
  it.each(["compact", "full"] as const)(
    "keeps empty High and Low sections ready to add todos in %s mode",
    (variant) => {
      render(<TodoBoard controller={makeController()} variant={variant} />);

      expect(screen.getByText("High")).toBeTruthy();
      expect(screen.getByText("Low")).toBeTruthy();
      expect(screen.getAllByRole("button", { name: /add a new todo/i })).toHaveLength(2);
    },
  );

  it("bounds scrolling in compact mode but leaves the full board unbounded", () => {
    const { rerender } = render(<TodoBoard controller={makeController()} variant="compact" />);

    expect(screen.getByRole("region", { name: /todo board/i }).className).toContain("max-h-");
    expect(screen.getByRole("region", { name: /todo board/i }).className).toContain(
      "overflow-y-auto",
    );

    rerender(<TodoBoard controller={makeController()} variant="full" />);

    expect(screen.getByRole("region", { name: /todo board/i }).className).not.toContain("max-h-");
    expect(screen.getByRole("region", { name: /todo board/i }).className).not.toContain(
      "overflow-y-auto",
    );
  });

  it("retries a failed initial load", () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    render(
      <TodoBoard
        controller={makeController({
          status: "error",
          loadError: "Could not load todos. Refresh to try again.",
          retry,
        })}
        variant="full"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(retry).toHaveBeenCalledOnce();
  });

  it.each(["compact", "full"] as const)("shows a save failure inside the %s board", (variant) => {
    render(
      <TodoBoard
        controller={makeController({ mutationError: "Save failed — check your connection." })}
        variant={variant}
      />,
    );

    expect(screen.getByText(/save failed/i)).toBeTruthy();
    expect(
      screen
        .getByRole("region", { name: /todo board/i })
        .contains(screen.getByText(/save failed/i)),
    ).toBe(true);
  });
});
