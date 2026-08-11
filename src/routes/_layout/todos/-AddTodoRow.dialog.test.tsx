/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AddTodoRow } from "./-AddTodoRow";

vi.mock("#/components/ui/calendar", () => ({
  Calendar: () => <div>Calendar</div>,
}));

afterEach(() => {
  cleanup();
});

function renderExpandedRow() {
  render(<AddTodoRow onCreate={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /add a new todo/i }));
}

describe("AddTodoRow with the Base UI date dialog", () => {
  it("uses the first Escape for the dialog and restores focus before a later Escape closes the form", async () => {
    renderExpandedRow();

    const dateTrigger = screen.getByRole("button", { name: /choose date and time/i });
    dateTrigger.focus();
    fireEvent.click(dateTrigger);
    fireEvent.keyDown(screen.getByLabelText(/choose date and time date/i), { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /choose date and time/i })).toBeNull();
    });
    expect(screen.getByRole("textbox", { name: /new todo name/i })).toBeTruthy();
    expect(document.activeElement).toBe(dateTrigger);

    fireEvent.keyDown(dateTrigger, { key: "Escape" });

    expect(screen.queryByRole("textbox", { name: /new todo name/i })).toBeNull();
    expect(screen.getByRole("button", { name: /add a new todo/i })).toBeTruthy();
  });

  it("lets the Base UI backdrop close only the dialog and restore trigger focus", async () => {
    renderExpandedRow();

    const dateTrigger = screen.getByRole("button", { name: /choose date and time/i });
    dateTrigger.focus();
    fireEvent.click(dateTrigger);
    const dialog = screen.getByRole("dialog", { name: /choose date and time/i });
    const backdrop = dialog.parentElement?.querySelector<HTMLElement>(
      "[role='presentation'][data-open]",
    );

    expect(backdrop).toBeInstanceOf(HTMLElement);
    fireEvent.click(backdrop!);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /choose date and time/i })).toBeNull();
    });
    expect(screen.getByRole("textbox", { name: /new todo name/i })).toBeTruthy();
    expect(document.activeElement).toBe(dateTrigger);
  });
});
