import type {
  CoreV1Event,
  CoreV1EventList,
  V1DaemonSet,
  V1DaemonSetList,
  V1Deployment,
  V1DeploymentList,
  V1NamespaceList,
  V1Node,
  V1NodeList,
  V1Pod,
  V1ContainerStatus,
  V1PodList,
  V1StatefulSet,
  V1StatefulSetList,
} from "@kubernetes/client-node";
import type {
  ClusterData,
  EventSummary,
  HealthStatus,
  JsonValue,
  NamespaceSummary,
  NodeSummary,
  PodContainerDetail,
  PodContainerImageEvidence,
  PodDetail,
  PodSummary,
  WorkloadSummary,
} from "../../../shared/homelab/contracts";
import { evaluateNode, evaluateWorkload } from "../../../shared/homelab/health-rules";

export interface KubernetesInventory {
  nodes: V1NodeList;
  namespaces: V1NamespaceList;
  deployments: V1DeploymentList;
  statefulSets: V1StatefulSetList;
  daemonSets: V1DaemonSetList;
  pods: V1PodList;
  events: CoreV1EventList;
}

type Workload = V1Deployment | V1StatefulSet | V1DaemonSet;
type WorkloadKind = "Deployment" | "StatefulSet" | "DaemonSet";

const CRITICAL_CONTAINER_WAITING_REASONS = new Set([
  "CrashLoopBackOff",
  "ImagePullBackOff",
  "ErrImagePull",
]);

function timestamp(value: Date | string | null | undefined): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : value;
}

function imageReference(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
}

function imageDigest(value: string | undefined): string | null {
  const reference = imageReference(value);
  if (!reference) return null;
  const digestSeparator = reference.indexOf("@");
  return digestSeparator >= 0 ? reference.slice(digestSeparator + 1) : null;
}

function containerImageEvidence(
  name: string,
  image: string | undefined,
  imageId: string | undefined,
): PodContainerImageEvidence {
  const reference = imageReference(image);
  const withoutDigest = reference?.split("@", 1)[0] ?? null;
  const lastSlash = withoutDigest?.lastIndexOf("/") ?? -1;
  const lastColon = withoutDigest?.lastIndexOf(":") ?? -1;
  const hasTag = withoutDigest !== null && lastColon > lastSlash;

  return {
    name,
    repository: withoutDigest ? (hasTag ? withoutDigest.slice(0, lastColon) : withoutDigest) : null,
    reference,
    tag: hasTag ? withoutDigest.slice(lastColon + 1) : null,
    digest: imageDigest(imageId),
  };
}

function podReady(pod: V1Pod): boolean {
  return (
    pod.status?.conditions?.some(
      (condition) => condition.type === "Ready" && condition.status === "True",
    ) ?? false
  );
}

function podStatus(pod: V1Pod, ready: boolean): HealthStatus {
  const criticalWaitingReason = pod.status?.containerStatuses
    ?.map((container) => container.state?.waiting?.reason)
    .find((reason) => reason && CRITICAL_CONTAINER_WAITING_REASONS.has(reason));

  if (pod.status?.phase === "Failed" || criticalWaitingReason) return "critical";
  if (pod.status?.phase === "Succeeded") return "healthy";
  if (ready) return "healthy";
  if (!pod.status?.phase || pod.status.phase === "Unknown") return "unknown";
  return "warning";
}

function mapNode(node: V1Node): NodeSummary {
  const name = node.metadata?.name ?? "unknown";
  const ready =
    node.status?.conditions?.some(
      (condition) => condition.type === "Ready" && condition.status === "True",
    ) ?? false;

  return {
    name,
    ready,
    status: evaluateNode({ name, ready }).status,
    conditions:
      node.status?.conditions?.map((condition) => `${condition.type}=${condition.status}`) ?? [],
  };
}

function workloadReplicas(
  workload: Workload,
  kind: WorkloadKind,
): {
  desiredReplicas: number;
  availableReplicas: number;
} {
  if (kind === "DaemonSet") {
    const daemonSet = workload as V1DaemonSet;
    return {
      desiredReplicas: daemonSet.status?.desiredNumberScheduled ?? 0,
      availableReplicas: daemonSet.status?.numberAvailable ?? 0,
    };
  }

  const scalable = workload as V1Deployment | V1StatefulSet;
  return {
    desiredReplicas: scalable.spec?.replicas ?? 0,
    availableReplicas: scalable.status?.availableReplicas ?? 0,
  };
}

function workloadFailureReason(workload: Workload): string | null {
  return (
    workload.status?.conditions?.find((condition) => condition.status === "False")?.reason ?? null
  );
}

function workloadRevision(workload: Workload, kind: WorkloadKind): string | null {
  const annotated = workload.metadata?.annotations?.["deployment.kubernetes.io/revision"];
  if (annotated) return annotated;
  if (kind === "StatefulSet") {
    const statefulSet = workload as V1StatefulSet;
    return statefulSet.status?.updateRevision ?? statefulSet.status?.currentRevision ?? null;
  }
  return null;
}

