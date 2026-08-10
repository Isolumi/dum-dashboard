# Task 1 Report: Board-level drag and cross-priority persistence

## Status

DONE_WITH_CONCERNS

Commit: `57266206a4e31d2d63ca6dc6a622d6203e1b5fe5` (`feat: drag Todos between priorities`)

## Implementation

- Added one board-level `DndContext` in `TodoBoard` with pointer and keyboard sensors.
- Added board drag-end routing. A same-priority drop calls `reorder`. A cross-priority drop calls `move` with the target index.
- Removed the section-level `DndContext` from `PrioritySection`.
- Registered each section as `priority-high` or `priority-low` with `useDroppable`.
- Kept one `SortableContext` in each section and added the Todo priority to sortable metadata.
- Added `TodoController.move(id, targetPriority, targetIndex)`.
- The move operation normalizes source and target sort orders and updates local state at once.
- Persistence calls `updateTodo` for the moved priority and sort order. It also calls `reorderTodos` for all affected Todo IDs.
- A persistence failure restores the captured Todo array and shows `REORDER_ERROR`.

## TDD evidence

The worktree had unstaged edits in the three Task 1 test files before production code changed. These edits matched the tests required by the brief. I preserved them and used them for the RED run.

### RED

Command:

```bash
bun run test -- src/routes/_layout/todos/-TodoBoard.test.tsx src/routes/_layout/todos/-PrioritySection.test.tsx src/routes/_layout/todos/-useTodoController.test.tsx
```

Result: exit code 1.

```text
Test Files  3 failed (3)
Tests       3 failed | 31 passed (34)
Duration    20.49s
```

Expected failures:

```text
PrioritySection > registers the priority container as a drop target
expected "spy" to be called with arguments: [ { id: 'priority-high' } ]
Number of calls: 0

TodoBoard > moves a High todo into the Low section when the board drag ends over a Low todo
expected "spy" to be called with arguments: [ 'high-todo', 'low', +0 ]
Number of calls: 0

useTodoController > moves optimistically across priorities and restores both lists when persistence fails
TypeError: result.current.move is not a function
```

These failures show that the priority drop target, board-level cross-priority routing, and controller move operation did not exist.

### GREEN

Command:

```bash
bun run test -- src/routes/_layout/todos/-TodoBoard.test.tsx src/routes/_layout/todos/-PrioritySection.test.tsx src/routes/_layout/todos/-useTodoController.test.tsx
```

Result: exit code 0.

```text
Test Files  3 passed (3)
Tests       34 passed (34)
Duration    4.02s
```

## Full test suite

Command, run one time as required:

```bash
bun run test
```

Result: exit code 1.

```text
Test Files  1 failed | 44 passed (45)
Tests       8 failed | 602 passed (610)
Duration    14.79s
```

All eight failures are in `src/routes/_layout/todos/-TodoBentoCard.test.tsx`. That file fully mocks `@dnd-kit/core` but does not export `useDroppable`:

```text
Error: [vitest] No "useDroppable" export is defined on the "@dnd-kit/core" mock.
```

The focused Task 1 tests passed during the same implementation state. The full suite also passed all other 602 tests. I did not edit `-TodoBentoCard.test.tsx` because it is outside the six files allowed by the Task 1 brief. I did not run the full suite again because the request said to run it once.

## Changed files

- `src/routes/_layout/todos/-TodoBoard.tsx`
- `src/routes/_layout/todos/-PrioritySection.tsx`
- `src/routes/_layout/todos/-useTodoController.ts`
- `src/routes/_layout/todos/-TodoBoard.test.tsx`
- `src/routes/_layout/todos/-PrioritySection.test.tsx`
- `src/routes/_layout/todos/-useTodoController.test.tsx`

The required report is not part of the Task 1 source commit.

## Self-review

