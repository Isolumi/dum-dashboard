import type {
  ApplicationPipelineSummary,
  DeploymentWorkloadSummary,
  HealthIssue,
  HealthStatus,
  PipelineStage,
  PodContainerImageEvidence,
} from "../../shared/homelab/contracts";
import type { ArgoApplicationState } from "./providers/argocd";
import type { WorkflowRun } from "./providers/github";

const DEPLOYMENT_NAMESPACE = "yootoob-mp3";
const ARGO_APPLICATION = "yootoob-mp3-dumachine";
const GITHUB_REPOSITORY = "Isolumi/youtube-mp3";
const GITHUB_BRANCH = "development";
const TARGETS = [
  {
    name: "yootoob-mp3-api",
    repository: "ghcr.io/isolumi/yootoob-mp3-api",
  },
  {
    name: "yootoob-mp3-frontend",
    repository: "ghcr.io/isolumi/yootoob-mp3-frontend",
  },
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
    containerImages: PodContainerImageEvidence[];
  }>;
}

export interface DeploymentCorrelationInput {
  workflow: WorkflowRun | null;
  application: ArgoApplicationState | null;
  kubernetes: KubernetesDeploymentEvidence | null;
  observedAt: string;
}

export type DeploymentState = ApplicationPipelineSummary;

interface ImageParts {
  repository: string | null;
  reference: string | null;
  tag: string | null;
  digest: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isPodContainerImageEvidence(value: unknown): value is PodContainerImageEvidence {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    isNullableString(value.repository) &&
    isNullableString(value.reference) &&
    isNullableString(value.tag) &&
    isNullableString(value.digest)
  );
}

function runtimeContainerImages(
  pod: KubernetesDeploymentEvidence["pods"][number],
): PodContainerImageEvidence[] | null {
  const value: unknown = pod.containerImages;
  if (!Array.isArray(value) || !value.every(isPodContainerImageEvidence)) {
    return null;
  }
  return value;
}

function worstStatus(statuses: readonly HealthStatus[]): HealthStatus {
  for (const status of ["critical", "warning", "unknown", "healthy"] as const) {
    if (statuses.includes(status)) return status;
  }
  return "unknown";
}

