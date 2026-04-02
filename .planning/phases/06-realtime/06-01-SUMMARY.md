---
phase: 06-realtime
plan: 01
subsystem: realtime
tags: [supabase-realtime, postgres_changes, custom-hook, tdd, vitest]

# Dependency graph
requires:
  - phase: 03-supabase-data-layer
    provides: supabase.ts anon key client singleton
  - phase: 04-todo-tool
    provides: TodosPage with useState<Todo[]>, getTodos server function, setTodos

provides:
  - useTodosRealtime hook: Supabase channel lifecycle, onEvent forwarding, ChannelStatus tracking
  - LiveIndicator component: renders null/live/reconnecting states
  - TodosPage wired to hook and indicator
  - 7 new automated tests (4 hook + 3 component), all passing

affects: [06-realtime, src/routes/_layout/todos/index.tsx]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useRef stable callback pattern to avoid channel churn on re-renders (onEventRef)"
    - "Empty deps [] useEffect for single-mount channel setup/teardown"
    - "supabase.channel().on('postgres_changes').subscribe() for realtime cross-tab sync"
    - "Refetch-on-event strategy: call getTodos() on any INSERT/UPDATE/DELETE event"

key-files:
  created:
    - src/hooks/useTodosRealtime.ts
    - src/routes/_layout/todos/-LiveIndicator.tsx
    - src/hooks/-useTodosRealtime.test.tsx
    - src/routes/_layout/todos/-LiveIndicator.test.tsx
  modified:
    - src/routes/_layout/todos/index.tsx

key-decisions:
  - "useRef (onEventRef) pattern used for stable callback -- prevents channel churn when TodosPage re-renders"
  - "Empty deps array [] for channel useEffect -- channel created once per mount, per D-03"
  - "LiveIndicator uses text-muted-foreground for both dot and text -- low-prominence informational indicator per UI-SPEC"
  - "Heading row wrapped in flex justify-between div -- LiveIndicator right-aligned per UI-SPEC placement spec"
  - "Optimistic initial status ('live') -- avoids nothing→Live flash; reasonable for personal app with reliable Supabase"
  - "hasSubscribed ref guard -- errors before first SUBSCRIBED don't flash 'Reconnecting...'; only degrade after real established failure"

requirements-completed: [REAL-01]

# Metrics
duration: 149s
completed: 2026-04-02
---

# Phase 6 Plan 01: Supabase Realtime Cross-Tab Sync Summary

**Supabase postgres_changes subscription with refetch-on-event strategy, stable useRef callback, and pulsing LiveIndicator for channel status**

## Performance

- **Duration:** ~2.5 min
- **Started:** 2026-04-02T19:57:09Z
- **Completed:** 2026-04-02T19:59:38Z
- **Tasks:** 2 completed (Task 3 is a human checkpoint — pending)
- **Files created/modified:** 5

## Accomplishments

### Task 1 (RED): Wrote failing tests

Created two test files before any implementation:

- `src/hooks/-useTodosRealtime.test.tsx`: 4 tests — onEvent callback forwarding, SUBSCRIBED status transition, CHANNEL_ERROR status transition, removeChannel on unmount. Uses `vi.mock("#/lib/supabase")` with a chainable channel mock that captures subscribe and event callbacks.
- `src/routes/_layout/todos/-LiveIndicator.test.tsx`: 3 tests — null render for 'connecting', "Live" text + pulsing dot for 'live', "Reconnecting..." text (no dot) for 'reconnecting'.

Tests failed with "Failed to resolve import" errors as expected (RED). Committed at `6e93c99`.

### Task 2 (GREEN): Implemented all three files

- `src/hooks/useTodosRealtime.ts`: Custom hook using `useRef` stable callback pattern + empty deps `[]` to ensure single-mount channel setup. Maps Supabase `REALTIME_SUBSCRIBE_STATES` to internal `ChannelStatus`. Exports both `ChannelStatus` type and `useTodosRealtime` function.
- `src/routes/_layout/todos/-LiveIndicator.tsx`: Pure presentational component. Returns `null` for 'connecting' (no flash), pulsing dot + "Live" for 'live', "Reconnecting..." text for 'reconnecting'. All colours via semantic tokens (`text-muted-foreground`, `bg-muted-foreground`).
- `src/routes/_layout/todos/index.tsx`: Added `useTodosRealtime` and `LiveIndicator` imports. Hook called with `getTodos()+setTodos` callback. Heading wrapped in `flex justify-between` div with `<LiveIndicator status={channelStatus} />`.

