import { useState } from "react";
import { ArrowRight, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";
import type { MoniesExpense } from "./-monies.types";
import type { MoniesView } from "./-useMoniesController";

interface ExpenseListProps {
  expenses: MoniesExpense[];
  view: MoniesView;
  pendingIds: ReadonlySet<string>;
  onEdit(expense: MoniesExpense): void;
  onDelete(id: string): Promise<boolean>;
  onRestore(id: string): Promise<boolean>;
}

const currencyFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

function formatCurrency(value: string | null): string {
  return value === null ? "—" : currencyFormatter.format(Number(value));
}

function formatTorontoDate(value: string): string {
  return dateTimeFormatter
    .format(new Date(value))
    .replace(" at ", ", ")
    .replace(/\bAM\b/, "a.m.")
    .replace(/\bPM\b/, "p.m.");
}

function Relationship({ expense }: { expense: MoniesExpense }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="truncate font-medium">{expense.payer.name}</span>
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{expense.debtor?.name ?? "—"}</span>
    </span>
  );
}

function DesktopExpenseList({
  expenses,
  view,
  pendingIds,
  onEdit,
  onDeleteRequest,
  onRestore,
}: Omit<ExpenseListProps, "onDelete"> & { onDeleteRequest(expense: MoniesExpense): void }) {
  return (
    <div
      className="hidden overflow-hidden rounded-xl border border-border md:block"
      data-testid="expense-desktop-list"
    >
      <table className="w-full table-fixed text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="w-[28%] px-4 py-3 font-medium">
              Item
            </th>
            <th scope="col" className="w-[22%] px-3 py-3 font-medium">
              Payer → debtor
            </th>
            <th scope="col" className="w-[11%] px-3 py-3 text-right font-medium">
              Total
            </th>
            <th scope="col" className="w-[11%] px-3 py-3 text-right font-medium">
              Owed
            </th>
            <th scope="col" className="w-[18%] px-3 py-3 font-medium">
              {view === "trash" ? "Deleted" : "Purchased"}
            </th>
            <th scope="col" className="w-32 px-3 py-3 text-right font-medium">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {expenses.map((expense) => {
            const pending = pendingIds.has(expense.id);
            return (
              <tr key={expense.id} className="align-middle transition-colors hover:bg-muted/20">
                <td className="px-4 py-3">
                  <span className="block min-w-0 break-words font-medium">{expense.item}</span>
                </td>
                <td className="min-w-0 px-3 py-3">
                  <Relationship expense={expense} />
                </td>
                <td className="px-3 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                  {formatCurrency(expense.amount)}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                  {formatCurrency(expense.owedAmount)}
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  {view === "trash" && expense.deletedAt
                    ? `Deleted ${formatTorontoDate(expense.deletedAt)}`
                    : formatTorontoDate(expense.purchaseDate)}
                </td>
                <td className="w-32 px-3 py-2">
                  <div className="flex justify-end gap-1">
                    {view === "active" ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11"
                          onClick={() => onEdit(expense)}
                          disabled={pending}
                          aria-label={`Edit ${expense.item}`}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 text-muted-foreground hover:text-destructive"
                          onClick={() => onDeleteRequest(expense)}
                          disabled={pending}
                          aria-label={`Delete ${expense.item}`}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => void onRestore(expense.id)}
                        disabled={pending}
                        aria-label={`Restore ${expense.item}`}
                      >
                        <RotateCcw data-icon="inline-start" />
                        Restore
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MobileExpenseList({
  expenses,
  view,
  pendingIds,
  onEdit,
  onDeleteRequest,
  onRestore,
}: Omit<ExpenseListProps, "onDelete"> & { onDeleteRequest(expense: MoniesExpense): void }) {
  return (
    <ul className="space-y-3 md:hidden" data-testid="expense-mobile-list">
      {expenses.map((expense) => {
        const pending = pendingIds.has(expense.id);
        return (
          <li key={expense.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <p className="min-w-0 flex-1 break-words font-medium">{expense.item}</p>
              <div className="flex shrink-0 gap-1">
                {view === "active" ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      onClick={() => onEdit(expense)}
                      disabled={pending}
                      aria-label={`Edit ${expense.item}`}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 text-muted-foreground hover:text-destructive"
                      onClick={() => onDeleteRequest(expense)}
                      disabled={pending}
                      aria-label={`Delete ${expense.item}`}
                    >
                      <Trash2 />
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => void onRestore(expense.id)}
                    disabled={pending}
                    aria-label={`Restore ${expense.item}`}
                  >
                    <RotateCcw data-icon="inline-start" />
                    Restore
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-3 border-y border-border py-3">
              <Relationship expense={expense} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Total</dt>
                <dd className="mt-0.5 font-medium whitespace-nowrap tabular-nums">
                  {formatCurrency(expense.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Owed</dt>
                <dd className="mt-0.5 whitespace-nowrap tabular-nums">
                  {formatCurrency(expense.owedAmount)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">
                  {view === "trash" ? "Deleted" : "Purchased"}
                </dt>
                <dd className="mt-0.5 text-muted-foreground">
                  {view === "trash" && expense.deletedAt
                    ? `Deleted ${formatTorontoDate(expense.deletedAt)}`
                    : formatTorontoDate(expense.purchaseDate)}
                </dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

export function ExpenseList({
  expenses,
  view,
  pendingIds,
  onEdit,
  onDelete,
  onRestore,
}: ExpenseListProps) {
  const [deleteTarget, setDeleteTarget] = useState<MoniesExpense | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (expenses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <p className="font-medium">{view === "active" ? "No active expenses" : "Trash is empty"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {view === "active"
            ? "Add an expense to start this ledger."
            : "Deleted expenses will stay here for up to 30 days."}
        </p>
      </div>
    );
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const sharedProps = {
    expenses,
    view,
    pendingIds,
    onEdit,
    onDeleteRequest: setDeleteTarget,
    onRestore,
  };

  return (
    <>
      <DesktopExpenseList {...sharedProps} />
      <MobileExpenseList {...sharedProps} />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent closeLabel="Close delete confirmation" closeButtonSize="touch">
          <div className="space-y-2 px-5 py-5 pr-12">
            <DialogTitle>Delete expense?</DialogTitle>
            <p className="break-words text-sm text-muted-foreground">
              Move “{deleteTarget?.item}” to Trash?
            </p>
            <p className="text-sm text-muted-foreground">
              You can restore it from Trash for up to 30 days.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 px-4"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 px-4"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? "Moving…" : "Move to Trash"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
