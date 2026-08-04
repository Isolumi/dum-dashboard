import type {
  ApplicationPipelineSummary,
  DeploymentWorkloadSummary,
  HealthIssue,
  HealthStatus,
  PipelineStage,
} from "../../shared/homelab/contracts";
import type { ArgoApplicationState } from "./providers/argocd";
import type { WorkflowRun } from "./providers/github";

const DEPLOYMENT_NAMESPACE = "yootoob-mp3";
const ARGO_APPLICATION = "yootoob-mp3-dumachine";
const GITHUB_REPOSITORY = "Isolumi/youtube-mp3";
const GITHUB_BRANCH = "main";
const TARGETS = [
  { name: "yootoob-mp3-api", imageName: "youtube-mp3-api" },
  { name: "yootoob-mp3-frontend", imageName: "youtube-mp3-frontend" },
] as const;

export interface KubernetesDeploymentEvidence {
  workloads: Array<{
    kind: string;
    name: string;
    namespace: string;
    desiredReplicas: number;
    availableReplicas: number;
  }>;
  pods: Array<{
    name: string;
    namespace: string;
    ready: boolean;
    imageTag?: string | null;
    imageDigest?: string | null;
  }>;
}

export interface DeploymentCorrelationInput {
  workflow: WorkflowRun | null;
  application: ArgoApplicationState | null;
  kubernetes: KubernetesDeploymentEvidence | null;
  observedAt: string;
}

export type DeploymentState = ApplicationPipelineSummary;

function worstStatus(statuses: readonly HealthStatus[]): HealthStatus {
  for (const status of ["critical", "warning", "unknown", "healthy"] as const) {
    if (statuses.includes(status)) return status;
  }
  return "unknown";
}

