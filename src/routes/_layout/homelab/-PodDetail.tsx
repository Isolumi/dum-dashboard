import { useEffect, useMemo, useRef, useState } from "react";
import { Box, CircleAlert, Container, FileJson, Image } from "lucide-react";

import type { PodDetail as PodDetailContract } from "@shared/homelab/contracts";
import { StatusBadge } from "./-StatusBadge";
import { LiveLogPanel } from "./-LiveLogPanel";
import type { PodSelection } from "./-PodTable";

export type PodDetailFetcher = (
  selection: PodSelection,
  signal: AbortSignal,
) => Promise<PodDetailContract>;

function podReason(detail: PodDetailContract): string {
  const container = detail.containers.find((item) => item.reason);
  if (container?.reason) {
    return `${container.name} is ${container.state} because ${container.reason}.`;
  }
  const condition = detail.conditions.find((item) => item.reason || item.message);
  if (condition?.message) return condition.message;
  if (condition?.reason) return `${condition.type}: ${condition.reason}.`;
  return detail.ready
    ? "Every reported container is ready."
    : "Kubernetes has not reported a specific reason for this pod yet.";
}

export function PodDetail({
  selection,
  selectedContainer,
  onContainerChange,
  fetcher,
  refreshKey,
}: {
  selection: PodSelection;
  selectedContainer?: string;
  onContainerChange: (container: string | undefined) => void;
  fetcher: PodDetailFetcher;
  refreshKey: string;
}) {
  const [detail, setDetail] = useState<PodDetailContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    const requestId = ++requestSequence.current;
    const controller = new AbortController();
    setLoading((current) => (detail ? current : true));
    setRefreshing(Boolean(detail));

    void fetcher(selection, controller.signal)
      .then((nextDetail) => {
        if (controller.signal.aborted || requestSequence.current !== requestId) return;
        setDetail(nextDetail);
        setError(false);
      })
      .catch(() => {
        if (controller.signal.aborted || requestSequence.current !== requestId) return;
        setError(true);
      })
      .finally(() => {
        if (controller.signal.aborted || requestSequence.current !== requestId) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      controller.abort();
    };
  }, [fetcher, refreshKey, selection.namespace, selection.pod]);

  const containerNames = useMemo(
    () => detail?.containers.map((container) => container.name) ?? [],
    [detail],
  );
  const activeContainer =
    selectedContainer && containerNames.includes(selectedContainer)
      ? selectedContainer
      : containerNames[0];

  useEffect(() => {
    if (!detail) return;
    if (activeContainer !== selectedContainer) onContainerChange(activeContainer);
  }, [activeContainer, detail, onContainerChange, selectedContainer]);

  if (loading) {
    return (
      <section
        aria-labelledby="pod-detail-title"
        className="rounded-lg border border-border bg-card p-4"
      >
        <h2 id="pod-detail-title" className="text-base font-semibold text-foreground">
          Pod details
        </h2>
        <p
          role="status"
          aria-label="Loading pod details"
          className="mt-4 text-sm text-muted-foreground"
        >
          Loading pod details…
        </p>
      </section>
    );
  }

  if (!detail) {
    return (
      <section
        aria-labelledby="pod-detail-title"
        className="rounded-lg border border-border bg-card p-4"
      >
        <h2 id="pod-detail-title" className="text-base font-semibold text-foreground">
          Pod details
        </h2>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-health-unknown">
            Pod details unavailable.
          </p>
        ) : (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            Waiting for pod details.
          </p>
        )}
      </section>
    );
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-12">
      <section
        aria-labelledby="pod-detail-title"
        className="min-w-0 rounded-lg border border-border bg-card p-4 xl:col-span-7"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {detail.namespace}
            </p>
            <h2
              id="pod-detail-title"
              className="mt-1 truncate text-base font-semibold text-foreground"
            >
              Pod details
            </h2>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{detail.name}</p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
            <StatusBadge status={error ? "unknown" : detail.status} />
            {error ? (
              <span className="text-xs font-medium text-health-unknown">Stale pod details</span>
            ) : refreshing ? (
              <span role="status" className="text-xs text-muted-foreground">
                Refreshing pod details
              </span>
            ) : null}
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-health-unknown">
            Could not refresh pod details. Showing the last successful details.
          </p>
        ) : null}

        <div className="mt-4 rounded-md border border-border/70 bg-background/40 p-3">
          <div className="flex items-start gap-2">
            <CircleAlert
              className="mt-0.5 size-4 shrink-0 text-health-warning"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Current reason
              </h3>
              <p className="mt-1 text-sm text-foreground">{podReason(detail)}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="pod-containers-title">
            <div className="flex items-center gap-2">
              <Container className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 id="pod-containers-title" className="text-sm font-semibold text-foreground">
                Containers
              </h3>
            </div>
            {detail.containers.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No containers reported.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border/70" aria-label="Pod containers">
                {detail.containers.map((container) => (
                  <li key={container.name} className="py-3 first:pt-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{container.name}</span>
                      <span className="ml-auto text-xs capitalize text-muted-foreground">
                        {container.state}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {container.ready ? "Ready" : "Not ready"} · {container.restartCount}{" "}
                      {container.restartCount === 1 ? "restart" : "restarts"}
                    </p>
                    {container.reason ? (
                      <p className="mt-1 text-xs font-medium text-health-warning">
                        {container.reason}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-start gap-2">
                      <Image
                        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <p className="min-w-0 break-all font-mono text-[11px] text-muted-foreground">
                        {container.imageId ?? container.image ?? "Image identity unknown"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="pod-conditions-title">
            <div className="flex items-center gap-2">
              <Box className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 id="pod-conditions-title" className="text-sm font-semibold text-foreground">
                Conditions
              </h3>
            </div>
            {detail.conditions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No pod conditions reported.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border/70" aria-label="Pod conditions">
                {detail.conditions.map((condition) => (
                  <li
                    key={`${condition.type}/${condition.lastTransitionAt ?? "unknown"}`}
                    className="py-3 first:pt-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{condition.type}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {condition.status}
                      </span>
                    </div>
                    {condition.reason ? (
                      <p className="mt-1 text-xs font-medium text-health-warning">
                        {condition.reason}
                      </p>
                    ) : null}
                    {condition.message ? (
                      <p className="mt-1 text-xs text-muted-foreground">{condition.message}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <details className="mt-4 rounded-md border border-border/70 bg-background/40">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <FileJson className="size-4 text-muted-foreground" aria-hidden="true" />
            Raw status evidence
          </summary>
          <pre className="max-h-80 overflow-auto border-t border-border p-3 font-mono text-xs text-muted-foreground">
            {JSON.stringify(detail.rawStatus, null, 2)}
          </pre>
        </details>
      </section>

      <div className="min-w-0 xl:col-span-5">
        {activeContainer ? (
          <div className="grid gap-3">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Log container
              <select
                aria-label="Log container"
                value={activeContainer}
                onChange={(event) => onContainerChange(event.currentTarget.value)}
                className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
              >
                {containerNames.map((container) => (
                  <option key={container} value={container}>
                    {container}
                  </option>
                ))}
              </select>
            </label>
            <LiveLogPanel
              namespace={selection.namespace}
              pod={selection.pod}
              container={activeContainer}
            />
          </div>
        ) : (
          <section
            aria-labelledby="live-logs-unavailable-title"
            className="rounded-lg border border-border bg-card p-4"
          >
            <h3 id="live-logs-unavailable-title" className="text-sm font-semibold text-foreground">
              Live logs
            </h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Logs are unavailable because this pod has no reported containers.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
