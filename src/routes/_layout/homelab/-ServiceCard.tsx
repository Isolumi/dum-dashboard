import { Boxes, ExternalLink, Globe2, LockKeyhole, Server } from "lucide-react";

import type { ServiceSummary } from "@shared/homelab/contracts";
import { StatusBadge } from "./-StatusBadge";

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? value : null;
  } catch {
    return null;
  }
}

function formatDate(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Certificate expiry unknown";
  return `Certificate expires ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))}`;
}

function formatAge(value: string | null, now = Date.now()): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Deployment age unknown";
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1_000));
  if (seconds < 60) return `Deployed ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Deployed ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Deployed ${hours}h ago`;
  return `Deployed ${Math.floor(hours / 24)}d ago`;
}

export function ServiceCard({ service }: { service: ServiceSummary }) {
  const href = safeHttpsUrl(service.url);
  return (
    <article
      aria-label={`${service.name} service`}
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Globe2 className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="truncate text-lg font-semibold text-foreground">{service.name}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${service.name} in a new tab`}
              className="mt-2 inline-flex min-h-8 items-center gap-1.5 break-all text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {service.url} <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ) : (
            <p className="mt-2 break-all text-xs text-muted-foreground">Service URL unavailable</p>
          )}
        </div>
        <StatusBadge status={service.status} />
      </header>

      <p className="mt-4 text-sm text-foreground">{service.reason}</p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-border/70 bg-background/40 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Server className="size-3.5" aria-hidden="true" />
            Endpoint
          </dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">
            {service.reachable ? "Reachable" : "Unavailable"}
          </dd>
          <dd className="mt-0.5 text-xs text-muted-foreground">
            {service.probeLatencyMs === null
              ? "Latency unknown"
              : `${Math.round(service.probeLatencyMs)} ms`}
          </dd>
        </div>
        <div className="rounded-md border border-border/70 bg-background/40 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LockKeyhole className="size-3.5" aria-hidden="true" />
            TLS
          </dt>
          <dd className="mt-1 text-xs font-medium text-foreground">
            {formatDate(service.certificateExpiresAt)}
          </dd>
        </div>
        <div className="rounded-md border border-border/70 bg-background/40 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Boxes className="size-3.5" aria-hidden="true" />
            Argo CD
          </dt>
          <dd className="mt-1 break-all text-xs font-medium text-foreground">
            {service.argoApplication ?? "Application unknown"}
          </dd>
          <dd className="mt-1">
            <StatusBadge status={service.argoStatus} className="min-h-5 px-1.5 py-0 text-[10px]" />
          </dd>
        </div>
        <div className="rounded-md border border-border/70 bg-background/40 p-3">
          <dt className="text-xs text-muted-foreground">Kubernetes</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">
            {service.namespace ?? "Namespace unknown"}
          </dd>
          <dd className="mt-0.5 text-xs text-muted-foreground">
            {service.relatedPodCount === null
              ? "Pod count unknown"
              : `${service.relatedPodCount} related ${service.relatedPodCount === 1 ? "pod" : "pods"}`}
          </dd>
        </div>
      </dl>

      <section aria-labelledby={`${service.name}-workloads`} className="mt-4">
        <h3 id={`${service.name}-workloads`} className="text-sm font-semibold text-foreground">
          Workloads and versions
        </h3>
        {service.workloads.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Workload evidence unavailable.</p>
        ) : (
          <ul className="mt-2 grid gap-3 lg:grid-cols-2">
            {service.workloads.map((workload) => (
              <li
                key={`${workload.kind}/${workload.name}`}
                className="min-w-0 rounded-lg border border-border/70 bg-background/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {workload.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{workload.kind}</p>
                  </div>
                  <StatusBadge
                    status={workload.status}
                    className="min-h-5 px-1.5 py-0 text-[10px]"
                  />
                </div>
                <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                  {workload.version ?? "Version unknown"}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {workload.availableReplicas === null || workload.desiredReplicas === null
                      ? "Replicas unknown"
                      : `${workload.availableReplicas}/${workload.desiredReplicas} available`}
                  </span>
                  <span>
                    {workload.podCount === null
                      ? "Pod count unknown"
                      : `${workload.podCount} ${workload.podCount === 1 ? "pod" : "pods"}`}
                  </span>
                  <span>{formatAge(workload.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
