import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
  ClusterSnapshot,
  DeploymentSnapshot,
  OverviewSnapshot,
  ServiceSnapshot,
} from "@shared/homelab/contracts";
import { requireServerEnv } from "#/lib/runtime-env";
import { noStore } from "#/lib/server-auth";

const SNAPSHOT_TIMEOUT_MS = 5_000;

const HealthStatusSchema = z.enum(["healthy", "warning", "critical", "unknown"]);
const SourceNameSchema = z.enum(["kubernetes", "argocd", "prometheus", "github", "service-probe"]);
const TimestampSchema = z.string().datetime({ offset: true });
const EvidenceSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]));

const HealthIssueSchema = z
  .object({
    ruleId: z.string(),
    status: z.enum(["warning", "critical", "unknown"]),
    reason: z.string(),
    source: SourceNameSchema.nullable(),
    resource: z.string(),
    observedAt: TimestampSchema,
    evidence: EvidenceSchema,
  })
  .strict();

const SourceStateSchema = z
  .object({
    source: SourceNameSchema,
    status: HealthStatusSchema,
    observedAt: TimestampSchema,
    stale: z.boolean(),
    error: z.string().optional(),
  })
  .strict();

const MetricPointSchema = z
  .object({ timestamp: TimestampSchema, value: z.number().finite() })
  .strict();
const ResourceNameSchema = z.enum(["cpu", "memory", "disk"]);
const CurrentResourceMetricSchema = z
  .object({
    resource: ResourceNameSchema,
    usagePercent: z.number().finite(),
    observedAt: TimestampSchema,
  })
  .strict();
const ResourceHistorySchema = z
  .object({
    resource: ResourceNameSchema,
    points: z.array(MetricPointSchema),
  })
  .strict();
const ResourceMetricsSchema = z
  .object({
    current: z.array(CurrentResourceMetricSchema),
    history: z.array(ResourceHistorySchema),
  })
  .strict();

const ServiceSummarySchema = z
  .object({
    name: z.string(),
    description: z.string(),
    status: HealthStatusSchema,
    url: z.string().url(),
    certificateExpiresAt: TimestampSchema.nullable(),
    probeLatencyMs: z.number().finite().nonnegative().nullable(),
    namespace: z.string().nullable(),
    workload: z.string().nullable(),
    image: z.string().nullable(),
    observedAt: TimestampSchema,
  })
  .strict();

const OverviewDataSchema = z
  .object({
    cluster: z
      .object({
        status: HealthStatusSchema,
        readyNodes: z.number().int().nonnegative(),
        totalNodes: z.number().int().nonnegative(),
      })
      .strict(),
    workloads: z
      .object({
        healthy: z.number().int().nonnegative(),
        warning: z.number().int().nonnegative(),
        critical: z.number().int().nonnegative(),
        unknown: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
      })
      .strict(),
    argo: z
      .object({
        status: HealthStatusSchema,
        syncedApplications: z.number().int().nonnegative(),
        totalApplications: z.number().int().nonnegative(),
      })
      .strict(),
    resources: ResourceMetricsSchema,
    activeIssues: z.array(HealthIssueSchema),
    recentActivity: z.array(
      z
        .object({
          id: z.string(),
          resource: z.string(),
          message: z.string(),
          status: HealthStatusSchema,
          occurredAt: TimestampSchema,
          source: SourceNameSchema.nullable(),
          url: z.string().url().nullable(),
        })
        .strict(),
    ),
    services: z.array(ServiceSummarySchema),
  })
  .strict();

const PodSummarySchema = z
  .object({
    name: z.string(),
    namespace: z.string(),
    status: HealthStatusSchema,
    ready: z.boolean(),
    restartCount: z.number().int().nonnegative(),
    node: z.string().nullable(),
    image: z.string().nullable(),
    imageTag: z.string().nullable(),
    imageDigest: z.string().nullable(),
    containerImages: z.array(
      z
        .object({
          name: z.string(),
          repository: z.string().nullable(),
          reference: z.string().nullable(),
          tag: z.string().nullable(),
          digest: z.string().nullable(),
        })
        .strict(),
    ),
    createdAt: TimestampSchema,
  })
  .strict();

