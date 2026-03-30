---
phase: 04-todo-tool
plan: 02
subsystem: todo-row-component
tags: [ui, component, inline-editing, base-ui, popover, lucide]
dependency_graph:
  requires: [04-01]
  provides: [TodoRow component with full interactivity]
  affects: [src/routes/_layout/todos/index.tsx]
tech_stack:
  added: []
  patterns:
    - base-ui render prop pattern for PopoverTrigger (not asChild)
    - per-field inline editing state (not single isEditing flag)
    - group/group-hover for hover-revealed delete button
    - semantic Tailwind tokens only (hover:bg-accent, text-destructive, text-muted-foreground)
key_files:
  created: []
  modified:
    - src/routes/_layout/todos/TodoRow.tsx
decisions:
  - Plan says src/routes/todos/TodoRow.tsx but actual location is src/routes/_layout/todos/TodoRow.tsx per Phase 04 Plan 01 decision (TanStack Router layout nesting)
  - Used render prop on PopoverTrigger with native button element (base-ui pattern)
  - No data-icon on icons in icon-only Buttons (data-icon only for inline icons with text)
  - nameInputRef declared but only used as type-safe ref; autoFocus handles focus behavior
  - routeTree.gen.ts has pre-existing oxfmt formatting issue (auto-generated file); deferred
metrics:
  duration: 129s
  completed: "2026-03-30"
  tasks_completed: 1
  files_changed: 2
---

# Phase 04 Plan 02: Full TodoRow Component Summary

Replaced the stub TodoRow with a fully interactive row component providing per-field inline editing (name, priority, status, due date), hover-revealed delete, and completed-todo de-emphasis.

## What Was Built

**`src/routes/_layout/todos/TodoRow.tsx`** — Full interactive TodoRow component:

- Status icon cycling: Circle (not_started) / CircleDot (started) / CircleCheck (complete) via icon-only Button
- Per-field inline name editing: click span to enter Input, Enter/blur saves, Escape reverts
- Priority badge with popover dropdown: base-ui `render` prop pattern; three options (High/Medium/Low) auto-save on select
- Due date inline editing: click to show date Input, blur/Enter saves, Escape cancels
- Overdue detection: `due_date < today && status !== complete` shows `text-destructive`
- Hover-revealed delete: `opacity-0 group-hover:opacity-100` transition on trash icon Button
- Completed state: `opacity-60` on row container, `line-through text-muted-foreground` on name span
- All colors via semantic Tailwind tokens; zero hardcoded color values; zero raw palette classes

## Acceptance Criteria Verification

- [x] `export function TodoRow` and `TodoRowProps` interface present
- [x] `STATUS_CYCLE` record maps each status to its next value
- [x] Status icons: Circle, CircleDot, CircleCheck — no sizing classes, no data-icon
- [x] `isEditingName`, `isPriorityOpen`, `isEditingDate` as separate per-field state
- [x] Name Input uses `h-auto border-0 shadow-none p-0` (Pitfall 6 mitigation)
- [x] Name edit handles Enter (save), Escape (revert), blur (save with relatedTarget check)
- [x] PopoverTrigger uses `render` prop — not `asChild` (base-ui pattern)
- [x] Priority colors: `bg-destructive/20 text-destructive`, `bg-amber-400/20 text-amber-400`, `text-muted-foreground`
- [x] Priority options use `hover:bg-accent` (not raw palette)
- [x] Row hover uses `hover:bg-accent` (not raw palette)
- [x] Delete button: `opacity-0 group-hover:opacity-100` with aria-label
- [x] Trash2 icon: no data-icon, no sizing classes
- [x] Completed rows: `opacity-60` + `line-through text-muted-foreground`
- [x] Overdue: `text-destructive`
- [x] Zero hardcoded colors (oklch, hsl, rgb, hex)
- [x] Zero raw palette classes (neutral-*, gray-*, slate-*, zinc-*)
- [x] No `asChild` anywhere in file
- [x] `bun run test` passes (23/23 tests)
- [x] `bun run lint` passes (0 warnings, 0 errors)
- [x] `bun run fmt` applied — file is properly formatted

## Commits

| Hash | Description |
|------|-------------|
| a8f6208 | feat(04-02): implement full TodoRow component with inline editing |

## Deviations from Plan

### Path Deviation (Not a Bug)

**Plan specifies `src/routes/todos/TodoRow.tsx` — actual path is `src/routes/_layout/todos/TodoRow.tsx`**

- Reason: Phase 04 Plan 01 established that todos files live in `_layout/todos/` for correct TanStack Router layout nesting (logged in STATE.md)
- Resolution: Edited the correct file at `src/routes/_layout/todos/TodoRow.tsx`

### Pre-existing Format Issue

**`src/routeTree.gen.ts` fails `oxfmt --check`**

- This is an auto-generated file that was pre-existing before this plan
- Out of scope — not caused by this plan's changes
- Logged to deferred-items

### README.md Formatted

The `oxfmt` run also fixed pre-existing formatting in `README.md` — included in commit as a housekeeping improvement.

## Known Stubs

None — all interactions are wired to onUpdate/onDelete callbacks.

## Self-Check

### Created files
- src/routes/_layout/todos/TodoRow.tsx — FOUND

### Commits
- a8f6208 — FOUND

## Self-Check: PASSED
