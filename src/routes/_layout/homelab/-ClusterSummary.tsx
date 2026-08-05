import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  Server,
} from "lucide-react";

import type {
  ClusterData,
  CurrentResourceMetric,
  EventSummary,
  ResourceHistory,
  ResourceName,
} from "@shared/homelab/contracts";
import { Button } from "#/components/ui/button";
import { StatusBadge } from "./-StatusBadge";

const CHART_WIDTH = 480;
const CHART_HEIGHT = 112;

type HistoryWindow = "1h" | "6h" | "24h" | "7d";

const HISTORY_WINDOWS: ReadonlyArray<{
  value: HistoryWindow;
  label: string;
  shortLabel: string;
  durationMs: number;
}> = [
  { value: "1h", label: "1 hour", shortLabel: "1h", durationMs: 60 * 60 * 1_000 },
  { value: "6h", label: "6 hours", shortLabel: "6h", durationMs: 6 * 60 * 60 * 1_000 },
  { value: "24h", label: "24 hours", shortLabel: "24h", durationMs: 24 * 60 * 60 * 1_000 },
  { value: "7d", label: "7 days", shortLabel: "7d", durationMs: 7 * 24 * 60 * 60 * 1_000 },
];

const RESOURCE_PRESENTATION: Record<
  ResourceName,
  { label: string; icon: typeof Cpu; lineClassName: string }
> = {
  cpu: { label: "CPU", icon: Cpu, lineClassName: "text-chart-1" },
  memory: { label: "Memory", icon: MemoryStick, lineClassName: "text-chart-2" },
  disk: { label: "Disk", icon: HardDrive, lineClassName: "text-chart-3" },
};

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}

