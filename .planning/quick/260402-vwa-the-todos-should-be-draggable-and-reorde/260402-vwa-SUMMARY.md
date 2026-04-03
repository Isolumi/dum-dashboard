---
phase: quick
plan: 260402-vwa
subsystem: todos
tags: [drag-and-drop, sort, ui, dnd-kit, supabase]
dependency_graph:
  requires: []
  provides: [draggable-todo-sections, sort-order-persistence]
  affects: [todos-page, todos-functions, database-types]
tech_stack:
  added: ["@dnd-kit/core@6.3.1", "@dnd-kit/sortable@10.0.0"]
  patterns: [SortableContext, useSortable, optimistic-reorder]
key_files:
  created:
    - src/routes/_layout/todos/-PrioritySection.tsx
  modified:
    - src/lib/database.types.ts
    - src/routes/todos/todos.functions.ts
    - src/routes/_layout/todos/index.tsx
    - src/routes/_layout/todos/-TodoRow.tsx
    - src/routes/_layout/todos/-AddTodoRow.tsx
decisions:
  - "@dnd-kit/sortable useSortable with SyntheticListenerMap inline type — avoids internal path import while keeping type safety"
  - "sort_order ordered ascending; grouping happens client-side in useMemo — no multi-column DB ordering needed"
  - "SortableTodoRow wrapper co-located in -PrioritySection.tsx — keeps dnd-kit concerns contained to one file"
  - "defaultPriority resets in resetForm callback — so after submit the priority snaps back to the section's default"
metrics:
  duration: "~10 min"
  completed: "2026-04-02"
  tasks: 2
  files: 6
---

# Phase quick Plan 260402-vwa: Draggable Priority-Grouped Todos Summary

Drag-and-drop reorderable todo list grouped into three priority sections (High, Medium, Low) using @dnd-kit/sortable with sort_order persisted to Supabase.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Add sort_order column + reorderTodos server function + install dnd-kit | adc5f2f | Done |
| 2 | Create PrioritySection component and refactor TodosPage for grouped drag-and-drop | 88ae608 | Done |
| 3 (checkpoint) | Human verification of drag-and-drop UX | — | Approved |
| 4 | Fix SSR hydration mismatch (useId on DndContext) + remove priority badge | HEAD | Done |

## What Was Built

### Database Layer (Task 1)

- Added `sort_order: number` to `database.types.ts` (Row, Insert, Update types for todos table)
- Updated `getTodos` to order by `sort_order ASC` instead of `created_at DESC`
- Updated `createTodo` to assign `max(sort_order) + 1` within the same priority group so new todos appear at the bottom
- Added `ReorderTodosSchema` and `reorderTodos` server function for batch sort_order updates
- Added optional `sort_order` field to `UpdateTodoSchema`
- Installed `@dnd-kit/core@6.3.1` and `@dnd-kit/sortable@10.0.0`

### UI Layer (Task 2)

- **`-PrioritySection.tsx`** (new): Renders a priority group with section header, count badge, `DndContext` + `SortableContext`, and its own `AddTodoRow`. Contains a `SortableTodoRow` wrapper using `useSortable`.
- **`-TodoRow.tsx`**: Added optional `dragListeners` prop and `GripVertical` drag handle (visible on hover via `opacity-0 group-hover:opacity-100`).
- **`-AddTodoRow.tsx`**: Added `defaultPriority` prop (defaults to "low"); resets to `defaultPriority` after submit.
- **`index.tsx`**: Replaced flat todo list with three `PrioritySection` components. Added `handleReorder` with optimistic state update and persist via `reorderTodos` (reverts on failure).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used inline SyntheticListenerMap type instead of internal import path**
- **Found during:** Task 2
- **Issue:** `@dnd-kit/core/dist/hooks/utilities` is an internal path — stable but fragile across package versions
- **Fix:** Replaced with inline `type SyntheticListenerMap = Record<string, (event: Event) => void>` which is functionally equivalent
- **Files modified:** `src/routes/_layout/todos/-TodoRow.tsx`

## Known Stubs

None — the sort_order column must be added to the Supabase database before the ordering will persist. The `reorderTodos` server function and `getTodos` sort order are wired up correctly, but the `sort_order integer NOT NULL DEFAULT 0` column must be added via:

```sql
ALTER TABLE todos ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
```

This is a **required database migration** for the feature to function. Without it, the build succeeds but runtime will error on sort_order reads. The migration is intentionally left as a manual step since no migration system exists in this project.

## Checkpoint: Human Verification Required

The implementation is complete and builds successfully. The following verification steps are needed:

1. Run `bun run dev` and navigate to the Todos page
2. Verify todos are grouped into three sections: High, Medium, Low (each with a section header)
3. Hover over a todo row — a drag handle (grip icon) should appear on the left
4. Drag a todo within its priority section to reorder it
5. Refresh the page — the new order should persist (requires `sort_order` column in DB)
6. Click "Add a todo" within the High section — the default priority should be "High"
7. Create a new todo in the Low section — it should appear at the bottom of the Low group
8. Verify existing functionality still works: status toggle, name editing, priority change, date picker, delete

## Self-Check: PASSED

- All 6 files exist at expected paths
- Both task commits (`adc5f2f`, `88ae608`) present in git history
- `bun run build` succeeds with no errors (confirmed twice)
