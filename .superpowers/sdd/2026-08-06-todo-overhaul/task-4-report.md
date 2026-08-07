# Task 4 — Shared Todo board report

## RED

Added `src/routes/_layout/todos/-TodoBoard.test.tsx` before creating the board.
The test covers the visible product contract that would break if the board omitted a priority,
lost the inline add affordances, used an unbounded compact layout, disconnected retry, or rendered
errors outside the board boundary:

- Both `compact` and `full` render empty High and Low sections with two add rows.
- Compact mode has a bounded, internally scrollable region; full mode does not.
- A failed initial load exposes Retry and invokes `controller.retry`.
- Mutation failures remain inside both compact and full boards.

Command:

```text
bunx vitest run src/routes/_layout/todos/-TodoBoard.test.tsx
```

Observed expected RED failure:

```text
Error: Failed to resolve import "./-TodoBoard" from
"src/routes/_layout/todos/-TodoBoard.test.tsx". Does the file exist?
```

## GREEN implementation

- Added `-TodoBoard.tsx`, which owns loading skeletons, retryable initial-load errors, mutation
  errors, and the shared High/Low `PrioritySection` mapping.
- Added an accessible `Todo board` region. Compact mode applies `max-h-[32rem] overflow-y-auto`;
  full mode remains unbounded.
- Refactored the full `/todos` page to retain its existing heading and max-width shell while
  rendering `<TodoBoard controller={controller} variant="full" />`.

## Verification

Passed:

```text
bunx vitest run src/routes/_layout/todos/-TodoBoard.test.tsx
6 tests passed

bunx vitest run src/routes/_layout/todos
7 files passed, 60 tests passed

bunx oxfmt --check src/routes/_layout/todos/-TodoBoard.tsx \
  src/routes/_layout/todos/-TodoBoard.test.tsx src/routes/_layout/todos/index.tsx
all matched files correctly formatted

bunx tsc --noEmit
passed

bun run lint
0 warnings, 0 errors

bun run build
passed

git diff --check
passed
```

`bun run test` was also run. It completed with 559 passing tests and one unrelated timeout:

```text
src/routes/_layout/homelab/-LiveLogPanel.test.tsx
LiveLogPanel > keeps at most 2,000 rendered lines
Test timed out in 20000ms.
```

No Task 4 Todo tests failed. The production build emitted only pre-existing dependency/CSS optimizer
warnings and completed successfully.

## Scope and concerns

- Changed only Task 4 source/tests and this report.
- No temp artifacts were created or retained.
- No publishing, migration, deployment, or unrelated test changes were made.