function validTimestamp(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function historyPoints(
  history: ResourceHistory | undefined,
  current: CurrentResourceMetric | undefined,
  window: (typeof HISTORY_WINDOWS)[number],
) {
  if (!history) return [];
  const samples = history.points
    .map((point) => ({ ...point, timestampMs: validTimestamp(point.timestamp) }))
    .filter((point): point is typeof point & { timestampMs: number } => point.timestampMs !== null)
    .sort((left, right) => left.timestampMs - right.timestampMs);
  if (samples.length === 0) return [];

  const currentTimestamp = current ? validTimestamp(current.observedAt) : null;
  const domainEnd = currentTimestamp ?? samples.at(-1)!.timestampMs;
  const domainStart = domainEnd - window.durationMs;
  return samples.filter(
    (point) => point.timestampMs >= domainStart && point.timestampMs <= domainEnd,
  );
}

function ResourceHistoryChart({
  resource,
  current,
  history,
  window,
}: {
  resource: Extract<ResourceName, "cpu" | "memory">;
  current: CurrentResourceMetric | undefined;
  history: ResourceHistory | undefined;
  window: (typeof HISTORY_WINDOWS)[number];
}) {
  const details = RESOURCE_PRESENTATION[resource];
  const samples = historyPoints(history, current, window);
  const currentTimestamp = current ? validTimestamp(current.observedAt) : null;
  const domainEnd = currentTimestamp ?? samples.at(-1)?.timestampMs ?? Date.now();
  const domainStart = domainEnd - window.durationMs;
  const coordinates = samples.map((point) => {
    const x = ((point.timestampMs - domainStart) / window.durationMs) * CHART_WIDTH;
    const boundedValue = Math.max(0, Math.min(100, point.value));
    const y = CHART_HEIGHT - (boundedValue / 100) * CHART_HEIGHT;
    return { x, y };
  });
  const points = coordinates.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

  return (
    <figure
      data-testid={`${resource}-history`}
      className="min-w-0 rounded-md border border-border/70 bg-background/40 p-3"
    >
      <figcaption className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{details.label}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
            {current ? formatPercent(current.usagePercent) : "Unknown"}
          </p>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {samples.length} {samples.length === 1 ? "sample" : "samples"}
        </span>
      </figcaption>

      {points ? (
        <svg
          role="img"
          aria-label={`${details.label} usage over ${window.label}`}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          className="h-28 w-full overflow-visible"
        >
          <line
            x1="0"
            x2={CHART_WIDTH}
            y1={CHART_HEIGHT / 2}
            y2={CHART_HEIGHT / 2}
            stroke="currentColor"
            strokeDasharray="3 5"
            vectorEffect="non-scaling-stroke"
            className="text-border"
          />
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className={details.lineClassName}
          />
          {coordinates.length === 1 ? (
            <circle
              cx={coordinates[0]!.x}
              cy={coordinates[0]!.y}
              r="3"
              fill="currentColor"
              className={details.lineClassName}
            />
          ) : null}
        </svg>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-sm border border-dashed border-border text-xs text-muted-foreground">
          No {window.label} history available.
        </div>
      )}
    </figure>
  );
}

function CurrentMetric({
  resource,
  metric,
}: {
  resource: ResourceName;
  metric: CurrentResourceMetric | undefined;
}) {
  const details = RESOURCE_PRESENTATION[resource];
  const Icon = details.icon;

  return (
    <div className="rounded-md border border-border/70 bg-background/40 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        <span className="text-xs font-medium">{details.label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {metric ? formatPercent(metric.usagePercent) : "Unknown"}
      </p>
    </div>
  );
}

function eventTimestamp(event: EventSummary): number {
  return validTimestamp(event.observedAt) ?? Number.NEGATIVE_INFINITY;
}

function WarningEvents({ events }: { events: readonly EventSummary[] }) {
  const warnings = [...events]
    .filter((event) => event.status !== "healthy")
    .sort((left, right) => eventTimestamp(right) - eventTimestamp(left));

  return (
    <section
      aria-labelledby="cluster-events-title"
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-health-warning" aria-hidden="true" />
        <h2 id="cluster-events-title" className="text-sm font-semibold text-foreground">
          Recent Kubernetes warnings
        </h2>
      </div>
      {warnings.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No warning events reported.</p>
      ) : (
        <ul aria-label="Recent Kubernetes warnings" className="mt-3 divide-y divide-border/70">
          {warnings.map((event) => (
            <li key={event.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={event.status} />
                <span className="text-xs font-semibold text-foreground">{event.reason}</span>
                <time dateTime={event.observedAt} className="ml-auto text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("en-CA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(event.observedAt))}
                </time>
              </div>
              <p className="mt-1 text-sm text-foreground">{event.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {event.namespace} · {event.resource}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ClusterSummary({ data }: { data: ClusterData }) {
  const [historyWindow, setHistoryWindow] = useState<HistoryWindow>("24h");
  const selectedWindow = HISTORY_WINDOWS.find(({ value }) => value === historyWindow)!;
  const healthyNamespaces = data.namespaces.filter(({ status }) => status === "healthy").length;
  const healthyWorkloads = data.workloads.filter(({ status }) => status === "healthy").length;

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-12">
      <section
        aria-labelledby="node-health-title"
        className="rounded-lg border border-border bg-card p-4 xl:col-span-7"
      >
        <div className="flex items-center gap-2">
          <Server className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="node-health-title" className="text-sm font-semibold text-foreground">
            Node health
          </h2>
        </div>
        {data.nodes.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No nodes reported.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {data.nodes.map((node) => (
              <article
                key={node.name}
                className="rounded-md border border-border/70 bg-background/40 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-foreground">{node.name}</h3>
                  <StatusBadge status={node.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {node.ready ? "Kubernetes reports this node Ready." : "This node is not Ready."}
                </p>
                {node.conditions.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">Conditions unknown.</p>
                ) : (
                  <ul
                    className="mt-3 flex flex-wrap gap-1.5"
                    aria-label={`${node.name} conditions`}
                  >
                    {node.conditions.map((condition) => (
                      <li
                        key={condition}
                        className="rounded-full border border-border bg-card px-2 py-1 font-mono text-[11px] text-muted-foreground"
                      >
                        {condition}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        aria-labelledby="inventory-summary-title"
        className="rounded-lg border border-border bg-card p-4 xl:col-span-5"
      >
        <div className="flex items-center gap-2">
          <Boxes className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="inventory-summary-title" className="text-sm font-semibold text-foreground">
            Inventory
          </h2>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
            <Database className="size-4 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-lg font-semibold text-foreground">
              {data.namespaces.length} {data.namespaces.length === 1 ? "namespace" : "namespaces"}
            </p>
            <p className="text-xs text-muted-foreground">
              Healthy namespaces: {healthyNamespaces}/{data.namespaces.length} ·{" "}
              {data.namespaces.reduce((total, namespace) => total + namespace.podCount, 0)} pods
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
            <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-lg font-semibold text-foreground">
              {healthyWorkloads} of {data.workloads.length} workloads healthy
            </p>
            <p className="text-xs text-muted-foreground">Across all namespaces</p>
          </div>
        </div>
        {data.workloads.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No workloads reported.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/70" aria-label="Workload health">
            {data.workloads.map((workload) => (
              <li
                key={`${workload.namespace}/${workload.kind}/${workload.name}`}
                className="py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {workload.name}
                  </span>
                  <StatusBadge status={workload.status} className="ml-auto" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {workload.namespace} · {workload.kind} · {workload.availableReplicas}/
                  {workload.desiredReplicas} available
                </p>
                {workload.failureReason ? (
                  <p className="mt-1 text-xs text-health-warning">{workload.failureReason}</p>
                ) : null}
                {workload.restartIncrease15m ? (
                  <p className="mt-1 text-xs text-health-warning">
                    Restarts increased in the last 15m.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="current-resources-title"
        className="rounded-lg border border-border bg-card p-4 xl:col-span-4"
      >
        <h2 id="current-resources-title" className="text-sm font-semibold text-foreground">
          Current resources
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          {(["cpu", "memory", "disk"] as const).map((resource) => (
            <CurrentMetric
              key={resource}
              resource={resource}
              metric={data.resources.current.find((metric) => metric.resource === resource)}
            />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="resource-history-title"
        className="min-w-0 rounded-lg border border-border bg-card p-4 xl:col-span-8"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="resource-history-title" className="text-sm font-semibold text-foreground">
            Resource history
          </h2>
          <div role="group" aria-label="Resource history range" className="flex flex-wrap gap-1">
            {HISTORY_WINDOWS.map((window) => (
              <Button
                key={window.value}
                type="button"
                variant={historyWindow === window.value ? "secondary" : "ghost"}
                size="sm"
                className="min-h-11 min-w-11"
                aria-label={`Show ${window.label}`}
                aria-pressed={historyWindow === window.value}
                onClick={() => setHistoryWindow(window.value)}
              >
                {window.shortLabel}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
          {(["cpu", "memory"] as const).map((resource) => (
            <ResourceHistoryChart
              key={resource}
              resource={resource}
              current={data.resources.current.find((metric) => metric.resource === resource)}
              history={data.resources.history.find((history) => history.resource === resource)}
              window={selectedWindow}
            />
          ))}
        </div>
      </section>

      <div className="xl:col-span-12">
        <WarningEvents events={data.events} />
      </div>
    </div>
  );
}
