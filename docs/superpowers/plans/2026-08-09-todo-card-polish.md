# Todo Card Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Overview Todo card quieter and more usable while adding persisted date-and-time support to Todo due dates.

**Architecture:** Keep the existing shared `TodoBoard` used by the Overview card and full Todo page. Add one reusable due-date picker/formatting boundary, keep `due_date` as the public field name, and migrate its Supabase type from date-only storage to `timestamptz` while accepting old date-only API values. Move the add control below the two priority sections and make its expanded form replace that same row in place.

**Tech Stack:** React 19, TanStack Router/Start, Base UI popovers, React Day Picker, date-fns, Zod, Supabase migrations, Vitest, Testing Library, Bun.

## Global Constraints

- The visible `Todos` title is the only navigation affordance and links to the full `/todos` page.
- Replace the two section-level add rows with one shared add row below both priority sections.
- The priority switch displays `Low` when off and `High` when on. Off maps to the existing `low` value; on maps to `high`.
- The calendar icon opens a date/time picker that supports both picker selection and typed date/time input.
- Enter submits a valid Todo; Escape cancels and restores the add row.
- Keep status, rename, drag/reorder, priority, due date, and delete actions.
- No new Todo features, filters, modals, or settings.
- No changes to unrelated Overview cards.
- The UI should format timestamps in the user's local timezone and retain a clear date-only display when an existing Todo has no time component.

---

### Task 1: Migrate the Todo due-date contract to date/time values

**Files:**

- Create: `supabase/migrations/20260809000000_todo_due_datetime.sql`
- Modify: `src/routes/todos/todos.functions.ts`
- Modify: `src/lib/database.types.ts` only if regeneration changes the generated schema output
- Test: `src/routes/todos/-todos.functions.test.ts`

**Interfaces:**

- Preserve `CreateTodoSchema`, `UpdateTodoSchema`, and the existing `Todo` field name `due_date`.
- Accept `null`, an ISO date-only string such as `2026-08-09`, or an ISO timestamp with an explicit offset such as `2026-08-09T15:30:00.000Z` at the server boundary.
- New UI-created values will use ISO timestamps; existing date-only values remain valid during the transition.

- [ ] **Step 1: Add failing schema tests for timestamps**

Add tests beside the existing date-only validation tests:

```ts
it("accepts an ISO timestamp with an offset for due_date", () => {
  expect(
    CreateTodoSchema.safeParse({
      name: "Timed todo",
      due_date: "2026-08-09T15:30:00.000Z",
    }).success,
  ).toBe(true);
});

it("accepts an ISO timestamp in UpdateTodoSchema", () => {
  expect(
    UpdateTodoSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000001",
      due_date: "2026-08-09T11:30:00-04:00",
    }).success,
  ).toBe(true);
});
```

- [ ] **Step 2: Run the focused server-function tests and verify RED**

Run:

```bash
bunx vitest run src/routes/todos/-todos.functions.test.ts
```

Expected: the new timestamp cases fail because the current schemas only accept `z.string().date()`.

- [ ] **Step 3: Update the server schemas**

Define one shared schema in `src/routes/todos/todos.functions.ts`:

```ts
const TodoDueDateSchema = z.union([z.string().date(), z.string().datetime({ offset: true })]);
```

Use `TodoDueDateSchema.nullable().optional()` in both create and update schemas. Keep all other validation unchanged.

- [ ] **Step 4: Add the migration preserving existing date-only values**

Create `supabase/migrations/20260809000000_todo_due_datetime.sql` with a transaction that converts the existing `public.todos.due_date` column to `timestamptz` and interprets old dates as UTC midnight:

```sql
begin;

alter table public.todos
  alter column due_date type timestamptz
  using case
    when due_date is null then null
    else due_date::timestamp at time zone 'UTC'
  end;

commit;
```

The migration must not rename the column, change nullability, or change existing Todo priority/status data.

- [ ] **Step 5: Regenerate and verify database types**

Run `bunx supabase gen types typescript --linked > src/lib/database.types.ts`. Confirm `src/lib/database.types.ts` still represents `todos.Row.due_date`, `todos.Insert.due_date`, and `todos.Update.due_date` as `string | null` because Supabase timestamps are serialized as strings. Keep only the generator's necessary changes.

- [ ] **Step 6: Run the focused tests and commit**

Run:

```bash
bunx vitest run src/routes/todos/-todos.functions.test.ts
git diff --check
git add supabase/migrations/20260809000000_todo_due_datetime.sql src/routes/todos/todos.functions.ts src/routes/todos/-todos.functions.test.ts src/lib/database.types.ts
git commit -m "feat: support todo due times"
```

Expected: focused tests pass and the migration/schema diff is clean.

### Task 2: Add reusable date/time picker and row date display

**Files:**

