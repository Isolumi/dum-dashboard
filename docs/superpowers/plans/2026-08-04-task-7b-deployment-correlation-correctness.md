# Task 7b Deployment Correlation Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the two remaining false-Healthy deployment paths by rejecting blank required Argo evidence and invalid workload replica counts.

**Architecture:** Tighten the existing descriptor-safe parsers rather than adding another schema layer. Argo owns its required-string rule, while `runtime-validation.ts` exports one replica-number predicate shared by snapshot normalization and direct correlation.

**Tech Stack:** TypeScript, Bun, Vitest, Hono, `@kubernetes/client-node`.

## Global Constraints

- Strict TDD: each behavior test must be written and observed failing before production code changes.
- Invalid provider evidence returns fixed partial/Unknown deployment data over HTTP 200; never expose raw payloads, credentials, or stacks.
- Argo application name remains `yootoob-mp3-dumachine` in namespace `argocd`.
- A valid target workload with `availableReplicas: 0` remains Critical.
- A missing target workload remains Unknown with nullable replica evidence.
- The raw Kubernetes pre-mapper collection-cap finding remains parked and out of scope.
- No live GitHub, Argo CD, Kubernetes, or Prometheus requests in tests.
- Preserve all existing Task 1-7 behavior and use `.yml` for any YAML file; this plan creates no YAML.

---

### Task 1: Reject Blank Required Argo Evidence

**Files:**
- Modify: `gateway/src/providers/argocd.ts`
- Modify: `gateway/src/providers/-argocd.test.ts`
- Modify: `gateway/src/-snapshot.test.ts`
- Modify: `gateway/src/-app.test.ts`

**Interfaces:**
- Consumes: `parseArgoApplicationState(value: unknown): ArgoApplicationState | null`.
- Produces: the same interface, with every required Argo string constrained to `value.trim().length > 0`.
- Preserves: optional string fields remain `string | null`; core API group and cluster-scoped namespace may remain empty where already optional.

- [ ] **Step 1: Add direct parser tests for blank required strings**

Add a table-driven test in `gateway/src/providers/-argocd.test.ts` that starts from a valid normalized `ArgoApplicationState`, sets each of these paths to `""` and `"   "`, and expects `parseArgoApplicationState` to return `null`:

```ts
const requiredPaths = [
  ["sync", "status"],
  ["sync", "revision"],
  ["health", "status"],
  ["operation", "phase"],
] as const;

for (const path of requiredPaths) {
  for (const invalid of ["", "   "]) {
    const value = structuredClone(validApplication);
    value[path[0]][path[1]] = invalid;
    expect(parseArgoApplicationState(value)).toBeNull();
  }
}
```

Add equivalent resource cases for `kind`, `name`, and `syncStatus`. Keep `group`, `version`, and namespace behavior aligned with the existing optional/default mapping.

- [ ] **Step 2: Add provider-mapping tests for whitespace-only producer values**

In the provider test, inject a cloned Argo custom-resource fixture with whitespace-only values for sync revision, health status, operation phase, and required resource fields. Each `getApplication` call must reject with the provider's fixed safe error, not the raw value.

- [ ] **Step 3: Add deployment snapshot and route regressions**

In `gateway/src/-snapshot.test.ts`, return a successful Argo provider payload whose `sync.revision` is whitespace-only. Assert the deployment snapshot remains HTTP/data-level successful but includes an Unknown Argo source and no blank revision:

```ts
expect(snapshot.status).toBe("unknown");
expect(snapshot.sources).toContainEqual(
  expect.objectContaining({ source: "argocd", status: "unknown" }),
);
expect(snapshot.data.application?.argoRevision ?? null).toBeNull();
```

Add the same malformed successful Argo provider at the `/deployments` route boundary in `gateway/src/-app.test.ts`. Assert HTTP 200, fixed Unknown Argo source evidence, and absence of the whitespace marker and any raw provider error.

- [ ] **Step 4: Run the focused tests and capture RED**

Run:

```bash
bunx vitest run gateway/src/providers/-argocd.test.ts gateway/src/-snapshot.test.ts gateway/src/-app.test.ts
```

Expected: FAIL because blank/whitespace-only required strings currently pass one or both Argo parsing paths.

- [ ] **Step 5: Implement one Argo required-string rule**

In `gateway/src/providers/argocd.ts`, add one local predicate and use it in both normalized parsing and custom-resource mapping:

```ts
function isRequiredString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requiredString(value: unknown): string {
  if (!isRequiredString(value)) throw new Error("invalid value");
  return value;
}
```

Replace the `typeof ... === "string"` checks for required normalized fields with `isRequiredString`. Required resource fields are `kind`, `name`, and `syncStatus`; preserve current optional/default handling for group, version, namespace, health, messages, and timestamps.

- [ ] **Step 6: Verify Task 1**

Run:

