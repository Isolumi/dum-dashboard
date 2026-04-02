---
phase: 05-bento-overview-registration
plan: "01"
subsystem: tool-registry
tags: [bento, registry, todo, tdd, component]
dependency_graph:
  requires: [04-todo-tool, 02-route-shell-and-tool-registry]
  provides: [TodoBentoCard, updated-ToolEntry-interface]
  affects: [src/tools/registry.ts, src/tools/PlaceholderBentoCard.tsx, src/routes/_layout/todos/-TodoBentoCard.tsx]
tech_stack:
  added: []
  patterns: [tdd-component, semantic-token-only, conditional-render]
key_files:
  created:
    - src/routes/_layout/todos/-TodoBentoCard.tsx
    - src/routes/_layout/todos/-TodoBentoCard.test.tsx
  modified:
    - src/tools/registry.ts
    - src/tools/PlaceholderBentoCard.tsx
decisions:
  - "BentoCard prop type now ComponentType<{ tool: ToolEntry; data: unknown }> — enables data-carrying overview loader"
  - "PlaceholderBentoCard accepts data prop but ignores it — type-compatible with updated BentoCard contract"
  - "TodoBentoCard attention row hidden from DOM entirely when overdueCount=0 and highPriorityCount=0 (D-04)"
  - "Regex fix in Test 8: use /^started: 0$/i (anchored) not /started: 0/i to avoid ambiguity with 'not started: 0'"
metrics:
  duration: "163s"
  completed_date: "2026-04-02"
  tasks_completed: 2
  files_modified: 4
---

# Phase 05 Plan 01: ToolEntry Registry Contract + TodoBentoCard Summary

**One-liner:** Extended ToolEntry with `loadData`/`data: unknown` contract and built TodoBentoCard showing live status counts and attention flags from Todo[] data, verified with 8 TDD component tests.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Update ToolEntry interface and fix PlaceholderBentoCard | b0da0fa | src/tools/registry.ts, src/tools/PlaceholderBentoCard.tsx |
| 2 | Create TodoBentoCard component and tests (TDD) | eebd814 | src/routes/_layout/todos/-TodoBentoCard.tsx, src/routes/_layout/todos/-TodoBentoCard.test.tsx |

## What Was Built

### Task 1: ToolEntry Interface + PlaceholderBentoCard Fix

Updated `ToolEntry` in `src/tools/registry.ts`:
- Added `loadData?: () => Promise<unknown>` field — enables the overview loader (Plan 02) to call each tool's data fetcher
- Updated `BentoCard` type from `ComponentType<{ tool: ToolEntry }>` to `ComponentType<{ tool: ToolEntry; data: unknown }>` — passes loaded data into each card

Updated `PlaceholderBentoCard` in `src/tools/PlaceholderBentoCard.tsx`:
- Accepts `{ tool, data }: { tool: ToolEntry; data: unknown }` (data destructured away as it is unused)
- Replaced all raw palette classes with semantic tokens: `border-neutral-700` -> `border-border`, `bg-neutral-900` -> `bg-card`, `text-neutral-100` -> `text-foreground`, `text-neutral-400` -> `text-muted-foreground`, `hover:border-violet-400` -> `hover:border-primary/50`
- Now FOUN-02 compliant (zero raw palette classes)

### Task 2: TodoBentoCard Component (TDD)

**TDD RED:** Wrote 8 failing tests in `-TodoBentoCard.test.tsx` covering:
- Three status badge groups with correct counts from fixture data
- Overdue count badge (excludes complete todos)
- High-priority count badge (excludes complete todos)
- Attention row absent from DOM when counts are 0
- Card renders as Link with href /todos
- Null data handled gracefully (all counts 0)

**TDD GREEN:** Implemented `TodoBentoCard` in `-TodoBentoCard.tsx`:
- Derives `todos = Array.isArray(data) ? (data as Todo[]) : []` for null-safe operation
- Computes `notStartedCount`, `startedCount`, `completeCount`, `overdueCount`, `highPriorityCount`
- Overdue detection mirrors existing TodoRow pattern: `due_date !== null && new Date(due_date) < today && status !== 'complete'`
- `hasAttention = overdueCount > 0 || highPriorityCount > 0` — attention row absent from DOM (not just hidden) when false
- Card wrapped in `<Link to="/todos" aria-label="Open Todos tool">` for full-card click navigation
- Status icons use same color tokens as TodoRow: `text-muted-foreground`, `text-primary`
- Attention badges use `bg-destructive/10 text-destructive` (overdue) and `bg-amber-400/10 text-amber-400` (high-priority)
- Zero FOUN-01/FOUN-02 violations (no hardcoded colors, no raw palette classes)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Ambiguous regex in Test 8 caused multiple-element match**
- **Found during:** Task 2 TDD GREEN (first test run)
- **Issue:** Test 8 used `/started: 0/i` which matched both `aria-label="Not started: 0"` and `aria-label="Started: 0"`, causing `getByRole` to throw "Found multiple elements"
- **Fix:** Changed regex to `/^started: 0$/i` (anchored with ^ and $) to match only the exact string "Started: 0"
- **Files modified:** src/routes/_layout/todos/-TodoBentoCard.test.tsx
- **Commit:** eebd814 (included in Task 2 commit)

## Test Results

```
Test Files  3 passed (3)
     Tests  38 passed (38)
  Duration  3.24s
```

All existing tests (24 unit + 6 component) plus 8 new TodoBentoCard component tests pass.

## Known Stubs

None. The `TodoBentoCard` is a complete implementation — it accepts real `Todo[]` data and renders status counts and attention flags. The `PlaceholderBentoCard` continues to show "Coming soon" but this is intentional placeholder behavior for non-todo tools, not a stub for this plan's goal. The `tools` array in `registry.ts` still uses `PlaceholderBentoCard` for todos — this will be updated in Plan 02 to use `TodoBentoCard` with `loadData: getTodos`.

## Self-Check: PASSED

- src/tools/registry.ts: FOUND
- src/tools/PlaceholderBentoCard.tsx: FOUND
- src/routes/_layout/todos/-TodoBentoCard.tsx: FOUND
- src/routes/_layout/todos/-TodoBentoCard.test.tsx: FOUND
- Commit b0da0fa: FOUND
- Commit eebd814: FOUND
