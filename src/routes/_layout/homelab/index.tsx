import { createFileRoute } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Clock3,
  ExternalLink,
  GitBranch,
  RefreshCw,
  Server,
} from "lucide-react";

import type {
  HealthStatus,
  OverviewSnapshot,
  RecentActivity,
  ServiceSummary,
  SourceState,
  WorkloadCounts,
} from "@shared/homelab/contracts";
import { Skeleton } from "#/components/ui/skeleton";
import { getHomelabOverview } from "#/homelab/homelab.functions";
import { useHomelabSnapshot } from "#/homelab/useHomelabSnapshot";
import { IssueList } from "./-IssueList";
import { ResourceChart } from "./-ResourceChart";
import {
  formatSnapshotAge,
  getHealthStatusLabel,
  HEALTH_STATUS_PRIORITY,
  StatusBadge,
} from "./-StatusBadge";

export const Route = createFileRoute("/_layout/homelab/")({
  loader: () => getHomelabOverview(),
  pendingComponent: HomelabOverviewLoading,
  errorComponent: HomelabOverviewError,
  component: HomelabOverviewRoute,
});

const STATUS_MESSAGE: Record<HealthStatus, string> = {
  healthy: "Everything is operating normally.",
  warning: "Some systems need attention.",
  critical: "Immediate attention is required.",
  unknown: "Current health cannot be confirmed.",
};

function workloadStatus(workloads: WorkloadCounts): HealthStatus {
  if (workloads.critical > 0) return "critical";
  if (workloads.warning > 0) return "warning";
  if (workloads.unknown > 0) return "unknown";
  return "healthy";
}

function issueStatus(snapshot: OverviewSnapshot): HealthStatus {
  const issues = snapshot.data?.activeIssues ?? [];
  if (issues.length === 0) return "healthy";
  return (
    [...issues].sort(
      (left, right) => HEALTH_STATUS_PRIORITY[left.status] - HEALTH_STATUS_PRIORITY[right.status],
    )[0]?.status ?? "unknown"
  );
}

function formatUtcTime(timestamp: string): string {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return "Time unknown";
  return `${new Date(parsed).toISOString().slice(11, 16)} UTC`;
}

function SummaryCard({
  title,
  summary,
  status,
  icon: Icon,
}: {
  title: string;
  summary: string;
  status: HealthStatus;
  icon: LucideIcon;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
          <h3>{title}</h3>
        </div>
        <StatusBadge status={status} className="min-h-5 px-1.5 py-0 text-[10px]" />
      </div>
      <p className="mt-3 text-sm font-semibold tabular-nums text-foreground">{summary}</p>
    </article>
  );
}

