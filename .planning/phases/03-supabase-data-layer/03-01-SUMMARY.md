---
phase: 03-supabase-data-layer
plan: 01
subsystem: data-layer
status: complete
tags: [supabase, zod, client, types, infrastructure]
dependency_graph:
  requires: [phase-02-route-shell]
  provides: [supabase-client-singleton, typed-database-types, helper-aliases]
  affects: [03-02-PLAN.md, todo-server-functions]
tech_stack:
  added:
    - "@supabase/supabase-js@2.100.1"
    - "zod@3.25.76"
    - "@tanstack/zod-adapter@1.166.9"
  patterns:
    - "createClient<Database>() typed Supabase singleton"
    - "import.meta.env.VITE_SUPABASE_* env vars"
    - "Database['public']['Tables']['todos']['Row'] helper aliases"
key_files:
  created:
    - src/lib/supabase.ts
    - src/lib/database.types.ts
    - .env.example
  modified:
    - package.json
    - bun.lock
decisions:
  - "zod pinned to v3 (^3.24.2) — @tanstack/zod-adapter@1.166.9 peer requires zod@^3.23.8; v4 breaks compatibility"
  - "supabase.ts MUST only be imported from *.functions.ts files — createServerFn compiler boundary enforcement"
metrics:
  completed_date: "2026-03-29"
  duration_seconds: ~900
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
---

# Phase 03 Plan 01: Supabase Client Setup Summary

**One-liner:** Supabase JS client singleton typed with Database generic, Zod v3 installed, hosted Supabase project provisioned with todos table (enums + RLS disabled), TypeScript types generated and helper aliases exported.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Install packages and create Supabase client singleton | 1614212 | package.json, bun.lock, src/lib/supabase.ts, .env.example |
| 2 | User configures Supabase env vars, creates schema, generates types | (human action) | .env.local, src/lib/database.types.ts |
| 3 | Format generated types and add helper type aliases | 3de5a38 | src/lib/database.types.ts |

## Artifacts Produced

- **`src/lib/supabase.ts`** — Typed Supabase client singleton (`createClient<Database>`) using `import.meta.env` vars. Must only be imported from `*.functions.ts` files.
- **`src/lib/database.types.ts`** — Generated types from live Supabase schema, formatted with oxfmt, with five helper aliases appended: `Todo`, `TodoInsert`, `TodoUpdate`, `TodoPriority`, `TodoStatus`.
- **`.env.example`** — Documents `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` env vars with source instructions.
- **`package.json` + `bun.lock`** — Three new runtime dependencies added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pinned zod to v3 instead of latest (v4)**
- **Found during:** Task 1 — bun resolved zod@4.3.6 by default
- **Issue:** `@tanstack/zod-adapter@1.166.9` has `peerDependencies: { "zod": "^3.23.8" }` — zod v4 breaks compatibility
- **Fix:** Ran `bun add zod@^3.24.2` to pin to zod v3 (resolved as v3.25.76)
- **Files modified:** package.json, bun.lock
- **Commit:** 1614212

### Task 2: Human-action Checkpoint

User completed all three required steps:
1. Added `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to `.env.local`
2. Ran schema SQL in Supabase SQL Editor (created `todo_priority`, `todo_status` enums and `todos` table with RLS disabled)
3. Generated `src/lib/database.types.ts` via `npx supabase gen types typescript`

The generated types include additional tables (`expenses`, `ledgers`, `users`, `category`, `priority`, `status` enums) from a pre-existing Supabase project — these are present in the types file but are not used by this plan.

## Known Stubs

None — all type aliases are wired to actual schema types and typecheck passes cleanly.

## Self-Check: PASSED

- [x] `src/lib/supabase.ts` — FOUND
- [x] `.env.example` — FOUND
- [x] `src/lib/database.types.ts` — FOUND
- [x] `export type Database =` present in database.types.ts — FOUND
- [x] `todo_priority` enum in database.types.ts — FOUND
- [x] `todo_status` enum in database.types.ts — FOUND
- [x] `export type Todo = Database["public"]["Tables"]["todos"]["Row"]` — FOUND
- [x] `export type TodoInsert` — FOUND
- [x] `export type TodoUpdate` — FOUND
- [x] `export type TodoPriority` — FOUND
- [x] `export type TodoStatus` — FOUND
- [x] `bun run fmt:check` passes — PASSED
- [x] `tsc --noEmit` exits 0 — PASSED
- [x] commit 1614212 exists — FOUND
- [x] commit 3de5a38 exists — FOUND
