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
import { readDenseArray, readOwnDataProperties } from "./runtime-validation";

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

function parseDenseArray<T>(value: unknown, parse: (entry: unknown) => T | null): T[] | null {
  const entries = readDenseArray(value);
  if (!entries) return null;

  const parsed: T[] = [];
  for (const entry of entries) {
    const result = parse(entry);
    if (result === null) return null;
    parsed.push(result);
  }
  return parsed;
}

function parseString(value: unknown): string | null {
  return isString(value) ? value : null;
}

function parseMetricPoint(value: unknown): ResourceHistory["points"][number] | null {
  const properties = readOwnDataProperties(value, ["timestamp", "value"]);
  if (!properties || !isString(properties.timestamp) || !isFiniteNumber(properties.value)) {
    return null;
  }
  return { timestamp: properties.timestamp, value: properties.value };
}

function parseResourceMetrics(value: unknown): ResourceMetrics | null {
  const properties = readOwnDataProperties(value, ["current", "history"]);
  if (!properties) return null;

  const current = parseDenseArray<ResourceMetrics["current"][number]>(
    properties.current,
    (metric) => {
      const fields = readOwnDataProperties(metric, ["resource", "usagePercent", "observedAt"]);
      if (
        !fields ||
        !isResourceName(fields.resource) ||
        !isFiniteNumber(fields.usagePercent) ||
        !isString(fields.observedAt)
      ) {
        return null;
      }
      return {
        resource: fields.resource,
        usagePercent: fields.usagePercent,
        observedAt: fields.observedAt,
      };
    },
  );
  const history = parseDenseArray<ResourceHistory>(properties.history, (series) => {
    const fields = readOwnDataProperties(series, ["resource", "points"]);
    if (!fields || !isResourceName(fields.resource)) return null;
    const points = parseDenseArray(fields.points, parseMetricPoint);
    return points ? { resource: fields.resource, points } : null;
  });
  return current && history ? { current, history } : null;
}

