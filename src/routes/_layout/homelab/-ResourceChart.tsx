import type {
  CurrentResourceMetric,
  ResourceHistory,
  ResourceName,
} from "@shared/homelab/contracts";

const CHART_WIDTH = 240;
const CHART_HEIGHT = 72;

const RESOURCE_DETAILS: Record<
  Extract<ResourceName, "cpu" | "memory">,
  { label: string; lineClassName: string }
> = {
  cpu: { label: "CPU", lineClassName: "text-chart-1" },
  memory: { label: "Memory", lineClassName: "text-chart-2" },
};

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}

function chartPoints(history: ResourceHistory | undefined): string {
  if (!history || history.points.length === 0) return "";

  const horizontalDivisor = Math.max(1, history.points.length - 1);
  return history.points
    .map((point, index) => {
      const x = (index / horizontalDivisor) * CHART_WIDTH;
      const boundedValue = Math.min(100, Math.max(0, point.value));
      const y = CHART_HEIGHT - (boundedValue / 100) * CHART_HEIGHT;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function ResourceChart({
  resource,
  current,
  history,
}: {
  resource: Extract<ResourceName, "cpu" | "memory">;
  current: CurrentResourceMetric | undefined;
  history: ResourceHistory | undefined;
}) {
  const details = RESOURCE_DETAILS[resource];
  const points = chartPoints(history);

  return (
    <figure className="rounded-md border border-border/70 bg-background/40 p-3">
      <figcaption className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{details.label}</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
            {current ? formatPercent(current.usagePercent) : "—"}
          </p>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          24 hours
        </span>
      </figcaption>

      {points ? (
        <svg
          role="img"
          aria-label={`${details.label} usage over 24 hours`}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          className="h-20 w-full overflow-visible"
        >
          <line
            x1="0"
            x2={CHART_WIDTH}
            y1={CHART_HEIGHT / 2}
            y2={CHART_HEIGHT / 2}
            className="text-border"
            stroke="currentColor"
            strokeDasharray="3 5"
            vectorEffect="non-scaling-stroke"
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
        </svg>
      ) : (
        <div className="flex h-20 items-center justify-center rounded-sm border border-dashed border-border text-xs text-muted-foreground">
          No 24-hour history available
        </div>
      )}
    </figure>
  );
}
