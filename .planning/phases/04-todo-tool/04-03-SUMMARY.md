---
phase: 04-todo-tool
plan: "03"
subsystem: todo-ui
tags: [react, ui, component, keyboard, popover, base-ui]
dependency_graph:
  requires: ["04-01"]
  provides: ["AddTodoRow"]
  affects: ["src/routes/_layout/todos/index.tsx"]
tech_stack:
  added: []
  patterns:
    - "base-ui PopoverTrigger render prop (not asChild)"
    - "useRef for manual Tab focus management"
    - "useCallback for stable event handlers"
    - "Semantic token hover:bg-accent (not raw neutral-800)"
key_files:
  created: []
  modified:
    - src/routes/_layout/todos/AddTodoRow.tsx
decisions:
  - "Collapsed state uses hover:bg-accent (semantic token) per FOUN-02 — UI-SPEC listed hover:bg-neutral-800 but CLAUDE.md prohibits raw palette classes in components"
  - "PopoverTrigger uses render prop — base-ui pattern confirmed; asChild is Radix-only"
  - "Tab order: name -> priority -> date -> name (wraps) via manual ref.focus() calls"
  - "Type-to-expand seeds name state with the typed character before setIsExpanded(true)"
metrics:
  duration: "~5min"
  completed_date: "2026-03-30"
  tasks_completed: 1
  files_changed: 1
---

# Phase 04 Plan 03: AddTodoRow Full Implementation Summary

**One-liner:** Full AddTodoRow with collapsed/expanded states, type-to-expand, Enter/Escape/Tab keyboard shortcuts, and priority Popover using base-ui render prop pattern.

## What Was Built

Replaced the stub `src/routes/_layout/todos/AddTodoRow.tsx` (3 lines) with a complete implementation (179 lines) that provides:

- **Collapsed state** — persistent "+ Add a todo..." placeholder row with `hover:bg-accent`, `tabIndex=0`, `role="button"`, and `aria-label`
- **Expanded state** — name Input (autoFocus), priority Popover, and date input with full Tab wrapping
- **Click to expand** — onClick sets `isExpanded(true)`, autoFocus on name Input handles focus
- **Type to expand** — onKeyDown on collapsed row detects printable characters, seeds `name` state, and expands immediately
- **Enter to submit** — guards against empty name (`.trim().length === 0`), calls `onCreate`, then `resetForm()`
- **Escape to cancel** — resets all fields and collapses to placeholder
- **Tab wrapping (D-12)** — name -> priority -> date -> name; Shift+Tab reverses; all via `e.preventDefault()` + `ref.current?.focus()`
- **Priority Popover** — `PopoverTrigger` with `render` prop (base-ui pattern); options styled with semantic tokens; Escape closes popover or resets form
- **Zero style violations** — no hardcoded colors, no raw palette classes, no `dark:` prefixes

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| Exports `AddTodoRow` and `AddTodoRowProps` | PASS |
| `isExpanded` boolean state | PASS |
| Collapsed: Plus + italic "Add a todo..." | PASS |
| Collapsed: hover:bg-accent | PASS |
| Collapsed: type-to-expand handler | PASS |
| Collapsed: onClick expands | PASS |
| Expanded: Input + priority Popover + date input | PASS |
| Name Input has autoFocus | PASS |
| Name Input: Enter, Escape, Tab handlers | PASS |
| PopoverTrigger uses render prop (not asChild) | PASS |
| Priority options: High/Medium/Low with correct colors | PASS |
| Priority options: hover:bg-accent | PASS |
| Date input: Tab wraps back to name | PASS |
| handleSubmit guards empty name | PASS |
| resetForm clears all and collapses | PASS |
| Default priority "medium" | PASS |
| Refs for manual Tab focus | PASS |
| Zero hardcoded colors | PASS |
| Zero raw palette classes | PASS |
| No asChild usage | PASS |
| bun run test passes | PASS |
| bun run lint passes | PASS |
| bun run fmt:check passes (file) | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Semantic Token] hover:bg-accent used instead of hover:bg-neutral-800**

- **Found during:** Task 1 implementation
- **Issue:** UI-SPEC §AddTodoRow says "hover:bg-neutral-800" for the collapsed row hover background, but CLAUDE.md and FOUN-02 explicitly prohibit raw Tailwind palette classes in component files
- **Fix:** Used `hover:bg-accent` (semantic token) which maps to the same visual token through the theme
- **Files modified:** src/routes/_layout/todos/AddTodoRow.tsx
- **Commit:** 3f8dd7b

**Note:** The plan itself already calls this out in the action spec ("NOT `hover:bg-neutral-800` -- FOUN-02"), so this was following the plan's own guidance — not a deviation from the plan spec, but from the UI-SPEC literal text.

**2. [Rule 1 - Pre-existing] routeTree.gen.ts oxfmt format issue**

- **Out of scope** — this file had a pre-existing format issue before plan 04-03. Confirmed by reverting AddTodoRow.tsx and re-running fmt:check: same issue remains. Not caused by this plan's changes.
- **Action:** Logged as out-of-scope discovery; not fixed

## Known Stubs

None — the component is fully wired. The priority selector is functional, the date input is functional, and the `onCreate` callback is properly called on submit.

## Self-Check: PASSED

- `src/routes/_layout/todos/AddTodoRow.tsx` — FOUND
- Commit `3f8dd7b` — FOUND in git log
