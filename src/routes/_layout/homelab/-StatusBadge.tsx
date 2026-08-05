import type { LucideIcon } from "lucide-react";
import { CircleCheck, CircleHelp, CircleX, TriangleAlert } from "lucide-react";

import type { HealthStatus } from "@shared/homelab/contracts";
import { cn } from "#/lib/utils";

interface StatusPresentation {
  label: string;
  icon: LucideIcon;
  className: string;
}

const STATUS_PRESENTATION: Record<HealthStatus, StatusPresentation> = {
  healthy: {
    label: "Healthy",
    icon: CircleCheck,
    className: "border-health-healthy/30 bg-health-healthy/10 text-health-healthy",
  },
  warning: {
    label: "Warning",
    icon: TriangleAlert,
    className: "border-health-warning/30 bg-health-warning/10 text-health-warning",
  },
  critical: {
    label: "Critical",
    icon: CircleX,
    className: "border-health-critical/30 bg-health-critical/10 text-health-critical",
  },
  unknown: {
    label: "Unknown",
    icon: CircleHelp,
    className: "border-health-unknown/30 bg-health-unknown/10 text-health-unknown",
  },
};

export const HEALTH_STATUS_PRIORITY: Record<HealthStatus, number> = {
  critical: 0,
  warning: 1,
  unknown: 2,
  healthy: 3,
};

export function getHealthStatusLabel(status: HealthStatus): string {
  return STATUS_PRESENTATION[status].label;
}

export function formatSnapshotAge(observedAt: string, now = Date.now()): string {
  const observedAtMs = Date.parse(observedAt);
  if (!Number.isFinite(observedAtMs)) return "Update time unknown";

  const elapsedSeconds = Math.max(0, Math.floor((now - observedAtMs) / 1_000));
  if (elapsedSeconds < 60) return `Updated ${elapsedSeconds}s ago`;

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `Updated ${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Updated ${elapsedHours}h ago`;

  return `Updated ${Math.floor(elapsedHours / 24)}d ago`;
}

export function StatusBadge({ status, className }: { status: HealthStatus; className?: string }) {
  const presentation = STATUS_PRESENTATION[status];
  const Icon = presentation.icon;

  return (
    <span
      role="status"
      aria-label={`Status: ${presentation.label}`}
      className={cn(
        "inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        presentation.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span>{presentation.label}</span>
    </span>
  );
}
