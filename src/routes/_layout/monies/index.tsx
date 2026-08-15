import { useState } from "react";
import { Plus } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import type {
  CreateMoniesExpenseInput,
  MoniesExpense,
  UpdateMoniesExpenseInput,
} from "./-monies.types";
import { ExpenseFormDialog } from "./-ExpenseFormDialog";
import { ExpenseList } from "./-ExpenseList";
import { useMoniesController } from "./-useMoniesController";

export const Route = createFileRoute("/_layout/monies/")({
  component: MoniesPage,
});

function LoadingExpenses() {
  return (
    <div className="space-y-2" aria-label="Loading expenses" aria-live="polite">
      <Skeleton className="h-11 w-full motion-reduce:animate-none" />
      <Skeleton className="h-16 w-full motion-reduce:animate-none" />
      <Skeleton className="h-16 w-full motion-reduce:animate-none" />
      <p className="sr-only">Loading expenses…</p>
    </div>
  );
}

function MoniesPage() {
  const controller = useMoniesController();
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MoniesExpense | null>(null);

  function openAddForm() {
    setEditingExpense(null);
    setFormOpen(true);
  }

  function openEditForm(expense: MoniesExpense) {
    setEditingExpense(expense);
    setFormOpen(true);
  }

  async function saveExpense(
    input: CreateMoniesExpenseInput | UpdateMoniesExpenseInput,
  ): Promise<boolean> {
    return "id" in input ? controller.update(input) : controller.create(input);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Monies</h1>
          <p className="mt-1 text-sm text-muted-foreground">Private two-person expense ledger.</p>
        </div>
        <Button type="button" className="min-h-11 px-3" onClick={openAddForm}>
          <Plus data-icon="inline-start" />
          Add expense
        </Button>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 border-b border-border">
        <nav className="flex" aria-label="Expense views">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 rounded-b-none border-b-2 border-transparent px-3 aria-pressed:border-primary aria-pressed:text-foreground"
            aria-pressed={controller.view === "active"}
            onClick={() => controller.setView("active")}
          >
            Active
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 rounded-b-none border-b-2 border-transparent px-3 aria-pressed:border-primary aria-pressed:text-foreground"
            aria-pressed={controller.view === "trash"}
            onClick={() => controller.setView("trash")}
          >
            Trash
          </Button>
        </nav>
        <p className="pb-3 text-xs text-muted-foreground">Amounts in CAD</p>
      </div>

      <div className="mt-4 space-y-4">
        {controller.mutationError ? (
          <Alert variant="destructive" aria-live="assertive">
            <AlertTitle>Expense action failed</AlertTitle>
            <AlertDescription>{controller.mutationError}</AlertDescription>
          </Alert>
        ) : null}

        {controller.status === "loading" ? <LoadingExpenses /> : null}

        {controller.status === "error" ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load expenses</AlertTitle>
            <AlertDescription>
              <p>{controller.loadError}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 min-h-11"
                onClick={() => void controller.retry()}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {controller.status === "ready" ? (
          <ExpenseList
            expenses={controller.expenses}
            view={controller.view}
            pendingIds={controller.pendingIds}
            onEdit={openEditForm}
            onDelete={controller.remove}
            onRestore={controller.restore}
          />
        ) : null}

        {controller.status === "ready" && controller.totalPages > 1 ? (
          <nav className="flex items-center justify-end gap-3" aria-label="Expense pages">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={controller.previousPage}
              disabled={controller.page <= 1}
              aria-label="Previous expense page"
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              Page {controller.page} of {controller.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={controller.nextPage}
              disabled={controller.page >= controller.totalPages}
              aria-label="Next expense page"
            >
              Next
            </Button>
          </nav>
        ) : null}
      </div>

      <ExpenseFormDialog
        open={formOpen}
        users={controller.users}
        expense={editingExpense}
        onOpenChange={setFormOpen}
        onSave={saveExpense}
      />
    </main>
  );
}
