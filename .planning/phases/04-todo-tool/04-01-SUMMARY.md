---
phase: 04-todo-tool
plan: 01
subsystem: ui
tags: [tanstack-start, tanstack-router, shadcn, tailwind, popover, alert, skeleton, react-state, optimistic-updates]

# Dependency graph
requires:
  - phase: 03-supabase-data-layer
    provides: todos.functions.ts with getTodos/createTodo/updateTodo/deleteTodo server functions and Todo type
  - phase: 01-foundation
    provides: theme.css @theme block for color tokens, shadcn component install pattern
provides:
  - /todos route at /_layout/todos/ with loading/empty/error states
  - TodoRow and AddTodoRow typed stub components ready for Wave 2 implementation
  - Popover and Alert shadcn components installed (base-ui pattern)
  - amber-400 OKLCH color token in theme.css for medium priority badge
  - Full optimistic mutation handlers (create/update/delete) wired in TodosPage
affects: [04-02, 04-03, todos-wave2]

# Tech tracking
tech-stack:
  added: [@base-ui/react/popover via shadcn, alert component via shadcn]
  patterns:
    - Route.useLoaderData() (not bare useLoaderData()) for type-safe loader data
    - pendingComponent for skeleton loading state (not in-component loading flag)
    - Optimistic state updates with revert on error
    - useEffect timer cleanup for auto-dismissing mutation errors

key-files:
  created:
    - src/routes/_layout/todos/index.tsx
    - src/routes/_layout/todos/TodoRow.tsx
    - src/routes/_layout/todos/AddTodoRow.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/alert.tsx
  modified:
    - src/theme.css (amber-400 token added)
    - src/routeTree.gen.ts (auto-regenerated with new /_layout/todos/ route)

key-decisions:
  - "Todo route files placed at src/routes/_layout/todos/ (not src/routes/todos/) for correct TanStack Router layout nesting — file-based routing requires nesting under _layout directory"
  - "todos.functions.ts stays at src/routes/todos/ (existing location); index.tsx imports via #/routes/todos/todos.functions alias"
  - "Alert variant=destructive used for both loader error and mutation errors per composition.md rule (Callouts use Alert, not custom styled divs)"
  - "Mutation error auto-dismisses after 4 seconds via useEffect timer with cleanup"

patterns-established:
  - "Pattern 1: Route files for layout-nested tools go in src/routes/_layout/<tool>/ not src/routes/<tool>/"
  - "Pattern 2: Server function files (*.functions.ts) can stay in src/routes/<tool>/ even when component files are in _layout/<tool>/ — import via #/routes/<tool>/<tool>.functions"
  - "Pattern 3: Optimistic update pattern — snapshot previous state, setTodos immediately, await server call, revert on error"

requirements-completed: [TODO-02]

# Metrics
duration: 7min
completed: 2026-03-30
---

# Phase 4 Plan 01: Todo Route Foundation Summary

**Todos route at /_layout/todos/ with optimistic mutation handlers, 5-skeleton loading state, Alert-based error/empty UI, and typed TodoRow/AddTodoRow stubs for Wave 2**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-30T05:08:12Z
- **Completed:** 2026-03-30T05:14:48Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Installed Popover and Alert shadcn components (base-ui pattern, not Radix) and added amber-400 OKLCH token to theme.css
- Created /todos page route (/_layout/todos/) with loader, pendingComponent (5 skeleton rows), and full state management
- Implemented optimistic create/update/delete mutation handlers with automatic revert on error and 4-second auto-dismiss for mutation errors
- Created typed TodoRow and AddTodoRow stub components with correct prop interfaces ready for Wave 2 implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Install popover and alert components, add amber-400 theme token** - `6b4f3c1` (feat)
2. **Task 2: Create todo route file with state management, mutation handlers, and loading/empty/error states** - `1327a6f` (feat)

**Plan metadata:** _(pending - docs commit)_