function imageParts(image: string | null | undefined): {
  tagReference: string | null;
  digest: string | null;
} {
  if (!image) return { tagReference: null, digest: null };
  const [tagReference, digest] = image.split("@", 2);
  return { tagReference: tagReference || null, digest: digest || null };
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function expectedImage(application: ArgoApplicationState | null, imageName: string): string | null {
  if (!application) return null;
  return (
    application.images.find((image) => {
      const path = imageParts(image).tagReference ?? image;
      const lastSlash = path.lastIndexOf("/");
      const lastColon = path.lastIndexOf(":");
      const repository = lastColon > lastSlash ? path.slice(0, lastColon) : path;
      return repository.endsWith(`/${imageName}`);
    }) ?? null
  );
}

function issue(
  ruleId: string,
  status: "warning" | "critical" | "unknown",
  reason: string,
  source: HealthIssue["source"],
  resource: string,
  observedAt: string,
  evidence: HealthIssue["evidence"],
): HealthIssue {
  return { ruleId, status, reason, source, resource, observedAt, evidence };
}

function workloadState(
  input: DeploymentCorrelationInput,
  target: (typeof TARGETS)[number],
): { state: DeploymentWorkloadSummary; issues: HealthIssue[] } {
  const workload = input.kubernetes?.workloads.find(
    (candidate) => candidate.namespace === DEPLOYMENT_NAMESPACE && candidate.name === target.name,
  );
  const pods =
    input.kubernetes?.pods.filter(
      (pod) =>
        pod.namespace === DEPLOYMENT_NAMESPACE &&
        (pod.name === target.name || pod.name.startsWith(`${target.name}-`)),
    ) ?? [];
  const expected = expectedImage(input.application, target.imageName);
  const expectedParts = imageParts(expected);
  const liveImages = unique(pods.map((pod) => pod.imageTag));
  const liveDigests = unique(
    pods.map((pod) => imageParts(pod.imageDigest).digest ?? pod.imageDigest ?? null),
  );
  const tagMatches = expectedParts.tagReference
    ? liveImages.length > 0 && liveImages.every((image) => image === expectedParts.tagReference)
    : null;
  const digestMatches = expectedParts.digest
    ? liveDigests.length > 0 && liveDigests.every((digest) => digest === expectedParts.digest)
    : null;
  const desiredReplicas = workload?.desiredReplicas ?? 0;
  const availableReplicas = workload?.availableReplicas ?? 0;
  const issues: HealthIssue[] = [];

  if (!input.kubernetes) {
    issues.push(
      issue(
        "deployment-workload-unavailable",
        "unknown",
        `Deployment evidence for ${target.name} is unavailable.`,
        "kubernetes",
        `Deployment/${target.name}`,
        input.observedAt,
        { desiredReplicas: null, availableReplicas: null },
      ),
    );
  } else if (!workload || desiredReplicas === 0 || availableReplicas === 0) {
    issues.push(
      issue(
        "deployment-unavailable",
        "critical",
        `Deployment ${target.name} has no available replicas.`,
        "kubernetes",
        `Deployment/${target.name}`,
        input.observedAt,
        { desiredReplicas, availableReplicas },
      ),
    );
  } else if (availableReplicas < desiredReplicas) {
    issues.push(
      issue(
        "deployment-partially-available",
        "warning",
        `Deployment ${target.name} has fewer available replicas than desired.`,
        "kubernetes",
        `Deployment/${target.name}`,
        input.observedAt,
        { desiredReplicas, availableReplicas },
      ),
    );
  }

  if (tagMatches === false) {
    issues.push(
      issue(
        "deployment-image-tag-mismatch",
        "warning",
        `Deployment ${target.name} is not running the expected image tag.`,
        null,
        `Deployment/${target.name}`,
        input.observedAt,
        { expectedImage: expected, liveImage: liveImages[0] ?? null },
      ),
    );
  }
  if (digestMatches === false) {
    issues.push(
      issue(
        "deployment-image-digest-mismatch",
        "warning",
        `Deployment ${target.name} is not running the expected image digest.`,
        null,
        `Deployment/${target.name}`,
        input.observedAt,
        { expectedDigest: expectedParts.digest, liveDigest: liveDigests[0] ?? null },
      ),
    );
  }

  return {
    state: {
      name: target.name,
      namespace: DEPLOYMENT_NAMESPACE,
      status: issues.length === 0 ? "healthy" : worstStatus(issues.map(({ status }) => status)),
      desiredReplicas,
      availableReplicas,
      expectedImage: expected,
      liveImage: liveImages[0] ?? null,
      liveDigests,
      tagMatches,
      digestMatches,
    },
    issues,
  };
}

function workflowStage(workflow: WorkflowRun | null, observedAt: string): PipelineStage {
  if (!workflow) {
    return {
      status: "unknown",
      summary: "GitHub workflow evidence is unavailable.",
      observedAt,
      url: null,
    };
  }
  const succeeded = workflow.status === "completed" && workflow.conclusion === "success";
  return {
    status: succeeded ? "healthy" : workflow.status === "completed" ? "warning" : "unknown",
    summary: succeeded
      ? `Workflow ${workflow.name} succeeded.`
      : workflow.status === "completed"
        ? `Workflow ${workflow.name} concluded ${workflow.conclusion ?? "without a result"}.`
        : `Workflow ${workflow.name} is ${workflow.status}.`,
    observedAt: workflow.completedAt ?? workflow.startedAt,
    url: workflow.url,
  };
}

function argoStage(application: ArgoApplicationState | null, observedAt: string): PipelineStage {
  if (!application) {
    return {
      status: "unknown",
      summary: "Argo CD application evidence is unavailable.",
      observedAt,
      url: null,
    };
  }
  const degraded = application.health.status === "Degraded";
  const synced = application.sync.status === "Synced";
  const healthy = application.health.status === "Healthy";
  return {
    status: degraded ? "critical" : !synced ? "warning" : healthy ? "healthy" : "unknown",
    summary: degraded
      ? `Argo CD reports ${application.name} Degraded.`
      : !synced
        ? `Argo CD reports ${application.name} ${application.sync.status}.`
        : `Argo CD reports ${application.name} Synced and ${application.health.status}.`,
    observedAt:
      application.health.lastTransitionAt ??
      application.operation.finishedAt ??
      application.operation.startedAt ??
      "",
    url: null,
  };
}

export function correlateDeployment(input: DeploymentCorrelationInput): DeploymentState {
  const correlated = TARGETS.map((target) => workloadState(input, target));
  const workloads = correlated.map(({ state }) => state);
  const issues = correlated.flatMap(({ issues: workloadIssues }) => workloadIssues);
  const workflow = workflowStage(input.workflow, input.observedAt);
  const argo = argoStage(input.application, input.observedAt);

  if (workflow.status !== "healthy") {
    issues.push(
      issue(
        input.workflow ? "deployment-workflow-not-successful" : "deployment-workflow-unavailable",
        workflow.status,
        workflow.summary,
        "github",
        input.workflow?.repository ?? GITHUB_REPOSITORY,
        workflow.observedAt,
        {
          conclusion: input.workflow?.conclusion ?? null,
          commit: input.workflow?.commit.sha ?? null,
        },
      ),
    );
  }
  if (argo.status !== "healthy") {
    issues.push(
      issue(
        argo.status === "critical" ? "argocd-degraded" : "argocd-out-of-sync",
        argo.status,
        argo.summary,
        "argocd",
        input.application?.name ?? ARGO_APPLICATION,
        argo.observedAt || input.observedAt,
        {
          syncStatus: input.application?.sync.status ?? null,
          healthStatus: input.application?.health.status ?? null,
        },
      ),
    );
  }
  if (
    input.application &&
    input.workflow &&
    input.application.sync.revision !== input.workflow.commit.sha
  ) {
    issues.push(
      issue(
        "deployment-revision-mismatch",
        "warning",
        "The Argo CD revision does not match the latest workflow commit.",
        null,
        input.application.name,
        input.observedAt,
        {
          workflowCommit: input.workflow.commit.sha,
          argoRevision: input.application.sync.revision,
        },
      ),
    );
  }

  const rolloutStatus = worstStatus(workloads.map(({ status }) => status));
  const rollout: PipelineStage = {
    status: rolloutStatus,
    summary:
      rolloutStatus === "healthy"
        ? "Both deployments are available and running the expected images."
        : "One or more deployments do not match the expected live state.",
    observedAt: input.observedAt,
    url: null,
  };

  return {
    application: input.application?.name ?? ARGO_APPLICATION,
    namespace: DEPLOYMENT_NAMESPACE,
    repository: input.workflow?.repository ?? GITHUB_REPOSITORY,
    branch: input.workflow?.branch ?? GITHUB_BRANCH,
    status: worstStatus([workflow.status, argo.status, rollout.status]),
    commit: input.workflow?.commit ?? null,
    workflow,
    argo,
    rollout,
    workloads,
    issues,
  };
}
