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

  it("renders the date field as a Calendar popover trigger button", () => {
    renderExpanded();
    const dateTrigger = screen.getByRole("button", { name: /select due date/i });
    expect(dateTrigger).toBeTruthy();
    expect(screen.getByText("Date")).toBeTruthy();
  });

  it("opens the date picker from its trigger before a date can be selected", () => {
    renderExpanded();

    expect(screen.queryByRole("button", { name: /december 25, 2026/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /select due date/i }));
    fireEvent.click(screen.getByRole("button", { name: /december 25, 2026/i }));

    expect(screen.queryByRole("button", { name: /december 25, 2026/i })).toBeNull();
    expect(screen.getByRole("button", { name: /select due date/i }).textContent).toContain(
      "Dec 25",
    );
  });

  it("date trigger button has shrink-0 class for fixed width", () => {
    renderExpanded();
    const dateTrigger = screen.getByRole("button", { name: /select due date/i });
    expect(dateTrigger.className).toContain("shrink-0");
  });

  it("shows keyboard hint containing 'Esc to cancel' when expanded", () => {
    renderExpanded();
    expect(screen.getByText(/esc to cancel/i)).toBeTruthy();
  });

  it("opens the priority selector and offers only High and Low", () => {
    renderExpanded();

    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /select priority/i }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "High",
      "Low",
    ]);
    fireEvent.click(screen.getByRole("option", { name: "Low" }));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: /select priority/i }).textContent).toContain("Low");
  });

  it("keeps the priority trigger at least 44px wide", () => {
    renderExpanded();

    expect(screen.getByRole("button", { name: /select priority/i }).className).toContain(
      "min-w-11",
    );
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
