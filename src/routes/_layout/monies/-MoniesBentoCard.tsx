import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Skeleton } from "#/components/ui/skeleton";
import { getMoniesExpenses, getMoniesSummary } from "#/routes/monies/monies.functions";
import type { ToolEntry } from "#/tools/registry";
import { OwedSummary } from "./-OwedSummary";
import type { MoniesExpense, MoniesSummary } from "./-monies.types";

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
  const [summary, setSummary] = useState<MoniesSummary | null>(null);
  const [status, setStatus] = useState<BentoStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let latestRequestId = 0;

    async function loadEntries() {
      const requestId = ++latestRequestId;
      try {
        const [page, freshSummary] = await Promise.all([
          getMoniesExpenses({ data: { page: 1, pageSize: MAX_EXPENSES } }),
          getMoniesSummary(),
        ]);
        if (cancelled || requestId !== latestRequestId) return;
        setExpenses(page.items.slice(0, MAX_EXPENSES));
        setSummary(freshSummary);
        setStatus("ready");
      } catch {
        if (!cancelled && requestId === latestRequestId) setStatus("error");
      }
    }

    function stopRefresh() {
      if (intervalId === undefined) return;
      clearInterval(intervalId);
      intervalId = undefined;
    }

    function startRefresh() {
      if (document.visibilityState !== "visible" || intervalId !== undefined) return;
      intervalId = setInterval(() => void loadEntries(), REFRESH_INTERVAL_MS);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") startRefresh();
      else stopRefresh();
    }

    void loadEntries();
    startRefresh();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      latestRequestId += 1;
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
          <div role="status" aria-label="Loading Monies entries" className="flex flex-col gap-2">
            <span className="sr-only">Loading Monies entries</span>
            {Array.from({ length: MAX_EXPENSES }).map((_, index) => (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Skeleton className="h-4 min-w-0 motion-reduce:animate-none" />
                <Skeleton className="h-4 w-20 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        ) : null}

        {status === "error" ? (
          <p className="text-xs text-muted-foreground">Could not load entries.</p>
        ) : null}

        {status === "ready" && summary ? <OwedSummary summary={summary} className="mb-3" /> : null}

        {status === "ready" && expenses.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active entries.</p>
        ) : null}

        {status === "ready" && expenses.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex min-w-0 flex-col gap-0.5 border-b border-border/40 py-1.5 last:border-0"
              >
                <p className="min-w-0 break-words text-sm leading-5 font-medium text-foreground">
                  {expense.item}
                </p>
                <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(expense.owedAmount)}
                </span>
                <span className="min-w-0 break-words text-xs text-muted-foreground">
                  {expense.debtor
                    ? `${expense.debtor.name} owes ${expense.payer.name}`
                    : "Direction unavailable"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Link>
  );
}
