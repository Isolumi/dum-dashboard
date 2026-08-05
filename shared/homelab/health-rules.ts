import type { HealthStatus, ResourceName } from "./contracts";

export interface HealthEvaluation {
  status: HealthStatus;
  ruleId: string;
  reason: string;
  evidence: Record<string, string | number | boolean | null>;
}

export interface NodeHealthInput {
  name: string;
  ready: boolean;
}

export interface WorkloadHealthInput {
  kind: string;
  name: string;
  desiredReplicas: number;
  availableReplicas: number;
  failureReason?: string;
  restartIncrease15m?: boolean;
}

export interface CertificateHealthInput {
  name: string;
  expiresAt: string;
}

export interface ResourceHealthInput {
  resource: ResourceName;
  usagePercent: number;
  sustainedMinutes: number;
  criticalSustainedMinutes?: number;
}

export interface HealthRollup {
  status: HealthStatus;
  issues: HealthEvaluation[];
  unknownIssues: HealthEvaluation[];
}

const FIVE_MINUTES = 5;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const SOURCE_STALE_AFTER_MS = 30 * 1000;

export function evaluateNode(input: NodeHealthInput): HealthEvaluation {
  if (!input.ready) {
    return {
      status: "critical",
      ruleId: "node-not-ready",
      reason: `Node ${input.name} is not ready.`,
      evidence: { name: input.name, ready: input.ready },
    };
  }

  return {
    status: "healthy",
    ruleId: "node-ready",
    reason: `Node ${input.name} is ready.`,
    evidence: { name: input.name, ready: input.ready },
  };
}

export function evaluateWorkload(input: WorkloadHealthInput): HealthEvaluation {
  const evidence = {
    kind: input.kind,
    name: input.name,
    desiredReplicas: input.desiredReplicas,
    availableReplicas: input.availableReplicas,
    failureReason: input.failureReason ?? null,
    restartIncrease15m: input.restartIncrease15m ?? false,
  };
  const unavailable = input.desiredReplicas > 0 && input.availableReplicas === 0;

  if (input.failureReason) {
    return {
      status: unavailable ? "critical" : "warning",
      ruleId: unavailable ? "workload-failure-unavailable" : "workload-failure",
      reason: `${input.kind} ${input.name} reports ${input.failureReason}.`,
      evidence,
    };
  }

  if (unavailable) {
    return {
      status: "critical",
      ruleId: "workload-unavailable",
      reason: `${input.kind} ${input.name} has no available replicas.`,
      evidence,
    };
  }

  if (input.availableReplicas < input.desiredReplicas) {
    return {
      status: "warning",
      ruleId: "workload-partially-available",
      reason: `${input.kind} ${input.name} has fewer available replicas than desired.`,
      evidence,
    };
  }

  if (input.restartIncrease15m) {
    return {
      status: "warning",
      ruleId: "workload-restarts-increasing",
      reason: `${input.kind} ${input.name} restarts increased in the last 15 minutes.`,
      evidence,
    };
  }

  return {
    status: "healthy",
    ruleId: "workload-ready",
    reason: `${input.kind} ${input.name} has all desired replicas available.`,
    evidence,
  };
}

export function evaluateCertificate(input: CertificateHealthInput, now: number): HealthEvaluation {
  const expiresAt = Date.parse(input.expiresAt);
  const evidence = { name: input.name, expiresAt: input.expiresAt };

  if (Number.isNaN(expiresAt)) {
    return {
      status: "unknown",
      ruleId: "certificate-invalid-expiry",
      reason: `Certificate ${input.name} has an invalid expiry timestamp.`,
      evidence,
    };
  }

  if (expiresAt <= now) {
    return {
      status: "critical",
      ruleId: "certificate-expired",
      reason: `Certificate ${input.name} has expired.`,
      evidence,
    };
  }

  if (expiresAt - now <= FOURTEEN_DAYS_MS) {
    return {
      status: "warning",
      ruleId: "certificate-expiring",
      reason: `Certificate ${input.name} expires within 14 days.`,
      evidence,
    };
  }

  return {
    status: "healthy",
    ruleId: "certificate-valid",
    reason: `Certificate ${input.name} is valid for more than 14 days.`,
    evidence,
  };
}

export function evaluateResources(input: ResourceHealthInput): HealthEvaluation {
  const evidence = {
    resource: input.resource,
    usagePercent: input.usagePercent,
    sustainedMinutes: input.sustainedMinutes,
  };
  const requiresSustainedUsage = input.resource !== "disk";
  const sustainedLongEnough = !requiresSustainedUsage || input.sustainedMinutes >= FIVE_MINUTES;
  const criticalSustainedLongEnough =
    !requiresSustainedUsage ||
    (input.criticalSustainedMinutes ?? input.sustainedMinutes) >= FIVE_MINUTES;
  const criticalThreshold = input.resource === "disk" ? 97 : 95;
  const warningThreshold = input.resource === "disk" ? 90 : 85;

  if (criticalSustainedLongEnough && input.usagePercent >= criticalThreshold) {
    return {
      status: "critical",
      ruleId: `${input.resource}-usage-critical`,
      reason: `${input.resource} usage is at or above the critical threshold.`,
      evidence,
    };
  }

  if (sustainedLongEnough && input.usagePercent >= warningThreshold) {
    return {
      status: "warning",
      ruleId: `${input.resource}-usage-warning`,
      reason: `${input.resource} usage is at or above the warning threshold.`,
      evidence,
    };
  }

  return {
    status: "healthy",
    ruleId: `${input.resource}-usage-normal`,
    reason: `${input.resource} usage is below the active thresholds.`,
    evidence,
  };
}

export function evaluateSourceFreshness(observedAt: string, now: number): HealthEvaluation {
  const observedAtMs = Date.parse(observedAt);
  const evidence = {
    observedAt,
    ageMilliseconds: Number.isNaN(observedAtMs) ? null : now - observedAtMs,
  };

  if (Number.isNaN(observedAtMs)) {
    return {
      status: "unknown",
      ruleId: "source-invalid-observed-at",
      reason: "Source observation time is invalid.",
      evidence,
    };
  }

  if (now - observedAtMs > SOURCE_STALE_AFTER_MS) {
    return {
      status: "unknown",
      ruleId: "source-stale",
      reason: "Source observation is older than 30 seconds.",
      evidence,
    };
  }

  return {
    status: "healthy",
    ruleId: "source-fresh",
    reason: "Source observation is no more than 30 seconds old.",
    evidence,
  };
}

export function rollUpStatus(evaluations: readonly HealthEvaluation[]): HealthRollup {
  const issues = evaluations.filter(
    (evaluation): evaluation is HealthEvaluation & { status: "warning" | "critical" } =>
      evaluation.status === "warning" || evaluation.status === "critical",
  );
  const unknownIssues = evaluations.filter((evaluation) => evaluation.status === "unknown");

  if (issues.some((issue) => issue.status === "critical")) {
    return { status: "critical", issues, unknownIssues };
  }

  if (issues.some((issue) => issue.status === "warning")) {
    return { status: "warning", issues, unknownIssues };
  }

  if (unknownIssues.length > 0) {
    return { status: "unknown", issues, unknownIssues };
  }

  return { status: "healthy", issues, unknownIssues };
}
