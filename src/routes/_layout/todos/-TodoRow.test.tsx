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

const { TodoRow } = await import("./-TodoRow");

const highTodo: Todo = {
  id: "todo-high",
  name: "Deploy app",
  priority: "high",
  status: "not_started",
  due_date: "2026-01-10",
  due_date_has_time: false,
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

  it("does not render priority controls", () => {
    renderTodoRow();

    expect(screen.queryAllByRole("button", { name: /^change/i })).toHaveLength(0);
  });

  it("sends the selected due date when its date control is used", () => {
    const { onUpdate } = renderTodoRow();

    expect(screen.queryByRole("button", { name: /december 25, 2026/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /edit due date for "deploy app"/i }));
    fireEvent.click(screen.getByRole("button", { name: /december 25, 2026/i }));

    expect(onUpdate).toHaveBeenCalledWith({
      id: "todo-high",
      due_date: new Date(2026, 11, 25, 9, 0).toISOString(),
      due_date_has_time: true,
    });
  });

  it("shows timestamp due dates with a compact local time", () => {
    const dueDate = new Date(2026, 7, 9, 15, 30).toISOString();
    renderTodoRow({ todo: { ...highTodo, due_date: dueDate, due_date_has_time: true } });

    expect(
      screen.getByRole("button", { name: /edit due date for "deploy app"/i }).textContent,
    ).toContain(format(new Date(dueDate), "MMM d, h:mm a"));
  });

  it("keeps a migrated UTC-midnight due date on its original calendar day without a time", () => {
    renderTodoRow({
      todo: {
        ...highTodo,
        due_date: "2026-08-09T00:00:00.000Z",
        due_date_has_time: false,
      },
    });

    expect(
      screen.getByRole("button", { name: /edit due date for "deploy app"/i }).textContent,
    ).toBe(format(new Date(2026, 7, 9), "MMM d"));
  });

  it("clears both the due date and its time metadata", () => {
    const { onUpdate } = renderTodoRow({
      todo: {
        ...highTodo,
        due_date: new Date(2026, 7, 9, 15, 30).toISOString(),
        due_date_has_time: true,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /edit due date for "deploy app"/i }));
    fireEvent.click(screen.getByRole("button", { name: /clear due date/i }));

    expect(onUpdate).toHaveBeenCalledWith({
      id: "todo-high",
      due_date: null,
      due_date_has_time: false,
    });
  });

  it("contains a selected compact date and time without overflowing its control", () => {
    const dueDate = new Date(2026, 7, 9, 15, 30).toISOString();
    renderTodoRow({
      compact: true,
      todo: { ...highTodo, due_date: dueDate, due_date_has_time: true },
    });

    const trigger = screen.getByRole("button", { name: /edit due date for "deploy app"/i });
    const value = trigger.querySelector("span");

    expect(trigger.parentElement?.className).toContain("w-32");
    expect(trigger.className).toContain("overflow-hidden");
    expect(value?.className).toContain("min-w-0");
    expect(value?.className).toContain("truncate");
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
    const dragControl = screen.getByRole("button", { name: /drag to move "deploy app"/i });

    expect(row.className).toContain("min-h-[44px]");
    expect(row.className).toContain("px-1");
    expect(row.className).toContain("motion-reduce:transition-none");
    expect(screen.getByRole("button", { name: "Deploy app" }).className).toContain("text-sm");
    expect(screen.getByRole("button", { name: /mark "deploy app" as started/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /edit due date for "deploy app"/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete "deploy app"/i })).toBeTruthy();
    expect(dragControl).toBeTruthy();
    dragControl.focus();
    expect(document.activeElement).toBe(dragControl);
  });

  it("uses one aligned compact grid with a leading drag handle", () => {
    renderTodoRow({ compact: true });

    const row = screen.getByRole("listitem");
    const nameControl = screen.getByRole("button", { name: "Deploy app" });
    const statusControl = screen.getByRole("button", { name: /mark "deploy app" as started/i });
    const dragControl = screen.getByRole("button", { name: /drag to move "deploy app"/i });

    expect(row.className).toContain("grid-cols-[1rem_2.75rem_minmax(0,1fr)_auto]");
    expect(row.className).toContain("gap-0.5");
    expect(row.className).toContain("px-1");
    expect(dragControl.className).toContain("w-4");
    expect(dragControl.className).not.toContain("w-6");
    expect(dragControl.className).toContain("opacity-40");
    expect(dragControl.className).not.toContain("min-w-11");
    expect(nameControl.className).toContain("min-w-0");
    expect(nameControl.className).toContain("overflow-hidden");
    expect(row.firstElementChild).toBe(dragControl);
    expect(row.children[1]).toBe(statusControl);
    expect(screen.getAllByRole("button", { name: /drag to move "deploy app"/i })).toHaveLength(1);
    expect(
      dragControl.compareDocumentPosition(nameControl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("keeps the full-page drag handle before the status control", () => {
    renderTodoRow();

    const row = screen.getByRole("listitem");
    const dragControl = screen.getByRole("button", { name: /drag to move "deploy app"/i });
    const statusControl = screen.getByRole("button", { name: /mark "deploy app" as started/i });

    expect(row.className).toContain("flex gap-1 px-4");
    expect(row.firstElementChild).toBe(dragControl);
    expect(row.children[1]).toBe(statusControl);
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
      (screen.getByRole("button", { name: /edit due date for "deploy app"/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: /delete "deploy app"/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("makes drag and delete controls discoverable for coarse pointers", () => {
    renderTodoRow();

    expect(screen.getByRole("button", { name: /drag to move "deploy app"/i }).className).toContain(
      "[@media(pointer:coarse)]:opacity-100",
    );
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
