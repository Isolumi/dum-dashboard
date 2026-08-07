/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import React from "react";

afterEach(() => {
  cleanup();
});

// Mock the Popover components since they use portals/DOM features
vi.mock("#/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <React.Fragment>{children}</React.Fragment>
  ),
  PopoverTrigger: ({
    render: renderProp,
    children,
  }: {
    render?: React.ReactElement;
    children?: React.ReactNode;
  }) => React.cloneElement(renderProp!, undefined, children),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
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

  it("date trigger button has shrink-0 class for fixed width", () => {
    renderExpanded();
    const dateTrigger = screen.getByRole("button", { name: /select due date/i });
    expect(dateTrigger.className).toContain("shrink-0");
  });

  it("shows keyboard hint containing 'Esc to cancel' when expanded", () => {
    renderExpanded();
    expect(screen.getByText(/esc to cancel/i)).toBeTruthy();
  });

  it("offers only High and Low priorities in the selector", () => {
    renderExpanded();

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "High",
      "Low",
    ]);
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
