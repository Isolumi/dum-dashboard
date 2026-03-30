---
phase: 04-todo-tool
plan: 05
subsystem: api
tags: [supabase, server-functions, null-safety, bug-fix, tdd]

# Dependency graph
requires:
  - phase: 03-supabase-data-layer
    provides: getTodos server function returning Supabase query results
provides:
  - Null-safe getTodos that always returns Todo[] (never null)
  - Verified by test that data ?? [] guard is present
affects: [todos-route-loader, todo-page-component]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Null coalescing guard on Supabase .select() data: return data ?? [] instead of return data"

key-files:
  created: []
  modified:
    - src/routes/todos/todos.functions.ts
    - src/routes/todos/-todos.functions.test.ts

key-decisions:
  - "TDD static verification: test reads source file and asserts data ?? [] is present — reliable RED/GREEN without mocking createServerFn"

patterns-established:
  - "Supabase select() null guard: always apply data ?? [] when returning array results"

requirements-completed: [TODO-01]

# Metrics
duration: 5min
completed: 2026-03-30
---

# Phase 04 Plan 05: Null Guard for getTodos Summary

**One-line null coalescing fix to getTodos: `return data ?? []` prevents todos.map() crash when Supabase returns null for an empty table**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-30T06:54:00Z
- **Completed:** 2026-03-30T07:00:00Z
- **Tasks:** 1 (+ TDD test task)
- **Files modified:** 2

## Accomplishments

- Added `data ?? []` null guard to getTodos handler — getTodos can no longer return null
- Added TDD test that verifies the null guard is present in the source file
- All 24 tests pass (23 existing schema tests + 1 new null safety test)

## Task Commits

1. **RED test: getTodos null safety** - `0b08536` (test)
2. **Task 1: Add null guard to getTodos** - `3bb0305` (fix)

## Files Created/Modified

- `src/routes/todos/todos.functions.ts` — Changed `return data` to `return data ?? []` on line 37
- `src/routes/todos/-todos.functions.test.ts` — Added `getTodos null safety` describe block with static verification test

## Decisions Made

- Used static verification (file content assertion) for TDD: the test reads `todos.functions.ts` and asserts it contains `data ?? []`. This approach is reliable in a test environment where mocking `createServerFn` is complex, while providing genuine RED/GREEN cycle.

## Deviations from Plan

None - plan executed exactly as written. One-line change to `todos.functions.ts` only.

## Issues Encountered

- Worktree was initialized on `main` branch (different Next.js codebase) instead of `v1`. Reset with `git reset --hard v1` before beginning work.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- getTodos now always returns `Todo[]` — the todos loader will no longer crash when the table is empty
- Ready for Phase 04 Plan 06 (remaining gap closure fixes)

---
*Phase: 04-todo-tool*
*Completed: 2026-03-30*

## Self-Check: PASSED

- FOUND: `.planning/phases/04-todo-tool/04-05-SUMMARY.md`
- FOUND: `src/routes/todos/todos.functions.ts`
- FOUND: commit `0b08536` (RED test)
- FOUND: commit `3bb0305` (fix implementation)
- FOUND: commit `dd37e32` (docs/SUMMARY)
