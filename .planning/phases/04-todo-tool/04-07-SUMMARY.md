---
phase: 04-todo-tool
plan: 07
subsystem: ui
tags: [react, focus-management, keyboard-navigation, refs, useEffect]

# Dependency graph
requires:
  - phase: 04-todo-tool
    provides: AddTodoRow component with collapsed/expanded states and priority/date popovers
provides:
  - AddTodoRow with correct focus management: type-to-expand on collapsed row, full Tab cycle (name -> priority -> date -> name), Shift+Tab reversal
affects: [04-todo-tool]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "collapsedRowRef pattern: attach ref to collapsed div + useEffect([isExpanded]) to auto-focus when !isExpanded"
    - "dateTriggerRef pattern: explicit ref on PopoverTrigger Button child for manual Tab targeting"
    - "Closed Tab cycle: each node in cycle handles Tab/Shift+Tab with e.preventDefault() + explicit .focus() call"

key-files:
  created: []
  modified:
    - src/routes/_layout/todos/-AddTodoRow.tsx

key-decisions:
  - "useEffect([isExpanded]) with !isExpanded guard handles both initial mount focus and post-resetForm focus in one effect"
  - "Explicit dateTriggerRef required because PopoverTrigger render-prop pattern (base-ui) doesn't participate in natural Tab order without ref"

patterns-established:
  - "Closed keyboard Tab cycle: each focusable node explicitly handles Tab/Shift+Tab with preventDefault + peer ref.focus()"

requirements-completed: [TODO-01]

# Metrics
duration: 1min
completed: 2026-04-02
---

# Phase 4 Plan 7: AddTodoRow Focus Management Summary

**Collapsed-row type-to-expand and priority-to-date Tab key now work via collapsedRowRef/dateTriggerRef with closed useEffect-driven focus cycle**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-02T06:07:44Z
- **Completed:** 2026-04-02T06:08:46Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Collapsed AddTodoRow div receives focus on mount and after cancel/submit (via `useEffect([isExpanded])`) — typing a character now immediately expands the row and seeds the name input
- Tab from priority badge now moves focus to the date picker trigger button (via `dateTriggerRef.current?.focus()`)
- Tab from date picker trigger wraps back to the name input, completing the cycle: name -> priority -> date -> name
- Shift+Tab from date picker goes back to priority; Shift+Tab from priority goes back to name (pre-existing)
- Zero regressions: no styling or behavior changes outside focus management

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix focus management for collapsed-row typing and Tab cycle** - `2539bff` (fix)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/routes/_layout/todos/-AddTodoRow.tsx` - Added `collapsedRowRef`, `dateTriggerRef`, `useEffect([isExpanded])` for auto-focus, wired Tab handlers in priority button and date picker button

## Decisions Made

- `useEffect([isExpanded])` with a `!isExpanded` guard is the correct pattern here — it runs on mount (where `isExpanded` is already `false`) and again any time `resetForm()` collapses the row. Single-effect, no duplication.
- The date picker `<Button>` inside `PopoverTrigger render={...}` needed an explicit `ref` because the base-ui render-prop pattern does not participate in the natural DOM Tab order the same way a standard `asChild` would — explicit `.focus()` call is the safe approach given the existing codebase pattern (same as priority button).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UAT tests 7 (type-to-expand) and 11 (Tab priority -> date) should now pass on re-test
- All 20 UAT acceptance criteria for Phase 04 should be satisfied
- Phase 04 todo-tool is ready for phase transition

---
*Phase: 04-todo-tool*
*Completed: 2026-04-02*