const ClusterDataSchema = z
  .object({
    nodes: z.array(
      z
        .object({
          name: z.string(),
          ready: z.boolean(),
          status: HealthStatusSchema,
          conditions: z.array(z.string()),
        })
        .strict(),
    ),
    namespaces: z.array(
      z
        .object({
          name: z.string(),
          status: HealthStatusSchema,
          workloadCount: z.number().int().nonnegative(),
          podCount: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    workloads: z.array(
      z
        .object({
          kind: z.string(),
          name: z.string(),
          namespace: z.string(),
          status: HealthStatusSchema,
          desiredReplicas: z.number().int().nonnegative(),
          availableReplicas: z.number().int().nonnegative(),
          failureReason: z.string().nullable(),
          restartIncrease15m: z.boolean(),
        })
        .strict(),
    ),
    pods: z.array(PodSummarySchema),
    events: z.array(
      z
        .object({
          id: z.string(),
          namespace: z.string(),
          resource: z.string(),
          status: HealthStatusSchema,
          reason: z.string(),
          message: z.string(),
          observedAt: TimestampSchema,
        })
        .strict(),
    ),
    resources: ResourceMetricsSchema,
  })
  .strict();

const PipelineStageSchema = z
  .object({
    status: HealthStatusSchema,
    summary: z.string(),
    observedAt: TimestampSchema,
    url: z.string().url().nullable(),
  })
  .strict();

const DeploymentDataSchema = z
  .object({
    applications: z.array(
      z
        .object({
          application: z.string(),
          namespace: z.string(),
          repository: z.string(),
          branch: z.string(),
          status: HealthStatusSchema,
          commit: z
            .object({
              sha: z.string(),
              message: z.string(),
              author: z.string(),
              committedAt: TimestampSchema,
              url: z.string().url(),
            })
            .strict()
            .nullable(),
          argoRevision: z.string().nullable(),
          workflow: PipelineStageSchema,
          argo: PipelineStageSchema,
          rollout: PipelineStageSchema,
          workloads: z.array(
            z
              .object({
                name: z.string(),
                namespace: z.string(),
                status: HealthStatusSchema,
                desiredReplicas: z.number().int().nonnegative().nullable(),
                availableReplicas: z.number().int().nonnegative().nullable(),
                expectedImage: z.string().nullable(),
                liveImage: z.string().nullable(),
                liveDigests: z.array(z.string()),
                tagMatches: z.boolean().nullable(),
                digestMatches: z.boolean().nullable(),
              })
              .strict(),
          ),
          issues: z.array(HealthIssueSchema),
        })
        .strict(),
    ),
  })
  .strict();

const ServiceDataSchema = z.object({ services: z.array(ServiceSummarySchema) }).strict();

function snapshotSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z
    .object({
      data: dataSchema.nullable(),
      status: HealthStatusSchema,
      observedAt: TimestampSchema,
      stale: z.boolean(),
      issues: z.array(HealthIssueSchema),
      sources: z.array(SourceStateSchema),
    })
    .strict();
}

const OverviewSnapshotSchema: z.ZodType<OverviewSnapshot> = snapshotSchema(OverviewDataSchema);
const ClusterSnapshotSchema: z.ZodType<ClusterSnapshot> = snapshotSchema(ClusterDataSchema);
const DeploymentSnapshotSchema: z.ZodType<DeploymentSnapshot> =
  snapshotSchema(DeploymentDataSchema);
const ServiceSnapshotSchema: z.ZodType<ServiceSnapshot> = snapshotSchema(ServiceDataSchema);

function unavailableError(): Error {
  const error = new Error("Homelab data unavailable");
  error.stack = undefined;
  return error;
}

function gatewayEndpointUrl(endpoint: string): URL {
  const url = new URL(requireServerEnv("GATEWAY_URL"));
  url.pathname = `${url.pathname.replace(/\/$/, "")}/${endpoint}`;
  url.search = "";
  url.hash = "";
  return url;
}

async function requestSnapshot<T>(endpoint: string, schema: z.ZodType<T>): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    noStore();
    timeoutId = setTimeout(() => controller.abort(), SNAPSHOT_TIMEOUT_MS);
    const response = await fetch(gatewayEndpointUrl(endpoint), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-store",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw unavailableError();
    }
    return schema.parse(await response.json());
  } catch {
    throw unavailableError();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function loadHomelabOverview(): Promise<OverviewSnapshot> {
  return requestSnapshot("overview", OverviewSnapshotSchema);
}

async function loadClusterSnapshot(): Promise<ClusterSnapshot> {
  return requestSnapshot("cluster", ClusterSnapshotSchema);
}

async function loadDeploymentSnapshot(): Promise<DeploymentSnapshot> {
  return requestSnapshot("deployments", DeploymentSnapshotSchema);
}

async function loadServiceSnapshot(): Promise<ServiceSnapshot> {
  return requestSnapshot("services", ServiceSnapshotSchema);
}

export const getHomelabOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<OverviewSnapshot> => loadHomelabOverview(),
);

export const getClusterSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<ClusterSnapshot> => loadClusterSnapshot(),
);

export const getDeploymentSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<DeploymentSnapshot> => loadDeploymentSnapshot(),
);

export const getServiceSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<ServiceSnapshot> => loadServiceSnapshot(),
);
