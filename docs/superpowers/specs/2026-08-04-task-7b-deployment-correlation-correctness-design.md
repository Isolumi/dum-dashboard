# Task 7b Deployment Correlation Correctness Design

## Goal

Close the two load-bearing false-Healthy paths left by Task 7 so later snapshot and UI tasks can trust deployment status.

## Scope

Task 7b makes two focused behavior corrections:

1. Argo CD evidence that is structurally present but contains an empty or whitespace-only required string is invalid. The gateway must convert that source to fixed partial/Unknown evidence instead of allowing a Healthy deployment result.
2. Kubernetes workload replica counts are valid only when they are finite, non-negative integers. Negative, fractional, non-finite, or non-number values must convert the Kubernetes deployment source to fixed partial/Unknown evidence instead of reaching correlation.

Required Argo strings include application name and namespace, sync status and revision, health status, operation phase when the operation state is present, and required resource identity/status fields for each mapped resource. Optional fields remain optional.

## Architecture

Use the existing descriptor-safe parsers and fresh-copy boundaries introduced by Task 7. Tighten those parsers instead of adding a second validation layer:

- `gateway/src/providers/argocd.ts` owns non-empty required-string validation for Argo application evidence.
- A shared runtime helper owns finite non-negative integer validation for replica counts.
- `gateway/src/snapshot.ts` and `gateway/src/deployment-correlation.ts` use the same replica rule so route and direct-call behavior cannot diverge.

No schema framework or broad validator rewrite is added.

## Data Flow and Error Behavior

- Valid Argo and Kubernetes values continue through fresh normalized copies to deployment correlation.
- Invalid Argo required strings cause the Argo provider result to be treated as malformed. The deployment snapshot remains HTTP 200 and records fixed Unknown/partial-source evidence without raw values, stacks, or credentials.
- Invalid replica counts cause the Kubernetes deployment evidence to be treated as malformed with the same fixed Unknown/partial-source behavior.
- A valid target workload with `availableReplicas: 0` remains Critical.
- A missing target workload remains Unknown with nullable replica evidence.

## Testing

Strict TDD is required. Tests must fail for the intended behavior before production code changes.

Cover:

- Empty and whitespace-only Argo sync revision, sync status, health status, operation phase, and required resource strings.
- Negative, fractional, `NaN`, infinite, and non-number desired/available replicas at the snapshot route boundary.
- HTTP 200 with fixed Unknown/partial evidence for malformed values and no raw payload leakage.
- Valid non-zero replicas retain existing status.
- Valid zero available replicas remain Critical.
- Direct correlator and snapshot route apply the same replica rule.
- Existing Task 1-7 tests, gateway and application builds, lint, formatting, and diff checks remain green.

## Non-Goals

- Raw Kubernetes list and nested collection caps before provider mapping remain parked for a dedicated provider-hardening task.
- No changes to GitHub workflow selection, image correlation semantics, service probing, frontend UI, Kubernetes manifests, or deployment configuration.
- No live GitHub, Argo CD, Prometheus, or Kubernetes calls are required for this task.

## Completion Gate

Task 7b is complete only after its implementation commit passes an independent task-scoped review with no open Critical or Important findings. After that gate, the original Task 7 is unblocked and Task 8 may begin.