```bash
bunx vitest run gateway/src/providers/-argocd.test.ts gateway/src/-snapshot.test.ts gateway/src/-app.test.ts gateway/src/-deployment-correlation.test.ts
bun run build:gateway
bun run lint
bunx oxfmt --check gateway/src/providers/argocd.ts gateway/src/providers/-argocd.test.ts gateway/src/-snapshot.test.ts gateway/src/-app.test.ts
git diff --check
```

Expected: all commands pass. Record RED/GREEN commands and totals in the Task 1 report.

- [ ] **Step 7: Commit**

```bash
git add gateway/src/providers/argocd.ts gateway/src/providers/-argocd.test.ts gateway/src/-snapshot.test.ts gateway/src/-app.test.ts
git commit -m "fix: reject blank argo deployment evidence"
```

---

### Task 2: Share Strict Replica Validation Across Snapshot and Correlation

**Files:**
- Modify: `gateway/src/runtime-validation.ts`
- Modify: `gateway/src/snapshot.ts`
- Modify: `gateway/src/deployment-correlation.ts`
- Modify: `gateway/src/-snapshot.test.ts`
- Modify: `gateway/src/-deployment-correlation.test.ts`
- Modify: `gateway/src/-app.test.ts`

**Interfaces:**
- Produces: `isNonNegativeInteger(value: unknown): value is number` from `gateway/src/runtime-validation.ts`.
- Consumes: the same predicate in both `parseClusterData` and direct Kubernetes deployment evidence parsing.
- Preserves: `0` is valid input; correlation decides that a present target with zero available replicas is Critical.

- [ ] **Step 1: Add route/snapshot tests for invalid replica counts**

Add table-driven cases covering both `desiredReplicas` and `availableReplicas` with:

```ts
const invalidReplicaValues = [-1, -0.5, 0.5, 1.5, Number.NaN, Infinity, "1", null];
```

For each case, inject an otherwise valid Kubernetes cluster provider result through the deployment snapshot and `/deployments` route. Assert:

```ts
expect(response.status).toBe(200);
expect(body.status).toBe("unknown");
expect(body.sources).toContainEqual(
  expect.objectContaining({ source: "kubernetes", status: "unknown" }),
);
```

For the non-number case, use the fixed value `SECRET_REPLICA_MARKER` and assert `JSON.stringify(body)` does not contain that marker. For numeric cases, assert the fixed Unknown issue/reason and nullable deployment replica evidence rather than searching for a number that may legitimately occur elsewhere in the snapshot.

- [ ] **Step 2: Add shared-rule parity tests**

In `gateway/src/-deployment-correlation.test.ts`, add fractional replica cases to the existing invalid-evidence table. Add valid controls for `0`, `1`, and a larger integer. Assert:

- invalid values produce fixed Unknown evidence;
- a present target with `availableReplicas: 0` remains Critical;
- valid positive integer replicas retain the existing Healthy/Warning behavior.

- [ ] **Step 3: Run the focused tests and capture RED**

Run:

```bash
bunx vitest run gateway/src/-snapshot.test.ts gateway/src/-app.test.ts gateway/src/-deployment-correlation.test.ts
```

Expected: snapshot/route cases fail because `parseClusterData` currently accepts any finite number, while direct correlation already rejects most invalid values.

- [ ] **Step 4: Export the shared predicate**

Add to `gateway/src/runtime-validation.ts`:

```ts
export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
```

Import and use it in `gateway/src/snapshot.ts` for `desiredReplicas` and `availableReplicas`. Remove the duplicate local predicate from `gateway/src/deployment-correlation.ts` and import the shared helper there.

- [ ] **Step 5: Verify focused and repository regressions**

Run:

```bash
bunx vitest run gateway/src/-snapshot.test.ts gateway/src/-app.test.ts gateway/src/-deployment-correlation.test.ts
bunx vitest run gateway shared
bun run test
bun run build:gateway
bun run build
bun run lint
bunx oxfmt --check gateway/src/runtime-validation.ts gateway/src/snapshot.ts gateway/src/deployment-correlation.ts gateway/src/-snapshot.test.ts gateway/src/-deployment-correlation.test.ts gateway/src/-app.test.ts
git diff --check
```

Expected: all commands pass. `bunx tsc --noEmit` may still report only the two pre-existing unrelated diagnostics in `src/lib/secret-vault.ts` and `src/routes/_layout/todos/-PrioritySection.tsx`; run it and record the exact output without changing those files.

- [ ] **Step 6: Commit**

```bash
git add gateway/src/runtime-validation.ts gateway/src/snapshot.ts gateway/src/deployment-correlation.ts gateway/src/-snapshot.test.ts gateway/src/-deployment-correlation.test.ts gateway/src/-app.test.ts
git commit -m "fix: unify deployment replica validation"
```

---

## Final Task 7b Gate

After both tasks pass their independent task reviews:

1. Run the full Task 7b diff review from the commit before Task 1 through Task 2 HEAD.
2. Confirm no Critical or Important findings remain for blank Argo fields or replica validation parity.
3. Record the parked raw Kubernetes pre-mapper cap without expanding this plan.
4. Mark original Task 7 unblocked, then resume Task 8 from the Homelab Dashboard plan.
