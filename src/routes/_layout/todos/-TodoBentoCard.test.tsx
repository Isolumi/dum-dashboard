/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

import type { Todo } from "#/lib/database.types";
import {
  createTodo,
  deleteTodo,
  moveTodo,
  reorderTodos,
  updateTodo,
} from "#/routes/todos/todos.functions";
import type { ToolEntry } from "#/tools/registry";

const dndTestState = vi.hoisted(() => ({
  currentOnDragEnd: undefined as
    | undefined
    | ((event: { active: { id: string }; over: { id: string } | null }) => void),
  onDragEndBySortableId: new Map<
    string,
    (event: { active: { id: string }; over: { id: string } | null }) => void
  >(),
  nextSortableId: new Map<string, string>(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
    React.createElement("a", { href: to, ...props }, children),
}));

vi.mock("#/routes/todos/todos.functions", () => ({
  createTodo: vi.fn(),
  deleteTodo: vi.fn(),
  getTodos: vi.fn(),
  moveTodo: vi.fn(),
  reorderTodos: vi.fn(),
  updateTodo: vi.fn(),
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
  Calendar: ({ onSelect }: { onSelect: (date: Date) => void }) => (
    <button type="button" onClick={() => onSelect(new Date("2026-12-25T12:00:00"))}>
      December 25, 2026
    </button>
  ),
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragEnd: (event: { active: { id: string }; over: { id: string } | null }) => void;
  }) => {
    dndTestState.currentOnDragEnd = onDragEnd;
    return <>{children}</>;
  },
  KeyboardSensor: class {},
  PointerSensor: class {},
  closestCenter: () => null,
  useDroppable: () => ({ isOver: false, setNodeRef: () => undefined }),
  useSensor: () => ({}),
  useSensors: (...sensors: unknown[]) => sensors,
}));

