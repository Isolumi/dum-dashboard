---
phase: 04-todo-tool
plan: 06
subsystem: ui
tags: [todo, ui-polish, tdd, styling, ux, component-testing]

# Dependency graph
requires:
  - phase: 04-todo-tool
    plan: 01
    provides: AddTodoRow component initial implementation
  - phase: 04-todo-tool
    plan: 03
    provides: TodoRow reference layout (column structure)
provides:
  - Polished AddTodoRow with column alignment matching TodoRow
  - shadcn Input for date field (not raw browser date picker)
  - Visible backgrounds and keyboard affordance hints
  - React component test infrastructure (jsdom + vitest projects)
affects: [AddTodoRow, todos-page]

# Tech tracking
tech-stack:
  added:
    - vitest projects config (unit + components split)
    - "@testing-library/react component testing with jsdom"
  patterns:
    - "Vitest dual-project config: unit tests use TanStack Start plugin (node), component tests use jsdom"
    - "React component tests: use vi.mock for Popover, afterEach cleanup"
    - "Expanded form wrapper pattern: outer div carries bg + rounded, inner div carries flex layout"

key-files:
  created:
    - src/routes/_layout/todos/-AddTodoRow.test.tsx
    - vitest.config.ts
  modified:
    - src/routes/_layout/todos/AddTodoRow.tsx

key-decisions:
  - "Vitest projects split: unit (.ts) gets tanstackStart() plugin for createServerFn transform; components (.tsx) gets jsdom with no TanStack Start plugin to avoid React hook conflicts"
  - "Keyboard hint placed below the flex row in outer container: cleaner than inside row, better visual separation"
  - "Delete-column spacer added (size-8 shrink-0) to align columns with TodoRow even though AddTodoRow has no delete action"

patterns-established:
  - "Component test file naming: prefix with - to exclude from TanStack Router route tree"
  - "Popover mock in tests: mock #/components/ui/popover module to avoid portal/DOM issues"

requirements-completed: [TODO-02, TODO-03]

# Metrics
duration: ~10min
completed: 2026-03-30
---

# Phase 04 Plan 06: AddTodoRow Polish Summary

**Five targeted styling fixes to AddTodoRow: outer bg-accent/50 container, shadcn Input for date, w-24 column wrapper, invisible low-priority badge fixed, keyboard hint added — all verified by TDD render tests**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-30T10:43:00Z
- **Completed:** 2026-03-30T10:52:00Z
- **Tasks:** 1 (with TDD)
- **Files modified:** 1
- **Files created:** 2

## Accomplishments

- Fixed AddTodoRow expanded state to match TodoRow's column structure visually
- Replaced raw `<input type="date">` with shadcn `Input` component in `w-24 shrink-0` wrapper
- Added `bg-accent/50 rounded-md` outer wrapper to distinguish expanded state
- Fixed low-priority badge: added `bg-muted` so it's visible (was `text-muted-foreground` only, invisible)
- Added delete-column spacer (`size-8 shrink-0`) to align with TodoRow's delete button column
- Added keyboard hint "Enter to save · Esc to cancel" below the form row
- Added 6 TDD render tests covering all five changes
- Added `vitest.config.ts` with two projects (unit/node and components/jsdom) to support both pure-function tests and React component tests

## Task Commits

1. **feat(04-06): fix AddTodoRow column alignment and UX affordances** - `db648ad`

## Files Created/Modified

- `src/routes/_layout/todos/AddTodoRow.tsx` — Expanded state restructured: outer container wrapper, shadcn Input for date, delete spacer, keyboard hint, low-priority badge background
- `src/routes/_layout/todos/-AddTodoRow.test.tsx` — TDD render tests (6 tests, all pass)
- `vitest.config.ts` — Two-project vitest setup: unit tests (TanStack Start plugin, node) and component tests (jsdom)

## Decisions Made

- **Vitest dual-project**: The `tanstackStart()` Vite plugin transforms `createServerFn` calls at module load time, preventing supabase initialization. Component tests use `jsdom` without this plugin to avoid React hook conflicts with TanStack Start's React resolution. Two separate vitest projects solve both needs cleanly.
- **Outer wrapper pattern**: Instead of adding background to the inner `flex items-center` row, use an outer div with `bg-accent/50 rounded-md` that contains both the row and the keyboard hint. This allows the hint to sit visually inside the highlighted region.
- **Delete spacer**: `size-8 shrink-0` div added as the 5th column to match TodoRow's delete button width, ensuring columns align even though AddTodoRow has no delete action.

## Deviations from Plan

None — plan executed exactly as specified. All five sub-issues from UAT gap 4 resolved.

## Self-Check: PASSED

- FOUND: src/routes/_layout/todos/AddTodoRow.tsx
- FOUND: src/routes/_layout/todos/-AddTodoRow.test.tsx
- FOUND: vitest.config.ts
- FOUND: .planning/phases/04-todo-tool/04-06-SUMMARY.md
- FOUND: commit db648ad
