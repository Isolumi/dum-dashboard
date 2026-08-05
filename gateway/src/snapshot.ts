import type {
  ClusterData,
  ClusterSnapshot,
  DeploymentSnapshot,
  HealthIssue,
  HealthStatus,
  OverviewSnapshot,
  RecentActivity,
  ResourceHistory,
  ResourceMetrics,
  ResourceName,
  ServiceSnapshot,
  ServiceSummary,
  Snapshot,
  SourceName,
  SourceState,
} from "../../shared/homelab/contracts";
import {
  evaluateResources,
  evaluateSourceFreshness,
  rollUpStatus,
  type HealthEvaluation,
} from "../../shared/homelab/health-rules";
import type { Provider } from "./providers/provider";
import type { ServiceCatalogEntry } from "./service-catalog";
import type { ServiceProbeResult } from "./service-probe";
import { correlateValidatedDeployment, type DeploymentTargetName } from "./deployment-correlation";
import { parseArgoApplicationState } from "./providers/argocd";
import { parseWorkflowRun } from "./providers/github";
import {
  isNonNegativeInteger,
  readDenseArray,
  readOwnDataProperties,
  readOwnDataRecord,
  RUNTIME_COLLECTION_LIMITS,
} from "./runtime-validation";

export type Now = () => Date;

const DEPLOYMENT_NAMESPACE = "yootoob-mp3";
const DEPLOYMENT_TARGETS: readonly DeploymentTargetName[] = [
  "yootoob-mp3-api",
  "yootoob-mp3-frontend",
];

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

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || (isString(value) && Number.isFinite(Date.parse(value)));
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