All 45 tests pass (38 pre-existing + 7 new). lint: 0 errors (1 pre-existing warning in unrelated file). fmt:check: exit 0. Committed at `dbda366`.

## Task Commits

1. **Task 1 (RED): Write failing tests for useTodosRealtime and LiveIndicator** — `6e93c99` (test)
2. **Task 2 (GREEN): Implement useTodosRealtime hook and LiveIndicator component** — `dbda366` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/hooks/useTodosRealtime.ts` — Custom hook encapsulating Supabase channel setup, teardown, status tracking (CREATED)
- `src/routes/_layout/todos/-LiveIndicator.tsx` — Presentational component for channel status indicator (CREATED)
- `src/hooks/-useTodosRealtime.test.tsx` — 4 unit tests for hook behavior (CREATED)
- `src/routes/_layout/todos/-LiveIndicator.test.tsx` — 3 component tests for indicator rendering (CREATED)
- `src/routes/_layout/todos/index.tsx` — Wired hook + indicator into TodosPage heading area (MODIFIED)

## Decisions Made

- **useRef pattern for onEvent:** The `onEvent` callback is captured in `onEventRef` and updated on every render via a separate `useEffect`. This ensures the channel effect's empty `[]` deps array is valid while always calling the latest version of the callback. Avoids the channel churn anti-pattern documented in 06-RESEARCH.md.
- **LiveIndicator colour token:** `text-muted-foreground` and `bg-muted-foreground` used for both the dot and all text — low-prominence informational indicator per 06-UI-SPEC.md colour rationale (violet reserved for interactive elements, destructive reserved for actual errors).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - UX] Reconnecting flash on initial mount (two-stage fix)**
- **Found during:** Task 3 human checkpoint
- **Issue:** Supabase emits CHANNEL_ERROR/CLOSED during channel setup handshake before SUBSCRIBED, causing 'Reconnecting...' flash. A second issue was the nothing→Live flash from the original 'connecting' initial state.
- **Fix:** (a) Changed initial state to 'live' (optimistic); (b) Added `hasSubscribed` ref — only transition to 'reconnecting' after first successful SUBSCRIBED event. Errors during initial handshake are silently ignored.
- **Files modified:** `src/hooks/useTodosRealtime.ts`, `src/hooks/-useTodosRealtime.test.tsx`
- **Committed in:** `f3295a4`, `c530af0`, `db0b38e`

**2. [Rule 1 - Bug] oxfmt reformatted .on() call in useTodosRealtime.ts**
- **Found during:** Task 2 verification (bun run fmt:check)
- **Issue:** The multi-line `.on("postgres_changes", { ... }, callback)` format didn't match oxfmt's style
- **Fix:** Ran `bunx oxfmt` to auto-format the file; `.on(...)` args collapsed to single-line with trailing-comma lambda
- **Files modified:** `src/hooks/useTodosRealtime.ts`
- **Commit:** included in `dbda366`

## Known Stubs

None — all implementation is complete. The `useTodosRealtime` hook is fully wired: channel setup, event forwarding to `getTodos()+setTodos`, and status tracking. The `LiveIndicator` renders all three states. `TodosPage` consumes both.

The only pending item is the manual cross-tab verification checkpoint (Task 3), which requires a human to verify live Supabase realtime behavior.

## User Setup Required

Before Task 3 (manual verification) can pass, the user must verify:

1. Open Supabase Dashboard SQL Editor
2. Run: `select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime';`
3. If `todos` is NOT listed, run: `alter publication supabase_realtime add table todos;`

This is a one-time DB-level prerequisite — without it, the channel subscribes successfully but no INSERT/UPDATE/DELETE events fire (silent failure).

---
*Phase: 06-realtime*
*Completed: 2026-04-02 (all tasks including human checkpoint — approved)*

## Self-Check: PASSED

- FOUND: `src/hooks/useTodosRealtime.ts`
- FOUND: `src/routes/_layout/todos/-LiveIndicator.tsx`
- FOUND: `src/hooks/-useTodosRealtime.test.tsx`
- FOUND: `src/routes/_layout/todos/-LiveIndicator.test.tsx`
- FOUND: `.planning/phases/06-realtime/06-01-SUMMARY.md`
- FOUND: commit `6e93c99` (test RED)
- FOUND: commit `dbda366` (feat GREEN)
