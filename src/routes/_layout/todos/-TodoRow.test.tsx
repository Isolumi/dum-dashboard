/**
 * @vitest-environment jsdom
 */
import { format } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import type { Todo } from "#/lib/database.types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"));
});

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
    PopoverContent: ({ children }: { children: React.ReactNode }) => {
      const context = React.useContext(PopoverContext);
      return context?.open ? <>{children}</> : null;
    },
  };
});

vi.mock("#/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect: (date: Date) => void }) => (
    <button type="button" onClick={() => onSelect(new Date("2026-12-25T12:00:00"))}>
      December 25, 2026
    </button>
  ),
}));

const { TodoRow } = await import("./-TodoRow");

const highTodo: Todo = {
  id: "todo-high",
  name: "Deploy app",
  priority: "high",
  status: "not_started",
  due_date: "2026-01-10",
  sort_order: 0,
  created_at: "2026-01-01T00:00:00.000Z",
};

function renderTodoRow(props: Partial<React.ComponentProps<typeof TodoRow>> = {}) {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  render(<TodoRow todo={highTodo} onUpdate={onUpdate} onDelete={onDelete} {...props} />);
  return { onUpdate, onDelete };
}

describe("TodoRow", () => {
  it("sends the next status when its status control is clicked", () => {
    const { onUpdate } = renderTodoRow();

    fireEvent.click(screen.getByRole("button", { name: /mark "deploy app" as started/i }));

    expect(onUpdate).toHaveBeenCalledWith({ id: "todo-high", status: "started" });
  });

  it("sends the edited name when the row name is saved", () => {
    const { onUpdate } = renderTodoRow();

    fireEvent.click(screen.getByRole("button", { name: "Deploy app" }));
    const input = screen.getByRole("textbox", { name: /edit todo name/i });
    fireEvent.change(input, { target: { value: "Ship app" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onUpdate).toHaveBeenCalledWith({ id: "todo-high", name: "Ship app" });
  });

  it("changes a High todo to Low when its priority control is clicked", () => {
    const { onUpdate } = renderTodoRow();

    fireEvent.click(screen.getByRole("button", { name: /change "deploy app" priority to low/i }));

    expect(onUpdate).toHaveBeenCalledWith({ id: "todo-high", priority: "low" });
  });

  it("sends the selected due date when its date control is used", () => {
    const { onUpdate } = renderTodoRow();

    expect(screen.queryByRole("button", { name: /december 25, 2026/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /edit due date for "deploy app"/i }));
    fireEvent.click(screen.getByRole("button", { name: /december 25, 2026/i }));

    expect(onUpdate).toHaveBeenCalledWith({
      id: "todo-high",
      due_date: new Date(2026, 11, 25, 9, 0).toISOString(),
    });
  });

  it("shows timestamp due dates with a compact local time", () => {
    const dueDate = new Date(2026, 7, 9, 15, 30).toISOString();
    renderTodoRow({ todo: { ...highTodo, due_date: dueDate } });

    expect(screen.getByRole("button", { name: /edit due date for "deploy app"/i }).textContent).toContain(
      format(new Date(dueDate), "MMM d, h:mm a"),
    );
  });

  it("keeps overdue due dates visually destructive", () => {
    renderTodoRow({ todo: { ...highTodo, due_date: "2026-08-08" } });

    expect(
      screen.getByRole("button", { name: /edit due date for "deploy app"/i }).parentElement
        ?.className,
    ).toContain("text-destructive");
  });

  it("sends the todo id when its delete control is clicked", () => {
    const { onDelete } = renderTodoRow();

    fireEvent.click(screen.getByRole("button", { name: /delete "deploy app"/i }));

    expect(onDelete).toHaveBeenCalledWith("todo-high");
  });

  it("keeps compact controls focusable and preserves the 44px row target", () => {
    renderTodoRow({ compact: true });

    const row = screen.getByRole("listitem");
    const priorityControl = screen.getByRole("button", {
      name: /change "deploy app" priority to low/i,
    });

    expect(row.className).toContain("min-h-[44px]");
    expect(row.className).toContain("px-2");
    expect(row.className).toContain("motion-reduce:transition-none");
    expect(screen.getByRole("button", { name: "Deploy app" }).className).toContain("text-sm");
    expect(screen.getByRole("button", { name: /mark "deploy app" as started/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /edit due date for "deploy app"/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete "deploy app"/i })).toBeTruthy();
    expect(priorityControl.textContent).toBe("");
    expect(priorityControl.className).toContain("opacity-0");
    expect(priorityControl.className).toContain("group-hover:opacity-100");

    priorityControl.focus();
    expect(document.activeElement).toBe(priorityControl);
  });

  it("uses a two-line compact layout before fixed controls crowd out the todo name", () => {
    renderTodoRow({ compact: true });

    const row = screen.getByRole("listitem");
    const nameControl = screen.getByRole("button", { name: "Deploy app" });

    expect(row.className).toContain("flex-wrap");
    expect(nameControl.className).toContain("min-w-0");
    expect(nameControl.className).toContain("max-[480px]:order-last");
    expect(nameControl.className).toContain("max-[480px]:basis-full");
    expect(nameControl.className).toContain("overflow-hidden");
  });

  it("identifies a pending compact todo and disables its actions until it is saved", () => {
    renderTodoRow({ compact: true, isPending: true });

    const nameControl = screen.getByRole("button", { name: /deploy app \(saving\)/i });
    expect(nameControl.contains(screen.getByText("Saving…"))).toBe(true);
    expect((nameControl as HTMLButtonElement).disabled).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: /mark "deploy app" as started/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: /change "deploy app" priority to low/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: /edit due date for "deploy app"/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: /delete "deploy app"/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("keeps the priority control at least 44px wide", () => {
    renderTodoRow();

    expect(
      screen.getByRole("button", { name: /change "deploy app" priority to low/i }).className,
    ).toContain("min-w-11");
  });

  it("makes drag and delete controls discoverable for coarse pointers", () => {
    renderTodoRow();

    expect(
      screen.getByRole("button", { name: /drag to reorder "deploy app"/i }).className,
    ).toContain("[@media(pointer:coarse)]:opacity-100");
    expect(screen.getByRole("button", { name: /delete "deploy app"/i }).className).toContain(
      "[@media(pointer:coarse)]:opacity-100",
    );
  });

  it("reveals the empty date icon when its focusable trigger receives focus", () => {
    renderTodoRow({ todo: { ...highTodo, due_date: null } });

    const dateTrigger = screen.getByRole("button", { name: /edit due date for "deploy app"/i });
    const emptyDateIcon = dateTrigger.querySelector("svg");
    dateTrigger.focus();

    expect(document.activeElement).toBe(dateTrigger);
    expect(emptyDateIcon?.className.baseVal).toContain("group-focus-visible/date:opacity-100");
  });

  it("keeps the empty date icon visible for coarse pointers", () => {
    renderTodoRow({ todo: { ...highTodo, due_date: null } });

    const dateTrigger = screen.getByRole("button", { name: /edit due date for "deploy app"/i });
    const emptyDateIcon = dateTrigger.querySelector("svg");

    expect(emptyDateIcon?.className.baseVal).toContain("[@media(pointer:coarse)]:opacity-100");
  });
});