## Files Created/Modified
- `src/routes/_layout/todos/index.tsx` - Todo page route with loader, state management, and mutation handlers
- `src/routes/_layout/todos/TodoRow.tsx` - Typed stub with TodoRowProps (todo, onUpdate, onDelete)
- `src/routes/_layout/todos/AddTodoRow.tsx` - Typed stub with AddTodoRowProps (onCreate)
- `src/components/ui/popover.tsx` - Popover component (base-ui pattern, Popover/PopoverTrigger/PopoverContent)
- `src/components/ui/alert.tsx` - Alert component (Alert/AlertTitle/AlertDescription/AlertAction)
- `src/theme.css` - Added --color-amber-400: oklch(0.82 0.17 85) for medium priority badge
- `src/routeTree.gen.ts` - Auto-regenerated to include /_layout/todos/ route

## Decisions Made
- Route files placed at `src/routes/_layout/todos/` (not `src/routes/todos/`) for correct TanStack Router layout nesting — file-based routing requires the todos directory to be nested under `_layout/` directory to produce the `/_layout/todos/` route path
- `todos.functions.ts` stays at `src/routes/todos/` (existing Phase 3 location); `index.tsx` imports via `#/routes/todos/todos.functions` alias
- `Alert variant="destructive"` used for both loader error and mutation errors per composition.md ("Callouts use Alert, not custom styled divs")
- Empty state uses a simple custom layout with `CheckSquare` icon + text (no Empty shadcn component installed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved route files to src/routes/_layout/todos/ for correct TanStack Router nesting**
- **Found during:** Task 2 (creating todo route file)
- **Issue:** Plan specified files at `src/routes/todos/index.tsx` but TanStack Router file-based routing auto-transforms the `createFileRoute` path to match the actual file location. A file at `src/routes/todos/index.tsx` generates `"/todos/"` (not nested under layout), while `"/_layout/todos/"` requires the file to be at `src/routes/_layout/todos/index.tsx`.
- **Fix:** Created files at `src/routes/_layout/todos/` instead of `src/routes/todos/`. Updated `todos.functions.ts` import from `./todos.functions` to `#/routes/todos/todos.functions` alias.
- **Files modified:** Files created at `src/routes/_layout/todos/` (index.tsx, TodoRow.tsx, AddTodoRow.tsx)
- **Verification:** routeTree.gen.ts shows `LayoutTodosIndexRoute` with `getParentRoute: () => LayoutRoute`. All tests pass (23/23).
- **Committed in:** `1327a6f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for correct route nesting under the layout shell. No functional scope change — all planned behavior delivered.

## Issues Encountered
- `routeTree.gen.ts` has a persistent oxfmt format warning (pre-existing issue; the TanStack Router auto-generator produces code that oxfmt flags). This is out-of-scope (pre-existing in unrelated auto-generated file).

## Known Stubs
- `src/routes/_layout/todos/TodoRow.tsx` — renders only `todo.name` in a plain div. Full implementation (priority badge, status checkbox, due date, edit/delete controls) is Wave 2 work (Plan 04-02).
- `src/routes/_layout/todos/AddTodoRow.tsx` — renders only a static "+ Add a todo..." placeholder text. Full implementation (inline form with name/priority/date inputs) is Wave 2 work (Plan 04-02).

These stubs are intentional — Wave 1 establishes the data flow; Wave 2 implements the full component UI.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- /todos route navigates correctly and is nested under the layout shell (sidebar visible)
- Loading skeleton, empty state, and error state all wired
- Mutation handlers (create/update/delete) with optimistic updates ready to receive UI from Wave 2
- Popover and Alert components installed and ready for use in TodoRow/AddTodoRow implementations
- amber-400 token available for medium priority badge in Wave 2

---
*Phase: 04-todo-tool*
*Completed: 2026-03-30*

## Self-Check: PASSED

- FOUND: src/routes/_layout/todos/index.tsx
- FOUND: src/routes/_layout/todos/TodoRow.tsx
- FOUND: src/routes/_layout/todos/AddTodoRow.tsx
- FOUND: src/components/ui/popover.tsx
- FOUND: src/components/ui/alert.tsx
- FOUND: .planning/phases/04-todo-tool/04-01-SUMMARY.md
- FOUND: commit 6b4f3c1
- FOUND: commit 1327a6f
