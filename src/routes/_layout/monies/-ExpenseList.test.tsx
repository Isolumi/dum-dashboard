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
  it("shows the same expense facts in the desktop row and mobile card", () => {
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
      expect(layout.getByText("Lumi")).toBeTruthy();
      expect(layout.getByText("Dum")).toBeTruthy();
      expect(layout.getByText("$42.50")).toBeTruthy();
      expect(layout.getByText("$20.00")).toBeTruthy();
      expect(layout.getByText(/Aug 15, 2026/)).toBeTruthy();
      expect(layout.getByText(/8:00/)).toBeTruthy();
    }
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
    expect(screen.getByRole("dialog", { name: "Delete expense?" })).toBeTruthy();
    expect(screen.getByText("Move “Dinner” to Trash?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Move to Trash" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    expect(onDelete).toHaveBeenCalledWith(expense.id);
    expect(screen.queryByRole("dialog", { name: "Delete expense?" })).toBeNull();
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

  it("uses em dashes for a legacy expense without debtor or owed data", () => {
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
    expect(within(row).getAllByText("—")).toHaveLength(2);
    expect(
      within(row).getByRole("button", { name: /Edit Dinner with a long item description/i }),
    ).toBeTruthy();
  });
});
