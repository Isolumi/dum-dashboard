# Task 1: Compact calendar icon target

## What changed

- Added a regression test for an empty compact Todo calendar trigger.
- Added the `compactIconOnly` state.
- Updated the compact empty trigger to use `size-9`, coarse-pointer `size-11`, centered content, and no horizontal padding.
- Updated calendar icon classes so compact triggers receive focus-within opacity and do not apply `ml-auto` in the icon-only state.
- Preserved existing date logic, formatting, popover/dialog behavior, calendar behavior, input behavior, clear behavior, and update behavior.

## Files changed

- `src/routes/_layout/todos/-TodoDueDatePicker.test.tsx`
- `src/routes/_layout/todos/-TodoDueDatePicker.tsx`

## TDD RED

Command:

```bash
bunx vitest run src/routes/_layout/todos/-TodoDueDatePicker.test.tsx -t "sizes and centers an empty compact calendar trigger"
```

Relevant failing output:

```text
FAIL ... TodoDueDatePicker > sizes and centers an empty compact calendar trigger
AssertionError: expected 'group/button inline-flex shrink-0 ite…' to contain 'size-9'

Expected: "size-9"
Received: "... min-h-11 justify-end px-2 text-right"
Tests  1 failed | 10 skipped (11)
```

This failure was expected because the existing compact empty trigger still used the non-compact `min-h-11` trigger classes. The source had not yet added `size-9`, coarse-pointer sizing, centered layout, or the compact icon-only class state.

## TDD GREEN

Focused command:

```bash
bunx vitest run src/routes/_layout/todos/-TodoDueDatePicker.test.tsx -t "sizes and centers an empty compact calendar trigger"
```

Relevant passing output:

```text
✓ ... src/routes/_layout/todos/-TodoDueDatePicker.test.tsx (11 tests | 10 skipped)
Test Files  1 passed (1)
Tests  1 passed | 10 skipped (11)
```

Complete file command:

```bash
bunx vitest run src/routes/_layout/todos/-TodoDueDatePicker.test.tsx
```

Relevant passing output:

```text
✓ ... src/routes/_layout/todos/-TodoDueDatePicker.test.tsx (11 tests)
Test Files  1 passed (1)
Tests  11 passed (11)
```

## Self-review findings

- The diff is limited to the two brief-listed source/test files.
- The new test checks the required trigger size, coarse-pointer size, centering, removal of `ml-auto`, and compact focus-within opacity class.
- The source change matches the exact class values in the task brief.
- Existing date update and presentation paths are unchanged.
- `git diff --check` passed.
- `bunx oxfmt --check src/routes/_layout/todos/-TodoDueDatePicker.tsx src/routes/_layout/todos/-TodoDueDatePicker.test.tsx` passed.

## Concerns

- No functional concerns.
- The formatting check printed an environment Node deprecation warning for `module.register()`; formatting still passed.
