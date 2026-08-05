import { ChevronDown, CircleCheck, Clock3 } from "lucide-react";

import type { HealthIssue } from "@shared/homelab/contracts";
import { HEALTH_STATUS_PRIORITY, StatusBadge } from "./-StatusBadge";

function evidenceLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase();
}

function evidenceValue(value: string | number | boolean | null): string {
  if (value === null) return "Not reported";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatUtcTime(timestamp: string): string {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return "Time unknown";
  return `${new Date(parsed).toISOString().slice(11, 16)} UTC`;
}

export function IssueList({ issues }: { issues: readonly HealthIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex min-h-28 items-center justify-center gap-2 rounded-md border border-dashed border-health-healthy/30 bg-health-healthy/5 px-4 text-sm text-health-healthy">
        <CircleCheck className="size-4" aria-hidden="true" />
        <span>Nothing needs attention</span>
      </div>
    );
  }

  const prioritizedIssues = [...issues].sort(
    (left, right) => HEALTH_STATUS_PRIORITY[left.status] - HEALTH_STATUS_PRIORITY[right.status],
  );

  return (
    <ul aria-label="Active issues" className="flex flex-col divide-y divide-border/70">
      {prioritizedIssues.map((issue) => (
        <li
          key={`${issue.ruleId}-${issue.resource}-${issue.source ?? "combined"}`}
          className="py-3 first:pt-0 last:pb-0"
        >
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-5 text-foreground">{issue.reason}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{issue.resource}</span>
                {issue.source ? <span>{issue.source}</span> : null}
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3" aria-hidden="true" />
                  <time dateTime={issue.observedAt}>{formatUtcTime(issue.observedAt)}</time>
                </span>
              </div>
            </div>
            <StatusBadge status={issue.status} />
          </div>

          <details className="group mt-2 text-xs text-muted-foreground">
            <summary className="flex min-h-8 w-fit cursor-pointer list-none items-center gap-1 rounded-sm pr-2 font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              Evidence
              <ChevronDown
                className="size-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </summary>
            <dl className="mt-2 grid gap-x-4 gap-y-1.5 rounded-md bg-muted/40 p-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
              {Object.entries(issue.evidence).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="font-medium text-muted-foreground">{evidenceLabel(key)}</dt>
                  <dd className="break-words text-foreground">{evidenceValue(value)}</dd>
                </div>
              ))}
            </dl>
          </details>
        </li>
      ))}
    </ul>
  );
}
