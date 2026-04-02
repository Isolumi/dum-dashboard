---
phase: 05-bento-overview-registration
plan: "02"
subsystem: overview-page
tags: [bento, registry, overview, loader, skeleton, foun-02]
dependency_graph:
  requires: [05-01, 04-todo-tool, 02-route-shell-and-tool-registry]
  provides: [wired-overview-page, TodoBentoCard-registration, foun-02-complete]
  affects:
    - src/tools/registry.ts
    - src/routes/_layout/index.tsx
    - src/routes/_layout.tsx
    - .prettierignore
tech_stack:
  added: []
  patterns: [route-loader, promise-all-parallel-fetch, pending-component-skeleton, semantic-token-only]
key_files:
  created: []
  modified:
    - src/tools/registry.ts
    - src/routes/_layout/index.tsx
    - src/routes/_layout.tsx
    - .prettierignore
decisions:
  - "Overview loader uses Promise.all over tools registry — parallel data fetch, null-coalesced for tools with no loadData"
  - "pendingComponent renders Skeleton cards matching bento card structure (3 skeletons per tool)"
  - "errorComponent uses text-destructive with plain text message per UI-SPEC"
  - "routeTree.gen.ts added to .prettierignore — oxfmt uses .prettierignore as ignore path; generated file must not be linted for format"
metrics:
  duration: "~20min (including checkpoint)"
  completed_date: "2026-04-02"
  tasks_completed: 2
  files_modified: 4
---

# Phase 05 Plan 02: Register TodoBentoCard and Wire Overview Page Loader Summary

**One-liner:** Registered TodoBentoCard in tool registry with `loadData: getTodos`, rewrote overview page with a parallel `Promise.all` loader, skeleton `pendingComponent`, and destructive `errorComponent`; fixed final FOUN-02 violation in `_layout.tsx`.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Register TodoBentoCard and wire overview page loader | e8dce86 | src/tools/registry.ts, src/routes/_layout/index.tsx, src/routes/_layout.tsx |
| 2 | Visual verification of bento overview (checkpoint) | — (human approved) | — |

## What Was Built

### Task 1: Registration + Overview Page Loader

**registry.ts changes:**
- Replaced `BentoCard: PlaceholderBentoCard` with `BentoCard: TodoBentoCard` in the todos tool entry
- Added `loadData: getTodos` to the todos tool entry
- Removed unused `PlaceholderBentoCard` import (now only used if future tools reference it)
- Added imports for `TodoBentoCard` from `#/routes/_layout/todos/-TodoBentoCard` and `getTodos` from `#/routes/todos/todos.functions`

**_layout/index.tsx complete rewrite:**
- Added `loader` that calls `Promise.all(tools.map(tool => tool.loadData?.() ?? Promise.resolve(null)))` to fetch all tool data in parallel
- Builds `Record<string, unknown>` keyed by `tool.id` from loader results
- Added `pendingComponent: OverviewLoading` with Skeleton cards (3 Skeleton elements per tool matching bento card layout: title, subtitle line, third line)
- Added `errorComponent: OverviewError` with `text-destructive` message "Could not load overview. Refresh to try again."
- `OverviewPage` reads `toolData` via `Route.useLoaderData()` and passes `data={toolData[tool.id]}` to each `BentoCard`
- No direct `TodoBentoCard` import in overview page — OVER-02 compliant

**_layout.tsx FOUN-02 fix:**
- Changed `border-neutral-700` to `border-border` in the header element (line 14)
- Zero raw palette classes remain in the layout file

### Task 2: Human Verification (Checkpoint)

User navigated to `http://localhost:3000/` and visually verified:
- Bento grid renders one "Todos" card with CheckSquare icon
- Card shows status count badges (not_started / started / complete)
- Counts match actual todo data from /todos
- Card click navigates to /todos without full page reload
- Card hover and focus ring behave correctly

**Approved.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Config] Added routeTree.gen.ts to .prettierignore**
- **Found during:** Post-task verification (`bun run fmt:check`)
- **Issue:** `oxfmt --check` perpetually flagged `src/routeTree.gen.ts` as unformatted — the formatter would format it one way, then flag it again on the next check. TanStack Router regenerates this file during dev; oxfmt's own formatting pass doesn't converge on a stable representation for it.
- **Fix:** Added `src/routeTree.gen.ts` to `.prettierignore`. oxfmt uses `.prettierignore` as its default ignore file (per `--ignore-path` docs).
- **Files modified:** .prettierignore
- **Commit:** 6e63ec7

**2. [Rule 2 - Missing Critical Config] Applied oxfmt normalization to previously unformatted source files**
- **Found during:** Post-task `bun run fmt:check`
- **Issue:** Several pre-existing files (`button.tsx`, `calendar.tsx`, `-AddTodoRow.tsx`, `-TodoBentoCard.tsx`, `-TodoRow.tsx`, `vitest.config.ts`) had accumulated formatting drift not caught by prior plans
- **Fix:** Ran `bun run fmt` to normalize all files; committed as a single chore commit
- **Files modified:** above 6 files
- **Commit:** 6e63ec7

## Test Results

```
Test Files  3 passed (3)
     Tests  38 passed (38)
  Duration  3.08s
```

No test changes — all 38 tests pass (24 unit + 6 AddTodoRow component + 8 TodoBentoCard component).

## Known Stubs

None. The overview page is fully wired — it loads real todo data via the route loader and passes it to `TodoBentoCard`, which renders live status counts and attention flags. No placeholder data flows to the UI.

## Self-Check: PASSED

- src/tools/registry.ts: FOUND
- src/routes/_layout/index.tsx: FOUND
- src/routes/_layout.tsx: FOUND
- .prettierignore: FOUND
- Commit e8dce86: FOUND
- Commit 6e63ec7: FOUND
- `bun run test`: 38/38 pass
- `bun run lint`: 0 errors
- `bun run fmt:check`: All matched files use the correct format
