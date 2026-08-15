import { useEffect, useRef, useState } from "react";

import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import type {
  CreateMoniesExpenseInput,
  MoniesExpense,
  MoniesUser,
  UpdateMoniesExpenseInput,
} from "./-monies.types";

const TORONTO_TIME_ZONE = "America/Toronto";
const MONEY_PATTERN = /^\d{1,10}(?:\.\d{0,2})?$/;
const SAVE_ERROR = "Could not save expense. Check your connection and try again.";

type ExpenseSaveInput = CreateMoniesExpenseInput | UpdateMoniesExpenseInput;

interface ExpenseFormDialogProps {
  open: boolean;
  users: MoniesUser[];
  expense: MoniesExpense | null;
  onOpenChange(open: boolean): void;
  onSave(input: ExpenseSaveInput): Promise<boolean>;
}

interface FormErrors {
  item?: string;
  amount?: string;
  owedAmount?: string;
  payerId?: string;
  purchaseDate?: string;
}

const torontoPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TORONTO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function dateParts(date: Date): Record<string, string> {
  return Object.fromEntries(
    torontoPartsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function toTorontoInputValue(value: string): string {
  const parts = dateParts(new Date(value));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function torontoOffsetMinutes(utcMilliseconds: number): number {
  const parts = dateParts(new Date(utcMilliseconds));
  const torontoAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
  return Math.round((torontoAsUtc - utcMilliseconds) / 60_000);
}

function fromTorontoInputValue(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  let offsetMinutes = torontoOffsetMinutes(localAsUtc);
  const actualUtc = localAsUtc - offsetMinutes * 60_000;
  offsetMinutes = torontoOffsetMinutes(actualUtc);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHour = String(Math.floor(absoluteOffset / 60)).padStart(2, "0");
  const offsetMinute = String(absoluteOffset % 60).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:00${sign}${offsetHour}:${offsetMinute}`;
}

function normalizeMoney(value: string): string | null {
  const trimmed = value.trim();
  if (!MONEY_PATTERN.test(trimmed)) return null;
  const [whole = "", fraction = ""] = trimmed.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  const normalized = `${normalizedWhole}.${fraction.padEnd(2, "0")}`;
  return normalized === "0.00" ? null : normalized;
}

function moneyToCents(value: string): bigint {
  const [whole = "0", fraction = "00"] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction);
}

function initialDateValue(expense: MoniesExpense | null): string {
  return toTorontoInputValue(expense?.purchaseDate ?? new Date().toISOString());
}

export function ExpenseFormDialog({
  open,
  users,
  expense,
  onOpenChange,
  onSave,
}: ExpenseFormDialogProps) {
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [owedAmount, setOwedAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const expenseId = expense?.id;

  useEffect(() => {
    if (!open) return;
    setItem(expense?.item ?? "");
    setAmount(expense?.amount ?? "");
    setOwedAmount(expense?.owedAmount ?? "");
    setPayerId(expense?.payer.id ?? users[0]?.id ?? "");
    setPurchaseDate(initialDateValue(expense));
    setErrors({});
    setSubmitError(null);
    setSaving(false);
    idempotencyKeyRef.current = null;
  }, [expenseId, open, users, expense]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const nextErrors: FormErrors = {};
    const normalizedItem = item.trim();
    const normalizedAmount = normalizeMoney(amount);
    const normalizedOwedAmount = normalizeMoney(owedAmount);
    const normalizedPurchaseDate = fromTorontoInputValue(purchaseDate);

    if (!normalizedItem) nextErrors.item = "Enter an item.";
    else if (normalizedItem.length > 200) nextErrors.item = "Use 200 characters or fewer.";
    if (!normalizedAmount) nextErrors.amount = "Enter a valid full amount greater than zero.";
    if (!normalizedOwedAmount) nextErrors.owedAmount = "Enter the amount owed.";
    if (
      normalizedAmount &&
      normalizedOwedAmount &&
      moneyToCents(normalizedOwedAmount) > moneyToCents(normalizedAmount)
    ) {
      nextErrors.owedAmount = "Owed amount cannot exceed the full amount.";
    }
    if (!users.some((user) => user.id === payerId)) nextErrors.payerId = "Select a payer.";
    if (!normalizedPurchaseDate) {
      nextErrors.purchaseDate = "Enter a Toronto purchase date and time.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitError(null);

    const sharedInput = {
      item: normalizedItem,
      amount: normalizedAmount!,
      owedAmount: normalizedOwedAmount!,
      payerId,
      purchaseDate: normalizedPurchaseDate!,
    };
    const input: ExpenseSaveInput = expense
      ? { id: expense.id, ...sharedInput }
      : {
          ...sharedInput,
          idempotencyKey:
            idempotencyKeyRef.current ??
            (idempotencyKeyRef.current = globalThis.crypto.randomUUID()),
        };

    setSaving(true);
    let saved = false;
    try {
      saved = await onSave(input);
    } catch {
      saved = false;
    } finally {
      setSaving(false);
    }
    if (saved) onOpenChange(false);
    else setSubmitError(SAVE_ERROR);
  }

  const title = expense ? "Edit expense" : "Add expense";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" closeLabel="Close expense form">
        <div className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">Amounts are in Canadian dollars.</p>
        </div>

        <form className="space-y-4 p-5" onSubmit={handleSubmit} noValidate>
          {submitError ? (
            <p
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
              aria-live="assertive"
            >
              {submitError}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="expense-item" className="text-sm font-medium">
              Item
            </label>
            <Input
              id="expense-item"
              className="h-11"
              value={item}
              onChange={(event) => setItem(event.target.value)}
              maxLength={200}
              autoFocus
              aria-invalid={Boolean(errors.item)}
              aria-describedby={errors.item ? "expense-item-error" : undefined}
            />
            {errors.item ? (
              <p id="expense-item-error" className="text-sm text-destructive">
                {errors.item}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="expense-amount" className="text-sm font-medium">
                Full amount (CAD)
              </label>
              <Input
                id="expense-amount"
                className="h-11 tabular-nums"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? "expense-amount-error" : undefined}
              />
              {errors.amount ? (
                <p id="expense-amount-error" className="text-sm text-destructive">
                  {errors.amount}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="expense-owed" className="text-sm font-medium">
                Amount owed (CAD)
              </label>
              <Input
                id="expense-owed"
                className="h-11 tabular-nums"
                value={owedAmount}
                onChange={(event) => setOwedAmount(event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={Boolean(errors.owedAmount)}
                aria-describedby={errors.owedAmount ? "expense-owed-error" : undefined}
              />
              {errors.owedAmount ? (
                <p id="expense-owed-error" className="text-sm text-destructive">
                  {errors.owedAmount}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="expense-payer" className="text-sm font-medium">
              Payer
            </label>
            <select
              id="expense-payer"
              className="h-11 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              value={payerId}
              onChange={(event) => setPayerId(event.target.value)}
              aria-invalid={Boolean(errors.payerId)}
              aria-describedby={errors.payerId ? "expense-payer-error" : undefined}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            {errors.payerId ? (
              <p id="expense-payer-error" className="text-sm text-destructive">
                {errors.payerId}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="expense-purchase-date" className="text-sm font-medium">
              Purchase date and time (Toronto)
            </label>
            <Input
              id="expense-purchase-date"
              type="datetime-local"
              className="h-11"
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
              aria-invalid={Boolean(errors.purchaseDate)}
              aria-describedby={errors.purchaseDate ? "expense-purchase-date-error" : undefined}
            />
            {errors.purchaseDate ? (
              <p id="expense-purchase-date-error" className="text-sm text-destructive">
                {errors.purchaseDate}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 px-4"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-11 px-4" disabled={saving}>
              {saving ? "Saving…" : expense ? "Save changes" : "Add expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
