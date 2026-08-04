import type {
  ClusterData,
  DeploymentSnapshot,
  HealthIssue,
  HealthStatus,
  ResourceHistory,
  ResourceMetrics,
  ResourceName,
  Snapshot,
  SourceName,
  SourceState,
} from "../../shared/homelab/contracts";
import {
  evaluateResources,
  rollUpStatus,
  type HealthEvaluation,
} from "../../shared/homelab/health-rules";
import type { Provider } from "./providers/provider";
import { correlateDeployment } from "./deployment-correlation";
import { isArgoApplicationState } from "./providers/argocd";
import { isWorkflowRun } from "./providers/github";

export type Now = () => Date;

export type SourceResult<T = unknown> =
  | {
      source: SourceName;
      ok: true;
      data: T;
      state: SourceState;
    }
  | {
      source: SourceName;
      ok: false;
      error: string;
      state: SourceState;
    };

function sourceUnavailableMessage(source: SourceName): string {
  const sourceName = {
    kubernetes: "Kubernetes",
    argocd: "Argo CD",
    prometheus: "Prometheus",
    github: "GitHub",
    "service-probe": "Service probe",
  }[source];

  return `${sourceName} unavailable`;
}

function timestamp(now: Now): string {
  return now().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isHealthStatus(value: unknown): value is HealthStatus {
  return ["healthy", "warning", "critical", "unknown"].includes(value as HealthStatus);
}

function isResourceName(value: unknown): value is ResourceName {
  return ["cpu", "memory", "disk"].includes(value as ResourceName);
}

function isResourceMetrics(value: unknown): value is ResourceMetrics {
  return (
    isRecord(value) &&
    Array.isArray(value.current) &&
    value.current.every(
      (metric) =>
        isRecord(metric) &&
        isResourceName(metric.resource) &&
        isFiniteNumber(metric.usagePercent) &&
        isString(metric.observedAt),
    ) &&
    Array.isArray(value.history) &&
    value.history.every(
      (history) =>
        isRecord(history) &&
        isResourceName(history.resource) &&
        Array.isArray(history.points) &&
        history.points.every(
          (point) => isRecord(point) && isString(point.timestamp) && isFiniteNumber(point.value),
        ),
    )
  );
}

function isClusterData(value: unknown): value is ClusterData {
  return (
    isRecord(value) &&
    Array.isArray(value.nodes) &&
    value.nodes.every(
      (node) =>
        isRecord(node) &&
        isString(node.name) &&
        typeof node.ready === "boolean" &&
        isHealthStatus(node.status) &&
        Array.isArray(node.conditions) &&
        node.conditions.every(isString),
    ) &&
    Array.isArray(value.namespaces) &&
    value.namespaces.every(
      (namespace) =>
        isRecord(namespace) &&
        isString(namespace.name) &&
        isHealthStatus(namespace.status) &&
        isFiniteNumber(namespace.workloadCount) &&
        isFiniteNumber(namespace.podCount),
    ) &&
    Array.isArray(value.workloads) &&
    value.workloads.every(
      (workload) =>
        isRecord(workload) &&
        isString(workload.kind) &&
        isString(workload.name) &&
        isString(workload.namespace) &&
        isHealthStatus(workload.status) &&
        isFiniteNumber(workload.desiredReplicas) &&
        isFiniteNumber(workload.availableReplicas) &&
        isNullableString(workload.failureReason) &&
        typeof workload.restartIncrease15m === "boolean",
    ) &&
    Array.isArray(value.pods) &&
    value.pods.every(
      (pod) =>
        isRecord(pod) &&
        isString(pod.name) &&
        isString(pod.namespace) &&
        isHealthStatus(pod.status) &&
        typeof pod.ready === "boolean" &&
        isFiniteNumber(pod.restartCount) &&
        isNullableString(pod.node) &&
        isNullableString(pod.image) &&
        isNullableString(pod.imageTag) &&
        isNullableString(pod.imageDigest) &&
        Array.isArray(pod.containerImages) &&
        pod.containerImages.every(
          (container) =>
            isRecord(container) &&
            isString(container.name) &&
            isNullableString(container.repository) &&
            isNullableString(container.reference) &&
            isNullableString(container.tag) &&
            isNullableString(container.digest),
        ) &&
        isString(pod.createdAt),
    ) &&
    Array.isArray(value.events) &&
    value.events.every(
      (event) =>
        isRecord(event) &&
        isString(event.id) &&
        isString(event.namespace) &&
        isString(event.resource) &&
        isHealthStatus(event.status) &&
        isString(event.reason) &&
        isString(event.message) &&
        isString(event.observedAt),
    ) &&
    isResourceMetrics(value.resources)
  );
}

const RESOURCE_NAMES: readonly ResourceName[] = ["cpu", "memory", "disk"];
const FIVE_MINUTES_MS = 5 * 60 * 1_000;

function sustainedMinutes(
  metric: ResourceMetrics["current"][number],
  history: ResourceHistory | undefined,
  threshold: number,
): number | null {
  const observedAt = Date.parse(metric.observedAt);
  if (Number.isNaN(observedAt) || !history) return null;
  const cutoff = observedAt - FIVE_MINUTES_MS;
  const points = history.points
    .map((point) => ({ ...point, timestampMs: Date.parse(point.timestamp) }))
    .filter((point) => !Number.isNaN(point.timestampMs) && point.timestampMs <= observedAt)
    .sort((left, right) => left.timestampMs - right.timestampMs);
  const anchor = points.filter((point) => point.timestampMs <= cutoff).at(-1);
  if (!anchor) return null;

  const relevant = [anchor, ...points.filter((point) => point.timestampMs > cutoff)];
  return metric.usagePercent >= threshold && relevant.every((point) => point.value >= threshold)
    ? 5
    : 0;
}

function unknownResource(resource: ResourceName): HealthEvaluation {
  return {
    status: "unknown",
    ruleId: `${resource}-usage-unknown`,
    reason: `${resource} usage is unavailable.`,
    evidence: { resource, usagePercent: null, sustainedMinutes: null },
  };
}

function evaluateResourceMetrics(resources: ResourceMetrics): HealthEvaluation[] {
  return RESOURCE_NAMES.map((resource) => {
    const current = resources.current.find((metric) => metric.resource === resource);
    if (!current) return unknownResource(resource);
    if (resource === "disk" || current.usagePercent < 85) {
      return evaluateResources({
        resource,
        usagePercent: current.usagePercent,
        sustainedMinutes: 0,
      });
    }

    const history = resources.history.find((series) => series.resource === resource);
    const warningMinutes = sustainedMinutes(current, history, 85);
    const criticalMinutes = sustainedMinutes(current, history, 95);
    if (warningMinutes === null || criticalMinutes === null) return unknownResource(resource);
    return evaluateResources({
      resource,
      usagePercent: current.usagePercent,
      sustainedMinutes: warningMinutes,
      criticalSustainedMinutes: criticalMinutes,
    });
  });
}

function healthIssue(
  evaluation: HealthEvaluation & { status: Exclude<HealthStatus, "healthy"> },
  resources: ResourceMetrics,
  observedAt: string,
  source: SourceName | null,
): HealthIssue {
  const resource = RESOURCE_NAMES.find((name) => evaluation.ruleId.startsWith(`${name}-`));
  const metric = resources.current.find((current) => current.resource === resource);
  return {
    ...evaluation,
    source,
    resource: resource ?? "resources",
    observedAt: metric?.observedAt ?? observedAt,
  };
}

function successfulClusterData(results: readonly SourceResult<unknown>[]): ClusterData | undefined {
  for (const result of results) {
    if (result.ok && isClusterData(result.data)) return result.data;
  }
  return undefined;
}

function successfulResourceMetrics(
  results: readonly SourceResult<unknown>[],
): ResourceMetrics | undefined {
  for (const result of results) {
    if (result.ok && result.source === "prometheus" && isResourceMetrics(result.data)) {
      return result.data;
    }
  }
  return undefined;
}

async function collectWithTimeout<T>(
  provider: Provider<T>,
  controller: AbortController,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const collection = provider.collect(controller.signal);
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error("provider timed out"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([collection, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function collectProviders<T>(
  providers: readonly Provider<T>[],
  timeoutMs: number,
  now: Now = () => new Date(),
): Promise<SourceResult<T>[]> {
  const controllers = providers.map(() => new AbortController());
  const settled = await Promise.allSettled(
    providers.map((provider, index) => collectWithTimeout(provider, controllers[index], timeoutMs)),
  );

  return settled.map((result, index) => {
    const source = providers[index].source;
    const observedAt = timestamp(now);

    if (result.status === "fulfilled") {
      return {
        source,
        ok: true,
        data: result.value,
        state: { source, status: "healthy", observedAt, stale: false },
      };
    }

    const error = sourceUnavailableMessage(source);
    return {
      source,
      ok: false,
      error,
      state: { source, status: "unknown", observedAt, stale: true, error },
    };
  });
}

export async function collectSnapshot(
  providers: readonly Provider<unknown>[],
  timeoutMs: number,
  now: Now = () => new Date(),
): Promise<Snapshot<unknown[]>> {
  const results = await collectProviders(providers, timeoutMs, now);
  const clusterData = successfulClusterData(results);
  const resources = successfulResourceMetrics(results);
  const mergedCluster = clusterData && resources ? { ...clusterData, resources } : undefined;
  const resourcesForHealth = resources ?? clusterData?.resources;
  const resourceIssueSource = results.some((result) => result.source === "prometheus")
    ? "prometheus"
    : null;
  const successfulData = results.flatMap((result) => {
    if (!result.ok) return [];
    if (mergedCluster && result.data === resources) return [];
    if (mergedCluster && result.data === clusterData) return [mergedCluster];
    return [result.data];
  });
  const hasFailures = results.some((result) => !result.ok);
  const resourceEvaluations = resourcesForHealth ? evaluateResourceMetrics(resourcesForHealth) : [];
  const resourceRollup = rollUpStatus(resourceEvaluations);
  const status: HealthStatus =
    resourceRollup.status === "critical" || resourceRollup.status === "warning"
      ? resourceRollup.status
      : hasFailures || results.length === 0 || resourceRollup.status === "unknown"
        ? "unknown"
        : "healthy";
  const observedAt = timestamp(now);
  const issues = resourceEvaluations
    .filter(
      (evaluation): evaluation is HealthEvaluation & { status: Exclude<HealthStatus, "healthy"> } =>
        evaluation.status !== "healthy",
    )
    .map((evaluation) =>
      healthIssue(evaluation, resourcesForHealth!, observedAt, resourceIssueSource),
    );

  return {
    data: successfulData.length > 0 ? successfulData : null,
    status,
    observedAt,
    stale: hasFailures || results.length === 0,
    issues,
    sources: results.map((result) => result.state),
  };
}

export async function collectDeploymentSnapshot(
  providers: readonly Provider<unknown>[],
  timeoutMs: number,
  now: Now = () => new Date(),
): Promise<DeploymentSnapshot> {
  const collected = await collectProviders(providers, timeoutMs, now);
  const results: SourceResult<unknown>[] = collected.map((result) => {
    const invalidGitHub = result.ok && result.source === "github" && !isWorkflowRun(result.data);
    const invalidArgo =
      result.ok && result.source === "argocd" && !isArgoApplicationState(result.data);
    const invalidKubernetes =
      result.ok && result.source === "kubernetes" && !isClusterData(result.data);
    if (!invalidGitHub && !invalidArgo && !invalidKubernetes) return result;

    const error = sourceUnavailableMessage(result.source);
    return {
      source: result.source,
      ok: false,
      error,
      state: { ...result.state, status: "unknown", stale: true, error },
    };
  });
  const workflow = results.find((result) => result.ok && result.source === "github");
  const application = results.find((result) => result.ok && result.source === "argocd");
  const cluster = results.find(
    (result) => result.ok && result.source === "kubernetes" && isClusterData(result.data),
  );
  const successful = results.some((result) => result.ok);
  const observedAt = timestamp(now);

  if (!successful) {
    return {
      data: null,
      status: "unknown",
      observedAt,
      stale: true,
      issues: [],
      sources: results.map((result) => result.state),
    };
  }

  const state = correlateDeployment({
    workflow: workflow?.ok && isWorkflowRun(workflow.data) ? workflow.data : null,
    application:
      application?.ok && isArgoApplicationState(application.data) ? application.data : null,
    kubernetes:
      cluster?.ok && isClusterData(cluster.data)
        ? {
            workloads: cluster.data.workloads,
            pods: cluster.data.pods.map((pod) => ({
              name: pod.name,
              namespace: pod.namespace,
              ready: pod.ready,
              containerImages: pod.containerImages,
            })),
          }
        : null,
    observedAt,
  });
  const hasFailures = results.some((result) => !result.ok);

  return {
    data: { applications: [state] },
    status:
      state.status === "critical" || state.status === "warning"
        ? state.status
        : hasFailures
          ? "unknown"
          : state.status,
    observedAt,
    stale: hasFailures || state.status === "unknown",
    issues: state.issues,
    sources: results.map((result) => result.state),
  };
}
