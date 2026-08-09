# Task 2 report: reusable todo due-date helpers, picker, and TodoRow integration

Date: 2026-08-09
Worktree: `/Users/isolumi/Documents/CS/dum-dashboard/.worktrees/homelab-dashboard`
Task: Task 2 only — reusable due-date conversion helpers, date/time picker, and TodoRow integration

## Files changed

- `src/routes/_layout/todos/-todoDueDate.ts`
- `src/routes/_layout/todos/-todoDueDate.test.ts`
- `src/routes/_layout/todos/-TodoDueDatePicker.tsx`
- `src/routes/_layout/todos/-TodoDueDatePicker.test.tsx`
- `src/routes/_layout/todos/-TodoRow.tsx`
- `src/routes/_layout/todos/-TodoRow.test.tsx`
- `.superpowers/sdd/2026-08-09-todo-card-polish/task-2-report.md`

## TDD log

### RED 1 — helper tests

Command:

```bash
node ./node_modules/vitest/vitest.mjs run --reporter=verbose src/routes/_layout/todos/-todoDueDate.test.ts
```

Observed failure reason:

- Vitest failed with `ERR_MODULE_NOT_FOUND` because `src/routes/_layout/todos/-todoDueDate.ts` did not exist yet.

### GREEN 1 — helper implementation

Implemented:

- `formatTodoDueDate(value: string | null)` returning:
  - `""` for `null`
  - local `MMM d` formatting for date-only values like `2026-08-09`
  - local `MMM d, h:mm a` formatting for timestamp values
- `toTodoDueDate(dateValue, timeValue)` building a local browser date/time and serializing with `toISOString()`
- `DEFAULT_TODO_DUE_TIME = "09:00"` for typed/calendar defaults
- `getTodoDueDateInputValues(value)` to normalize existing `string | null` values into native date/time input values

Command:

```bash
node ./node_modules/vitest/vitest.mjs run --reporter=verbose src/routes/_layout/todos/-todoDueDate.test.ts
```

Observed output:

- `Test Files  1 passed (1)`
- `Tests  4 passed (4)`

### RED 2 — picker tests

Command:

```bash
node ./node_modules/vitest/vitest.mjs run --reporter=verbose src/routes/_layout/todos/-TodoDueDatePicker.test.tsx
```

Observed failure reason:

- Vite import resolution failed because `src/routes/_layout/todos/-TodoDueDatePicker.tsx` did not exist yet.

### GREEN 2 — picker implementation

Implemented:

- `TodoDueDatePicker` with the required existing primitives:
  - `Popover`
  - `PopoverContent`
  - `PopoverTrigger`
  - `Calendar`
  - `Button`
  - `Input`
- Internal draft `dateValue` / `timeValue` state synchronized from the public `string | null` prop
- Native `date` and `time` inputs inside the popover
- Immediate ISO serialization on typed changes using local time before `toISOString()`
- Calendar selection that preserves an existing time or defaults to `09:00`
- Escape closing
- Clear action calling `onChange(null)`
- Icon-only empty trigger and compact local date/time display when populated

Command:

```bash
node ./node_modules/vitest/vitest.mjs run --reporter=verbose src/routes/_layout/todos/-TodoDueDatePicker.test.tsx
```

Observed output:

- `Test Files  1 passed (1)`
- `Tests  4 passed (4)`

### RED 3 — TodoRow integration tests

Command:

```bash
node ./node_modules/vitest/vitest.mjs run --reporter=verbose src/routes/_layout/todos/-TodoRow.test.tsx
```

Observed failure reason:

- TodoRow still emitted date-only strings (`2026-12-25`) instead of ISO timestamps when a date was selected
- Timestamp due dates still rendered as date-only text (`Aug 9`) instead of including local time
- Overdue styling was not preserved through the new integration expectations

### GREEN 3 — TodoRow integration

Implemented:

