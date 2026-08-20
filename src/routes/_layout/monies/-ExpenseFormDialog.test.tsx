/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CreateMoniesExpenseInput,
  MoniesExpense,
  MoniesUser,
  UpdateMoniesExpenseInput,
} from "./-monies.types";
import { ExpenseFormDialog } from "./-ExpenseFormDialog";

const users: MoniesUser[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Lumi" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Dum" },
];

const expense: MoniesExpense = {
  id: "33333333-3333-4333-8333-333333333333",
  item: "Dinner",
  amount: "42.50",
  owedAmount: "20.00",
  payer: users[0]!,
  debtor: users[1]!,
  purchaseDate: "2026-08-15T20:00:00.000-04:00",
  createdAt: "2026-08-16T00:01:00.000Z",
  updatedAt: "2026-08-16T00:01:00.000Z",
  deletedAt: null,
};

function renderDialog({
  editing = null,
  onSave = vi.fn(async () => true),
  onOpenChange = vi.fn(),
}: {
  editing?: MoniesExpense | null;
  onSave?: (input: CreateMoniesExpenseInput | UpdateMoniesExpenseInput) => Promise<boolean>;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  render(
    <ExpenseFormDialog
      open
      users={users}
      expense={editing}
      onSave={onSave}
      onOpenChange={onOpenChange}
    />,
  );
  return { onOpenChange, onSave };
}

function fillAddForm() {
  fireEvent.change(screen.getByRole("textbox", { name: "Note" }), {
    target: { value: "Groceries" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Amount owed (CAD)" }), {
    target: { value: "15" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Owed to" }), {
    target: { value: users[1]!.id },
  });
  fireEvent.change(screen.getByLabelText("Date and time (Toronto)"), {
    target: { value: "2026-08-15T18:30" },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ExpenseFormDialog", () => {
  it("offers both registered people as owed-to choices", () => {
    renderDialog();

    const owedTo = screen.getByRole("combobox", { name: "Owed to" });
    expect(within(owedTo).getByRole("option", { name: "Lumi" })).toBeTruthy();
    expect(within(owedTo).getByRole("option", { name: "Dum" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Full amount (CAD)" })).toBeNull();
  });

  it("normalizes the owed amount and creates one idempotency key for an add", async () => {
    const onSave = vi.fn(async () => true);
    const onOpenChange = vi.fn();
    const randomUUID = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue("44444444-4444-4444-8444-444444444444");
    renderDialog({ onSave, onOpenChange });
    fillAddForm();

    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith({
      item: "Groceries",
      owedAmount: "15.00",
      payerId: users[1]!.id,
      purchaseDate: "2026-08-15T18:30:00-04:00",
      idempotencyKey: "44444444-4444-4444-8444-444444444444",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("reuses the first idempotency key when a failed add is retried", async () => {
    const onSave = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const randomUUID = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue("44444444-4444-4444-8444-444444444444");
    renderDialog({ onSave });
    fillAddForm();

    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));

    expect(randomUUID).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      idempotencyKey: "44444444-4444-4444-8444-444444444444",
    });
    expect(onSave.mock.calls[1]?.[0]).toMatchObject({
      idempotencyKey: "44444444-4444-4444-8444-444444444444",
    });
  });

  it("rejects a Toronto local time in the spring DST gap", async () => {
    const onSave = vi.fn(async () => true);
    renderDialog({ onSave });
    fillAddForm();
    fireEvent.change(screen.getByLabelText("Date and time (Toronto)"), {
      target: { value: "2026-03-08T02:30" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));

    expect(await screen.findByText("Enter a Toronto purchase date and time.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("uses the earlier Toronto offset for a valid fall-back local time", async () => {
    const onSave = vi.fn(async () => true);
    renderDialog({ onSave });
    fillAddForm();
    fireEvent.change(screen.getByLabelText("Date and time (Toronto)"), {
      target: { value: "2026-11-01T01:30" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ purchaseDate: "2026-11-01T01:30:00-04:00" }),
    );
  });

  it("uses a 44px close target for the expense dialog", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "Close entry form" }).className).toContain("size-11");
  });

  it("keeps the record ID and does not create an idempotency key for an edit", async () => {
    const onSave = vi.fn(async () => true);
    const randomUUID = vi.spyOn(globalThis.crypto, "randomUUID");
    renderDialog({ editing: expense, onSave });
    fireEvent.change(screen.getByRole("textbox", { name: "Note" }), {
      target: { value: "Birthday dinner" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(randomUUID).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith({
      id: expense.id,
      item: "Birthday dinner",
      owedAmount: "20.00",
      payerId: users[0]!.id,
      purchaseDate: "2026-08-15T20:00:00-04:00",
    });
  });

  it("keeps the dialog and all entered values after a failed save", async () => {
    const onSave = vi.fn(async () => false);
    const onOpenChange = vi.fn();
    renderDialog({ onSave, onOpenChange });
    fillAddForm();

    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(screen.getByRole("dialog", { name: "Add entry" })).toBeTruthy();
    expect(
      screen.getByText("Could not save entry. Check your connection and try again."),
    ).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveProperty("value", "Groceries");
    expect(screen.getByRole("textbox", { name: "Amount owed (CAD)" })).toHaveProperty(
      "value",
      "15",
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("requires an owed amount when editing a legacy expense", async () => {
    const onSave = vi.fn(async () => true);
    renderDialog({
      editing: { ...expense, owedAmount: null, debtor: null },
      onSave,
    });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Enter the amount owed.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
});
