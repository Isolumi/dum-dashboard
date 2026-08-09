# Task 3 report: shared board structure, stable inline add row, and Overview card styling

Date: 2026-08-09
Base commit: `53ebbe8`
Recorded task commit hash: `3951caa`

Note: this report file lives inside the same commit lineage it describes, so the exact final HEAD hash is returned in the task handoff after the report backfill amend.

## Scope implemented

- Moved TodoBoard to a shared single inline `AddTodoRow` placed after both priority sections in compact and full variants.
- Removed section-owned add controls from `PrioritySection`.
- Rebuilt `AddTodoRow` to use:
  - `Input` with `aria-label="New todo name"`
  - native `input[type="checkbox"][role="switch"]` with `aria-label="High priority"`
  - shared `TodoDueDatePicker` with `label="Choose date and time"`
  - inline `Add` submit button
- Kept the expanded add form in the same row location as the collapsed row, focused the name input on open, submitted on Enter, and cancelled on Escape.
- Changed the Overview card so only the `Todos` heading links to `/todos`; removed `Open full page`.
- Preserved independent row controls and updated the compact row priority control to a neutral icon-only treatment for the Overview board while keeping existing actions and accessible labels intact.

## RED commands and results

### 1) Board/card structure RED

Command:

```bash
bunx vitest run src/routes/_layout/todos/-TodoBoard.test.tsx src/routes/_layout/todos/-TodoBentoCard.test.tsx
```

Observed RED:

- `TodoBoard` still rendered two add rows instead of one.
- Opening the add control failed because multiple `Add a new todo` controls existed.
- `TodoBentoCard` still used `Open full page` instead of linking the `Todos` heading.

### 2) Full focused UI RED

Command:

```bash
bunx vitest run src/routes/_layout/todos/-AddTodoRow.test.tsx src/routes/_layout/todos/-PrioritySection.test.tsx src/routes/_layout/todos/-TodoBoard.test.tsx src/routes/_layout/todos/-TodoBentoCard.test.tsx
```

Observed RED:

- Board tests still failed on duplicate add rows.
- Add row tests failed because the form still used the old priority popover and old date trigger.
- Section tests failed because `PrioritySection` still rendered its own add row.
- Card tests failed until the heading-link behavior and low-priority default expectation were updated.

### 3) Targeted compact-priority RED

Command:

```bash
bunx vitest run src/routes/_layout/todos/-TodoRow.test.tsx
```

Observed RED:

- Compact row priority control still rendered visible `High` text instead of an icon-only compact control.

## GREEN commands and results

### Focused Task 3 suite

Command:

```bash
bunx vitest run src/routes/_layout/todos/-AddTodoRow.test.tsx src/routes/_layout/todos/-PrioritySection.test.tsx src/routes/_layout/todos/-TodoBoard.test.tsx src/routes/_layout/todos/-TodoBentoCard.test.tsx
```

Result:

- 4 test files passed
- 29 tests passed
- 0 failures

### Compact row verification

Command:

```bash
bunx vitest run src/routes/_layout/todos/-TodoRow.test.tsx
```

Result:

- 1 test file passed
- 14 tests passed
- 0 failures

### Diff hygiene

Command:

```bash
git diff --check
```

Result:

- No whitespace or patch-format errors

## Files changed

- `src/routes/_layout/todos/-TodoBentoCard.tsx`
- `src/routes/_layout/todos/-TodoBoard.tsx`
- `src/routes/_layout/todos/-PrioritySection.tsx`
- `src/routes/_layout/todos/-AddTodoRow.tsx`
- `src/routes/_layout/todos/-TodoRow.tsx`
- `src/routes/_layout/todos/-AddTodoRow.test.tsx`
- `src/routes/_layout/todos/-TodoBoard.test.tsx`
- `src/routes/_layout/todos/-PrioritySection.test.tsx`
- `src/routes/_layout/todos/-TodoBentoCard.test.tsx`
- `src/routes/_layout/todos/-TodoRow.test.tsx`

## UI behavior summary

- Both board variants now render `High`, `Low`, then exactly one inline add row below them.
- Expanding the add row replaces the collapsed row in place instead of adding a second control elsewhere.
- The add form opens focused on the todo name field.
- Enter submits the add form.
- Escape restores the single collapsed add row.
- The High/Low choice now uses a native switch and submits `low` when off and `high` when on.
- The add form reuses the shared due date picker and passes through ISO timestamp values or `null`.
- The Overview card heading is the only `/todos` link, so todo-row actions remain independently clickable.
- Compact priority controls now stay neutral and icon-only while preserving their accessible action labels.

## Test output summary

Final focused suite output:

```text
✓ |components| src/routes/_layout/todos/-TodoBoard.test.tsx (8 tests)
✓ |components| src/routes/_layout/todos/-AddTodoRow.test.tsx (12 tests)
✓ |components| src/routes/_layout/todos/-TodoBentoCard.test.tsx (8 tests)
✓ |components| src/routes/_layout/todos/-PrioritySection.test.tsx (1 test)

Test Files  4 passed (4)
Tests  29 passed (29)
```

Additional compact-row verification:

```text
✓ |components| src/routes/_layout/todos/-TodoRow.test.tsx (14 tests)

Test Files  1 passed (1)
Tests  14 passed (14)
```
