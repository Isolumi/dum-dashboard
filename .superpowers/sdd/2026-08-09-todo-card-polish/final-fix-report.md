# Todo card polish final-review fix report

Date: 2026-08-09
Worktree: /Users/isolumi/Documents/CS/dum-dashboard/.worktrees/homelab-dashboard
Base commit: 1499bf6
Scope: Single final-review fix wave

## Final fix commit

The final fix commit is the single branch commit immediately after 1499bf6 and contains this
report together with all code, tests, types, and migration changes. Its authoritative hash is
the value of git rev-parse HEAD in the final handoff.

A literal copy of that hash cannot be embedded inside this tracked report: changing this file
to add the hash changes the commit tree and therefore produces a different hash. The exact
post-commit hash is reported in the final handoff; the parent/base recorded above and the
one-commit branch delta make the commit identity unambiguous and truthfully reproducible.

## Issues fixed

### 1. Legacy due-date precision

- Added due_date_has_time boolean NOT NULL DEFAULT false to the existing, not-yet-deployed
  20260809000000_todo_due_datetime.sql migration.
- Kept existing rows false while converting due_date to timestamptz.
- Added the field to database Row, Insert, and Update types.
- Added it to server select columns, create/update schemas, normalization, controller
  optimistic state, rollback state, create/update payloads, and all Todo UI call sites.
- Preserved compatibility for API objects without metadata:
  - only an exact YYYY-MM-DD value is inferred as date-only;
  - timestamp values without metadata remain time-aware.
- Date-only metadata uses the timestamp's normalized UTC calendar date, then local-day display
  and overdue semantics, so migrated UTC-midnight values do not shift to the previous evening.
- New picker date/time values emit hasTime=true; clear emits null with hasTime=false.
- Todo sorting now uses the same UTC calendar key as display and overdue behavior.
- Server normalization forces cleared/null due dates to due_date_has_time=false, even if a
  stale client submits true.

### 2. Add-form priority switch

- Replaced the visually ambiguous checkbox treatment with a neutral blue-gray text-in-switch
  control.
- The switch visibly says Low while off and High while on.
- Preserved role=switch, aria-checked, keyboard button behavior, and the High priority
  accessible name.

### 3. Context-specific compact calendar behavior

- Added showValue=false to TodoDueDatePicker and use it in AddTodoRow.
- The add control always shows a centered calendar icon and never places a full date/time
  string in its narrow slot.
- Todo rows provide w-32 compact and w-40 full widths for selected local date/time values.
- Trigger/value wrappers use min-width and overflow/truncation guards.
- Empty row icons remain available on hover, keyboard focus, and coarse pointers.
- Removed expanded add-row vertical padding and standardized controls at h-9 inside the same
  44px minimum row footprint as the collapsed add control.

### 4. Popover accessible name

- Added the existing PopoverTitle primitive as a visually hidden title.
- Bound PopoverContent to that title with aria-labelledby.
- Unit and real-browser checks locate the dialog by the supplied picker label.

### 5. PostgREST schema refresh

- Added NOTIFY pgrst, 'reload schema'; after the DDL and before commit in the same pending
  migration.

## TDD evidence

### UTC date-only helper regression

RED command:

~~~bash
bunx vitest run src/routes/_layout/todos/-todoDueDate.test.ts
~~~

Observed RED:

- 1 failed, 8 passed.
- The offset-safe case expected calendar key 2026-08-10 but received 2026-08-09.

GREEN:

- Normalized timestamp inputs through ISO UTC before extracting the date.
- 1 file passed, 9 tests passed at that checkpoint; the final suite contains 10 helper tests.

### Popover accessible name

RED command:

~~~bash
bunx vitest run src/routes/_layout/todos/-TodoDueDatePicker.test.tsx
~~~

Observed RED:

- 1 failed, 6 passed.
- The dialog existed but had no accessible name.

GREEN:

- Added PopoverTitle and explicit title association.
- 1 file passed, 7 tests passed.

### Add-row visible states and compact footprint

RED command:

~~~bash
bunx vitest run src/routes/_layout/todos/-AddTodoRow.test.tsx
~~~

