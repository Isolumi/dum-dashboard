import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Clock3, RefreshCw, Server } from "lucide-react";

import type {
  ClusterSnapshot,
  PodDetail as PodDetailContract,
  ResourceWindow,
} from "@shared/homelab/contracts";
import { Skeleton } from "#/components/ui/skeleton";
import {
  getClusterSnapshot,
  getClusterSnapshotForWindow,
  getPodDetail,
} from "#/homelab/homelab.functions";
import { useHomelabSnapshot } from "#/homelab/useHomelabSnapshot";
import { ClusterSummary } from "./-ClusterSummary";
import { PodDetail, type PodDetailFetcher } from "./-PodDetail";
import { PodTable, type PodSelection } from "./-PodTable";
import { formatSnapshotAge, StatusBadge } from "./-StatusBadge";

const DNS_LABEL = /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/;

export interface ClusterSearch {
  namespace?: string;
  pod?: string;
  container?: string;
}

function isDnsLabel(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= 63 && DNS_LABEL.test(value)
  );
}

function isDnsSubdomain(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 253 &&
    value.split(".").every((label) => isDnsLabel(label))
  );
}

export function normalizeClusterSearch(search: Record<string, unknown>): ClusterSearch {
  if (!isDnsLabel(search.namespace)) return {};

  const normalized: ClusterSearch = { namespace: search.namespace };
  if (!isDnsSubdomain(search.pod)) return normalized;
  normalized.pod = search.pod;
  if (isDnsLabel(search.container)) normalized.container = search.container;
  return normalized;
}

const fetchPodDetail: PodDetailFetcher = ({ namespace, pod }, signal) =>
  getPodDetail({ data: { namespace, pod }, signal }) as Promise<PodDetailContract>;

export type ClusterSnapshotFetcher = (
  window: ResourceWindow,
  signal: AbortSignal,
) => Promise<ClusterSnapshot>;

const fetchClusterSnapshot: ClusterSnapshotFetcher = (window, signal) =>
  getClusterSnapshotForWindow({ data: { window }, signal });

export const Route = createFileRoute("/_layout/homelab/cluster")({
  validateSearch: normalizeClusterSearch,
  loader: () => getClusterSnapshot().catch(() => null),
  pendingComponent: ClusterViewLoading,
  component: ClusterRoute,
});

function ClusterRoute() {
  const initialSnapshot = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const changeSearch = useCallback(
    (nextSearch: ClusterSearch) => {
      void navigate({ search: nextSearch, replace: true });
    },
    [navigate],
  );

  return (
    <ClusterView
      initialSnapshot={initialSnapshot}
      fetcher={fetchClusterSnapshot}
      detailFetcher={fetchPodDetail}
      search={search}
      onSearchChange={changeSearch}
    />
  );
}

export function ClusterViewLoading() {
  return (
    <div
      role="status"
      aria-label="Loading cluster data"
      className="mx-auto grid w-full max-w-7xl gap-4 p-4 sm:p-6"
    >
      <span className="sr-only">Loading cluster data</span>
      <Skeleton className="h-28 motion-reduce:animate-none" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 motion-reduce:animate-none" />
        <Skeleton className="h-80 motion-reduce:animate-none" />
      </div>
      <Skeleton className="h-96 motion-reduce:animate-none" />
    </div>
  );
}