function SourceNotices({ sources }: { sources: readonly SourceState[] }) {
  const degradedSources = sources.filter(
    (source) => source.status !== "healthy" || source.stale || source.error,
  );
  if (degradedSources.length === 0) return null;

  return (
    <section
      aria-labelledby="source-notices-title"
      className="rounded-lg border border-health-unknown/30 bg-health-unknown/5 p-3.5"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-health-unknown">
        <AlertTriangle className="size-4" aria-hidden="true" />
        <h2 id="source-notices-title">Data source notices</h2>
      </div>
      <ul className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
        {degradedSources.map((source) => (
          <li
            key={source.source}
            className="flex min-w-0 items-start justify-between gap-3 rounded-md bg-background/50 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="font-medium capitalize text-foreground">{source.source}</p>
              <p className="mt-0.5 break-words text-muted-foreground">
                {source.error ??
                  (source.stale ? "Source data is stale." : "Source health is degraded.")}
              </p>
            </div>
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-health-unknown">
              {source.stale ? "Stale" : getHealthStatusLabel(source.status)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivityRow({ item }: { item: RecentActivity }) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium text-foreground">{item.resource}</p>
          <time dateTime={item.occurredAt} className="text-xs text-muted-foreground">
            {formatUtcTime(item.occurredAt)}
          </time>
        </div>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.message}</p>
      </div>
      <StatusBadge status={item.status} className="min-h-5 px-1.5 py-0 text-[10px]" />
      {item.url ? (
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : null}
    </>
  );

  return item.url ? (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open activity for ${item.resource} in a new tab`}
      className="flex min-h-11 items-start gap-2 rounded-md px-2 py-2 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
    >
      {content}
    </a>
  ) : (
    <div className="flex min-h-11 items-start gap-2 px-2 py-2">{content}</div>
  );
}

function RecentActivityList({ items }: { items: readonly RecentActivity[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No recent activity.</p>;
  }

  return (
    <ul className="divide-y divide-border/70">
      {items.slice(0, 6).map((item) => (
        <li key={item.id}>
          <ActivityRow item={item} />
        </li>
      ))}
    </ul>
  );
}

function ServiceLink({ service }: { service: ServiceSummary }) {
  return (
    <li>
      <a
        href={service.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${service.name} in a new tab`}
        className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
      >
        <StatusBadge status={service.status} className="min-h-5 px-1.5 py-0 text-[10px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{service.name}</p>
          <p className="truncate text-xs text-muted-foreground">{service.description}</p>
        </div>
        {service.probeLatencyMs !== null ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {Math.round(service.probeLatencyMs)} ms
          </span>
        ) : null}
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </a>
    </li>
  );
}

function ServiceList({ services }: { services: readonly ServiceSummary[] }) {
  if (services.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No services reported.</p>;
  }

  return (
    <ul className="divide-y divide-border/70">
      {services.slice(0, 6).map((service) => (
        <ServiceLink key={service.url} service={service} />
      ))}
    </ul>
  );
}

function HomelabOverviewContent({
  snapshot,
  refreshing,
  error,
}: {
  snapshot: OverviewSnapshot;
  refreshing: boolean;
  error: string | null;
}) {
  const displayStatus = error || snapshot.stale ? "unknown" : snapshot.status;
  const data = snapshot.data;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:gap-5 sm:p-6">
      <section
        aria-labelledby="system-status-title"
        className="rounded-lg border border-border bg-card p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              System status
            </p>
            <h2
              id="system-status-title"
              className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl"
            >
              {STATUS_MESSAGE[displayStatus]}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Prioritized from live cluster, deployment, metrics, and service evidence.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <div className="flex items-center gap-2">
              <StatusBadge status={displayStatus} />
              {snapshot.stale ? (
                <span className="text-xs font-medium text-health-unknown">Stale</span>
              ) : null}
            </div>
            <span
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              aria-live="polite"
            >
              {refreshing ? (
                <RefreshCw
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Clock3 className="size-3.5" aria-hidden="true" />
              )}
              <time dateTime={snapshot.observedAt} suppressHydrationWarning>
                {refreshing ? "Refreshing" : formatSnapshotAge(snapshot.observedAt)}
              </time>
            </span>
          </div>
        </div>
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-health-unknown/30 bg-health-unknown/5 px-3 py-2 text-xs text-health-unknown"
          >
            {error}. Showing the last successful snapshot.
          </p>
        ) : null}
      </section>

      <SourceNotices sources={snapshot.sources} />

      {data ? (
        <>
          <section aria-labelledby="health-summary-title">
            <h2 id="health-summary-title" className="sr-only">
              Health summary
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Cluster"
                summary={`${data.cluster.readyNodes} of ${data.cluster.totalNodes} nodes ready`}
                status={data.cluster.status}
                icon={Server}
              />
              <SummaryCard
                title="Workloads"
                summary={`${data.workloads.healthy} of ${data.workloads.total} healthy`}
                status={workloadStatus(data.workloads)}
                icon={Boxes}
              />
              <SummaryCard
                title="Argo CD"
                summary={`${data.argo.syncedApplications} of ${data.argo.totalApplications} synced`}
                status={data.argo.status}
                icon={GitBranch}
              />
              <SummaryCard
                title="Active issues"
                summary={`${data.activeIssues.length} active ${data.activeIssues.length === 1 ? "issue" : "issues"}`}
                status={issueStatus(snapshot)}
                icon={AlertTriangle}
              />
            </div>
          </section>

          <div className="grid min-w-0 gap-4 lg:grid-cols-12 sm:gap-5">
            <section
              aria-labelledby="active-issues-title"
              className="min-w-0 rounded-lg border border-border bg-card p-4 lg:col-span-7 sm:p-5"
            >
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Triage queue
                </p>
                <h2
                  id="active-issues-title"
                  className="mt-1 text-base font-semibold text-foreground"
                >
                  Active issues
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Confirmed failures first, followed by warnings and unknown evidence.
                </p>
              </div>
              <IssueList issues={data.activeIssues} />
            </section>

            <section
              aria-labelledby="resources-title"
              className="min-w-0 rounded-lg border border-border bg-card p-4 lg:col-span-5 sm:p-5"
            >
              <div className="mb-4 flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 id="resources-title" className="text-base font-semibold text-foreground">
                  Resources
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <ResourceChart
                  resource="cpu"
                  current={data.resources.current.find((metric) => metric.resource === "cpu")}
                  history={data.resources.history.find((history) => history.resource === "cpu")}
                />
                <ResourceChart
                  resource="memory"
                  current={data.resources.current.find((metric) => metric.resource === "memory")}
                  history={data.resources.history.find((history) => history.resource === "memory")}
                />
              </div>
            </section>

            <section
              aria-labelledby="recent-activity-title"
              className="min-w-0 rounded-lg border border-border bg-card p-4 lg:col-span-7 sm:p-5"
            >
              <div className="mb-2 flex items-center gap-2">
                <Clock3 className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 id="recent-activity-title" className="text-base font-semibold text-foreground">
                  Recent activity
                </h2>
              </div>
              <RecentActivityList items={data.recentActivity} />
            </section>

            <section
              aria-labelledby="services-title"
              className="min-w-0 rounded-lg border border-border bg-card p-4 lg:col-span-5 sm:p-5"
            >
              <div className="mb-2 flex items-center gap-2">
                <Server className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 id="services-title" className="text-base font-semibold text-foreground">
                  Services
                </h2>
              </div>
              <ServiceList services={data.services} />
            </section>
          </div>
        </>
      ) : (
        <section className="rounded-lg border border-health-unknown/30 bg-card p-6 text-center">
          <AlertTriangle className="mx-auto size-5 text-health-unknown" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-foreground">
            Overview data is unavailable.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The latest snapshot could not provide overview details. Existing navigation remains
            available.
          </p>
        </section>
      )}
    </div>
  );
}

export function HomelabOverview({
  initialSnapshot,
  fetcher = getHomelabOverview,
}: {
  initialSnapshot: OverviewSnapshot;
  fetcher?: () => Promise<OverviewSnapshot>;
}) {
  const { snapshot, refreshing, error } = useHomelabSnapshot(fetcher, initialSnapshot);
  return <HomelabOverviewContent snapshot={snapshot} refreshing={refreshing} error={error} />;
}

function HomelabOverviewRoute() {
  return <HomelabOverview initialSnapshot={Route.useLoaderData()} />;
}

export function HomelabOverviewLoading() {
  return (
    <div
      aria-label="Loading Homelab overview"
      className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6"
    >
      <Skeleton className="h-36 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-72 w-full rounded-lg lg:col-span-7" />
        <Skeleton className="h-72 w-full rounded-lg lg:col-span-5" />
      </div>
    </div>
  );
}

function HomelabOverviewError() {
  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <section className="rounded-lg border border-health-unknown/30 bg-card p-6 text-center">
        <StatusBadge status="unknown" />
        <h2 className="mt-3 text-base font-semibold text-foreground">
          Homelab overview is unavailable.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Refresh the page to request a new snapshot.
        </p>
      </section>
    </div>
  );
}