function parseString(value: unknown): string | null {
  return isString(value) ? value : null;
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isPrivateHttpsUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function parseServiceCatalogEntry(value: unknown): ServiceCatalogEntry | null {
  const properties = readOwnDataProperties(value, [
    "id",
    "name",
    "description",
    "url",
    "namespace",
    "argoApplication",
    "workloads",
  ]);
  if (
    !properties ||
    !isNonEmptyString(properties.id) ||
    !isNonEmptyString(properties.name) ||
    !isNonEmptyString(properties.description) ||
    !isPrivateHttpsUrl(properties.url) ||
    !isNonEmptyString(properties.namespace) ||
    !isNonEmptyString(properties.argoApplication)
  ) {
    return null;
  }

  const workloads = parseDenseArray(properties.workloads, 32, (workload) => {
    const fields = readOwnDataProperties(workload, ["kind", "name"]);
    if (!fields || !isNonEmptyString(fields.kind) || !isNonEmptyString(fields.name)) return null;
    return { kind: fields.kind, name: fields.name };
  });
  if (!workloads || workloads.length === 0) return null;

  return {
    id: properties.id,
    name: properties.name,
    description: properties.description,
    url: properties.url,
    namespace: properties.namespace,
    argoApplication: properties.argoApplication,
    workloads,
  };
}

function parseServiceProbeResult(value: unknown): ServiceProbeResult | null {
  const record = readOwnDataRecord(value);
  const properties = readOwnDataProperties(value, [
    "entry",
    "id",
    "reachable",
    "status",
    "latencyMs",
    "certificateExpiresAt",
    "consecutiveFailures",
  ]);
  const entry = properties ? parseServiceCatalogEntry(properties.entry) : null;
  if (
    !record ||
    !properties ||
    !entry ||
    properties.id !== entry.id ||
    typeof properties.reachable !== "boolean" ||
    !isHealthStatus(properties.status) ||
    !isFiniteNumber(properties.latencyMs) ||
    properties.latencyMs < 0 ||
    !isNullableString(properties.certificateExpiresAt) ||
    !isNonNegativeInteger(properties.consecutiveFailures)
  ) {
    return null;
  }
  if (record.has("error") && !isString(record.get("error"))) return null;

  return {
    entry,
    id: entry.id,
    reachable: properties.reachable,
    status: properties.status,
    latencyMs: properties.latencyMs,
    certificateExpiresAt: properties.certificateExpiresAt,
    consecutiveFailures: properties.consecutiveFailures,
  };
}

function parseServiceProbeResults(value: unknown): ServiceProbeResult[] | null {
  return parseDenseArray(value, 64, parseServiceProbeResult);
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
    RUNTIME_COLLECTION_LIMITS.currentResourceMetrics,
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
  const history = parseDenseArray<ResourceHistory>(
    properties.history,
    RUNTIME_COLLECTION_LIMITS.resourceHistory,
    (series) => {
      const fields = readOwnDataProperties(series, ["resource", "points"]);
      if (!fields || !isResourceName(fields.resource)) return null;
      const points = parseDenseArray(
        fields.points,
        RUNTIME_COLLECTION_LIMITS.metricPoints,
        parseMetricPoint,
      );
      return points ? { resource: fields.resource, points } : null;
    },
  );
  return current && history ? { current, history } : null;
}

function deploymentTargetForPod(name: unknown, namespace: unknown): DeploymentTargetName | null {
  if (typeof name !== "string" || namespace !== DEPLOYMENT_NAMESPACE) return null;
  return (
    DEPLOYMENT_TARGETS.find((target) => name === target || name.startsWith(`${target}-`)) ?? null
  );
}

function parseClusterData(
  value: unknown,
  invalidContainerTargets?: Set<DeploymentTargetName>,
): ClusterData | null {
  const properties = readOwnDataProperties(value, [
    "nodes",
    "namespaces",
    "workloads",
    "pods",
    "events",
    "resources",
  ]);
  if (!properties) return null;

  const nodes = parseDenseArray<ClusterData["nodes"][number]>(
    properties.nodes,
    RUNTIME_COLLECTION_LIMITS.nodes,
    (node) => {
      const fields = readOwnDataProperties(node, ["name", "ready", "status", "conditions"]);
      if (
        !fields ||
        !isString(fields.name) ||
        typeof fields.ready !== "boolean" ||
        !isHealthStatus(fields.status)
      ) {
        return null;
      }
      const conditions = parseDenseArray(
        fields.conditions,
        RUNTIME_COLLECTION_LIMITS.nodeConditions,
        parseString,
      );
      return conditions
        ? {
            name: fields.name,
            ready: fields.ready,
            status: fields.status,
            conditions,
          }
        : null;
    },
  );
  const namespaces = parseDenseArray<ClusterData["namespaces"][number]>(
    properties.namespaces,
    RUNTIME_COLLECTION_LIMITS.namespaces,
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
    RUNTIME_COLLECTION_LIMITS.workloads,
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
        "createdAt",
        "revision",
      ]);
      if (
        !fields ||
        !isString(fields.kind) ||
        !isString(fields.name) ||
        !isString(fields.namespace) ||
        !isHealthStatus(fields.status) ||
        !isNonNegativeInteger(fields.desiredReplicas) ||
        !isNonNegativeInteger(fields.availableReplicas) ||
        !isNullableString(fields.failureReason) ||
        typeof fields.restartIncrease15m !== "boolean" ||
        !isNullableTimestamp(fields.createdAt) ||
        !isNullableString(fields.revision)
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
        createdAt: fields.createdAt,
        revision: fields.revision,
      };
    },
  );
  const pods = parseDenseArray<ClusterData["pods"][number]>(
    properties.pods,
    RUNTIME_COLLECTION_LIMITS.pods,
    (pod) => {
      const fields = readOwnDataRecord(pod);
      const name = fields?.get("name");
      const namespace = fields?.get("namespace");
      if (
        !fields ||
        !fields.has("name") ||
        !fields.has("namespace") ||
        !fields.has("status") ||
        !fields.has("ready") ||
        !fields.has("restartCount") ||
        !fields.has("node") ||
        !fields.has("image") ||
        !fields.has("imageTag") ||
        !fields.has("imageDigest") ||
        !fields.has("createdAt") ||
        !isString(name) ||
        !isString(namespace) ||
        !isHealthStatus(fields.get("status")) ||
        typeof fields.get("ready") !== "boolean" ||
        !isFiniteNumber(fields.get("restartCount")) ||
        !isNullableString(fields.get("node")) ||
        !isNullableString(fields.get("image")) ||
        !isNullableString(fields.get("imageTag")) ||
        !isNullableString(fields.get("imageDigest")) ||
        !isString(fields.get("createdAt"))
      ) {
        return null;
      }
      const containerImages = fields.has("containerImages")
        ? parseDenseArray(
            fields.get("containerImages"),
            RUNTIME_COLLECTION_LIMITS.podContainerImages,
            (container) => {
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
            },
          )
        : null;
      if (!containerImages) {
        const target = deploymentTargetForPod(name, namespace);
        if (target) invalidContainerTargets?.add(target);
        return null;
      }
      return {
        name,
        namespace,
        status: fields.get("status") as HealthStatus,
        ready: fields.get("ready") as boolean,
        restartCount: fields.get("restartCount") as number,
        node: fields.get("node") as string | null,
        image: fields.get("image") as string | null,
        imageTag: fields.get("imageTag") as string | null,
        imageDigest: fields.get("imageDigest") as string | null,
        containerImages,
        createdAt: fields.get("createdAt") as string,
      };
    },
  );
  const events = parseDenseArray<ClusterData["events"][number]>(
    properties.events,
    RUNTIME_COLLECTION_LIMITS.events,
    (event) => {
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
    },
  );
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
      const observation = providers[index].observation?.();
      const sourceObservedAt = observation?.observedAt ?? observedAt;
      const stale = observation?.stale ?? false;
      return {
        source,
        ok: true,
        data: result.value,
        state: {
          source,
          status: stale ? ("unknown" as const) : ("healthy" as const),
          observedAt: sourceObservedAt,
          stale,
          ...(observation?.error ? { error: observation.error } : {}),
        },
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
  const freshnessEvaluations = (resourcesForHealth?.current ?? []).map((metric) => ({
    metric,
    evaluation: evaluateSourceFreshness(metric.observedAt, now().getTime()),
  }));
  const freshnessRollup = rollUpStatus(freshnessEvaluations.map(({ evaluation }) => evaluation));
  const staleResources = freshnessRollup.status === "unknown";
  const status: HealthStatus =
    resourceRollup.status === "critical" || resourceRollup.status === "warning"
      ? resourceRollup.status
      : hasFailures || results.length === 0 || resourceRollup.status === "unknown" || staleResources
        ? "unknown"
        : "healthy";
  const observedAt = timestamp(now);
  const resourceIssues = resourceEvaluations
    .filter(
      (
        evaluation,
      ): evaluation is HealthEvaluation & {
        status: Exclude<HealthStatus, "healthy">;
      } => evaluation.status !== "healthy",
    )
    .map((evaluation) =>
      healthIssue(evaluation, resourcesForHealth!, observedAt, resourceIssueSource),
    );
  const freshnessIssues: HealthIssue[] = freshnessEvaluations
    .filter(
      (
        result,
      ): result is typeof result & {
        evaluation: HealthEvaluation & { status: "unknown" };
      } => result.evaluation.status === "unknown",
    )
    .map(({ metric, evaluation }) => ({
      ...evaluation,
      source: resourceIssueSource,
      resource: metric.resource,
      observedAt: metric.observedAt,
    }));
  const resourceSourceData = resourceResult?.sourceData ?? clusterResult?.sourceData;
  const oldestResourceObservation = (resourcesForHealth?.current ?? []).reduce<
    ResourceMetrics["current"][number] | null
  >((oldest, metric) => {
    if (!oldest) return metric;
    const oldestTime = Date.parse(oldest.observedAt);
    const metricTime = Date.parse(metric.observedAt);
    if (Number.isNaN(oldestTime)) return oldest;
    if (Number.isNaN(metricTime) || metricTime < oldestTime) return metric;
    return oldest;
  }, null);
  const sources = results.map((result) => {
    if (!result.ok || result.data !== resourceSourceData || oldestResourceObservation === null) {
      return result.state;
    }

    return {
      ...result.state,
      status: staleResources ? ("unknown" as const) : result.state.status,
      observedAt: oldestResourceObservation.observedAt,
      stale: result.state.stale || staleResources,
      ...(staleResources
        ? {
            error: `${sourceUnavailableMessage(result.source).replace(" unavailable", "")} observation is stale`,
          }
        : {}),
    };
  });

  return {
    data: successfulData.length > 0 ? successfulData : null,
    status,
    observedAt,
    stale: hasFailures || results.length === 0 || staleResources,
    issues: [...resourceIssues, ...freshnessIssues],
    sources,
  };
}