- Create: `src/routes/_layout/todos/-todoDueDate.ts`
- Create: `src/routes/_layout/todos/-TodoDueDatePicker.tsx`
- Test: `src/routes/_layout/todos/-todoDueDate.test.ts`
- Test: `src/routes/_layout/todos/-TodoDueDatePicker.test.tsx`
- Modify: `src/routes/_layout/todos/-TodoRow.tsx`
- Modify: `src/routes/_layout/todos/-TodoRow.test.tsx`

**Interfaces:**

- `formatTodoDueDate(value: string | null): string` returns an empty marker for null, a local date for date-only values, and a local date plus time for timestamp values.
- `toTodoDueDate(dateValue: string, timeValue: string): string` combines local date/time input and returns an ISO timestamp.
- `TodoDueDatePicker` accepts `value: string | null`, `onChange(value: string | null)`, `label: string`, `compact?: boolean`, and `disabled?: boolean`.

- [ ] **Step 1: Write failing date conversion tests**

Cover date-only compatibility, local date/time combination, clearing, and display formatting:

```ts
it("keeps date-only values displayable", () => {
  expect(formatTodoDueDate("2026-08-09")).toMatch(/Aug 9/);
});

it("converts typed local date and time into an ISO timestamp", () => {
  const result = toTodoDueDate("2026-08-09", "15:30");
  expect(new Date(result).toISOString()).toBe(result);
  expect(result).toMatch(/2026-08-09T/);
});

it("formats timestamp values with a local time", () => {
  expect(formatTodoDueDate("2026-08-09T19:30:00.000Z")).toMatch(/Aug 9/);
});
```

- [ ] **Step 2: Run the focused date tests and verify RED**

Run:

```bash
bunx vitest run src/routes/_layout/todos/-todoDueDate.test.ts
```

Expected: the test file fails because the conversion module does not exist.

- [ ] **Step 3: Implement the pure date helpers**

Implement `-todoDueDate.ts` with date-fns and native `Date` conversion. Treat a date-only value as local midnight for display. When combining input values, use the browser's local timezone and serialize with `toISOString()`; reject empty date input by returning `null` from the picker instead of creating an invalid timestamp.

- [ ] **Step 4: Write failing picker tests**

Add tests that render the picker, open it from the calendar-icon trigger, find native `date` and `time` inputs, type values, and assert the ISO value passed to `onChange`. Also test Escape/clear behavior and accessible labeling.

- [ ] **Step 5: Run picker tests and verify RED**

Run:

```bash
bunx vitest run src/routes/_layout/todos/-TodoDueDatePicker.test.tsx
```

Expected: the test file fails because the component does not exist.

- [ ] **Step 6: Implement the reusable picker**

Build `TodoDueDatePicker` with the existing `Popover`, `PopoverContent`, `PopoverTrigger`, `Calendar`, `Button`, and `Input` components. The trigger is a calendar icon with the requested accessible label. The popover contains a clickable calendar plus typed `date` and `time` inputs. Date selection preserves an existing time or defaults to `09:00`; changing either native input immediately calls `onChange` with an ISO timestamp. A clear action calls `onChange(null)`. Keep the popover anchored to the trigger so it overlays instead of changing card height.

- [ ] **Step 7: Replace TodoRow's date implementation**

Remove the row-local calendar/date formatting code and render `TodoDueDatePicker`. Keep `aria-label=\"Edit due date for \\\"<todo name>\\\"\"`, disabled/pending behavior, overdue styling, and the existing 44px target. Display the formatted local date/time only when a value exists; leave the trigger icon-only when empty.

- [ ] **Step 8: Run row, helper, and picker tests and commit**

Run:

```bash
bunx vitest run src/routes/_layout/todos/-todoDueDate.test.ts src/routes/_layout/todos/-TodoDueDatePicker.test.tsx src/routes/_layout/todos/-TodoRow.test.tsx
git diff --check
git add src/routes/_layout/todos/-todoDueDate.ts src/routes/_layout/todos/-todoDueDate.test.ts src/routes/_layout/todos/-TodoDueDatePicker.tsx src/routes/_layout/todos/-TodoDueDatePicker.test.tsx src/routes/_layout/todos/-TodoRow.tsx src/routes/_layout/todos/-TodoRow.test.tsx
git commit -m "feat: add todo date and time picker"
```

Expected: all focused tests pass and TodoRow keeps its existing actions.

### Task 3: Polish the shared board, add form, and Overview card

**Files:**

- Modify: `src/routes/_layout/todos/-TodoBentoCard.tsx`
- Modify: `src/routes/_layout/todos/-TodoBoard.tsx`
- Modify: `src/routes/_layout/todos/-PrioritySection.tsx`
- Modify: `src/routes/_layout/todos/-AddTodoRow.tsx`
- Modify: `src/routes/_layout/todos/-AddTodoRow.test.tsx`
- Modify: `src/routes/_layout/todos/-TodoBoard.test.tsx`
- Modify: `src/routes/_layout/todos/-PrioritySection.test.tsx`
- Modify: `src/routes/_layout/todos/-TodoBentoCard.test.tsx`

