import { z } from "zod";

import type { DeploymentSnapshot } from "@shared/homelab/contracts";

const HealthStatusSchema = z.enum(["healthy", "warning", "critical", "unknown"]);
const SourceNameSchema = z.enum(["kubernetes", "argocd", "prometheus", "github", "service-probe"]);
const TimestampSchema = z.string().datetime({ offset: true });
const EvidenceSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]));
const HttpsUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    },
    { message: "must be an HTTPS URL without credentials" },
  );

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

const PipelineStageSchema = z
  .object({
    status: HealthStatusSchema,
    summary: z.string(),
    observedAt: TimestampSchema,
    url: HttpsUrlSchema.nullable(),
  })
  .strict();

const WorkflowPipelineStageSchema = PipelineStageSchema.extend({
  conclusion: z.string().nullable(),
  durationMs: z.number().finite().nonnegative().nullable(),
}).strict();

const ArgoPipelineStageSchema = PipelineStageSchema.extend({
  revision: z.string().nullable(),
  syncStatus: z.string().nullable(),
  healthStatus: z.string().nullable(),
  operationResult: z.string().nullable(),
  lastTransitionAt: TimestampSchema.nullable(),
}).strict();

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
              url: HttpsUrlSchema,
            })
            .strict()
            .nullable(),
          argoRevision: z.string().nullable(),
          workflow: WorkflowPipelineStageSchema,
          argo: ArgoPipelineStageSchema,
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
                revision: z.string().nullable(),
                createdAt: TimestampSchema.nullable(),
              })
              .strict(),
          ),
          issues: z.array(HealthIssueSchema),
        })
        .strict(),
    ),
  })
  .strict();

export const DeploymentSnapshotSchema: z.ZodType<DeploymentSnapshot> = z
  .object({
    data: DeploymentDataSchema.nullable(),
    status: HealthStatusSchema,
    observedAt: TimestampSchema,
    stale: z.boolean(),
    issues: z.array(HealthIssueSchema),
    sources: z.array(SourceStateSchema),
  })
  .strict();
