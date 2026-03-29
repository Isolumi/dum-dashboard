---
phase: 03-supabase-data-layer
plan: 02
subsystem: data-layer
tags: [supabase, tanstack-start, server-functions, zod, validation, crud, tdd]

requires:
  - phase: 03-01
    provides: supabase-client-singleton, typed-database-types, helper-aliases

provides:
  - CRUD server functions for todos table (getTodos, getTodo, createTodo, updateTodo, deleteTodo)
  - Zod schema exports for todos input validation
  - Bundle isolation confirmed: no Supabase in client chunks

affects: [04-todo-tool-ui, any phase that imports todos server functions]

tech-stack:
  added: []
  patterns:
    - "createServerFn({ method: 'GET'|'POST' }).inputValidator(zodValidator(schema)).handler() pattern"
    - "Supabase import boundary: only *.functions.ts files import supabase client"
    - "Export Zod schemas from functions file to enable direct unit testing"
    - "Prefix test files with - to exclude from TanStack Router route tree"

key-files:
  created:
    - src/routes/todos/todos.functions.ts
    - src/routes/todos/-todos.functions.test.ts
  modified: []

key-decisions:
  - "Zod schemas exported from todos.functions.ts — enables direct unit testing without mocking createServerFn"
  - "Test file prefixed with - (-todos.functions.test.ts) — TanStack Router ignores files with - prefix, preventing spurious route warnings"
  - "No vitest config needed — vitest picks up vite.config.ts automatically with vite-tsconfig-paths for #/* alias resolution"

patterns-established:
  - "Server function pattern: createServerFn + zodValidator + Supabase query + error throw"
  - "TDD test file naming: prefix with - to exclude from TanStack Router route discovery"

requirements-completed: [TODO-07]

duration: 142s
completed: 2026-03-29
---

# Phase 03 Plan 02: Supabase Server Functions Summary

**Five typed CRUD server functions for todos with Zod validation — written TDD (RED then GREEN), bundle isolation verified: zero Supabase code in client chunks.**

## Performance

- **Duration:** ~142 seconds
- **Started:** 2026-03-29T22:42:05Z
- **Completed:** 2026-03-29T22:44:27Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

### Task 1: Create CRUD Server Functions with Zod Validation (TDD)

Created `src/routes/todos/todos.functions.ts` with 5 exported server functions:

- `getTodos` — GET, no input, returns `Todo[]` ordered by `created_at` descending
- `getTodo` — GET, input validated by `GetTodoSchema`, returns single `Todo`
- `createTodo` — POST, input validated by `CreateTodoSchema`, returns created `Todo`
- `updateTodo` — POST, input validated by `UpdateTodoSchema` (id required, other fields optional), returns updated `Todo`
- `deleteTodo` — POST, input validated by `DeleteTodoSchema`, returns void

All four Zod schemas (`CreateTodoSchema`, `UpdateTodoSchema`, `DeleteTodoSchema`, `GetTodoSchema`) are exported from the file for direct unit testing.

TDD process followed strictly:
- RED: wrote 23 test cases in `-todos.functions.test.ts` — all failed (Cannot find module)
- GREEN: implemented `todos.functions.ts` — all 23 tests pass

### Task 2: Bundle Isolation Verification

Ran `bun run build` and verified via grep that no Supabase-related strings (`createClient`, `@supabase`, `supabase-js`, `realtime-js`) appear in `dist/client/` JavaScript chunks. The `createServerFn` compiler transform correctly isolates all Supabase code to server-side execution.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create CRUD server functions with Zod validation | 4f1541c | src/routes/todos/todos.functions.ts, src/routes/todos/-todos.functions.test.ts |
| 2 | Verify bundle isolation — no Supabase in client chunks | (verification only) | None — dist/ is gitignored |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Prefixed test file with - to exclude from route tree**
- **Found during:** Task 1 — TanStack Router plugin emitted warning that test file "does not export a Route"
- **Issue:** Test file at `src/routes/todos/todos.functions.test.ts` triggered TanStack Router route discovery warning
- **Fix:** Renamed to `src/routes/todos/-todos.functions.test.ts` (files prefixed with `-` are ignored by TanStack Router's route file scanner)
- **Impact:** None — vitest can still run the file by path; import from `./todos.functions` still resolves correctly
- **Files modified:** Renamed from todos.functions.test.ts to -todos.functions.test.ts

**2. [Rule 2 - Missing Critical] Exported Zod schemas for testability**
- **Found during:** Task 1 — schemas needed to be exported for TDD unit tests
- **Issue:** Plan specified schemas as internal, but TDD requirements required direct schema testing
- **Fix:** Added `export` keyword to all four Zod schemas (CreateTodoSchema, UpdateTodoSchema, DeleteTodoSchema, GetTodoSchema)
- **Files modified:** src/routes/todos/todos.functions.ts

### Auth Gates

None.

## Known Stubs

None — all server functions are fully wired to Supabase with real query logic.

## Self-Check: PASSED

- [x] `src/routes/todos/todos.functions.ts` — FOUND
- [x] `src/routes/todos/-todos.functions.test.ts` — FOUND
- [x] `export const getTodos = createServerFn({ method: "GET" })` — FOUND
- [x] `export const getTodo = createServerFn({ method: "GET" })` — FOUND
- [x] `export const createTodo = createServerFn({ method: "POST" })` — FOUND
- [x] `export const updateTodo = createServerFn({ method: "POST" })` — FOUND
- [x] `export const deleteTodo = createServerFn({ method: "POST" })` — FOUND
- [x] `.inputValidator(zodValidator(` — 4 occurrences — FOUND
- [x] `z.object({` — 4 occurrences — FOUND
- [x] `z.looseObject` — NOT PRESENT (correct)
- [x] 23 vitest tests pass — PASSED
- [x] `bun run fmt:check` on todos files — PASSED
- [x] `tsc --noEmit` exits 0 — PASSED
- [x] `bun run build` exits 0 — PASSED
- [x] No Supabase strings in `dist/client/` — PASSED
- [x] commit 4f1541c exists — FOUND
