---
phase: 03-supabase-data-layer
plan: GAP
subsystem: testing
tags: [vitest, typescript, tanstack-router, vite]

# Dependency graph
requires:
  - phase: 03-supabase-data-layer
    provides: todos.functions.ts with CRUD server functions and Zod-validated schemas
  - phase: 04-todo-tool
    provides: TodoRow and AddTodoRow components with unit tests

provides:
  - vitest env stubs so supabase client initializes without throwing during test collection
  - viteReact() plugin in components project for JSX transform in .tsx tests
  - tsconfig.json without deprecated baseUrl (TS5101 eliminated)
  - routeFileIgnorePattern in vite.config.ts to silence todos.functions.ts route warnings
  - -TodoRow.tsx and -AddTodoRow.tsx with - prefix (TanStack Router ignores these)
  - All 30 tests passing, tsc --noEmit clean, build warning-free

affects: [future phases adding test files, any route files added to todos/]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "routeFileIgnorePattern under router: {} sub-key in tanstackStart() plugin options (not top-level)"
    - "vitest env: {} in defineProject test config for supabase URL stubs in unit tests"
    - "Component files in routes/ use - prefix; test files always use - prefix"

key-files:
  created: []
  modified:
    - vitest.config.ts
    - tsconfig.json
    - vite.config.ts
    - src/routes/_layout/todos/-TodoRow.tsx
    - src/routes/_layout/todos/-AddTodoRow.tsx
    - src/routes/_layout/todos/index.tsx
    - src/routes/_layout/todos/-AddTodoRow.test.tsx

key-decisions:
  - "routeFileIgnorePattern belongs inside router: {} sub-object in tanstackStart(), not at top level — TypeScript enforced this"
  - "Test verification command is bun run test (vitest run), not bun test (bun native runner) — plan said bun test but project uses vitest"
  - "-AddTodoRow.test.tsx import updated from ./AddTodoRow to ./-AddTodoRow after file rename — required Rule 1 fix"

patterns-established:
  - "tanstackStart router options: always nest router-level options under router: {} key"

requirements-completed: [TODO-07]

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 03 GAP: Supabase Data Layer Gap Closure Summary

**vitest env stubs + viteReact() plugin restore all 30 tests; tsconfig baseUrl removal fixes TS5101; component file renames and routeFileIgnorePattern eliminate all build warnings**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T18:26:40Z
- **Completed:** 2026-03-30T18:30:52Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- All 30 tests pass (24 unit + 6 component) with zero collection errors
- `tsc --noEmit` exits 0 with no TS5101 or other errors after removing deprecated `baseUrl`
- `bun run build` completes with zero "does not export a Route" warnings after rename and routeFileIgnorePattern
- D-07 preserved: `todos.functions.ts` stays at `src/routes/todos/todos.functions.ts` (not renamed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix vitest.config.ts — add env stubs and viteReact() plugin** - `d19090a` (feat)
2. **Task 2: Fix tsconfig.json — remove deprecated baseUrl** - `da2fbcf` (fix)
3. **Task 3: Silence build warnings — configure routeFileIgnorePattern and rename component files** - `9c9d66a` (feat)

## Files Created/Modified

- `vitest.config.ts` - Added viteReact() import, env stubs to unit project, viteReact() to components project
- `tsconfig.json` - Removed `"baseUrl": "."` from compilerOptions
- `vite.config.ts` - Added `router.routeFileIgnorePattern: "\\.functions\\.ts$"` to tanstackStart()
- `src/routes/_layout/todos/-TodoRow.tsx` - Renamed from TodoRow.tsx (git mv)
- `src/routes/_layout/todos/-AddTodoRow.tsx` - Renamed from AddTodoRow.tsx (git mv)
- `src/routes/_layout/todos/index.tsx` - Updated imports to use -prefixed paths
- `src/routes/_layout/todos/-AddTodoRow.test.tsx` - Updated dynamic import path from ./AddTodoRow to ./-AddTodoRow

## Decisions Made

- `routeFileIgnorePattern` is nested under `router: {}` in `tanstackStart()` options (not top-level) — TypeScript declared it at `TanStackStartInputConfig.router.routeFileIgnorePattern`, not at the root config level. The plan specified top-level placement which TypeScript rejected.
- The project uses `bun run test` (which calls `vitest run`) as the test command, not `bun test` (bun's native runner). The plan's verification command said `bun test` but that runs bun's built-in test runner which doesn't understand vitest test files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated dynamic import in -AddTodoRow.test.tsx after component rename**
- **Found during:** Task 3 (Silence build warnings — component renames)
- **Issue:** The test file has `await import("./AddTodoRow")` — after git mv of AddTodoRow.tsx to -AddTodoRow.tsx, this import path broke with "Failed to resolve import ./AddTodoRow"
- **Fix:** Changed dynamic import from `./AddTodoRow` to `./-AddTodoRow` to match the new filename
- **Files modified:** `src/routes/_layout/todos/-AddTodoRow.test.tsx`
- **Verification:** `bun run test` passes all 30 tests including all 6 component tests
- **Committed in:** `9c9d66a` (Task 3 commit)

**2. [Rule 1 - Bug] Moved routeFileIgnorePattern into router sub-object**
- **Found during:** Task 3 (configuring vite.config.ts)
- **Issue:** Plan specified `tanstackStart({ routeFileIgnorePattern: "..." })` but TypeScript error TS2353 showed the property does not exist at the top level — it belongs under `router: {}`
- **Fix:** Changed to `tanstackStart({ router: { routeFileIgnorePattern: "..." } })`
- **Files modified:** `vite.config.ts`
- **Verification:** `tsc --noEmit` exits 0; build warning check passes
- **Committed in:** `9c9d66a` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes required for correctness. No scope creep.

## Issues Encountered

- `bun test` runs bun's native test runner, not vitest. The project test suite uses vitest APIs (`describe`, `it`, `expect` from vitest). All tests pass via `bun run test` which calls the `vitest run` script. Plan verification command said `bun test` — this is confirmed as a naming mismatch; `bun run test` is the correct command.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 03 UAT gaps fully closed: all 3 gap items resolved
- `bun run test` exits 0, 30 tests pass
- `tsc --noEmit` exits 0 with no errors
- `bun run build` produces no route warnings
- Ready to proceed to Phase 05 or any subsequent phase

## Self-Check: PASSED

- `03-GAP-SUMMARY.md` exists at `.planning/phases/03-supabase-data-layer/`
- Commit `d19090a` (Task 1) exists
- Commit `da2fbcf` (Task 2) exists
- Commit `9c9d66a` (Task 3) exists
- `bun run test`: 30/30 tests pass
- `tsc --noEmit`: exits 0

---
*Phase: 03-supabase-data-layer*
*Completed: 2026-03-30*