export function ClusterView({
  initialSnapshot,
  fetcher,
  detailFetcher,
  search,
  onSearchChange,
}: {
  initialSnapshot: ClusterSnapshot | null;
  fetcher: ClusterSnapshotFetcher;
  detailFetcher: PodDetailFetcher;
  search: ClusterSearch;
  onSearchChange: (search: ClusterSearch) => void;
}) {
  const [requestedHistoryWindow, setRequestedHistoryWindow] = useState<ResourceWindow>("24h");
  const [loadedHistoryWindow, setLoadedHistoryWindow] = useState<ResourceWindow>("24h");
  const fetchSelectedWindow = useCallback(
    async (signal: AbortSignal) => {
      const nextSnapshot = await fetcher(requestedHistoryWindow, signal);
      if (!signal.aborted) setLoadedHistoryWindow(requestedHistoryWindow);
      return nextSnapshot;
    },
    [fetcher, requestedHistoryWindow],
  );
  const { snapshot, refreshing, error } = useHomelabSnapshot(fetchSelectedWindow, initialSnapshot, {
    refreshKey: requestedHistoryWindow,
  });
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);

  useEffect(() => {
    const data = snapshot?.data;
    if (!data || !search.namespace) return;
    const namespaceExists = data.namespaces.some(({ name }) => name === search.namespace);
    if (!namespaceExists) {
      setSelectionNotice(`Namespace ${search.namespace} is no longer available.`);
      onSearchChange({});
      return;
    }
    if (
      search.pod &&
      !data.pods.some((pod) => pod.namespace === search.namespace && pod.name === search.pod)
    ) {
      setSelectionNotice(`Pod ${search.pod} is no longer available.`);
      onSearchChange({ namespace: search.namespace });
    }
  }, [onSearchChange, search.namespace, search.pod, snapshot?.data, snapshot?.observedAt]);

  const selectPod = useCallback(
    (selection: PodSelection) => {
      setSelectionNotice(null);
      onSearchChange({ namespace: selection.namespace, pod: selection.pod });
    },
    [onSearchChange],
  );
  const changeNamespace = useCallback(
    (namespace: string | null) => {
      setSelectionNotice(null);
      onSearchChange(namespace ? { namespace } : {});
    },
    [onSearchChange],
  );
  const changeContainer = useCallback(
    (container: string | undefined) => {
      if (!search.namespace || !search.pod) return;
      onSearchChange({
        namespace: search.namespace,
        pod: search.pod,
        ...(container ? { container } : {}),
      });
    },
    [onSearchChange, search.namespace, search.pod],
  );

  if (!snapshot && error) {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
        <section className="rounded-lg border border-health-unknown/30 bg-card p-6 text-center">
          <AlertCircle className="mx-auto size-5 text-health-unknown" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-foreground">
            Cluster data is unavailable
          </h2>
          <p role="alert" className="mt-2 text-sm text-muted-foreground">
            Cluster data is unavailable. No last-good snapshot is available yet.
          </p>
          <p
            role="status"
            aria-label="Cluster retry status"
            className="mt-2 text-xs font-medium text-health-unknown"
          >
            Retrying automatically every 10 seconds.
          </p>
        </section>
      </div>
    );
  }

  if (!snapshot) return <ClusterViewLoading />;

  const selectedPod =
    search.namespace && search.pod
      ? snapshot.data?.pods.find(
          (pod) => pod.namespace === search.namespace && pod.name === search.pod,
        )
      : undefined;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:gap-5 sm:p-6">
      <section
        aria-labelledby="cluster-status-title"
        className="rounded-lg border border-border bg-card p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Cluster telemetry
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Server className="size-4 text-muted-foreground" aria-hidden="true" />
              <h2 id="cluster-status-title" className="text-lg font-semibold text-foreground">
                Cluster health
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Current Kubernetes inventory and resource evidence for dumachine.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <div className="flex items-center gap-2">
              <StatusBadge status={error ? "unknown" : snapshot.status} />
              {snapshot.stale ? (
                <span className="text-xs font-medium text-health-unknown">Stale</span>
              ) : null}
            </div>
            <span
              aria-live="polite"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
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
          <p role="alert" className="mt-3 text-sm text-health-unknown">
            {error}. Showing the last successful snapshot.
          </p>
        ) : null}
      </section>

      {snapshot.sources.some((source) => source.error || source.stale) ? (
        <section
          aria-labelledby="cluster-source-notices"
          className="rounded-lg border border-health-unknown/30 bg-health-unknown/5 p-4"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-health-unknown" aria-hidden="true" />
            <h2 id="cluster-source-notices" className="text-sm font-semibold text-foreground">
              Partial data
            </h2>
          </div>
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

      {selectionNotice ? (
        <p
          role="status"
          aria-label="Selection update"
          className="rounded-lg border border-health-unknown/30 bg-health-unknown/5 px-4 py-3 text-sm text-health-unknown"
        >
          {selectionNotice}
        </p>
      ) : null}

      {snapshot.data ? (
        <>
          <ClusterSummary
            data={snapshot.data}
            requestedHistoryWindow={requestedHistoryWindow}
            loadedHistoryWindow={loadedHistoryWindow}
            historyRefreshing={refreshing}
            historyError={Boolean(error)}
            onHistoryWindowChange={setRequestedHistoryWindow}
          />
          <PodTable
            pods={snapshot.data.pods}
            selectedPod={
              selectedPod ? { namespace: selectedPod.namespace, pod: selectedPod.name } : undefined
            }
            namespaceFilter={search.namespace ?? null}
            onNamespaceChange={changeNamespace}
            onSelectPod={selectPod}
          />
          {selectedPod && search.namespace && search.pod ? (
            <PodDetail
              key={`${search.namespace}/${search.pod}`}
              selection={{ namespace: search.namespace, pod: search.pod }}
              selectedContainer={search.container}
              onContainerChange={changeContainer}
              fetcher={detailFetcher}
              refreshKey={snapshot.observedAt}
            />
          ) : (
            <section
              aria-labelledby="pod-selection-title"
              className="rounded-lg border border-dashed border-border p-6 text-center"
            >
              <h2 id="pod-selection-title" className="text-sm font-semibold text-foreground">
                Pod details
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a pod to inspect containers, conditions, raw evidence, and live logs.
              </p>
            </section>
          )}
        </>
      ) : (
        <section className="rounded-lg border border-health-unknown/30 bg-card p-6 text-center">
          <h2 className="text-base font-semibold text-foreground">Cluster data is unavailable</h2>
          <p role="alert" className="mt-2 text-sm text-muted-foreground">
            Cluster data is unavailable. The dashboard will retry automatically.
          </p>
        </section>
      )}
    </div>
  );
}
