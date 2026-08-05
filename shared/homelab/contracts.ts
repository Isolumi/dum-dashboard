export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export type SourceName = "kubernetes" | "argocd" | "prometheus" | "github" | "service-probe";

export interface HealthIssue {
  ruleId: string;
  status: Exclude<HealthStatus, "healthy">;
  reason: string;
  source: SourceName | null;
  resource: string;
  observedAt: string;
  evidence: Record<string, string | number | boolean | null>;
}

export interface SourceState {
  source: SourceName;
  status: HealthStatus;
  observedAt: string;
  stale: boolean;
  error?: string;
}

export interface Snapshot<T> {
  data: T | null;
  status: HealthStatus;
  observedAt: string;
  stale: boolean;
  issues: HealthIssue[];
  sources: SourceState[];
}

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export type ResourceName = "cpu" | "memory" | "disk";
export type ResourceWindow = "1h" | "6h" | "24h" | "7d";

export interface CurrentResourceMetric {
  resource: ResourceName;
  usagePercent: number;
  observedAt: string;
}

export interface ResourceHistory {
  resource: ResourceName;
  points: MetricPoint[];
}

export interface ResourceMetrics {
  current: CurrentResourceMetric[];
  history: ResourceHistory[];
}

export interface ClusterSummary {
  status: HealthStatus;
  readyNodes: number;
  totalNodes: number;
}

export interface WorkloadCounts {
  healthy: number;
  warning: number;
  critical: number;
  unknown: number;
  total: number;
}

export interface ArgoSummary {
  status: HealthStatus;
  syncedApplications: number;
  totalApplications: number;
}

export interface RecentActivity {
  id: string;
  resource: string;
  message: string;
  status: HealthStatus;
  occurredAt: string;
  source: SourceName | null;
  url: string | null;
}

export interface ServiceWorkloadSummary {
  kind: string;
  name: string;
  status: HealthStatus;
  version: string | null;
  createdAt: string | null;
  desiredReplicas: number | null;
  availableReplicas: number | null;
  podCount: number | null;
}

export interface ServiceSummary {
  name: string;
  description: string;
  status: HealthStatus;
  url: string;
  certificateExpiresAt: string | null;
  probeLatencyMs: number | null;
  namespace: string | null;
  workload: string | null;
  image: string | null;
  observedAt: string;
  reachable: boolean;
  reason: string;
  argoApplication: string | null;
  argoStatus: HealthStatus;
  relatedPodCount: number | null;
  workloads: ServiceWorkloadSummary[];
}

export interface OverviewData {
  cluster: ClusterSummary;
  workloads: WorkloadCounts;
  argo: ArgoSummary;
  resources: ResourceMetrics;
  activeIssues: HealthIssue[];
  recentActivity: RecentActivity[];
  services: ServiceSummary[];
}

export interface NodeSummary {
  name: string;
  ready: boolean;
  status: HealthStatus;
  conditions: string[];
}

export interface NamespaceSummary {
  name: string;
  status: HealthStatus;
  workloadCount: number;
  podCount: number;
}

export interface WorkloadSummary {
  kind: string;
  name: string;
  namespace: string;
  status: HealthStatus;
  desiredReplicas: number;
  availableReplicas: number;
  failureReason: string | null;
  restartIncrease15m: boolean;
  createdAt: string | null;
  revision: string | null;
}

export interface PodContainerImageEvidence {
  name: string;
  repository: string | null;
  reference: string | null;
  tag: string | null;
  digest: string | null;
}

export interface PodSummary {
  name: string;
  namespace: string;
  status: HealthStatus;
  ready: boolean;
  restartCount: number;
  node: string | null;
  image: string | null;
  imageTag: string | null;
  imageDigest: string | null;
  containerImages: PodContainerImageEvidence[];
  createdAt: string;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface PodContainerDetail {
  name: string;
  image: string | null;
  imageId: string | null;
  ready: boolean;
  restartCount: number;
  state: "running" | "waiting" | "terminated" | "unknown";
  reason: string | null;
}

export interface PodConditionDetail {
  type: string;
  status: string;
  reason: string | null;
  message: string | null;
  lastTransitionAt: string | null;
}

export interface PodDetail extends PodSummary {
  containers: PodContainerDetail[];
  conditions: PodConditionDetail[];
  rawStatus: { [key: string]: JsonValue };
}

export interface EventSummary {
  id: string;
  namespace: string;
  resource: string;
  status: HealthStatus;
  reason: string;
  message: string;
  observedAt: string;
}

export interface ClusterData {
  nodes: NodeSummary[];
  namespaces: NamespaceSummary[];
  workloads: WorkloadSummary[];
  pods: PodSummary[];
  events: EventSummary[];
  resources: ResourceMetrics;
}

export interface PipelineStage {
  status: HealthStatus;
  summary: string;
  observedAt: string;
  url: string | null;
}

export interface WorkflowPipelineStage extends PipelineStage {
  conclusion: string | null;
  durationMs: number | null;
}

export interface ArgoPipelineStage extends PipelineStage {
  revision: string | null;
  syncStatus: string | null;
  healthStatus: string | null;
  operationResult: string | null;
  lastTransitionAt: string | null;
}

export interface DeploymentCommitSummary {
  sha: string;
  message: string;
  author: string;
  committedAt: string;
  url: string;
}

export interface DeploymentWorkloadSummary {
  name: string;
  namespace: string;
  status: HealthStatus;
  desiredReplicas: number | null;
  availableReplicas: number | null;
  expectedImage: string | null;
  liveImage: string | null;
  liveDigests: string[];
  tagMatches: boolean | null;
  digestMatches: boolean | null;
  revision: string | null;
  createdAt: string | null;
}

export interface ApplicationPipelineSummary {
  application: string;
  namespace: string;
  repository: string;
  branch: string;
  status: HealthStatus;
  commit: DeploymentCommitSummary | null;
  argoRevision: string | null;
  workflow: WorkflowPipelineStage;
  argo: ArgoPipelineStage;
  rollout: PipelineStage;
  workloads: DeploymentWorkloadSummary[];
  issues: HealthIssue[];
}

export interface DeploymentData {
  applications: ApplicationPipelineSummary[];
}

export interface ServiceData {
  services: ServiceSummary[];
}

export type OverviewSnapshot = Snapshot<OverviewData>;
export type ClusterSnapshot = Snapshot<ClusterData>;
export type DeploymentSnapshot = Snapshot<DeploymentData>;
export type ServiceSnapshot = Snapshot<ServiceData>;