export async function collectClusterSnapshot(
  providers: readonly Provider<unknown>[],
  timeoutMs: number,
  now: Now = () => new Date(),
): Promise<ClusterSnapshot> {
  const snapshot = await collectSnapshot(providers, timeoutMs, now);
  const data = snapshot.data?.map((value) => parseClusterData(value)).find(Boolean) ?? null;
  const entityIssues: HealthIssue[] = data
    ? [
        ...data.nodes.flatMap((node) =>
          node.status === "healthy"
            ? []
            : [
                {
                  ruleId: "cluster-node-unhealthy",
                  status: node.status,
                  reason: "Kubernetes node health needs attention.",
                  source: "kubernetes" as const,
                  resource: `Node/${node.name}`,
                  observedAt: snapshot.observedAt,
                  evidence: { name: node.name, ready: node.ready },
                },
              ],
        ),
        ...data.workloads.flatMap((workload) =>
          workload.status === "healthy"
            ? []
            : [
                {
                  ruleId: "cluster-workload-unhealthy",
                  status: workload.status,
                  reason: "Kubernetes workload health needs attention.",
                  source: "kubernetes" as const,
                  resource: `${workload.kind}/${workload.namespace}/${workload.name}`,
                  observedAt: snapshot.observedAt,
                  evidence: {
                    desiredReplicas: workload.desiredReplicas,
                    availableReplicas: workload.availableReplicas,
                    failureReason: workload.failureReason,
                  },
                },
              ],
        ),
        ...data.pods.flatMap((pod) =>
          pod.status === "healthy"
            ? []
            : [
                {
                  ruleId: "cluster-pod-unhealthy",
                  status: pod.status,
                  reason: "Kubernetes pod health needs attention.",
                  source: "kubernetes" as const,
                  resource: `Pod/${pod.namespace}/${pod.name}`,
                  observedAt: snapshot.observedAt,
                  evidence: {
                    ready: pod.ready,
                    restartCount: pod.restartCount,
                    node: pod.node,
                  },
                },
              ],
        ),
      ]
    : [];
  const entityStatuses = data
    ? [
        ...data.nodes.map(({ status }) => status),
        ...data.workloads.map(({ status }) => status),
        ...data.pods.map(({ status }) => status),
      ]
    : [];

  return {
    ...snapshot,
    data,
    status: data ? highestPriorityStatus([snapshot.status, ...entityStatuses]) : "unknown",
    stale: snapshot.stale || data === null,
    issues: [...snapshot.issues, ...entityIssues],
  };
}

