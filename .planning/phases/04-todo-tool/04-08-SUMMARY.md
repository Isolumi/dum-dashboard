---
phase: 04-todo-tool
plan: 08
subsystem: testing
tags: [vitest, react-testing-library, jsdom, calendar-popover, base-ui]

# Dependency graph
requires:
  - phase: 04-todo-tool plan 07
    provides: Calendar popover Button replacing Input[type=date] in AddTodoRow

provides:
  - All 30 component + unit tests passing (0 failures) after plan 07 UI changes
  - Tests verify Calendar popover Button interface via aria-label "Select due date"
  - bun run test exits 0, closing the Phase 04 verification gap

affects: [04-todo-tool]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Query Calendar popover trigger by role button + aria-label rather than input[type=date]"
    - "Assert shrink-0 class on PopoverTrigger Button child via dateTrigger.className"

key-files:
  created: []
  modified:
    - src/routes/_layout/todos/-AddTodoRow.test.tsx

key-decisions:
  - "Use getByRole('button', { name: /select due date/i }) to query Calendar trigger — matches aria-label set on PopoverTrigger's render-prop Button"

patterns-established:
  - "PopoverTrigger render-prop Button: query by role=button + aria-label, not by container class"

requirements-completed: [TODO-01, TODO-06]

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 4 Plan 08: Gap Closure — AddTodoRow Date Field Tests Summary

**Replaced 2 stale input[type="date"] tests with Calendar popover Button assertions, restoring bun run test to 30/30 pass**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-02T06:31:22Z
- **Completed:** 2026-04-02T06:34:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced both stale tests that queried `input[type="date"]` (removed in plan 07) with tests verifying the Calendar popover Button interface
- Test 1 now queries `screen.getByRole("button", { name: /select due date/i })` and checks "Date" placeholder text
- Test 2 asserts `dateTrigger.className` contains `"shrink-0"` matching the Button's className in the component
- All 30 tests pass (24 unit + 6 component), 0 failures, lint clean (0 warnings, 0 errors)

## Task Commits

1. **Task 1: Update 2 stale date-field tests to verify Calendar popover Button** - `c9185af` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/routes/_layout/todos/-AddTodoRow.test.tsx` - Replaced 2 stale date-input tests with Calendar popover Button assertions

## Decisions Made

None - followed plan as specified. The exact test code was provided in the plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - the test queries aligned precisely with the component's aria-label and className.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 04 verification gap "bun run test exits 0 with all tests passing" is now closed
- All 30 tests pass; no blockers for Phase 04 UAT or future plans

---
*Phase: 04-todo-tool*
*Completed: 2026-04-02*

## Self-Check: PASSED

- FOUND: `src/routes/_layout/todos/-AddTodoRow.test.tsx`
- FOUND: `.planning/phases/04-todo-tool/04-08-SUMMARY.md`
- FOUND: commit `c9185af` (task fix)
- FOUND: commit `e961e8a` (docs metadata)