Observed RED:

- Assertions exposed the old one-state visible label and taller padded controls.

GREEN:

- Added visible Low/High states, neutral switch styling, persistent compact calendar icon,
  showValue=false behavior, and h-9 controls in a 44px row.
- 1 file passed, 15 tests passed.

### Todo-row migrated date, clear metadata, and width contract

RED command:

~~~bash
bunx vitest run src/routes/_layout/todos/-TodoRow.test.tsx
~~~

Observed RED:

- The selected compact date/time contract still used w-28 instead of the required wider slot.

GREEN:

- Added migrated UTC-midnight/date-only display and clear-metadata regressions.
- Widened the compact/full date cells and retained safe truncation.
- 1 file passed, 17 tests passed.

### Legacy sorting and UTC calendar key

RED command:

~~~bash
bunx vitest run src/routes/_layout/todos/-todoUtils.test.ts
~~~

Observed RED:

- 2 failed, 2 passed.
- A legacy timestamp without metadata was treated as date-only.
- An offset timestamp marked date-only sorted by its raw leading date rather than its UTC
  calendar date.

GREEN:

- Added metadata fallback inference and shared UTC calendar-key sorting.
- 1 file passed, 4 tests passed.

### Server clearing invariant

RED command:

~~~bash
bunx vitest run src/routes/todos/-todos.functions.test.ts
~~~

Observed RED:

- 2 failed, 38 passed.
- Explicit stale true metadata survived create/update payloads whose due_date was null.

GREEN:

- Create and update normalization now force false whenever due_date is cleared.
- 1 file passed, 40 tests passed.

## Focused verification

Command:

~~~bash
bunx vitest run --maxWorkers=4 +  src/routes/todos/-todos.functions.test.ts +  src/routes/_layout/todos/-todoDueDate.test.ts +  src/routes/_layout/todos/-todoUtils.test.ts +  src/routes/_layout/todos/-TodoDueDatePicker.test.tsx +  src/routes/_layout/todos/-TodoRow.test.tsx +  src/routes/_layout/todos/-AddTodoRow.test.tsx +  src/routes/_layout/todos/-useTodoController.test.tsx +  src/routes/_layout/todos/-PrioritySection.test.tsx +  src/routes/_layout/todos/-TodoBoard.test.tsx +  src/routes/_layout/todos/-TodoBentoCard.test.tsx
~~~

Result:

- 10 test files passed.
- 131 tests passed.
- 0 failures.

## Full verification

- Full Vitest suite: 45 files passed, 601 tests passed.
- Lint: 0 warnings and 0 errors from oxlint.
- Type-check: bunx tsc --noEmit passed.
- Formatting: oxfmt was applied after one touched test file failed the first check; final
  fmt:check passed.
- Production build: bun run build passed.
- Diff hygiene: git diff --check passed.
- Scope audit: final delta from 1499bf6 is limited to Todo types, server/controller/helpers,
  Todo UI and tests, the existing due-date migration, and this report.

The build emitted non-fatal generated-CSS and dependency bundling warnings; it completed
successfully.

## Real-browser smoke check

Used the local Vite app with Playwright in a headed browser.

Confirmed:

- the compact expanded add row renders in place;
- the switch visibly changes from Low/unchecked to High/checked;
- the add-row calendar control remains icon-only;
- the popover renders native date and time inputs;
- the dialog is discoverable by role and the name Choose date and time;
- the compact popover layout is visually usable.

The local Todo backend was unavailable and displayed Could not load todos. Refresh to try
again. Therefore a populated persisted Todo row could not be smoke-tested against live data;
the selected-row width, truncation, migrated timestamp, clear, controller, and server paths
are covered by the focused component/unit suites.

## Review

The completion-review skill's independent subagent mechanism was not available in this
runtime. A manual diff audit was performed against 1499bf6, followed by focused and full
verification. No unresolved Important findings remain.

## Remaining concerns

- No migration was applied to a live Supabase project in this wave; the migration is still
  intentionally pending.
- Local browser verification could not exercise persisted Todo data because the local Todo
  backend was unavailable.
- The successful build retains the non-fatal warnings described above.