**Interfaces:**

- `PrioritySection` renders only its section header and Todo rows; it no longer owns an add control.
- `TodoBoard` renders exactly one `AddTodoRow` after both priority sections in both `compact` and `full` variants.
- `AddTodoRow` keeps its existing `onCreate({ name, priority, due_date })` interface, with `due_date` now accepting an ISO timestamp or null.

- [ ] **Step 1: Write failing board/card tests for the new structure**

Change the board tests to expect exactly one `AddTodoRow` in each variant. Add card assertions that `Todos` is the `/todos` link and `Open full page` is absent. Add a test that clicking the single add control removes that control while the inline name input appears in its place.

- [ ] **Step 2: Run board/card tests and verify RED**

Run:

```bash
bunx vitest run src/routes/_layout/todos/-TodoBoard.test.tsx src/routes/_layout/todos/-TodoBentoCard.test.tsx
```

Expected: tests fail because the current card still links only the secondary text, the board still renders two add rows, and the add control does not replace itself.

- [ ] **Step 3: Move the shared add row below both sections**

Remove `onCreate` and the `AddTodoRow` render from `PrioritySection`. In `TodoBoard`, render the two `PrioritySection` components first, then render one `AddTodoRow` with `defaultPriority=\"low\"`, `compact={compact}`, and `onCreate={controller.create}`. Preserve empty High and Low headers.

- [ ] **Step 4: Implement the stable inline add form**

Make the collapsed add control and expanded form occupy the same row location. The expanded form must contain:

```tsx
<Input aria-label="New todo name" />
<input type="checkbox" role="switch" aria-label="High priority" />
<TodoDueDatePicker label="Choose date and time" />
<Button>Add</Button>
```

Use the switch's off/on state to send `low`/`high`. Focus the name input on open, submit on Enter, cancel on Escape, and keep the calendar popover overlaid. Remove the old keyboard-hint row and the old text priority selector so the form stays visually compact.

- [ ] **Step 5: Polish the card and section styles**

In `TodoBentoCard`, wrap only the `Todos` heading in the `/todos` Link and remove the full-page link text. Keep the card itself a non-link section so row controls remain independently clickable. In `PrioritySection`, use muted section label styles for both priorities. In compact rows, keep name text flexible, keep utility actions hidden until hover/focus/coarse pointer, and use neutral icon-only priority controls.

- [ ] **Step 6: Update component tests for form controls and retained actions**

Assert that the add form exposes `High priority`, calendar icon `Choose date and time`, and Add controls; toggling the switch creates High instead of Low; typed date/time is passed to `onCreate`; Escape restores the single add control; and the existing status, rename, priority, date, delete, and reorder tests still pass.

- [ ] **Step 7: Run the focused UI tests and commit**

Run:

```bash
bunx vitest run src/routes/_layout/todos/-AddTodoRow.test.tsx src/routes/_layout/todos/-PrioritySection.test.tsx src/routes/_layout/todos/-TodoBoard.test.tsx src/routes/_layout/todos/-TodoBentoCard.test.tsx
git diff --check
git add src/routes/_layout/todos/-TodoBentoCard.tsx src/routes/_layout/todos/-TodoBoard.tsx src/routes/_layout/todos/-PrioritySection.tsx src/routes/_layout/todos/-AddTodoRow.tsx src/routes/_layout/todos/-AddTodoRow.test.tsx src/routes/_layout/todos/-TodoBoard.test.tsx src/routes/_layout/todos/-PrioritySection.test.tsx src/routes/_layout/todos/-TodoBentoCard.test.tsx
git commit -m "feat: polish todo overview card"
```

Expected: focused UI tests pass with one stable add row and no `Open full page` text.

### Task 4: Whole-branch verification and deployment handoff

**Files:**

- No planned source changes; fix only verified regressions found by the checks below.

- [ ] **Step 1: Run the complete local verification suite**

Run:

```bash
bunx vitest run --maxWorkers=4
bun run lint
bun run fmt:check
bunx tsc --noEmit
bun run build
git diff --check
```

Expected: all tests, lint, formatting, type checking, production build, and whitespace checks pass.

- [ ] **Step 2: Inspect the final diff and branch state**

Run:

```bash
git status --short --branch
git log --oneline --decorate -8
git diff origin/agent/todo-overhaul...HEAD --stat
```

Confirm only the approved spec, plan, migration, Todo date/time contract, picker, and Todo card files changed.

- [ ] **Step 3: Push the branch for the existing GitOps workflow**

Run:

```bash
git push origin agent/todo-overhaul
```

Then report the pushed commit and wait for the repository's normal PR/CI/deployment workflow before claiming the live card is updated.

- [ ] **Step 4: Verify the deployed card**

After deployment, verify `https://doh.lumilumi.xyz` in a real browser at desktop and narrow widths. Confirm the title link, one add row, High/Low switch, calendar popover with typed date/time, stable inline form, retained row actions, and no console errors.
