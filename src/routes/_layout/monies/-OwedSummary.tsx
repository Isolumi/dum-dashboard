import type { MoniesSummary } from "./-monies.types";

const currencyFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

export function OwedSummary({
  summary,
  className = "",
}: {
  summary: MoniesSummary;
  className?: string;
}) {
  const settled = summary.amount === "0.00";
  const description = settled
    ? "Settled up"
    : `${summary.debtor!.name} owes ${summary.creditor!.name}`;

  return (
    <div className={`flex min-w-0 items-baseline justify-between gap-4 ${className}`}>
      <p className="min-w-0 truncate text-sm text-muted-foreground">{description}</p>
      <p className="shrink-0 text-sm font-medium tabular-nums">
        {currencyFormatter.format(Number(summary.amount))}
      </p>
    </div>
  );
}