- Scope: The commit contains only the six files in the brief.
- TDD: Production code changed only after the expected focused RED run.
- Board behavior: The handler rejects missing drops, unknown Todo IDs, unknown priority IDs, and no-op drops.
- Same-priority behavior: The existing `reorder(priority, orderedIds)` contract remains in use.
- Cross-priority behavior: The target index comes from the destination Todo or the end of a priority container.
- Persistence: Both priority and sort order are sent for the moved Todo. All source and target IDs receive normalized sort orders.
- Rollback: A failed persistence request restores both priority lists and sets the reorder error.
- Test protection: The tests catch a missing board branch, a wrong target index, a missing priority drop target, a missing optimistic move, and a missing rollback.
- Hygiene: `git diff --check` passed before commit.

## Concerns

1. The full suite is not green because an out-of-scope test mock does not include `useDroppable`. A follow-up must add that export to the `@dnd-kit/core` mock in `src/routes/_layout/todos/-TodoBentoCard.test.tsx`.
2. The worktree contained Task 1 test edits at the start, although the request said that the prior agent made no changes. The edits were in scope and matched the brief, so I preserved them.

## Fix round 1

### Status

DONE_WITH_CONCERNS

### Stall investigation

No test deadlock remained in the inherited uncommitted changes. The first cold rerun yielded its PTY before Vitest finished collection, then completed successfully after polling: 3 files and 37 tests passed in 48.62s, with 91.70s aggregate collection time. The final warm run completed in 10.26s. The prior run most likely stopped after the yielded command was not polled to completion.

### Persistence and concurrency fixes

- Persist order before priority so an order failure cannot leave the moved Todo in its target priority.
- If either write fails, compensate with the moved Todo's original priority and all affected Todos' original sort orders.
- Keep every source and target Todo pending for the full move, including compensation.
- Reject overlapping update, delete, reorder, and move operations that touch an affected Todo.
- Roll back only the affected Todos' priority and sort order so unrelated concurrent state remains intact.

### Focused verification

RED evidence: the inherited regression tests were absent from committed `HEAD`. The committed controller persisted priority and order in parallel, marked no affected Todo pending, and restored the full captured Todo array. Those code paths violate all three new regression expectations. I preserved the prior agent's uncommitted RED tests and fix instead of reversing correct work only to rerun RED.

Command:

```bash
bun run test -- src/routes/_layout/todos/-TodoBoard.test.tsx src/routes/_layout/todos/-PrioritySection.test.tsx src/routes/_layout/todos/-useTodoController.test.tsx
```

Exact result: exit code 0; 3 test files passed; 37 tests passed; duration 10.26s.

GREEN evidence: the controller reran the same focused command and confirmed exit code 0, 3 files passed, and 37/37 tests passed.

Required evidence:

- Partial priority-write failure calls compensation with the original priority and original source and target sort orders.
- All affected Todos remain pending after order persistence and while priority persistence is still in flight; overlapping affected operations add no server calls and cannot change local state.
- A failed move restores affected positions without removing a Todo created concurrently.

### Changed files

- `src/routes/_layout/todos/-useTodoController.ts`
- `src/routes/_layout/todos/-useTodoController.test.tsx`
- `.superpowers/sdd/2026-08-10-todo-drag-polish/task-1-report.md`

No Task 2 file was edited.

### Self-review

- Safe ordering removes the known partial-persistence window, and compensation covers an uncertain server result from either request.
- Pending IDs cover the complete affected set and are cleared only after success or compensation finishes.
- Local rollback merges only prior position fields into current objects, so unrelated Todos and unrelated Todo fields are preserved.
- The focused suite and `git diff --check` pass. The two edited TypeScript files pass the scoped formatter check.

### Concerns

1. Compensation is best effort. If a compensation request also fails, local state is restored but server state can remain inconsistent until a refresh or later write.
2. Per the fix-round instruction, only the focused Task 1 tests were run. The full-suite mock concern recorded above was not rechecked.