vi.mock("@dnd-kit/sortable", () => ({
  arrayMove: <T,>(items: T[], from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (moved !== undefined) next.splice(to, 0, moved);
    return next;
  },
  SortableContext: ({ children, items }: { children: React.ReactNode; items: string[] }) => {
    items.slice(0, -1).forEach((id, index) => {
      dndTestState.nextSortableId.set(id, items[index + 1]!);
    });
    for (const id of items) {
      if (dndTestState.currentOnDragEnd) {
        dndTestState.onDragEndBySortableId.set(id, dndTestState.currentOnDragEnd);
      }
    }
    return <>{children}</>;
  },
  sortableKeyboardCoordinates: () => null,
  useSortable: ({ id }: { id: string }) => ({
    attributes: {},
    isDragging: false,
    listeners: {
      onClick: () => {
        const nextId = dndTestState.nextSortableId.get(id);
        if (nextId) {
          dndTestState.onDragEndBySortableId.get(id)?.({
            active: { id },
            over: { id: nextId },
          });
        }
      },
    },
    setNodeRef: () => undefined,
    transform: null,
    transition: undefined,
  }),
  verticalListSortingStrategy: () => null,
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

const { TodoBentoCard } = await import("./-TodoBentoCard");

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "First task",
    status: "not_started",
    priority: "high",
    due_date: null,
    due_date_has_time: false,
    sort_order: 0,
    created_at: "2026-08-06T12:00:00.000Z",
    ...overrides,
  };
}

const mockTool = {
  id: "todos",
  label: "Todos",
  route: "/todos",
  icon: () => null,
  BentoCard: () => null,
} as unknown as ToolEntry;

function installTodoServer(initialTodos: Todo[]) {
  const serverTodos = new Map(initialTodos.map((todo) => [todo.id, todo]));
  let createdCount = 0;

  vi.mocked(createTodo).mockImplementation(async ({ data }) => {
    createdCount += 1;
    const created = makeTodo({
      id: `22222222-2222-4222-8222-${String(createdCount).padStart(12, "0")}`,
      name: data.name,
      priority: data.priority,
      status: data.status,
      due_date: data.due_date ?? null,
      sort_order:
        Math.max(
          -1,
          ...[...serverTodos.values()]
            .filter((todo) => todo.priority === data.priority)
            .map((todo) => todo.sort_order),
        ) + 1,
    });
    serverTodos.set(created.id, created);
    return created;
  });
  vi.mocked(updateTodo).mockImplementation(async ({ data }) => {
    const current = serverTodos.get(data.id);
    if (!current) throw new Error("Todo not found");
    const updated = { ...current, ...data };
    serverTodos.set(updated.id, updated);
    return updated;
  });
  vi.mocked(deleteTodo).mockImplementation(async ({ data }) => {
    serverTodos.delete(data.id);
  });
  vi.mocked(moveTodo).mockResolvedValue(undefined);
  vi.mocked(reorderTodos).mockImplementation(async ({ data }) => {
    for (const update of data.updates) {
      const current = serverTodos.get(update.id);
      if (current) serverTodos.set(update.id, { ...current, sort_order: update.sort_order });
    }
  });
}

function renderCard(todos: Todo[]) {
  window.history.replaceState({}, "", "/");
  installTodoServer(todos);
  render(<TodoBentoCard tool={mockTool} data={todos} />);
}

function expectStillOnDashboard() {
  expect(window.location.pathname).toBe("/");
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("TodoBentoCard", () => {
  it("keeps only the Todos heading linked to the full page", () => {
    renderCard([]);

    expect(screen.queryByLabelText("Open Todos tool")).toBeNull();
    expect(screen.getByRole("region", { name: /todos/i }).tagName).toBe("SECTION");
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /open full page/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Todos" }).getAttribute("href")).toBe("/todos");
  });

  it("creates a todo from the card without navigating", async () => {
    renderCard([]);

    fireEvent.click(screen.getByRole("button", { name: /add a new todo/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /new todo name/i }), {
      target: { value: "Created inline" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: /new todo name/i }), { key: "Enter" });

    await waitFor(() =>
      expect(createTodo).toHaveBeenCalledWith({
        data: {
          name: "Created inline",
          priority: "low",
          status: "not_started",
          due_date: null,
          due_date_has_time: false,
        },
      }),
    );
    expect(await screen.findByRole("button", { name: "Created inline" })).toBeTruthy();
    expectStillOnDashboard();
  });

  it("cycles a todo status from the card without navigating", async () => {
    const first = makeTodo();
    renderCard([first]);

    fireEvent.click(screen.getByRole("button", { name: /mark "first task" as started/i }));

    await waitFor(() =>
      expect(updateTodo).toHaveBeenCalledWith({ data: { id: first.id, status: "started" } }),
    );
    expect(screen.getByRole("button", { name: /mark "first task" as complete/i })).toBeTruthy();
    expectStillOnDashboard();
  });

  it("renames a todo from the card without navigating", async () => {
    const first = makeTodo();
    renderCard([first]);

    fireEvent.click(screen.getByRole("button", { name: "First task" }));
    fireEvent.change(screen.getByRole("textbox", { name: /edit todo name/i }), {
      target: { value: "Renamed inline" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: /edit todo name/i }), { key: "Enter" });

    await waitFor(() =>
      expect(updateTodo).toHaveBeenCalledWith({ data: { id: first.id, name: "Renamed inline" } }),
    );
    expect(await screen.findByRole("button", { name: "Renamed inline" })).toBeTruthy();
    expectStillOnDashboard();
  });

  it("keeps the left drag handle and removes priority controls from the card", () => {
    const first = makeTodo();
    renderCard([first]);

    const row = screen.getByRole("listitem");
    const dragHandle = within(row).getByRole("button", { name: /drag to move "first task"/i });
    const statusControl = within(row).getByRole("button", {
      name: /mark "first task" as started/i,
    });

    expect(screen.queryAllByRole("button", { name: /^change/i })).toHaveLength(0);
    expect(row.firstElementChild).toBe(dragHandle);
    expect(row.children[1]).toBe(statusControl);
    expectStillOnDashboard();
  });

  it("updates a due date from the card without navigating", async () => {
    const first = makeTodo();
    renderCard([first]);

    fireEvent.click(screen.getByRole("button", { name: /edit due date for "first task"/i }));
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /december 25, 2026/i })
        .find((element) => element.tagName === "BUTTON")!,
    );

    await waitFor(() =>
      expect(updateTodo).toHaveBeenCalledWith({
        data: {
          id: first.id,
          due_date: new Date(2026, 11, 25, 9, 0).toISOString(),
          due_date_has_time: true,
        },
      }),
    );
    expect(
      screen.getByRole("button", { name: /edit due date for "first task"/i }).textContent,
    ).toMatch(/dec 25/i);
    expectStillOnDashboard();
  });

  it("deletes a todo from the card without navigating", async () => {
    const first = makeTodo();
    renderCard([first]);

    fireEvent.click(screen.getByRole("button", { name: /delete "first task"/i }));

    await waitFor(() => expect(deleteTodo).toHaveBeenCalledWith({ data: { id: first.id } }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "First task" })).toBeNull());
    expectStillOnDashboard();
  });

  it("reorders todos from the card without navigating", async () => {
    const first = makeTodo({ id: "first", name: "First task", sort_order: 0 });
    const second = makeTodo({ id: "second", name: "Second task", sort_order: 1 });
    renderCard([first, second]);

    const dragHandle = screen.getByRole("button", { name: /drag to move "first task"/i });
    fireEvent.click(dragHandle);

    await waitFor(() =>
      expect(reorderTodos).toHaveBeenCalledWith({
        data: {
          updates: [
            { id: second.id, sort_order: 0 },
            { id: first.id, sort_order: 1 },
          ],
        },
      }),
    );
    expect(screen.getAllByRole("listitem")[0]?.textContent).toContain("Second task");
    expectStillOnDashboard();
  });
});
