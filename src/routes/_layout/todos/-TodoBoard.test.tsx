/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import type { TodoController } from "./-useTodoController";

vi.mock("#/components/ui/popover", () => {
  const PopoverContext = React.createContext<{
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  } | null>(null);

  return {
    Popover: ({
      open = false,
      onOpenChange,
      children,
    }: {
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
      children: React.ReactNode;
    }) => (
      <PopoverContext.Provider value={{ open, onOpenChange }}>{children}</PopoverContext.Provider>
    ),
    PopoverTrigger: ({
      render: trigger,
      children,
    }: {
      render: React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>;
      children: React.ReactNode;
    }) => {
      const context = React.useContext(PopoverContext);
      return React.cloneElement(
        trigger,
        {
          onClick: (event: React.MouseEvent<HTMLElement>) => {
            trigger.props.onClick?.(event);
            if (!event.defaultPrevented) context?.onOpenChange?.(!context.open);
          },
        },
        children,
      );
    },
    PopoverContent: ({ children, ...props }: React.ComponentProps<"div">) => {
      const context = React.useContext(PopoverContext);
      return context?.open ? <div {...props}>{children}</div> : null;
    },
    PopoverTitle: ({ children, ...props }: React.ComponentProps<"h2">) => (
      <h2 {...props}>{children}</h2>
    ),
  };
});

vi.mock("#/components/ui/calendar", () => ({
  Calendar: () => <div>Calendar</div>,
}));

import { TodoBoard } from "./-TodoBoard";

afterEach(() => {
  cleanup();
});

function makeController(overrides: Partial<TodoController> = {}): TodoController {
  return {
    todos: [],
    grouped: { high: [], low: [] },
    pendingIds: new Set(),
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
      expect(screen.getAllByRole("button", { name: /add a new todo/i })).toHaveLength(1);
    },
  );

  it.each(["compact", "full"] as const)(
    "replaces the single add control inline with the add form in %s mode",
    (variant) => {
      render(<TodoBoard controller={makeController()} variant={variant} />);

      fireEvent.click(screen.getByRole("button", { name: /add a new todo/i }));

      expect(screen.queryByRole("button", { name: /add a new todo/i })).toBeNull();
      expect(screen.getByRole("textbox", { name: /new todo name/i })).toBeTruthy();
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
