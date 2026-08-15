import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Skeleton } from "#/components/ui/skeleton";
import { getMoniesExpenses } from "#/routes/monies/monies.functions";
import type { ToolEntry } from "#/tools/registry";
import type { MoniesExpense } from "./-monies.types";

const REFRESH_INTERVAL_MS = 10_000;
const MAX_EXPENSES = 3;

const currencyFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

type BentoStatus = "loading" | "ready" | "error";

function formatCurrency(value: string | null): string {
  return value === null ? "—" : currencyFormatter.format(Number(value));
}

export function MoniesBentoCard({ tool: _tool, data: _data }: { tool: ToolEntry; data: unknown }) {
  const [expenses, setExpenses] = useState<MoniesExpense[]>([]);
  const [status, setStatus] = useState<BentoStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    async function loadExpenses() {
      try {
        const page = await getMoniesExpenses({ data: { page: 1, pageSize: MAX_EXPENSES } });
        if (cancelled) return;
        setExpenses(page.items.slice(0, MAX_EXPENSES));
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    function stopRefresh() {
      if (intervalId === undefined) return;
      clearInterval(intervalId);
      intervalId = undefined;
    }

    function startRefresh() {
      if (document.visibilityState !== "visible" || intervalId !== undefined) return;
      intervalId = setInterval(() => void loadExpenses(), REFRESH_INTERVAL_MS);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") startRefresh();
      else stopRefresh();
    }

    void loadExpenses();
    startRefresh();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      stopRefresh();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <Link
      to="/monies"
      aria-label="Open Monies tool"
      className="block rounded-lg border border-border bg-card transition-colors duration-150 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
    >
      <div className="p-4">
        {status === "loading" ? (
          <div role="status" aria-label="Loading Monies expenses" className="flex flex-col gap-2">
            <span className="sr-only">Loading Monies expenses</span>
            {Array.from({ length: MAX_EXPENSES }).map((_, index) => (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Skeleton className="h-4 min-w-0 motion-reduce:animate-none" />
                <Skeleton className="h-4 w-20 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        ) : null}

        {status === "error" ? (
          <p className="text-xs text-muted-foreground">Could not load expenses.</p>
        ) : null}

        {status === "ready" && expenses.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active expenses.</p>
        ) : null}

        {status === "ready" && expenses.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-b border-border/40 py-1.5 last:border-0"
              >
                <p className="min-w-0 break-words text-sm leading-5 font-medium text-foreground">
                  {expense.item}
                </p>
                <div className="flex shrink-0 gap-2 text-xs whitespace-nowrap tabular-nums text-muted-foreground">
                  <span>Total {formatCurrency(expense.amount)}</span>
                  <span>Owed {formatCurrency(expense.owedAmount)}</span>
                </div>
                <span className="col-span-2 min-w-0 text-xs text-muted-foreground">
                  {expense.payer.name} → {expense.debtor?.name ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Link>
  );
}
