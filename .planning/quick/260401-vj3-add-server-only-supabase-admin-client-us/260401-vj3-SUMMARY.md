---
phase: quick
plan: 260401-vj3
subsystem: data-layer
tags: [supabase, rls, server-functions, security]
dependency_graph:
  requires: []
  provides: [supabase-admin-client, rls-bypass-for-server-functions]
  affects: [todos-server-functions]
tech_stack:
  added: []
  patterns: [process.env for server-only secrets, named-export admin client]
key_files:
  created:
    - src/lib/supabase-admin.ts
  modified:
    - src/routes/todos/todos.functions.ts
    - vitest.config.ts
decisions:
  - "supabase-admin.ts uses process.env (not import.meta.env) for both vars — keeps the pattern clearly server-only and prevents Vite from inlining SUPABASE_SECRET_KEY into the client bundle"
  - "SUPABASE_SECRET_KEY has no VITE_ prefix — Vite will not inline it; crash-on-startup via non-null assertion is preferable to a silent RLS bypass failure"
  - "supabase-admin.ts import boundary: only *.functions.ts files may import it"
metrics:
  duration: 4min
  completed: 2026-03-30
  tasks_completed: 2
  files_modified: 3
---

# Quick Task 260401-vj3: Add Server-Only Supabase Admin Client Summary

**One-liner:** Server-only `supabaseAdmin` client using `process.env.SUPABASE_SECRET_KEY` (service-role key, no VITE_ prefix) to bypass RLS — wired to all 5 todo server functions.

## What Was Built

`src/lib/supabase-admin.ts` exports a single `supabaseAdmin` Supabase client created with the service-role key sourced from `process.env.SUPABASE_SECRET_KEY`. Because the variable has no `VITE_` prefix, Vite's compile-time substitution never inlines it into the client bundle.

All 5 server functions in `todos.functions.ts` (getTodos, getTodo, createTodo, updateTodo, deleteTodo) now import and use `supabaseAdmin` instead of the public `supabase` client. This ensures they continue operating correctly when RLS is enabled on the todos table.

`vitest.config.ts` was updated to add `SUPABASE_SECRET_KEY: "test-secret"` to the unit project env block, satisfying the non-null assertion at module load time during tests.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create server-only admin client | 5cad9c6 | src/lib/supabase-admin.ts |
| 2 | Wire todos.functions.ts to admin client and update vitest stub | 731fbf2 | src/routes/todos/todos.functions.ts, vitest.config.ts |

## Verification Results

- `bun run tsc --noEmit`: no errors
- `bun run test --project=unit`: 24/24 tests pass
- `git diff src/lib/supabase.ts`: no changes (file untouched)
- Secret key check (`grep -r "SUPABASE_SECRET_KEY" src/ | grep -v "functions.ts" | grep -v "supabase-admin.ts"`): no matches (key confined to admin layer only)

## Deviations from Plan

**1. [Rule 1 - Bug] Multi-line Supabase call chains not replaced by replace_all**

- **Found during:** Task 2
- **Issue:** The `replace_all` for `supabase.` only matched same-line `.` chaining. Three server functions (getTodos, getTodo, updateTodo) used multi-line chaining (`await supabase\n    .from(...)`) so the identifier wasn't followed immediately by `.` on the same line.
- **Fix:** Applied three targeted single-occurrence edits to replace the `supabase` identifier in those handlers.
- **Files modified:** src/routes/todos/todos.functions.ts
- **Commit:** 731fbf2

## Known Stubs

None.

## Self-Check

- [x] `src/lib/supabase-admin.ts` exists: FOUND
- [x] `src/routes/todos/todos.functions.ts` contains `supabaseAdmin`: FOUND (6 occurrences)
- [x] `vitest.config.ts` contains `SUPABASE_SECRET_KEY`: FOUND
- [x] `src/lib/supabase.ts` unchanged: CONFIRMED (git diff empty)
- [x] Commit 5cad9c6 exists: CONFIRMED
- [x] Commit 731fbf2 exists: CONFIRMED

## Self-Check: PASSED