function parseClusterData(value: unknown): ClusterData | null {
  const properties = readOwnDataProperties(value, [
    "nodes",
    "namespaces",
    "workloads",
    "pods",
    "events",
    "resources",
  ]);
  if (!properties) return null;

  const nodes = parseDenseArray<ClusterData["nodes"][number]>(properties.nodes, (node) => {
    const fields = readOwnDataProperties(node, ["name", "ready", "status", "conditions"]);
    if (
      !fields ||
      !isString(fields.name) ||
      typeof fields.ready !== "boolean" ||
      !isHealthStatus(fields.status)
    ) {
      return null;
    }
    const conditions = parseDenseArray(fields.conditions, parseString);
    return conditions
      ? { name: fields.name, ready: fields.ready, status: fields.status, conditions }
      : null;
  });
  const namespaces = parseDenseArray<ClusterData["namespaces"][number]>(
    properties.namespaces,
    (namespace) => {
      const fields = readOwnDataProperties(namespace, [
        "name",
        "status",
        "workloadCount",
        "podCount",
      ]);
      if (
        !fields ||
        !isString(fields.name) ||
        !isHealthStatus(fields.status) ||
        !isFiniteNumber(fields.workloadCount) ||
        !isFiniteNumber(fields.podCount)
      ) {
        return null;
      }
      return {
        name: fields.name,
        status: fields.status,
        workloadCount: fields.workloadCount,
        podCount: fields.podCount,
      };
    },
  );
  const workloads = parseDenseArray<ClusterData["workloads"][number]>(
    properties.workloads,
    (workload) => {
      const fields = readOwnDataProperties(workload, [
        "kind",
        "name",
        "namespace",
        "status",
        "desiredReplicas",
        "availableReplicas",
        "failureReason",
        "restartIncrease15m",
      ]);
      if (
        !fields ||
        !isString(fields.kind) ||
        !isString(fields.name) ||
        !isString(fields.namespace) ||
        !isHealthStatus(fields.status) ||
        !isFiniteNumber(fields.desiredReplicas) ||
        !isFiniteNumber(fields.availableReplicas) ||
        !isNullableString(fields.failureReason) ||
        typeof fields.restartIncrease15m !== "boolean"
      ) {
        return null;
      }
      return {
        kind: fields.kind,
        name: fields.name,
        namespace: fields.namespace,
        status: fields.status,
        desiredReplicas: fields.desiredReplicas,
        availableReplicas: fields.availableReplicas,
        failureReason: fields.failureReason,
        restartIncrease15m: fields.restartIncrease15m,
      };
    },
  );
  const pods = parseDenseArray<ClusterData["pods"][number]>(properties.pods, (pod) => {
    const fields = readOwnDataProperties(pod, [
      "name",
      "namespace",
      "status",
      "ready",
      "restartCount",
      "node",
      "image",
      "imageTag",
      "imageDigest",
      "containerImages",
      "createdAt",
    ]);
    if (
      !fields ||
      !isString(fields.name) ||
      !isString(fields.namespace) ||
      !isHealthStatus(fields.status) ||
      typeof fields.ready !== "boolean" ||
      !isFiniteNumber(fields.restartCount) ||
      !isNullableString(fields.node) ||
      !isNullableString(fields.image) ||
      !isNullableString(fields.imageTag) ||
      !isNullableString(fields.imageDigest) ||
      !isString(fields.createdAt)
    ) {
      return null;
    }
    const containerImages = parseDenseArray(fields.containerImages, (container) => {
      const image = readOwnDataProperties(container, [
        "name",
        "repository",
        "reference",
        "tag",
        "digest",
      ]);
      if (
        !image ||
        !isString(image.name) ||
        !isNullableString(image.repository) ||
        !isNullableString(image.reference) ||
        !isNullableString(image.tag) ||
        !isNullableString(image.digest)
      ) {
        return null;
      }
      return {
        name: image.name,
        repository: image.repository,
        reference: image.reference,
        tag: image.tag,
        digest: image.digest,
      };
    });
    return containerImages
      ? {
          name: fields.name,
          namespace: fields.namespace,
          status: fields.status,
          ready: fields.ready,
          restartCount: fields.restartCount,
          node: fields.node,
          image: fields.image,
          imageTag: fields.imageTag,
          imageDigest: fields.imageDigest,
          containerImages,
          createdAt: fields.createdAt,
        }
      : null;
  });
  const events = parseDenseArray<ClusterData["events"][number]>(properties.events, (event) => {
    const fields = readOwnDataProperties(event, [
      "id",
      "namespace",
      "resource",
      "status",
      "reason",
      "message",
      "observedAt",
    ]);
    if (
      !fields ||
      !isString(fields.id) ||
      !isString(fields.namespace) ||
      !isString(fields.resource) ||
      !isHealthStatus(fields.status) ||
      !isString(fields.reason) ||
      !isString(fields.message) ||
      !isString(fields.observedAt)
    ) {
      return null;
    }
    return {
      id: fields.id,
      namespace: fields.namespace,
      resource: fields.resource,
      status: fields.status,
      reason: fields.reason,
      message: fields.message,
      observedAt: fields.observedAt,
    };
  });
  const resources = parseResourceMetrics(properties.resources);

  return nodes && namespaces && workloads && pods && events && resources
    ? { nodes, namespaces, workloads, pods, events, resources }
    : null;
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

interface ValidatedSourceData<T> {
  sourceData: unknown;
  data: T;
}

function successfulClusterData(
  results: readonly SourceResult<unknown>[],
): ValidatedSourceData<ClusterData> | undefined {
  for (const result of results) {
    if (!result.ok) continue;
    const cluster = parseClusterData(result.data);
    if (cluster) return { sourceData: result.data, data: cluster };
  }
  return undefined;
}

function successfulResourceMetrics(
  results: readonly SourceResult<unknown>[],
): ValidatedSourceData<ResourceMetrics> | undefined {
  for (const result of results) {
    if (result.ok && result.source === "prometheus") {
      const resources = parseResourceMetrics(result.data);
      if (resources) return { sourceData: result.data, data: resources };
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
  const clusterResult = successfulClusterData(results);
  const resourceResult = successfulResourceMetrics(results);
  const clusterData = clusterResult?.data;
  const resources = resourceResult?.data;
  const mergedCluster = clusterData && resources ? { ...clusterData, resources } : undefined;
  const resourcesForHealth = resources ?? clusterData?.resources;
  const resourceIssueSource = results.some((result) => result.source === "prometheus")
    ? "prometheus"
    : null;
  const successfulData = results.flatMap((result) => {
    if (!result.ok) return [];
    if (result.data === resourceResult?.sourceData) return mergedCluster ? [] : [resources!];
    if (result.data === clusterResult?.sourceData) return [mergedCluster ?? clusterData!];
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
    const clusterData =
      result.ok && result.source === "kubernetes" ? parseClusterData(result.data) : null;
    const invalidKubernetes = result.ok && result.source === "kubernetes" && !clusterData;
    if (clusterData) return { ...result, data: clusterData };
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
  const cluster = results.find((result) => result.ok && result.source === "kubernetes");
  const clusterData = cluster?.ok ? parseClusterData(cluster.data) : null;
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
    kubernetes: clusterData
      ? {
          workloads: clusterData.workloads,
          pods: clusterData.pods.map((pod) => ({
            name: pod.name,
            namespace: pod.namespace,
            status: pod.status,
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
