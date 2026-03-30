/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
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
  }) => (
    <span data-testid="popover-trigger">
      {renderProp}
      <span>{children}</span>
    </span>
  ),
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

  it("renders the date field using shadcn Input (not raw browser date picker)", () => {
    const container = renderExpanded();
    const dateInput = container.querySelector('input[type="date"]');
    expect(dateInput).toBeTruthy();
    // shadcn Input uses focus-visible:ring-ring/50 class
    expect(dateInput?.className).toContain("focus-visible:ring-ring/50");
    // Raw date input had w-36 - must NOT be present after fix
    expect(dateInput?.className).not.toContain("w-36");
  });

  it("wraps date input in a w-24 shrink-0 div matching TodoRow date column", () => {
    const container = renderExpanded();
    const dateInput = container.querySelector('input[type="date"]');
    const dateWrapper = dateInput?.parentElement;
    expect(dateWrapper?.className).toContain("w-24");
    expect(dateWrapper?.className).toContain("shrink-0");
  });

  it("shows keyboard hint containing 'Enter to save' when expanded", () => {
    renderExpanded();
    expect(screen.getByText(/enter to save/i)).toBeTruthy();
  });

  it("shows keyboard hint containing 'Esc to cancel' when expanded", () => {
    renderExpanded();
    expect(screen.getByText(/esc to cancel/i)).toBeTruthy();
  });
});