- Replaced TodoRow’s row-local calendar popover with `TodoDueDatePicker`
- Preserved the public `due_date` field as `string | null`
- Passed `label={`Edit due date for "${todo.name}"`}` through unchanged
- Passed `disabled={isPending}` through unchanged
- Kept the existing 44px target via the picker trigger classes
- Preserved overdue styling by applying row-level text color around the picker
- Preserved date-only readability for legacy values and local date/time display for timestamp values

Command:

```bash
node ./node_modules/vitest/vitest.mjs run --reporter=verbose src/routes/_layout/todos/-TodoRow.test.tsx
```

Observed output:

- `Test Files  1 passed (1)`
- `Tests  14 passed (14)`

## Behavior choices

- Date-only values such as `2026-08-09` remain readable and display as a local calendar date without a time.
- Typed or calendar-backed date/time edits serialize as ISO timestamps using the browser’s local timezone before `toISOString()`.
- When the user selects a date without an existing time, the picker defaults to `09:00`.
- When the user selects a date from the calendar and a time already exists, that time is preserved.
- The picker keeps the popover open after calendar selection so the user can continue typing/editing time without reopening it; Escape closes it.
- Clearing the date returns `null` instead of creating an invalid or partial timestamp.

## Tests added/updated

- Added helper coverage for null, date-only formatting, local ISO conversion, and timestamp formatting
- Added picker coverage for:
  - icon-only empty trigger
  - accessible native date/time inputs
  - typed local date/time ISO conversion
  - calendar time preservation
  - clear behavior
  - Escape closing
- Updated TodoRow coverage for:
  - ISO timestamp updates from the integrated picker
  - timestamp display with local time
  - overdue styling preservation
  - existing compact, pending, accessibility, and icon behavior

## Final verification

Commands:

```bash
node ./node_modules/vitest/vitest.mjs run --reporter=verbose src/routes/_layout/todos/-todoDueDate.test.ts src/routes/_layout/todos/-TodoDueDatePicker.test.tsx src/routes/_layout/todos/-TodoRow.test.tsx
git diff --check
```

Results:

- Focused Task 2 tests passed: `3` files, `22` tests
- `git diff --check` returned clean
- Final diff is scoped to the requested Task 2 helper, picker, and TodoRow files

## Commit

The final task commit hash is reported in the task handoff response. Embedding the post-amend final hash inside this committed report would change the commit hash again.

---

## Fix round 1 — overdue timestamp regression

Date: 2026-08-09

Changed files:

- `src/routes/_layout/todos/-todoDueDate.ts`
- `src/routes/_layout/todos/-todoDueDate.test.ts`
- `src/routes/_layout/todos/-TodoRow.tsx`
- `.superpowers/sdd/2026-08-09-todo-card-polish/task-2-report.md`

Root cause:

- TodoRow treated every due date as a day-level comparison against UTC midnight.
- That was compatible with legacy date-only values, but wrong for picker-produced ISO timestamps because a past timestamp on the same UTC date was still considered “not overdue”.

Fix:

- Added `isTodoDueDateOverdue(value, now?)` in `-todoDueDate.ts`
- Date-only values still compare at local day granularity via `startOfDay(now)`
- Timestamp values now compare directly against `now`
- TodoRow now uses the shared helper instead of duplicating the old UTC-midnight comparison

Focused regression test added:

- `treats timestamp values as overdue once the timestamp is in the past even on the same UTC day`

Exact test command:

```bash
node ./node_modules/vitest/vitest.mjs run --reporter=verbose src/routes/_layout/todos/-todoDueDate.test.ts src/routes/_layout/todos/-TodoRow.test.tsx
```

Output summary:

- `Test Files  2 passed (2)`
- `Tests  19 passed (19)`
- Both the due-date helper suite and TodoRow suite passed with the timestamp overdue regression covered

Fix commit hash:

- `ecf8c1053f9607abb63169c096532cf4537b9df3`
