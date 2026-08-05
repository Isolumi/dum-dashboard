import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock3, Server } from "lucide-react";

import type { OverviewSnapshot } from "@shared/homelab/contracts";
import { Skeleton } from "#/components/ui/skeleton";
import { getHomelabOverview } from "#/homelab/homelab.functions";
import { useHomelabSnapshot } from "#/homelab/useHomelabSnapshot";
import type { ToolEntry } from "#/tools/registry";
import { formatSnapshotAge, StatusBadge } from "./-StatusBadge";

function isOverviewSnapshot(value: unknown): value is OverviewSnapshot {
  if (!value || typeof value !== "object") return false;

  const snapshot = value as Partial<OverviewSnapshot>;
  return (
    typeof snapshot.observedAt === "string" &&
    typeof snapshot.stale === "boolean" &&
    (snapshot.status === "healthy" ||
      snapshot.status === "warning" ||
      snapshot.status === "critical" ||
      snapshot.status === "unknown") &&
    Array.isArray(snapshot.issues) &&
    Array.isArray(snapshot.sources) &&
    (snapshot.data === null ||
      (typeof snapshot.data === "object" &&
        typeof snapshot.data.cluster?.readyNodes === "number" &&
        typeof snapshot.data.cluster?.totalNodes === "number" &&
        typeof snapshot.data.workloads?.healthy === "number" &&
        typeof snapshot.data.workloads?.total === "number" &&
        Array.isArray(snapshot.data.activeIssues)))
  );
}

function CardFrame({ children }: { children: React.ReactNode }) {
  return (
    <Link
      to="/homelab"
      aria-label="Open Homelab overview"
      className="block rounded-lg border border-border bg-card outline-none transition-colors duration-150 hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
    >
      <div className="p-4">{children}</div>
    </Link>
  );
}

function CardHeader({ status }: { status: OverviewSnapshot["status"] }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Server className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Homelab</p>
          <p className="text-xs text-muted-foreground">dumachine · read only</p>
        </div>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

function UnavailableHomelabCard() {
  return (
    <CardFrame>
      <CardHeader status="unknown" />
      <div className="mt-4 flex items-center gap-2 rounded-md border border-health-unknown/30 bg-health-unknown/5 px-3 py-2 text-xs text-health-unknown">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        <span>Homelab snapshot unavailable</span>
      </div>
    </CardFrame>
  );
}

function LoadingHomelabCard() {
  return (
    <CardFrame>
      <div role="status" aria-label="Loading Homelab overview">
        <span className="sr-only">Loading Homelab overview</span>
        <div className="flex items-center justify-between gap-3" aria-hidden="true">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 motion-reduce:animate-none" />
            <div className="grid gap-1.5">
              <Skeleton className="h-4 w-20 motion-reduce:animate-none" />
              <Skeleton className="h-3 w-32 motion-reduce:animate-none" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full motion-reduce:animate-none" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3" aria-hidden="true">
          <Skeleton className="h-10 motion-reduce:animate-none" />
          <Skeleton className="h-10 motion-reduce:animate-none" />
          <Skeleton className="h-10 motion-reduce:animate-none" />
        </div>
      </div>
    </CardFrame>
  );
}

function LiveHomelabCard({ initialSnapshot }: { initialSnapshot: OverviewSnapshot | null }) {
  const { snapshot, refreshing, error } = useHomelabSnapshot(getHomelabOverview, initialSnapshot);
  if (!snapshot) return refreshing && !error ? <LoadingHomelabCard /> : <UnavailableHomelabCard />;

  const displayStatus = error ? "unknown" : snapshot.status;
  const data = snapshot.data;

  return (
    <CardFrame>
      <CardHeader status={displayStatus} />
      {data ? (
        <div className="mt-4 grid grid-cols-3 divide-x divide-border/70">
          <div className="pr-3">
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {data.cluster.readyNodes} / {data.cluster.totalNodes}
            </p>
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">nodes ready</p>
          </div>
          <div className="px-3">
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {data.workloads.healthy} / {data.workloads.total}
            </p>
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">healthy workloads</p>
          </div>
          <div className="pl-3">
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {data.activeIssues.length}
            </p>
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
              active {data.activeIssues.length === 1 ? "issue" : "issues"}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-health-unknown">Homelab snapshot unavailable</p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5" aria-hidden="true" />
          <time dateTime={snapshot.observedAt} suppressHydrationWarning>
            {formatSnapshotAge(snapshot.observedAt)}
          </time>
        </span>
        <span aria-live="polite">
          {error
            ? "Refresh delayed"
            : snapshot.stale
              ? "Stale snapshot"
              : refreshing
                ? "Refreshing"
                : "Live"}
        </span>
      </div>
    </CardFrame>
  );
}

export function HomelabBentoCard({ data }: { tool: ToolEntry; data: unknown }) {
  return <LiveHomelabCard initialSnapshot={isOverviewSnapshot(data) ? data : null} />;
}