function mapWorkload(workload: Workload, kind: WorkloadKind): WorkloadSummary {
  const name = workload.metadata?.name ?? "unknown";
  const namespace = workload.metadata?.namespace ?? "default";
  const { desiredReplicas, availableReplicas } = workloadReplicas(workload, kind);
  const failureReason = workloadFailureReason(workload);
  // Kubernetes inventory is point-in-time. A 15-minute increase requires a retained
  // previous counter or a Prometheus range query; mapping the current total cannot prove it.
  const restartIncrease15m = false;
  const evaluation = evaluateWorkload({
    kind,
    name,
    desiredReplicas,
    availableReplicas,
    ...(failureReason ? { failureReason } : {}),
    restartIncrease15m,
  });

  return {
    kind,
    name,
    namespace,
    status: evaluation.status,
    desiredReplicas,
    availableReplicas,
    failureReason,
    restartIncrease15m,
    createdAt: timestamp(workload.metadata?.creationTimestamp) || null,
    revision: workloadRevision(workload, kind),
  };
}

function mapPod(pod: V1Pod): PodSummary {
  const ready = podReady(pod);
  const containerStatuses = pod.status?.containerStatuses ?? [];
  const statuses = new Map(containerStatuses.map((status) => [status.name, status]));
  const containerImages =
    pod.spec?.containers.map((container) => {
      const status = statuses.get(container.name);
      return containerImageEvidence(
        container.name,
        container.image ?? status?.image,
        status?.imageID,
      );
    }) ?? [];
  const singleImage = containerImages.length === 1 ? containerImages[0] : undefined;
  const singleStatus = singleImage ? statuses.get(singleImage.name) : undefined;

  return {
    name: pod.metadata?.name ?? "unknown",
    namespace: pod.metadata?.namespace ?? "default",
    status: podStatus(pod, ready),
    ready,
    restartCount: containerStatuses.reduce(
      (total, container) => total + (container.restartCount ?? 0),
      0,
    ),
    node: pod.spec?.nodeName ?? null,
    image: singleImage ? (imageReference(singleStatus?.imageID) ?? singleImage.reference) : null,
    imageTag: singleImage?.reference ?? null,
    imageDigest: singleImage?.digest ?? null,
    containerImages,
    createdAt: timestamp(pod.metadata?.creationTimestamp),
  };
}

function containerState(
  status: V1ContainerStatus | undefined,
): Pick<PodContainerDetail, "state" | "reason"> {
  if (status?.state?.running) return { state: "running", reason: null };
  if (status?.state?.waiting) {
    return { state: "waiting", reason: status.state.waiting.reason ?? null };
  }
  if (status?.state?.terminated) {
    return { state: "terminated", reason: status.state.terminated.reason ?? null };
  }
  return { state: "unknown", reason: null };
}

function jsonObject(value: unknown): { [key: string]: JsonValue } {
  return JSON.parse(JSON.stringify(value ?? {})) as { [key: string]: JsonValue };
}

export function mapPodDetail(pod: V1Pod): PodDetail {
  const summary = mapPod(pod);
  const statuses = new Map(
    (pod.status?.containerStatuses ?? []).map((status) => [status.name, status]),
  );

  return {
    ...summary,
    containers:
      pod.spec?.containers.map((container) => {
        const status = statuses.get(container.name);
        return {
          name: container.name,
          image: container.image ?? null,
          imageId: imageReference(status?.imageID),
          ready: status?.ready ?? false,
          restartCount: status?.restartCount ?? 0,
          ...containerState(status),
        };
      }) ?? [],
    conditions:
      pod.status?.conditions?.map((condition) => ({
        type: condition.type,
        status: condition.status,
        reason: condition.reason ?? null,
        message: condition.message ?? null,
        lastTransitionAt: timestamp(condition.lastTransitionTime) || null,
      })) ?? [],
    rawStatus: jsonObject(pod.status),
  };
}

function eventTimestamp(event: CoreV1Event): string {
  return (
    timestamp(event.eventTime) ||
    timestamp(event.lastTimestamp) ||
    timestamp(event.firstTimestamp) ||
    timestamp(event.metadata?.creationTimestamp)
  );
}

function mapEvent(event: CoreV1Event): EventSummary {
  const kind = event.involvedObject.kind ?? "Resource";
  const name = event.involvedObject.name ?? "unknown";

  return {
    id: event.metadata?.uid ?? event.metadata?.name ?? `${kind}/${name}`,
    namespace: event.metadata?.namespace ?? event.involvedObject.namespace ?? "default",
    resource: `${kind}/${name}`,
    status: "warning",
    reason: event.reason ?? "Warning",
    message: event.message ?? "Kubernetes warning event",
    observedAt: eventTimestamp(event),
  };
}

function mapNamespace(
  name: string,
  phase: string | undefined,
  workloads: readonly WorkloadSummary[],
  pods: readonly PodSummary[],
): NamespaceSummary {
  return {
    name,
    status: phase === "Active" ? "healthy" : "unknown",
    workloadCount: workloads.filter((workload) => workload.namespace === name).length,
    podCount: pods.filter((pod) => pod.namespace === name).length,
  };
}

export function mapClusterData(inventory: KubernetesInventory): ClusterData {
  const workloads = [
    ...inventory.deployments.items.map((workload) => mapWorkload(workload, "Deployment")),
    ...inventory.statefulSets.items.map((workload) => mapWorkload(workload, "StatefulSet")),
    ...inventory.daemonSets.items.map((workload) => mapWorkload(workload, "DaemonSet")),
  ];
  const pods = inventory.pods.items.map(mapPod);

  return {
    nodes: inventory.nodes.items.map(mapNode),
    namespaces: inventory.namespaces.items.map((namespace) =>
      mapNamespace(namespace.metadata?.name ?? "unknown", namespace.status?.phase, workloads, pods),
    ),
    workloads,
    pods,
    events: inventory.events.items
      .filter((event) => event.type === "Warning")
      .map(mapEvent)
      .sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt)),
    resources: { current: [], history: [] },
  };
}
