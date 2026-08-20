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
const SAVE_ERROR = "Could not save entry. Check your connection and try again.";

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
  const zonedValue = `${year}-${month}-${day}T${hour}:${minute}:00${sign}${offsetHour}:${offsetMinute}`;
  if (toTorontoInputValue(zonedValue) !== value) return null;
  return zonedValue;
}

function normalizeMoney(value: string): string | null {
  const trimmed = value.trim();
  if (!MONEY_PATTERN.test(trimmed)) return null;
  const [whole = "", fraction = ""] = trimmed.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  const normalized = `${normalizedWhole}.${fraction.padEnd(2, "0")}`;
  return normalized === "0.00" ? null : normalized;
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
    const normalizedOwedAmount = normalizeMoney(owedAmount);
    const normalizedPurchaseDate = fromTorontoInputValue(purchaseDate);

    if (!normalizedItem) nextErrors.item = "Enter an item.";
    else if (normalizedItem.length > 200) nextErrors.item = "Use 200 characters or fewer.";
    if (!normalizedOwedAmount) nextErrors.owedAmount = "Enter the amount owed.";
    if (!users.some((user) => user.id === payerId)) nextErrors.payerId = "Select who is owed.";
    if (!normalizedPurchaseDate) {
      nextErrors.purchaseDate = "Enter a Toronto purchase date and time.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitError(null);

    const sharedInput = {
      item: normalizedItem,
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

  const title = expense ? "Edit entry" : "Add entry";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" closeLabel="Close entry form" closeButtonSize="touch">
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
              Note
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

          <div className="space-y-1.5">
            <label htmlFor="expense-payer" className="text-sm font-medium">
              Owed to
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
              Date and time (Toronto)
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
              {saving ? "Saving…" : expense ? "Save changes" : "Add entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
