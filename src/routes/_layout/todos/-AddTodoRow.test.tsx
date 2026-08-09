/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import React from "react";

afterEach(() => {
  cleanup();
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
    PopoverContent: ({ children, ...props }: React.ComponentProps<"div">) => {
      const context = React.useContext(PopoverContext);
      return context?.open ? <div {...props}>{children}</div> : null;
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

const { AddTodoRow } = await import("./-AddTodoRow");

const noopCreate = vi.fn();

function renderCollapsed() {
  const result = render(React.createElement(AddTodoRow, { onCreate: noopCreate }));
  return result;
}

function renderExpanded() {
  const { container } = renderCollapsed();
  const trigger = screen.getByRole("button", { name: /add a new todo/i });
  act(() => {
    trigger.click();
  });
  return container;
}

describe("AddTodoRow (collapsed state)", () => {
  it("renders the add-todo placeholder without crashing", () => {
    renderCollapsed();
    expect(screen.getByRole("button", { name: /add a new todo/i })).toBeTruthy();
  });

  it("opens the form with Enter", () => {
    renderCollapsed();

    fireEvent.keyDown(screen.getByRole("button", { name: /add a new todo/i }), { key: "Enter" });

    expect(screen.getByRole("textbox", { name: /new todo name/i })).toBeTruthy();
  });

  it("opens the form with Space without inserting a space into the name", () => {
    renderCollapsed();

    fireEvent.keyDown(screen.getByRole("button", { name: /add a new todo/i }), { key: " " });

    expect(screen.getByRole<HTMLInputElement>("textbox", { name: /new todo name/i }).value).toBe(
      "",
    );
  });

  it("starts quick entry with printable characters other than Space", () => {
    renderCollapsed();

    fireEvent.keyDown(screen.getByRole("button", { name: /add a new todo/i }), { key: "D" });

    expect(screen.getByRole<HTMLInputElement>("textbox", { name: /new todo name/i }).value).toBe(
      "D",
    );
  });
});

describe("AddTodoRow (expanded state)", () => {
  it("shows the outer wrapper with bg-accent/50 class when expanded", () => {
    const container = renderExpanded();
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("bg-accent/50");
  });

  it("focuses the name input and exposes the compact inline controls", () => {
    renderExpanded();
    const nameInput = screen.getByRole("textbox", { name: /new todo name/i });

    expect(document.activeElement).toBe(nameInput);
    expect(screen.getByRole("switch", { name: /high priority/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /choose date and time/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^add$/i })).toBeTruthy();
  });

  it("keeps the date picker overlaid while the expanded row stays in place", () => {
    renderExpanded();

    expect(screen.queryByRole("button", { name: /december 25, 2026/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /choose date and time/i }));

    expect(screen.getByRole("button", { name: /december 25, 2026/i })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /new todo name/i })).toBeTruthy();
  });

  it("submits low priority by default when Enter is pressed", () => {
    const onCreate = vi.fn();
    render(React.createElement(AddTodoRow, { onCreate }));

    fireEvent.click(screen.getByRole("button", { name: /add a new todo/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /new todo name/i }), {
      target: { value: "Pay bills" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: /new todo name/i }), { key: "Enter" });

    expect(onCreate).toHaveBeenCalledWith({
      name: "Pay bills",
      priority: "low",
      due_date: null,
    });
  });

  it("submits high priority when the switch is turned on", () => {
    const onCreate = vi.fn();
    render(React.createElement(AddTodoRow, { onCreate }));

    fireEvent.click(screen.getByRole("button", { name: /add a new todo/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /new todo name/i }), {
      target: { value: "Handle outage" },
    });
    fireEvent.click(screen.getByRole("switch", { name: /high priority/i }));
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(onCreate).toHaveBeenCalledWith({
      name: "Handle outage",
      priority: "high",
      due_date: null,
    });
  });

  it("passes typed date and time through to onCreate as an ISO timestamp", () => {
    const onCreate = vi.fn();
    render(React.createElement(AddTodoRow, { onCreate }));

    fireEvent.click(screen.getByRole("button", { name: /add a new todo/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /new todo name/i }), {
      target: { value: "Doctor appointment" },
    });
    fireEvent.click(screen.getByRole("button", { name: /choose date and time/i }));
    fireEvent.change(screen.getByLabelText(/choose date and time date/i), {
      target: { value: "2026-12-25" },
    });
    fireEvent.change(screen.getByLabelText(/choose date and time time/i), {
      target: { value: "14:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(onCreate).toHaveBeenCalledWith({
      name: "Doctor appointment",
      priority: "low",
      due_date: new Date(2026, 11, 25, 14, 30).toISOString(),
    });
  });

  it("cancels with Escape and restores the single collapsed row", () => {
    renderExpanded();

    fireEvent.keyDown(screen.getByRole("textbox", { name: /new todo name/i }), { key: "Escape" });

    expect(screen.queryByRole("textbox", { name: /new todo name/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: /add a new todo/i })).toHaveLength(1);
  });
});

describe("AddTodoRow (compact state)", () => {
  it("keeps the collapsed add control keyboard-focusable with a 44px target", () => {
    const { container } = render(
      React.createElement(AddTodoRow, { compact: true, onCreate: noopCreate }),
    );
    const addControl = screen.getByRole("button", { name: /add a new todo/i });

    expect(addControl.className).toContain("min-h-[44px]");
    expect(addControl.className).toContain("px-2");
    expect(screen.getByText("Add a todo...").className).toContain("text-xs");
    expect(addControl.className).toContain("motion-reduce:transition-none");

    addControl.focus();
    expect(document.activeElement).toBe(addControl);
    fireEvent.click(addControl);
    expect(container.querySelector("input[aria-label='New todo name']")).toBeTruthy();
  });
});
