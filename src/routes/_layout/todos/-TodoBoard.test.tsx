/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import type { TodoController } from "./-useTodoController";

type TestDragEvent = {
  active: { id: string; rect?: { current?: { translated?: { top: number } } } };
  over: { id: string; rect?: { top: number; height: number } } | null;
};

const dndTestState = vi.hoisted(() => ({
  onDragStartHandlers: [] as Array<(event: { active: { id: string } }) => void>,
  onDragOverHandlers: [] as Array<(event: TestDragEvent) => void>,
  onDragEndHandlers: [] as Array<(event: TestDragEvent) => void>,
  onDragCancelHandlers: [] as Array<() => void>,
  sensorCalls: [] as Array<{ name: string; options: unknown }>,
}));

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

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();

  return {
    ...actual,
    DndContext: ({
      children,
      onDragStart,
      onDragOver,
      onDragEnd,
      onDragCancel,
    }: {
      children: React.ReactNode;
      onDragStart: (event: { active: { id: string } }) => void;
      onDragOver: (event: TestDragEvent) => void;
      onDragEnd: (event: TestDragEvent) => void;
      onDragCancel: () => void;
    }) => {
      dndTestState.onDragStartHandlers.push(onDragStart);
      dndTestState.onDragOverHandlers.push(onDragOver);
      dndTestState.onDragEndHandlers.push(onDragEnd);
      dndTestState.onDragCancelHandlers.push(onDragCancel);
      return <>{children}</>;
    },
    DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useSensor: (sensor: { name?: string }, options: unknown) => {
      dndTestState.sensorCalls.push({ name: sensor.name ?? "unknown", options });
      return { sensor, options };
    },
    useSensors: (...sensors: unknown[]) => sensors,
  };
});

import { TodoBoard } from "./-TodoBoard";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  dndTestState.onDragStartHandlers.length = 0;
  dndTestState.onDragOverHandlers.length = 0;
  dndTestState.onDragEndHandlers.length = 0;
  dndTestState.onDragCancelHandlers.length = 0;
  dndTestState.sensorCalls.length = 0;
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
    move: vi.fn().mockResolvedValue(undefined),
    setDragging: vi.fn(),
    ...overrides,
  };
}

function makeTodo(id: string, priority: "high" | "low", sort_order: number) {
  return {
    id,
    name: id,
    priority,
    status: "not_started" as const,
    due_date: null,
    due_date_has_time: false,
    sort_order,
    created_at: "2026-08-10T00:00:00.000Z",
  };
}

