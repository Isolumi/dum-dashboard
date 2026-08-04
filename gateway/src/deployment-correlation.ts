import type {
  ApplicationPipelineSummary,
  DeploymentWorkloadSummary,
  HealthIssue,
  HealthStatus,
  PipelineStage,
  PodContainerImageEvidence,
} from "../../shared/homelab/contracts";
import { parseArgoApplicationState, type ArgoApplicationState } from "./providers/argocd";
import { parseWorkflowRun, type WorkflowRun } from "./providers/github";
import {
  readDenseArray,
  readOwnDataProperties,
  readOwnDataRecord,
  RUNTIME_COLLECTION_LIMITS,
} from "./runtime-validation";

const DEPLOYMENT_NAMESPACE = "yootoob-mp3";
const ARGO_APPLICATION = "yootoob-mp3-dumachine";
const GITHUB_REPOSITORY = "Isolumi/youtube-mp3";
const GITHUB_BRANCH = "development";
const UNKNOWN_OBSERVED_AT = "1970-01-01T00:00:00.000Z";
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
export type DeploymentTargetName = (typeof TARGETS)[number]["name"];

export interface KubernetesDeploymentEvidence {
  workloads: Array<{
    kind: string;
    name: string;
    namespace: string;
    status: HealthStatus;
    desiredReplicas: number;
    availableReplicas: number;
  }>;
  pods: Array<{
    name: string;
    namespace: string;
    status: HealthStatus;
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

interface NormalizedKubernetesEvidence {
  evidence: KubernetesDeploymentEvidence | null;
  invalid: boolean;
  invalidContainerTargets: DeploymentTargetName[];
}

interface NormalizedDeploymentCorrelationInput {
  input: DeploymentCorrelationInput;
  kubernetes: NormalizedKubernetesEvidence;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isHealthStatus(value: unknown): value is HealthStatus {
  return ["healthy", "warning", "critical", "unknown"].includes(value as HealthStatus);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseDenseArray<T>(
  value: unknown,
  maxLength: number,
  parse: (entry: unknown) => T | null,
): T[] | null {
  const entries = readDenseArray(value, maxLength);
  if (!entries) return null;

  const parsed: T[] = [];
  for (const entry of entries) {
    const result = parse(entry);
    if (result === null) return null;
    parsed.push(result);
  }
  return parsed;
}

function parsePodContainerImageEvidence(value: unknown): PodContainerImageEvidence | null {
  const properties = readOwnDataProperties(value, [
    "name",
    "repository",
    "reference",
    "tag",
    "digest",
  ]);
  if (
    !properties ||
    typeof properties.name !== "string" ||
    !isNullableString(properties.repository) ||
    !isNullableString(properties.reference) ||
    !isNullableString(properties.tag) ||
    !isNullableString(properties.digest)
  ) {
    return null;
  }

  return {
    name: properties.name,
    repository: properties.repository,
    reference: properties.reference,
    tag: properties.tag,
    digest: properties.digest,
  };
}

function parseWorkloadEvidence(
  value: unknown,
): KubernetesDeploymentEvidence["workloads"][number] | null {
  const properties = readOwnDataProperties(value, [
    "kind",
    "name",
    "namespace",
    "status",
    "desiredReplicas",
    "availableReplicas",
  ]);
  if (
    !properties ||
    typeof properties.kind !== "string" ||
    typeof properties.name !== "string" ||
    typeof properties.namespace !== "string" ||
    !isHealthStatus(properties.status) ||
    !isNonNegativeInteger(properties.desiredReplicas) ||
    !isNonNegativeInteger(properties.availableReplicas)
  ) {
    return null;
  }

  return {
    kind: properties.kind,
    name: properties.name,
    namespace: properties.namespace,
    status: properties.status,
    desiredReplicas: properties.desiredReplicas,
    availableReplicas: properties.availableReplicas,
  };
}

interface ParsedPodEvidence {
  data: KubernetesDeploymentEvidence["pods"][number] | null;
  invalidContainerTarget: DeploymentTargetName | null;
}

function targetForPod(name: unknown, namespace: unknown): DeploymentTargetName | null {
  if (typeof name !== "string" || namespace !== DEPLOYMENT_NAMESPACE) return null;
  return (
    TARGETS.find((target) => name === target.name || name.startsWith(`${target.name}-`))?.name ??
    null
  );
}

function parsePodEvidence(value: unknown): ParsedPodEvidence {
  const properties = readOwnDataRecord(value);
  if (!properties) return { data: null, invalidContainerTarget: null };
  const name = properties.get("name");
  const namespace = properties.get("namespace");
  if (
    !properties.has("name") ||
    !properties.has("namespace") ||
    !properties.has("status") ||
    !properties.has("ready") ||
    typeof name !== "string" ||
    typeof namespace !== "string" ||
    !isHealthStatus(properties.get("status")) ||
    typeof properties.get("ready") !== "boolean"
  ) {
    return { data: null, invalidContainerTarget: null };
  }
  const containerImages = properties.has("containerImages")
    ? parseDenseArray(
        properties.get("containerImages"),
        RUNTIME_COLLECTION_LIMITS.podContainerImages,
        parsePodContainerImageEvidence,
      )
    : null;
  if (!containerImages) {
    return {
      data: null,
      invalidContainerTarget: targetForPod(name, namespace),
    };
  }

  return {
    data: {
      name,
      namespace,
      status: properties.get("status") as HealthStatus,
      ready: properties.get("ready") as boolean,
      containerImages,
    },
    invalidContainerTarget: null,
  };
}

function normalizeKubernetesEvidence(value: unknown): NormalizedKubernetesEvidence {
  if (value === null) return { evidence: null, invalid: false, invalidContainerTargets: [] };
  const properties = readOwnDataProperties(value, ["workloads", "pods"]);
  if (!properties) return { evidence: null, invalid: true, invalidContainerTargets: [] };

  const workloads = parseDenseArray(
    properties.workloads,
    RUNTIME_COLLECTION_LIMITS.workloads,
    parseWorkloadEvidence,
  );
  const podEntries = readDenseArray(properties.pods, RUNTIME_COLLECTION_LIMITS.pods);
  const pods: KubernetesDeploymentEvidence["pods"] = [];
  const invalidContainerTargets = new Set<DeploymentTargetName>();
  let podsValid = podEntries !== null;
  for (const entry of podEntries ?? []) {
    const parsed = parsePodEvidence(entry);
    if (parsed.invalidContainerTarget) invalidContainerTargets.add(parsed.invalidContainerTarget);
    if (parsed.data) pods.push(parsed.data);
    else podsValid = false;
  }

  if (!workloads || !podsValid) {
    return {
      evidence: null,
      invalid: true,
      invalidContainerTargets: [...invalidContainerTargets],
    };
  }

  return {
    evidence: { workloads, pods },
    invalid: false,
    invalidContainerTargets: [...invalidContainerTargets],
  };
}

function normalizeDeploymentCorrelationInput(value: unknown): NormalizedDeploymentCorrelationInput {
  const properties = readOwnDataProperties(value, [
    "workflow",
    "application",
    "kubernetes",
    "observedAt",
  ]);
  const kubernetes = normalizeKubernetesEvidence(properties?.kubernetes);
  return {
    input: {
      workflow: parseWorkflowRun(properties?.workflow),
      application: parseArgoApplicationState(properties?.application),
      kubernetes: kubernetes.evidence,
      observedAt:
        properties && typeof properties.observedAt === "string"
          ? properties.observedAt
          : UNKNOWN_OBSERVED_AT,
    },
    kubernetes,
  };
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
  const targetContainers = pods.flatMap((pod) =>
    pod.containerImages.filter((container) => container.repository === target.repository),
  );
  const liveImages = unique(targetContainers.map((container) => container.reference));
  const liveTags = unique(targetContainers.map((container) => container.tag));
  const liveDigests = unique(targetContainers.map((container) => container.digest));
  const desiredReplicas = workload?.desiredReplicas ?? (input.kubernetes ? null : 0);
  const availableReplicas = workload?.availableReplicas ?? (input.kubernetes ? null : 0);
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
  } else if (!workload) {
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
  } else if (desiredReplicas === 0 || availableReplicas === 0) {
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
  } else if (workload.availableReplicas < workload.desiredReplicas) {
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
    const missingTag =
      targetContainers.length === 0 || targetContainers.some((container) => !container.tag);
    const missingDigest =
      targetContainers.length === 0 || targetContainers.some((container) => !container.digest);
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

function correlateNormalizedDeployment(
  input: DeploymentCorrelationInput,
  normalizedKubernetes: NormalizedKubernetesEvidence,
): DeploymentState {
  const correlated = TARGETS.map((target) => workloadState(input, target));
  const workloads = correlated.map(({ state }) => state);
  const issues = correlated.flatMap(({ issues: workloadIssues }) => workloadIssues);
  const workflow = workflowStage(input.workflow, input.observedAt);
  const argo = argoStage(input.application, input.observedAt);

  if (normalizedKubernetes.invalid) {
    issues.push(
      issue(
        "deployment-kubernetes-evidence-invalid",
        "unknown",
        "Kubernetes deployment evidence is invalid.",
        "kubernetes",
        DEPLOYMENT_NAMESPACE,
        input.observedAt,
        { valid: false },
      ),
    );
  }

  for (const targetName of normalizedKubernetes.invalidContainerTargets) {
    const target = TARGETS.find(({ name }) => name === targetName)!;
    issues.push(
      issue(
        "deployment-container-images-unavailable",
        "unknown",
        `Container image evidence is unavailable for ${target.name}.`,
        "kubernetes",
        `Deployment/${target.name}`,
        input.observedAt,
        { repository: target.repository, valid: false },
      ),
    );
  }

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

export function correlateValidatedDeployment(
  input: DeploymentCorrelationInput,
  invalidContainerTargets: readonly DeploymentTargetName[] = [],
): DeploymentState {
  return correlateNormalizedDeployment(input, {
    evidence: input.kubernetes,
    invalid: false,
    invalidContainerTargets: [...invalidContainerTargets],
  });
}

export function correlateDeployment(value: DeploymentCorrelationInput): DeploymentState {
  const normalized = normalizeDeploymentCorrelationInput(value);
  return correlateNormalizedDeployment(normalized.input, normalized.kubernetes);
}
