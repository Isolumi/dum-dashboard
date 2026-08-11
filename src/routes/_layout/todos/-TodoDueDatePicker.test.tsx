/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

let dialogContentKeyDownHandler: React.KeyboardEventHandler<HTMLDivElement> | undefined;

afterEach(() => {
  cleanup();
  dialogContentKeyDownHandler = undefined;
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
      return context?.open ? (
        <div role="dialog" {...props}>
          {children}
        </div>
      ) : null;
    },
    PopoverTitle: ({ children, ...props }: React.ComponentProps<"h2">) => (
      <h2 {...props}>{children}</h2>
    ),
  };
});

vi.mock("#/components/ui/dialog", () => {
  const DialogContext = React.createContext<{
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  } | null>(null);

  return {
    Dialog: ({
      open = false,
      onOpenChange,
      children,
    }: {
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
      children: React.ReactNode;
    }) => (
      <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
    ),
    DialogTrigger: ({
      render: trigger,
      children,
    }: {
      render: React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>;
      children: React.ReactNode;
    }) => {
      const context = React.useContext(DialogContext);
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
    DialogContent: ({
      children,
      closeLabel = "Close",
      onKeyDown,
      ...props
    }: React.ComponentProps<"div"> & { closeLabel?: string }) => {
      const context = React.useContext(DialogContext);
      dialogContentKeyDownHandler = onKeyDown;
      return context?.open ? (
        <div role="dialog" onKeyDown={onKeyDown} {...props}>
          {children}
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => context.onOpenChange?.(false)}
          >
            Close
          </button>
        </div>
      ) : null;
    },
    DialogTitle: ({ children, ...props }: React.ComponentProps<"h2">) => (
      <h2 {...props}>{children}</h2>
    ),
    DialogClose: ({ children, ...props }: React.ComponentProps<"button">) => {
      const context = React.useContext(DialogContext);
      return (
        <button type="button" {...props} onClick={() => context?.onOpenChange?.(false)}>
          {children}
        </button>
      );
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
  it("uses an anchored popover by default", () => {
    render(<TodoDueDatePicker value={null} onChange={vi.fn()} label="Edit due date" />);

    fireEvent.click(screen.getByRole("button", { name: "Edit due date" }));

    expect(screen.getByTestId("due-date-popover")).toBeTruthy();
    expect(screen.queryByTestId("due-date-dialog")).toBeNull();
  });

  it("uses a centered dialog when requested", () => {
    render(
      <TodoDueDatePicker
        value={null}
        onChange={vi.fn()}
        label="Choose date and time"
        presentation="dialog"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose date and time" }));

    expect(screen.getByTestId("due-date-dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: /close date and time picker/i })).toBeTruthy();
    expect(screen.queryByTestId("due-date-popover")).toBeNull();
  });

  it("delegates Escape dismissal to the Dialog wrapper", () => {
    render(
      <TodoDueDatePicker
        value={null}
        onChange={vi.fn()}
        label="Choose date and time"
        presentation="dialog"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose date and time" }));

    expect(dialogContentKeyDownHandler).toBeUndefined();
  });

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

    expect(screen.getByRole("dialog", { name: /edit due date for "deploy app"/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /edit due date for "deploy app"/i })).toBeTruthy();
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
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 7, 9, 9, 0).toISOString(), true);

    fireEvent.change(timeInput, { target: { value: "15:30" } });
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 7, 9, 15, 30).toISOString(), true);
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

    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 11, 25, 15, 30).toISOString(), true);

    fireEvent.click(screen.getByRole("button", { name: /clear due date/i }));
    expect(onChange).toHaveBeenLastCalledWith(null, false);
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

  it("keeps the calendar icon visible when the value is intentionally compact", () => {
    render(
      <TodoDueDatePicker
        value="2026-08-09T19:30:00.000Z"
        hasTime
        showValue={false}
        onChange={vi.fn()}
        label={'Edit due date for "Deploy app"'}
      />,
    );

    const trigger = screen.getByRole("button", { name: /edit due date for "deploy app"/i });
    expect(trigger.textContent?.trim()).toBe("");
    expect(trigger.querySelector("svg")?.className.baseVal).not.toContain("opacity-0");
  });

  it("keeps a selected value inside the trigger overflow contract", () => {
    render(
      <TodoDueDatePicker
        value="2026-08-09T19:30:00.000Z"
        hasTime
        onChange={vi.fn()}
        label={'Edit due date for "Deploy app"'}
      />,
    );

    const trigger = screen.getByRole("button", { name: /edit due date for "deploy app"/i });
    const value = trigger.querySelector("span");

    expect(trigger.className).toContain("overflow-hidden");
    expect(value?.className).toContain("min-w-0");
    expect(value?.className).toContain("truncate");
  });

  it("loads migrated date-only timestamps as date-only inputs", () => {
    render(
      <TodoDueDatePicker
        value="2026-08-09T00:00:00.000Z"
        hasTime={false}
        onChange={vi.fn()}
        label={'Edit due date for "Deploy app"'}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /edit due date for "deploy app"/i }));

    expect(
      (screen.getByLabelText(/edit due date for "deploy app" date/i) as HTMLInputElement).value,
    ).toBe("2026-08-09");
    expect(
      (screen.getByLabelText(/edit due date for "deploy app" time/i) as HTMLInputElement).value,
    ).toBe("");
  });
});