export async function collectDeploymentSnapshot(
  providers: readonly Provider<unknown>[],
  timeoutMs: number,
  now: Now = () => new Date(),
): Promise<DeploymentSnapshot> {
  const collected = await collectProviders(providers, timeoutMs, now);
  let workflow: ReturnType<typeof parseWorkflowRun> = null;
  let application: ReturnType<typeof parseArgoApplicationState> = null;
  let clusterData: ClusterData | null = null;
  const invalidContainerTargets = new Set<DeploymentTargetName>();
  const results: SourceResult<unknown>[] = [];
  for (const result of collected) {
    if (!result.ok) {
      results.push(result);
      continue;
    }

    if (result.source === "github") {
      const parsed = parseWorkflowRun(result.data);
      if (parsed) {
        workflow ??= parsed;
        results.push({
          source: result.source,
          ok: true,
          data: parsed,
          state: result.state,
        });
        continue;
      }
    } else if (result.source === "argocd") {
      const parsed = parseArgoApplicationState(result.data);
      if (parsed) {
        application ??= parsed;
        results.push({
          source: result.source,
          ok: true,
          data: parsed,
          state: result.state,
        });
        continue;
      }
    } else if (result.source === "kubernetes") {
      const parsed = parseClusterData(result.data, invalidContainerTargets);
      if (parsed) {
        clusterData ??= parsed;
        results.push({
          source: result.source,
          ok: true,
          data: parsed,
          state: result.state,
        });
        continue;
      }
    } else {
      results.push(result);
      continue;
    }

    const error = sourceUnavailableMessage(result.source);
    results.push({
      source: result.source,
      ok: false,
      error,
      state: { ...result.state, status: "unknown", stale: true, error },
    });
  }
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

  const state = correlateValidatedDeployment(
    {
      workflow,
      application,
      kubernetes: clusterData
        ? {
            workloads: clusterData.workloads,
            pods: clusterData.pods,
          }
        : null,
      observedAt,
    },
    [...invalidContainerTargets],
  );
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

export async function collectServiceSnapshot(
  providers: readonly Provider<unknown>[],
  timeoutMs: number,
  now: Now = () => new Date(),
): Promise<ServiceSnapshot> {
  const collected = await collectProviders(providers, timeoutMs, now);
  const results: SourceResult<unknown>[] = [];
  const probes: ServiceProbeResult[] = [];
  let cluster: ClusterData | null = null;
  let application: ReturnType<typeof parseArgoApplicationState> = null;
  for (const result of collected) {
    if (!result.ok) {
      results.push(result);
      continue;
    }

    if (result.source === "service-probe") {
      const parsed = parseServiceProbeResults(result.data);
      if (parsed) {
        probes.push(...parsed);
        results.push({
          source: result.source,
          ok: true,
          data: parsed,
          state: result.state,
        });
        continue;
      }
    } else if (result.source === "kubernetes") {
      const parsed = parseClusterData(result.data);
      if (parsed) {
        cluster = parsed;
        results.push({
          source: result.source,
          ok: true,
          data: parsed,
          state: result.state,
        });
        continue;
      }
    } else if (result.source === "argocd") {
      const parsed = parseArgoApplicationState(result.data);
      if (parsed) {
        application = parsed;
        results.push({
          source: result.source,
          ok: true,
          data: parsed,
          state: result.state,
        });
        continue;
      }
    } else {
      results.push(result);
      continue;
    }

    const error = sourceUnavailableMessage(result.source);
    results.push({
      source: result.source,
      ok: false,
      error,
      state: { ...result.state, status: "unknown", stale: true, error },
    });
  }
  const observedAt = timestamp(now);
  const argoHealthStatus = (probe: ServiceProbeResult): HealthStatus => {
    if (!application || application.name !== probe.entry.argoApplication) return "unknown";
    if (application.health.status === "Healthy" && application.sync.status === "Synced") {
      return "healthy";
    }
    if (["Degraded", "Missing"].includes(application.health.status)) return "critical";
    if (["Progressing", "Suspended"].includes(application.health.status)) return "warning";
    return "unknown";
  };
  const services: ServiceSummary[] = probes.map((probe) => {
    const relatedPods = cluster
      ? cluster.pods.filter(
          (pod) =>
            pod.namespace === probe.entry.namespace &&
            probe.entry.workloads.some(
              (workload) => pod.name === workload.name || pod.name.startsWith(`${workload.name}-`),
            ),
        )
      : [];
    const workloads = probe.entry.workloads.map((catalogWorkload) => {
      const workload = cluster?.workloads.find(
        (candidate) =>
          candidate.namespace === probe.entry.namespace &&
          candidate.kind === catalogWorkload.kind &&
          candidate.name === catalogWorkload.name,
      );
      const pods = relatedPods.filter(
        (pod) =>
          pod.name === catalogWorkload.name || pod.name.startsWith(`${catalogWorkload.name}-`),
      );
      const versions = [
        ...pods.flatMap((pod) =>
          pod.containerImages.flatMap((image) => image.reference ?? image.digest ?? []),
        ),
        ...pods.flatMap((pod) => pod.imageTag ?? pod.image ?? []),
      ].filter((version, index, all) => all.indexOf(version) === index);
      return {
        kind: catalogWorkload.kind,
        name: catalogWorkload.name,
        status: workload?.status ?? "unknown",
        version: versions[0] ?? null,
        createdAt: workload?.createdAt ?? null,
        desiredReplicas: workload?.desiredReplicas ?? null,
        availableReplicas: workload?.availableReplicas ?? null,
        podCount: cluster ? pods.length : null,
      };
    });
    const argoStatus = argoHealthStatus(probe);
    const status = rollUpStatus([
      {
        status: probe.status,
        ruleId: "service-probe",
        reason: "Service endpoint and certificate were probed.",
        evidence: { reachable: probe.reachable },
      },
      {
        status: argoStatus,
        ruleId: "service-argocd",
        reason: "Argo CD application state was inspected.",
        evidence: { application: probe.entry.argoApplication },
      },
      ...workloads.map((workload) => ({
        status: workload.status,
        ruleId: "service-workload",
        reason: "Kubernetes workload state was inspected.",
        evidence: { workload: workload.name },
      })),
    ]).status;
    const reason = !probe.reachable
      ? "The service endpoint is not currently reachable."
      : status === "critical"
        ? "The endpoint or deployment has a critical health problem."
        : status === "warning"
          ? "The endpoint is reachable, but the certificate or deployment needs attention."
          : argoStatus === "unknown" || workloads.some(({ status }) => status === "unknown")
            ? "The endpoint is reachable, but deployment state is unavailable."
            : "Endpoint, certificate, Argo CD, and workloads are healthy.";

    return {
      name: probe.entry.name,
      description: probe.entry.description,
      status,
      url: probe.entry.url,
      certificateExpiresAt: probe.certificateExpiresAt,
      probeLatencyMs: probe.latencyMs,
      namespace: probe.entry.namespace,
      workload: probe.entry.workloads.map(({ kind, name }) => `${kind}/${name}`).join(", "),
      image: workloads[0]?.version ?? null,
      observedAt,
      reachable: probe.reachable,
      reason,
      argoApplication: probe.entry.argoApplication,
      argoStatus,
      relatedPodCount: cluster ? relatedPods.length : null,
      workloads,
    };
  });
  const hasFailures = results.some((result) => !result.ok);
  const missingDeploymentEvidence = cluster === null || application === null;
  const status = rollUpStatus(
    services.map((service) => ({
      status: service.status,
      ruleId: "service-probe",
      reason: "Service probe completed.",
      evidence: { name: service.name },
    })),
  ).status;
  const issues: HealthIssue[] = services.flatMap((service) =>
    service.status === "healthy"
      ? []
      : [
          {
            ruleId: "service-unhealthy",
            status: service.status,
            reason: service.reason,
            source: null,
            resource: `Service/${service.name}`,
            observedAt: service.observedAt,
            evidence: {
              reachable: service.reachable,
              argoApplication: service.argoApplication,
              argoStatus: service.argoStatus,
            },
          },
        ],
  );
  const snapshotStatus: HealthStatus =
    services.length === 0
      ? "unknown"
      : status === "critical" || status === "warning"
        ? status
        : hasFailures || missingDeploymentEvidence
          ? "unknown"
          : status;

  return {
    data: services.length > 0 ? { services } : null,
    status: snapshotStatus,
    observedAt,
    stale: hasFailures || missingDeploymentEvidence || services.length === 0,
    issues,
    sources: results.map((result) => result.state),
  };
}

export interface OverviewProviderGroups {
  cluster: readonly Provider<unknown>[];
  deployments: readonly Provider<unknown>[];
  services: readonly Provider<unknown>[];
}

interface CertificateObservation {
  expiresAt: string | null;
  status: HealthStatus;
}

const CERTIFICATE_WARNING_WINDOW_MS = 14 * 24 * 60 * 60 * 1_000;

function certificateStatus(expiresAt: string | null, observedAt: string): HealthStatus {
  if (expiresAt === null) return "unknown";
  const expiryTime = Date.parse(expiresAt);
  const observedTime = Date.parse(observedAt);
  if (!Number.isFinite(expiryTime) || !Number.isFinite(observedTime)) return "unknown";
  if (expiryTime <= observedTime) return "critical";
  if (expiryTime - observedTime <= CERTIFICATE_WARNING_WINDOW_MS) return "warning";
  return "healthy";
}

function certificateActivityMessage(
  service: ServiceSummary,
  previous: CertificateObservation,
  current: CertificateObservation,
): string {
  if (
    previous.expiresAt !== null &&
    current.expiresAt !== null &&
    Date.parse(current.expiresAt) > Date.parse(previous.expiresAt)
  ) {
    return `Certificate for ${service.name} was renewed; it now expires ${current.expiresAt}.`;
  }
  if (current.status === "critical") return `Certificate for ${service.name} has expired.`;
  if (current.status === "warning") {
    return `Certificate for ${service.name} expires within 14 days.`;
  }
  if (current.expiresAt === null) {
    return `Certificate expiry for ${service.name} is unavailable.`;
  }
  return `Certificate expiry for ${service.name} changed to ${current.expiresAt}.`;
}

export class CertificateActivityTracker {
  private readonly observations = new Map<string, CertificateObservation>();
  private activity: RecentActivity[] = [];

  observe(services: readonly ServiceSummary[], observedAt: string): RecentActivity[] {
    const changes: RecentActivity[] = [];

    for (const service of services) {
      const key = service.url;
      const current = {
        expiresAt: service.certificateExpiresAt,
        status: certificateStatus(service.certificateExpiresAt, observedAt),
      };
      const previous = this.observations.get(key);
      this.observations.set(key, current);
      if (
        !previous ||
        (previous.expiresAt === current.expiresAt && previous.status === current.status)
      ) {
        continue;
      }

      changes.push({
        id: `certificate:${service.name}:${observedAt}`,
        resource: `Certificate/${service.name}`,
        message: certificateActivityMessage(service, previous, current),
        status: current.status,
        occurredAt: observedAt,
        source: "service-probe",
        url: service.url,
      });
    }

    this.activity = [...changes, ...this.activity].slice(0, OVERVIEW_ACTIVITY_LIMIT);
    return [...this.activity];
  }
}

const OVERVIEW_ACTIVITY_LIMIT = 50;
const OVERVIEW_ISSUE_LIMIT = 128;
const OVERVIEW_SERVICE_LIMIT = 64;
const SOURCE_ORDER: readonly SourceName[] = [
  "kubernetes",
  "argocd",
  "prometheus",
  "github",
  "service-probe",
];
const STATUS_PRIORITY: Record<HealthStatus, number> = {
  critical: 0,
  warning: 1,
  unknown: 2,
  healthy: 3,
};

function highestPriorityStatus(statuses: readonly HealthStatus[]): HealthStatus {
  return (
    [...statuses].sort((left, right) => STATUS_PRIORITY[left] - STATUS_PRIORITY[right])[0] ??
    "unknown"
  );
}

function mergeSourceStates(sources: readonly SourceState[]): SourceState[] {
  const merged = new Map<SourceName, SourceState>();

  for (const source of sources) {
    const current = merged.get(source.source);
    if (!current) {
      merged.set(source.source, { ...source });
      continue;
    }

    const status = highestPriorityStatus([current.status, source.status]);
    merged.set(source.source, {
      source: source.source,
      status,
      observedAt: source.observedAt > current.observedAt ? source.observedAt : current.observedAt,
      stale: current.stale || source.stale,
      ...(current.error || source.error ? { error: current.error ?? source.error } : {}),
    });
  }

  return SOURCE_ORDER.flatMap((source) => {
    const state = merged.get(source);
    return state ? [state] : [];
  });
}

export async function collectOverviewSnapshot(
  providers: OverviewProviderGroups,
  timeoutMs: number,
  now: Now = () => new Date(),
  certificateActivityTracker = new CertificateActivityTracker(),
): Promise<OverviewSnapshot> {
  const collections = new Map<Provider<unknown>, Promise<unknown>>();
  const wrappers = new Map<Provider<unknown>, Provider<unknown>>();
  const shareProvider = (provider: Provider<unknown>): Provider<unknown> => {
    const existing = wrappers.get(provider);
    if (existing) return existing;

    const shared: Provider<unknown> = {
      source: provider.source,
      collect(signal) {
        const pending = collections.get(provider);
        if (pending) return pending;

        const collection = Promise.resolve().then(() => provider.collect(signal));
        collections.set(provider, collection);
        return collection;
      },
      ...(provider.observation ? { observation: () => provider.observation?.() } : {}),
    };
    wrappers.set(provider, shared);
    return shared;
  };
  const shareGroup = (group: readonly Provider<unknown>[]) => group.map(shareProvider);
  const [cluster, deployments, services] = await Promise.all([
    collectClusterSnapshot(shareGroup(providers.cluster), timeoutMs, now),
    collectDeploymentSnapshot(shareGroup(providers.deployments), timeoutMs, now),
    collectServiceSnapshot(shareGroup(providers.services), timeoutMs, now),
  ]);
  const observedAt = timestamp(now);
  const clusterData = cluster.data;
  const applications = deployments.data?.applications ?? [];
  const serviceData = services.data?.services ?? [];
  const hasData = Boolean(clusterData || deployments.data || services.data);
  const workloadCounts = {
    healthy: 0,
    warning: 0,
    critical: 0,
    unknown: 0,
    total: clusterData?.workloads.length ?? 0,
  };
  for (const workload of clusterData?.workloads ?? []) workloadCounts[workload.status] += 1;

  const clusterStatus = clusterData
    ? highestPriorityStatus([
        cluster.status,
        ...clusterData.nodes.map(({ status }) => status),
        ...clusterData.workloads.map(({ status }) => status),
      ])
    : "unknown";
  const argoStatus =
    applications.length > 0
      ? highestPriorityStatus(applications.map(({ argo }) => argo.status))
      : "unknown";
  const activeIssues = [...cluster.issues, ...deployments.issues, ...services.issues].slice(
    0,
    OVERVIEW_ISSUE_LIMIT,
  );
  const clusterActivity = (clusterData?.events ?? []).map(
    ({ id, resource, message, status, observedAt: occurredAt }) => ({
      id,
      resource,
      message,
      status,
      occurredAt,
      source: "kubernetes" as const,
      url: null,
    }),
  );
  const deploymentActivity = applications.flatMap((application) => {
    const activity = [];
    if (application.argo.status !== "unknown") {
      activity.push({
        id: `argocd:${application.application}:${application.argo.observedAt}`,
        resource: `Application/${application.application}`,
        message: application.argo.summary,
        status: application.argo.status,
        occurredAt: application.argo.observedAt,
        source: "argocd" as const,
        url: application.argo.url,
      });
    }
    if (application.workflow.status === "warning" || application.workflow.status === "critical") {
      activity.push({
        id: `github:${application.application}:${application.workflow.observedAt}`,
        resource: `Workflow/${application.repository}`,
        message: application.workflow.summary,
        status: application.workflow.status,
        occurredAt: application.workflow.observedAt,
        source: "github" as const,
        url: application.workflow.url,
      });
    }
    return activity;
  });
  const certificateActivity = certificateActivityTracker.observe(serviceData, observedAt);
  const recentActivity = [...clusterActivity, ...deploymentActivity, ...certificateActivity]
    .sort((left, right) => {
      const leftTime = Date.parse(left.occurredAt);
      const rightTime = Date.parse(right.occurredAt);
      if (Number.isNaN(leftTime)) return Number.isNaN(rightTime) ? 0 : 1;
      if (Number.isNaN(rightTime)) return -1;
      return rightTime - leftTime;
    })
    .slice(0, OVERVIEW_ACTIVITY_LIMIT);
  const sources = mergeSourceStates([
    ...cluster.sources,
    ...deployments.sources,
    ...services.sources,
  ]);
  const status = highestPriorityStatus([clusterStatus, deployments.status, services.status]);

  return {
    data: hasData
      ? {
          cluster: {
            status: clusterStatus,
            readyNodes: clusterData?.nodes.filter(({ ready }) => ready).length ?? 0,
            totalNodes: clusterData?.nodes.length ?? 0,
          },
          workloads: workloadCounts,
          argo: {
            status: argoStatus,
            syncedApplications: applications.filter(({ argo }) => argo.status === "healthy").length,
            totalApplications: applications.length,
          },
          resources: clusterData?.resources ?? { current: [], history: [] },
          activeIssues,
          recentActivity,
          services: serviceData.slice(0, OVERVIEW_SERVICE_LIMIT),
        }
      : null,
    status,
    observedAt,
    stale: cluster.stale || deployments.stale || services.stale,
    issues: activeIssues,
    sources,
  };
}