describe("TodoBoard", () => {
  it("uses deliberate mouse and touch activation thresholds", () => {
    render(<TodoBoard controller={makeController()} variant="full" />);

    expect(dndTestState.sensorCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "MouseSensor",
          options: { activationConstraint: { distance: 6 } },
        }),
        expect.objectContaining({
          name: "TouchSensor",
          options: { activationConstraint: { delay: 160, tolerance: 6 } },
        }),
      ]),
    );
  });

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

  it("moves a High todo into the Low section when the board drag ends over a Low todo", () => {
    const highTodo = makeTodo("high-todo", "high", 0);
    const lowTodo = makeTodo("low-todo", "low", 0);
    const move = vi.fn().mockResolvedValue(undefined);
    const controller = makeController({
      todos: [highTodo, lowTodo],
      grouped: { high: [highTodo], low: [lowTodo] },
      move,
    });
    render(<TodoBoard controller={controller} variant="full" />);

    act(() => {
      dndTestState.onDragStartHandlers[0]?.({ active: { id: highTodo.id } });
      dndTestState.onDragOverHandlers[0]?.({
        active: { id: highTodo.id },
        over: { id: lowTodo.id },
      });
    });

    expect(screen.getByTestId("todo-drag-overlay").textContent).toContain(highTodo.name);
    expect(controller.setDragging).toHaveBeenCalledWith(true);

    act(() => {
      dndTestState.onDragEndHandlers[0]?.({
        active: { id: highTodo.id },
        over: { id: lowTodo.id },
      });
    });

    expect(move).toHaveBeenCalledWith(highTodo.id, "low", 0);
    expect(controller.setDragging).toHaveBeenLastCalledWith(false);
  });

  it("appends a High todo after the last Low todo through the trailing drop target", () => {
    const highTodo = makeTodo("high-todo", "high", 0);
    const lowTodo = makeTodo("low-todo", "low", 0);
    const move = vi.fn().mockResolvedValue(undefined);
    const controller = makeController({
      todos: [highTodo, lowTodo],
      grouped: { high: [highTodo], low: [lowTodo] },
      move,
    });
    render(<TodoBoard controller={controller} variant="full" />);

    act(() => {
      dndTestState.onDragStartHandlers[0]?.({ active: { id: highTodo.id } });
      dndTestState.onDragOverHandlers[0]?.({
        active: { id: highTodo.id },
        over: { id: "priority-low-end" },
      });
      dndTestState.onDragEndHandlers[0]?.({
        active: { id: highTodo.id },
        over: { id: "priority-low-end" },
      });
    });

    expect(move).toHaveBeenCalledWith(highTodo.id, "low", 1);
  });

  it("reorders High todos when the board drag ends in the same priority", () => {
    const first = makeTodo("first", "high", 0);
    const second = makeTodo("second", "high", 1);
    const reorder = vi.fn().mockResolvedValue(undefined);
    const controller = makeController({
      todos: [first, second],
      grouped: { high: [first, second], low: [] },
      reorder,
    });
    render(<TodoBoard controller={controller} variant="full" />);

    act(() => {
      dndTestState.onDragStartHandlers[0]?.({ active: { id: first.id } });
      dndTestState.onDragOverHandlers[0]?.({
        active: { id: first.id },
        over: { id: second.id },
      });
      dndTestState.onDragEndHandlers[0]?.({
        active: { id: first.id },
        over: { id: second.id },
      });
    });

    expect(reorder).toHaveBeenCalledWith("high", [second.id, first.id]);
  });

  it("moves a todo to the end of its priority through the trailing drop target", () => {
    const first = makeTodo("first", "high", 0);
    const second = makeTodo("second", "high", 1);
    const reorder = vi.fn().mockResolvedValue(undefined);
    const controller = makeController({
      todos: [first, second],
      grouped: { high: [first, second], low: [] },
      reorder,
    });
    render(<TodoBoard controller={controller} variant="full" />);

    act(() => {
      dndTestState.onDragStartHandlers[0]?.({ active: { id: first.id } });
      dndTestState.onDragOverHandlers[0]?.({
        active: { id: first.id },
        over: { id: "priority-high-end" },
      });
      dndTestState.onDragEndHandlers[0]?.({
        active: { id: first.id },
        over: { id: "priority-high-end" },
      });
    });

    expect(reorder).toHaveBeenCalledWith("high", [second.id, first.id]);
  });

  it("restores the original preview without a server write when dragging is cancelled", () => {
    const highTodo = makeTodo("high-todo", "high", 0);
    const lowTodo = makeTodo("low-todo", "low", 0);
    const controller = makeController({
      todos: [highTodo, lowTodo],
      grouped: { high: [highTodo], low: [lowTodo] },
    });
    render(<TodoBoard controller={controller} variant="full" />);

    act(() => {
      dndTestState.onDragStartHandlers[0]?.({ active: { id: highTodo.id } });
      dndTestState.onDragOverHandlers[0]?.({
        active: { id: highTodo.id },
        over: { id: lowTodo.id },
      });
      dndTestState.onDragCancelHandlers[0]?.();
    });

    expect(controller.move).not.toHaveBeenCalled();
    expect(controller.reorder).not.toHaveBeenCalled();
    expect(controller.setDragging).toHaveBeenLastCalledWith(false);
    expect(screen.queryByTestId("todo-drag-overlay")).toBeNull();
  });
});
