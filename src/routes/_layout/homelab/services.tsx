import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Clock3, RefreshCw, Server } from "lucide-react";

import type { ServiceSnapshot } from "@shared/homelab/contracts";
import { Skeleton } from "#/components/ui/skeleton";
import { getServiceSnapshot } from "#/homelab/homelab.functions";
import { useHomelabSnapshot } from "#/homelab/useHomelabSnapshot";
import { ServiceCard } from "./-ServiceCard";
import { formatSnapshotAge, StatusBadge } from "./-StatusBadge";

export type ServiceSnapshotFetcher = (signal: AbortSignal) => Promise<ServiceSnapshot>;
const fetchServiceSnapshot: ServiceSnapshotFetcher = (signal) => getServiceSnapshot({ signal });

export const Route = createFileRoute("/_layout/homelab/services")({
  loader: () => getServiceSnapshot().catch(() => null),
  pendingComponent: ServicesLoading,
  component: ServicesRoute,
});

function ServicesRoute() {
  return <ServicesView initialSnapshot={Route.useLoaderData()} fetcher={fetchServiceSnapshot} />;
}

function ServicesLoading() {
  return (
    <div
      role="status"
      aria-label="Loading services"
      className="mx-auto grid w-full max-w-7xl gap-4 p-4 sm:p-6"
    >
      <span className="sr-only">Loading services</span>
      <Skeleton className="h-28 motion-reduce:animate-none" />
      <Skeleton className="h-96 motion-reduce:animate-none" />
    </div>
  );
}

export function ServicesView({
  initialSnapshot,
  fetcher,
}: {
  initialSnapshot: ServiceSnapshot | null;
  fetcher: ServiceSnapshotFetcher;
}) {
  const { snapshot, refreshing, error } = useHomelabSnapshot(fetcher, initialSnapshot);
  if (!snapshot && !error) return <ServicesLoading />;
  if (!snapshot)
    return (
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
        <section className="rounded-lg border border-health-unknown/30 bg-card p-6 text-center">
          <AlertCircle className="mx-auto size-5 text-health-unknown" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-foreground">
            Service data is unavailable
          </h2>
          <p role="alert" className="mt-2 text-sm text-muted-foreground">
            No last-good service snapshot is available. Retrying automatically every 10 seconds.
          </p>
        </section>
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:gap-5 sm:p-6">
      <section
        aria-labelledby="services-title"
        className="rounded-lg border border-border bg-card p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Private catalog
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Server className="size-4 text-muted-foreground" aria-hidden="true" />
              <h2 id="services-title" className="text-lg font-semibold text-foreground">
                Services
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Private HTTPS endpoints enriched with certificate, Argo CD, workload, and pod
              evidence.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <StatusBadge status={error ? "unknown" : snapshot.status} />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {refreshing ? (
                <RefreshCw
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Clock3 className="size-3.5" aria-hidden="true" />
              )}
              {refreshing ? "Refreshing" : formatSnapshotAge(snapshot.observedAt)}
            </span>
          </div>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-health-unknown">
            {error}. Showing the last successful snapshot.
          </p>
        ) : null}
      </section>
      {snapshot.sources.some((source) => source.error || source.stale) ? (
        <section
          aria-labelledby="service-sources"
          className="rounded-lg border border-health-unknown/30 bg-health-unknown/5 p-4"
        >
          <h2 id="service-sources" className="text-sm font-semibold text-foreground">
            Partial service evidence
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {snapshot.sources
              .filter((source) => source.error || source.stale)
              .map((source) => (
                <li key={source.source}>
                  {source.source}: {source.error ?? "Source data is stale."}
                </li>
              ))}
          </ul>
        </section>
      ) : null}
      {snapshot.data?.services.length ? (
        snapshot.data.services.map((service) => (
          <ServiceCard key={service.name} service={service} />
        ))
      ) : (
        <section className="rounded-lg border border-dashed border-border p-8 text-center">
          <h2 className="text-sm font-semibold text-foreground">Private services</h2>
          <p className="mt-1 text-sm text-muted-foreground">No private services reported.</p>
        </section>
      )}
    </div>
  );
}
