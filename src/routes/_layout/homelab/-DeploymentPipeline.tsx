import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Boxes,
  Container,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  PackageCheck,
  Rocket,
} from "lucide-react";

import type {
  ApplicationPipelineSummary,
  HealthStatus,
  PipelineStage,
  WorkflowPipelineStage,
} from "@shared/homelab/contracts";
import { StatusBadge } from "./-StatusBadge";

const INCOMPLETE_IMAGE_EVIDENCE_RULES = new Set([
  "deployment-expected-image-unavailable",
  "deployment-expected-tag-unavailable",
  "deployment-live-tag-unavailable",
  "deployment-live-digest-unavailable",
  "deployment-pod-unavailable",
]);

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? value : null;
  } catch {
    return null;
  }
}

function shortSha(sha: string): string {
  return sha.slice(0, 7) || "Unknown";
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatDuration(durationMs: number | null | undefined): string {
  if (durationMs === null || durationMs === undefined || durationMs < 0) return "Unknown";
  const totalSeconds = Math.floor(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function workloadStatus(application: ApplicationPipelineSummary): HealthStatus {
  if (application.workloads.length === 0) return "unknown";
  if (application.workloads.some(({ status }) => status === "critical")) return "critical";
  if (application.workloads.some(({ status }) => status === "warning")) return "warning";
  if (application.workloads.some(({ status }) => status === "unknown")) return "unknown";
  return "healthy";
}

function imageStatus(application: ApplicationPipelineSummary): HealthStatus {
  if (application.workloads.length === 0) return "unknown";
  if (
    application.workloads.some(
      ({ tagMatches, digestMatches }) => tagMatches === false || digestMatches === false,
    )
  ) {
    return "warning";
  }
  if (application.issues.some(({ ruleId }) => INCOMPLETE_IMAGE_EVIDENCE_RULES.has(ruleId))) {
    return "unknown";
  }
  if (
    application.workloads.some(
      ({ expectedImage, liveImage, liveDigests, tagMatches, digestMatches }) =>
        expectedImage === null ||
        liveImage === null ||
        liveDigests.length === 0 ||
        (expectedImage.includes("@sha256:") ? digestMatches === null : tagMatches === null),
    )
  ) {
    return "unknown";
  }
  return "healthy";
}

function PipelineStageCard({
  title,
  icon: Icon,
  status,
  summary,
  url,
  children,
}: {
  title: string;
  icon: LucideIcon;
  status: HealthStatus;
  summary: string;
  url?: string | null;
  children?: ReactNode;
}) {
  const href = safeHttpsUrl(url);
  return (
    <section className="relative min-w-0 rounded-lg border border-border bg-background/45 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <StatusBadge status={status} className="min-h-5 px-1.5 py-0 text-[10px]" />
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{summary}</p>
          {children}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${title} source in a new tab`}
              className="mt-2 inline-flex min-h-8 items-center gap-1.5 text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              View source <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function stageCard(title: string, icon: LucideIcon, stage: PipelineStage): ReactNode {
  return (
    <PipelineStageCard
      key={title}
      title={title}
      icon={icon}
      status={stage.status}
      summary={stage.summary}
      url={stage.url}
    />
  );
}

function workflowStageCard(stage: WorkflowPipelineStage): ReactNode {
  return (
    <PipelineStageCard
      title="GitHub Actions"
      icon={GitBranch}
      status={stage.status}
      summary={stage.summary}
      url={stage.url}
    >
      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
        <p>Conclusion: {stage.conclusion ?? "unknown"}</p>
        <p>Duration: {formatDuration(stage.durationMs)}</p>
      </div>
    </PipelineStageCard>
  );
}

export function DeploymentPipeline({ application }: { application: ApplicationPipelineSummary }) {
  const hasGitHub = application.repository !== null && application.workflow !== null;
  const commitHref = safeHttpsUrl(application.commit?.url);
  const commitSummary = application.commit
    ? `${shortSha(application.commit.sha)} · ${application.commit.author}`
    : "Commit data unavailable";
  const liveStatus = workloadStatus(application);
  const liveReplicaCount = application.workloads.reduce(
    (total, workload) => total + (workload.availableReplicas ?? 0),
    0,
  );
  const desiredReplicaCount = application.workloads.reduce(
    (total, workload) => total + (workload.desiredReplicas ?? 0),
    0,
  );
  const replicaEvidenceAvailable = application.workloads.every(
    ({ desiredReplicas, availableReplicas }) =>
      desiredReplicas !== null && availableReplicas !== null,
  );

  return (
    <article
      aria-label={`${application.application} pipeline`}
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {application.repository && application.branch
              ? `${application.repository} · ${application.branch}`
              : "Argo CD managed"}
          </p>
          <h2 className="mt-1 truncate text-lg font-semibold text-foreground">
            {application.application}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Argo namespace: {application.namespace}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </header>

      <div className="mt-4 grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {hasGitHub ? (
          <>
            <PipelineStageCard
              title="Commit"
              icon={GitCommitHorizontal}
              status={application.commit ? "healthy" : "unknown"}
              summary={commitSummary}
              url={commitHref}
            >
              {application.commit ? (
                <div className="mt-2 min-w-0">
                  <p className="font-mono text-xs text-foreground">
                    {shortSha(application.commit.sha)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {application.commit.message}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatTimestamp(application.commit.committedAt)}
                  </p>
                </div>
              ) : null}
            </PipelineStageCard>
            {workflowStageCard(application.workflow)}
          </>
        ) : null}
        <PipelineStageCard
          title="Container images"
          icon={PackageCheck}
          status={imageStatus(application)}
          summary={
            application.workloads.length > 0
              ? `${application.workloads.length} expected workload images`
              : "Image evidence unavailable"
          }
        >
          <ul className="mt-2 space-y-1.5" aria-label="Expected workload images">
            {application.workloads.map((workload) => (
              <li key={workload.name} className="min-w-0 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{workload.name}</span>
                <span className="mt-0.5 block break-all font-mono">
                  {workload.expectedImage ?? "Expected image unknown"}
                </span>
              </li>
            ))}
          </ul>
        </PipelineStageCard>
        <PipelineStageCard
          title="Argo CD"
          icon={Boxes}
          status={application.argo.status}
          summary={application.argo.summary}
          url={application.argo.url}
        >
          <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            <p>
              Sync: {application.argo.syncStatus ?? "unknown"} · Health:{" "}
              {application.argo.healthStatus ?? "unknown"}
            </p>
            <p>Operation: {application.argo.operationResult ?? "unknown"}</p>
            <p>
              Revision:{" "}
              {application.argo.revision ? shortSha(application.argo.revision) : "unknown"}
            </p>
            <p>Last transition: {formatTimestamp(application.argo.lastTransitionAt)}</p>
          </div>
        </PipelineStageCard>
        {stageCard("K3s rollout", Rocket, application.rollout)}
        <PipelineStageCard
          title="Live pods"
          icon={Container}
          status={liveStatus}
          summary={
            application.workloads.length > 0 && replicaEvidenceAvailable
              ? `${liveReplicaCount} of ${desiredReplicaCount} replicas available`
              : application.workloads.length > 0
                ? "Replica evidence unavailable"
                : "Live pod evidence unavailable"
          }
        >
          <ul className="mt-2 space-y-2" aria-label="Live workload images">
            {application.workloads.map((workload) => (
              <li key={workload.name} className="min-w-0 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{workload.name}</span>
                <span className="mt-0.5 block break-all font-mono">
                  {workload.liveImage ?? "Live image unknown"}
                </span>
                {workload.liveDigests.length > 0 ? (
                  workload.liveDigests.map((digest) => (
                    <span key={digest} className="mt-0.5 block break-all font-mono">
                      {digest}
                    </span>
                  ))
                ) : (
                  <span className="mt-0.5 block">Live digest unknown</span>
                )}
                <span className="mt-0.5 block">
                  {workload.revision
                    ? `Kubernetes revision: ${workload.revision}`
                    : "Kubernetes revision unknown"}
                </span>
              </li>
            ))}
          </ul>
        </PipelineStageCard>
      </div>

      {application.issues.length > 0 ? (
        <section
          aria-labelledby={`${application.application}-issues`}
          className="mt-4 rounded-lg border border-health-warning/30 bg-health-warning/5 p-3.5"
        >
          <h3
            id={`${application.application}-issues`}
            className="text-sm font-semibold text-foreground"
          >
            Deployment evidence
          </h3>
          <ul className="mt-2 space-y-2">
            {application.issues.map((issue) => (
              <li
                key={`${issue.ruleId}/${issue.resource}`}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                <StatusBadge status={issue.status} className="min-h-5 px-1.5 py-0 text-[10px]" />
                <span className="leading-5">{issue.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
