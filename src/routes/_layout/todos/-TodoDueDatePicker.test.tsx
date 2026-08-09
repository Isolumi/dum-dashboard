/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    <button type="button" onClick={() => onSelect(new Date(2026, 11, 25))}>
      December 25, 2026
    </button>
  ),
}));

const { TodoDueDatePicker } = await import("./-TodoDueDatePicker");

describe("TodoDueDatePicker", () => {
  it("keeps the empty trigger icon-only and exposes accessible native inputs", () => {
    render(
      <TodoDueDatePicker
        value={null}
        onChange={vi.fn()}
        label={'Edit due date for "Deploy app"'}
      />,
    );

    const trigger = screen.getByRole("button", { name: /edit due date for "deploy app"/i });
    expect(trigger.textContent?.trim()).toBe("");
    expect(trigger.querySelector("svg")).toBeTruthy();

    fireEvent.click(trigger);

    const dateInput = screen.getByLabelText(/edit due date for "deploy app" date/i);
    const timeInput = screen.getByLabelText(/edit due date for "deploy app" time/i);
    expect((dateInput as HTMLInputElement).type).toBe("date");
    expect((timeInput as HTMLInputElement).type).toBe("time");
  });

  it("serializes typed local date and time changes as ISO timestamps", () => {
    const onChange = vi.fn();
    render(
      <TodoDueDatePicker
        value={null}
        onChange={onChange}
        label={'Edit due date for "Deploy app"'}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /edit due date for "deploy app"/i }));

    const dateInput = screen.getByLabelText(/edit due date for "deploy app" date/i);
    const timeInput = screen.getByLabelText(/edit due date for "deploy app" time/i);

    fireEvent.change(dateInput, { target: { value: "2026-08-09" } });
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 7, 9, 9, 0).toISOString());

    fireEvent.change(timeInput, { target: { value: "15:30" } });
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 7, 9, 15, 30).toISOString());
  });

  it("preserves the existing time for calendar picks and supports clearing", () => {
    const onChange = vi.fn();
    render(
      <TodoDueDatePicker
        value={new Date(2026, 7, 9, 15, 30).toISOString()}
        onChange={onChange}
        label={'Edit due date for "Deploy app"'}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /edit due date for "deploy app"/i }));
    fireEvent.click(screen.getByRole("button", { name: /december 25, 2026/i }));

    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 11, 25, 15, 30).toISOString());

    fireEvent.click(screen.getByRole("button", { name: /clear due date/i }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("closes the popover on Escape", () => {
    render(
      <TodoDueDatePicker
        value={null}
        onChange={vi.fn()}
        label={'Edit due date for "Deploy app"'}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /edit due date for "deploy app"/i }));
    const dateInput = screen.getByLabelText(/edit due date for "deploy app" date/i);
    fireEvent.keyDown(dateInput, { key: "Escape" });

    expect(screen.queryByLabelText(/edit due date for "deploy app" date/i)).toBeNull();
  });
});