function imageParts(image: string | null | undefined): ImageParts {
  if (!image) return { repository: null, reference: null, tag: null, digest: null };
  const reference = image.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const [nameAndTag, digest] = reference.split("@", 2);
  const lastSlash = nameAndTag.lastIndexOf("/");
  const lastColon = nameAndTag.lastIndexOf(":");
  const hasTag = lastColon > lastSlash;
  return {
    repository: hasTag ? nameAndTag.slice(0, lastColon) : nameAndTag,
    reference,
    tag: hasTag ? nameAndTag.slice(lastColon + 1) : null,
    digest: digest || null,
  };
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function expectedImage(application: ArgoApplicationState | null, repository: string): ImageParts {
  const image = application?.images.find(
    (candidate) => imageParts(candidate).repository === repository,
  );
  return imageParts(image);
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
  const resource = `Deployment/${target.name}`;
  const workload = input.kubernetes?.workloads.find(
    (candidate) => candidate.namespace === DEPLOYMENT_NAMESPACE && candidate.name === target.name,
  );
  const pods =
    input.kubernetes?.pods.filter(
      (pod) =>
        pod.namespace === DEPLOYMENT_NAMESPACE &&
        (pod.name === target.name || pod.name.startsWith(`${target.name}-`)),
    ) ?? [];
  const expected = expectedImage(input.application, target.repository);
  const podContainerImages = pods.map(runtimeContainerImages);
  const invalidContainerImagePods = podContainerImages.filter((images) => images === null).length;
  const targetContainers = podContainerImages.flatMap(
    (images) => images?.filter((container) => container.repository === target.repository) ?? [],
  );
  const liveImages = unique(targetContainers.map((container) => container.reference));
  const liveTags = unique(targetContainers.map((container) => container.tag));
  const liveDigests = unique(targetContainers.map((container) => container.digest));
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
        resource,
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
        resource,
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
        resource,
        input.observedAt,
        { desiredReplicas, availableReplicas },
      ),
    );
  }

  if (!expected.reference) {
    issues.push(
      issue(
        "deployment-expected-image-unavailable",
        "unknown",
        `Argo CD does not report the expected image for ${target.name}.`,
        "argocd",
        resource,
        input.observedAt,
        { repository: target.repository, expectedImage: null },
      ),
    );
  } else if (!expected.tag) {
    issues.push(
      issue(
        "deployment-expected-tag-unavailable",
        "unknown",
        `Argo CD does not report an expected image tag for ${target.name}.`,
        "argocd",
        resource,
        input.observedAt,
        { repository: target.repository, expectedImage: expected.reference },
      ),
    );
  }

  if (input.kubernetes && pods.length === 0) {
    issues.push(
      issue(
        "deployment-pod-unavailable",
        "unknown",
        `No live pod evidence is available for ${target.name}.`,
        "kubernetes",
        resource,
        input.observedAt,
        { podCount: 0, repository: target.repository },
      ),
    );
  } else if (pods.length > 0) {
    if (invalidContainerImagePods > 0) {
      issues.push(
        issue(
          "deployment-container-images-unavailable",
          "unknown",
          `Container image evidence is unavailable for ${target.name}.`,
          "kubernetes",
          resource,
          input.observedAt,
          {
            repository: target.repository,
            podCount: pods.length,
            invalidPodCount: invalidContainerImagePods,
          },
        ),
      );
    }
    const missingTag =
      invalidContainerImagePods > 0 ||
      targetContainers.length === 0 ||
      targetContainers.some((container) => !container.tag);
    const missingDigest =
      invalidContainerImagePods > 0 ||
      targetContainers.length === 0 ||
      targetContainers.some((container) => !container.digest);
    if (missingTag) {
      issues.push(
        issue(
          "deployment-live-tag-unavailable",
          "unknown",
          `A live image tag is unavailable for ${target.name}.`,
          "kubernetes",
          resource,
          input.observedAt,
          { repository: target.repository, containerCount: targetContainers.length },
        ),
      );
    }
    if (missingDigest) {
      issues.push(
        issue(
          "deployment-live-digest-unavailable",
          "unknown",
          `A live image digest is unavailable for ${target.name}.`,
          "kubernetes",
          resource,
          input.observedAt,
          { repository: target.repository, containerCount: targetContainers.length },
        ),
      );
    }
  }

  const comparableTags =
    invalidContainerImagePods === 0 &&
    expected.tag !== null &&
    liveTags.length > 0 &&
    targetContainers.every((container) => container.tag !== null);
  const tagMatches = comparableTags ? liveTags.every((tag) => tag === expected.tag) : null;
  if (tagMatches === false) {
    issues.push(
      issue(
        "deployment-image-tag-mismatch",
        "warning",
        `Deployment ${target.name} is not running the expected image tag.`,
        null,
        resource,
        input.observedAt,
        { expectedTag: expected.tag, liveTag: liveTags[0] ?? null },
      ),
    );
  }

  const comparableDigests =
    invalidContainerImagePods === 0 &&
    expected.digest !== null &&
    liveDigests.length > 0 &&
    targetContainers.every((container) => container.digest !== null);
  const digestMatches = comparableDigests
    ? liveDigests.every((digest) => digest === expected.digest)
    : null;
  if (digestMatches === false) {
    issues.push(
      issue(
        "deployment-image-digest-mismatch",
        "warning",
        `Deployment ${target.name} is not running the expected image digest.`,
        null,
        resource,
        input.observedAt,
        { expectedDigest: expected.digest, liveDigest: liveDigests[0] ?? null },
      ),
    );
  }

  if (input.workflow && expected.tag && input.workflow.commit.sha !== expected.tag) {
    issues.push(
      issue(
        "deployment-source-tag-mismatch",
        "warning",
        `The latest workflow source SHA has not reached the desired image for ${target.name}.`,
        null,
        resource,
        input.observedAt,
        { workflowCommit: input.workflow.commit.sha, expectedTag: expected.tag },
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
      expectedImage: expected.reference,
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
      observedAt,
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
        argo.observedAt,
        {
          syncStatus: input.application?.sync.status ?? null,
          healthStatus: input.application?.health.status ?? null,
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
        : "One or more deployments lack evidence or do not match the expected live state.",
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
    argoRevision: input.application?.sync.revision ?? null,
    workflow,
    argo,
    rollout,
    workloads,
    issues,
  };
}
