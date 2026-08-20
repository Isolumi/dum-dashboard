/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MoniesExpense, MoniesUser } from "./-monies.types";
import { ExpenseList } from "./-ExpenseList";

const users: MoniesUser[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Lumi" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Dum" },
];

function makeExpense(overrides: Partial<MoniesExpense> = {}): MoniesExpense {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    item: "Dinner with a long item description that must stay readable",
    amount: "42.50",
    owedAmount: "20.00",
    payer: users[0]!,
    debtor: users[1]!,
    purchaseDate: "2026-08-16T00:00:00.000Z",
    createdAt: "2026-08-16T00:01:00.000Z",
    updatedAt: "2026-08-16T00:01:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("ExpenseList", () => {
  it("shows the same owed-only entry facts in the desktop row and mobile card", () => {
    render(
      <ExpenseList
        expenses={[makeExpense()]}
        view="active"
        pendingIds={new Set()}
        onEdit={vi.fn()}
        onDelete={vi.fn(async () => true)}
        onRestore={vi.fn(async () => true)}
      />,
    );

    for (const testId of ["expense-desktop-list", "expense-mobile-list"]) {
      const layout = within(screen.getByTestId(testId));
      expect(layout.getByText(/Dinner with a long item description/)).toBeTruthy();
      expect(layout.getByText("Dum owes Lumi")).toBeTruthy();
      expect(layout.getByText("$20.00")).toBeTruthy();
      expect(layout.queryByText("$42.50")).toBeNull();
      expect(layout.getByText(/Aug 15, 2026/)).toBeTruthy();
      expect(layout.getByText(/8:00/)).toBeTruthy();
    }
  });

  it("uses owed-only desktop headings", () => {
    render(
      <ExpenseList
        expenses={[makeExpense()]}
        view="active"
        pendingIds={new Set()}
        onEdit={vi.fn()}
        onDelete={vi.fn(async () => true)}
        onRestore={vi.fn(async () => true)}
      />,
    );

    const desktop = within(screen.getByTestId("expense-desktop-list"));
    expect(desktop.getByRole("columnheader", { name: "Note" })).toBeTruthy();
    expect(desktop.getByRole("columnheader", { name: "Who owes who" })).toBeTruthy();
    expect(desktop.getByRole("columnheader", { name: "Amount" })).toBeTruthy();
    expect(desktop.getByRole("columnheader", { name: "Date" })).toBeTruthy();
    expect(desktop.queryByRole("columnheader", { name: "Total" })).toBeNull();
  });

  it("reserves enough desktop width for two 44px action controls", () => {
    render(
      <ExpenseList
        expenses={[makeExpense()]}
        view="active"
        pendingIds={new Set()}
        onEdit={vi.fn()}
        onDelete={vi.fn(async () => true)}
        onRestore={vi.fn(async () => true)}
      />,
    );

    const desktop = within(screen.getByTestId("expense-desktop-list"));
    const actions = desktop.getByRole("columnheader", { name: "Actions" });
    expect(actions.className).toContain("w-32");
    expect(actions.className).not.toContain("w-[10%]");
    expect(desktop.getByText(/Dinner with a long item description/).className).toContain(
      "break-words",
    );
  });

  it("uses one explicit confirmation before it deletes an expense", async () => {
    const onDelete = vi.fn(async () => true);
    const expense = makeExpense({ item: "Dinner" });
    render(
      <ExpenseList
        expenses={[expense]}
        view="active"
        pendingIds={new Set()}
        onEdit={vi.fn()}
        onDelete={onDelete}
        onRestore={vi.fn(async () => true)}
      />,
    );

    fireEvent.click(
      within(screen.getByTestId("expense-desktop-list")).getByRole("button", {
        name: "Delete Dinner",
      }),
    );

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Delete entry?" })).toBeTruthy();
    expect(screen.getByText("Move “Dinner” to Trash?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Move to Trash" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    expect(onDelete).toHaveBeenCalledWith(expense.id);
    expect(screen.queryByRole("dialog", { name: "Delete entry?" })).toBeNull();
  });

  it("uses a 44px close target for delete confirmation", () => {
    render(
      <ExpenseList
        expenses={[makeExpense({ item: "Dinner" })]}
        view="active"
        pendingIds={new Set()}
        onEdit={vi.fn()}
        onDelete={vi.fn(async () => true)}
        onRestore={vi.fn(async () => true)}
      />,
    );
    fireEvent.click(
      within(screen.getByTestId("expense-desktop-list")).getByRole("button", {
        name: "Delete Dinner",
      }),
    );

    expect(
      screen.getByRole("button", { name: "Close entry delete confirmation" }).className,
    ).toContain("size-11");
  });

  it("shows deleted time and Restore in Trash", () => {
    render(
      <ExpenseList
        expenses={[
          makeExpense({
            item: "Deleted dinner",
            deletedAt: "2026-08-16T00:05:00.000Z",
          }),
        ]}
        view="trash"
        pendingIds={new Set()}
        onEdit={vi.fn()}
        onDelete={vi.fn(async () => true)}
        onRestore={vi.fn(async () => true)}
      />,
    );

    const desktop = within(screen.getByTestId("expense-desktop-list"));
    expect(desktop.getByText("Deleted Aug 15, 2026, 8:05 p.m.")).toBeTruthy();
    expect(desktop.getByRole("button", { name: "Restore Deleted dinner" })).toBeTruthy();
    expect(desktop.queryByRole("button", { name: /edit/i })).toBeNull();
  });

  it("shows unavailable direction for a legacy entry without debtor data", () => {
    render(
      <ExpenseList
        expenses={[makeExpense({ debtor: null, owedAmount: null })]}
        view="active"
        pendingIds={new Set()}
        onEdit={vi.fn()}
        onDelete={vi.fn(async () => true)}
        onRestore={vi.fn(async () => true)}
      />,
    );

    const row = within(screen.getByTestId("expense-desktop-list")).getByRole("row", {
      name: /Dinner with a long item description/i,
    });
    expect(within(row).getByText("Direction unavailable")).toBeTruthy();
    expect(within(row).queryByText(/owes Lumi/)).toBeNull();
    expect(within(row).getAllByText("—")).toHaveLength(1);
    expect(
      within(row).getByRole("button", { name: /Edit Dinner with a long item description/i }),
    ).toBeTruthy();
  });
});
