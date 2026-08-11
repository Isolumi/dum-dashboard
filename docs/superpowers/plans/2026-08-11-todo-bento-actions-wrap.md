# Todo Bento Actions and Text Wrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the compact calendar action before trash, reduce their visual gap, and show up to two lines of Todo text in the Overview bento card.

**Architecture:** Keep the shared `TodoRow` component and change only its `compact` presentation. Give compact rows one stable flex action rail, and let `TodoDueDatePicker` render a smaller icon-only trigger when it is compact and has no saved value. Reuse the existing Button, date picker, Popover, Lucide, Tailwind, and Testing Library code.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Base UI, Lucide React, React DayPicker, Vitest, Testing Library

## Global Constraints

- The calendar action comes before the trash action in the compact DOM and visual order.
- Desktop icon-only action targets are exactly 36 px square.
- The compact action gap is exactly 2 px.
- Coarse-pointer icon-only targets are exactly 44 px square.
- The compact action rail keeps a stable width during hover and focus.
- Compact Todo names use at most two lines with a 20 px line height and an ellipsis.
- Short compact Todo names stay on one line without a fixed two-line height.
- The full Todos page keeps its current one-line presentation and action layout.
- Do not change Todo data, APIs, drag-and-drop behavior, or the add-Todo form.
- Do not add a new dependency, tooltip, action menu, icon set, or calendar library.
- Do not mutate live Todo data during browser verification.

## File map

- `src/routes/_layout/todos/-TodoDueDatePicker.tsx`: Size and center an empty compact calendar trigger while preserving all date logic and saved-value behavior.
- `src/routes/_layout/todos/-TodoDueDatePicker.test.tsx`: Lock the compact icon trigger size, centering, focus reveal, and coarse-pointer behavior.
- `src/routes/_layout/todos/-TodoRow.tsx`: Add the two-line compact name and stable calendar-then-trash action rail.
- `src/routes/_layout/todos/-TodoRow.test.tsx`: Lock compact text, action order, spacing, sizes, visibility, and full-page isolation.
- `docs/superpowers/specs/2026-08-11-todo-bento-actions-wrap-design.md`: Mark the design implemented after all checks pass.

---

### Task 1: Compact calendar icon target

**Files:**

- Modify: `src/routes/_layout/todos/-TodoDueDatePicker.tsx:128-174`
- Test: `src/routes/_layout/todos/-TodoDueDatePicker.test.tsx:270-302`

**Interfaces:**

- Consumes: `TodoDueDatePickerProps.compact`, `TodoDueDatePickerProps.showValue`, and `TodoDueDatePickerProps.value`.
- Produces: An icon-only compact trigger with `size-9`, `[@media(pointer:coarse)]:size-11`, no `ml-auto`, and the existing accessible `label`.

- [ ] **Step 1: Write the failing compact-trigger test**

Add this test after the current compact-value test in `-TodoDueDatePicker.test.tsx`:

```tsx
it("sizes and centers an empty compact calendar trigger", () => {
  render(
    <TodoDueDatePicker
      value={null}
      compact
      onChange={vi.fn()}
      label={'Edit due date for "Deploy app"'}
    />,
  );

  const trigger = screen.getByRole("button", {
    name: /edit due date for "deploy app"/i,
  });
  const icon = trigger.querySelector("svg");

  expect(trigger.className).toContain("size-9");
  expect(trigger.className).toContain("[@media(pointer:coarse)]:size-11");
  expect(trigger.className).toContain("justify-center");
  expect(icon?.className.baseVal).not.toContain("ml-auto");
  expect(icon?.className.baseVal).toContain("group-focus-within:opacity-100");
});
```

- [ ] **Step 2: Run the new test and verify the expected failure**

Run:

```bash
bunx vitest run src/routes/_layout/todos/-TodoDueDatePicker.test.tsx -t "sizes and centers an empty compact calendar trigger"
```

Expected: FAIL because the trigger still has `min-h-11` instead of `size-9`, and the icon still has `ml-auto`.

- [ ] **Step 3: Add the compact icon-only trigger state**

In `-TodoDueDatePicker.tsx`, define the state after `displayValue`:

```tsx
const compactIconOnly = compact && showValue && !value;
```

Replace the trigger class selection with:

```tsx
className={cn(
  "group/date w-full min-w-0 overflow-hidden text-inherit hover:text-inherit",
  compactIconOnly
    ? "size-9 min-h-0 justify-center px-0 [@media(pointer:coarse)]:size-11"
    : showValue
      ? "min-h-11 justify-end px-2 text-right"
      : "h-9 min-h-0 justify-center px-0",
)}
```

Replace the calendar icon classes with:

```tsx
className={cn(
  "size-4 text-muted-foreground",
  showValue && !compactIconOnly && "ml-auto",
  showValue &&
    "opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-visible/date:opacity-100 [@media(pointer:coarse)]:opacity-100",
  compact && "group-focus-within:opacity-100",
)}
```

Do not change `updateDueDate`, Popover, Dialog, calendar, date input, time input, Clear, or formatting behavior.

- [ ] **Step 4: Run the complete date-picker test file**

Run:

```bash
bunx vitest run src/routes/_layout/todos/-TodoDueDatePicker.test.tsx
```

Expected: PASS with all date-picker tests green.

- [ ] **Step 5: Commit the compact calendar trigger**

```bash
git add src/routes/_layout/todos/-TodoDueDatePicker.tsx src/routes/_layout/todos/-TodoDueDatePicker.test.tsx
git commit -m "style: compact Todo calendar action"
```

---

### Task 2: Stable compact action rail and two-line names

**Files:**

- Modify: `src/routes/_layout/todos/-TodoRow.tsx:146-210`
- Test: `src/routes/_layout/todos/-TodoRow.test.tsx:211-322`

**Interfaces:**

- Consumes: The compact trigger contract from Task 1, `TodoRowProps.compact`, `todo.due_date`, `isOverdue`, `onUpdate`, and `onDelete`.
- Produces: A compact name span with `line-clamp-2 min-w-0 leading-5` and one stable action rail with calendar before trash.

- [ ] **Step 1: Write the failing compact-name test**

Add this test near the existing compact layout tests in `-TodoRow.test.tsx`:

```tsx
it("clamps compact names to two lines without changing the full-page name", () => {
  renderTodoRow({ compact: true });

  const compactName = screen.getByRole("button", { name: "Deploy app" }).querySelector("span");
  expect(compactName?.className).toContain("line-clamp-2");
  expect(compactName?.className).toContain("leading-5");
  expect(compactName?.className).not.toContain("truncate");

  cleanup();
  renderTodoRow();

  const fullName = screen.getByRole("button", { name: "Deploy app" }).querySelector("span");
  expect(fullName?.className).toContain("truncate");
  expect(fullName?.className).not.toContain("line-clamp-2");
});
```

- [ ] **Step 2: Write the failing action-rail test**

Add this test after the compact-name test:

```tsx
it("keeps compact actions stable with calendar before trash", () => {
  renderTodoRow({ compact: true, todo: { ...highTodo, due_date: null } });

  const calendar = screen.getByRole("button", {
    name: /edit due date for "deploy app"/i,
  });
  const trash = screen.getByRole("button", { name: /delete "deploy app"/i });
  const calendarWrapper = calendar.parentElement;
  const actionRail = calendarWrapper?.parentElement;

  expect(calendar.compareDocumentPosition(trash) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(actionRail?.className).toContain("gap-0.5");
  expect(calendarWrapper?.className).toContain("w-9");
  expect(calendarWrapper?.className).toContain("[@media(pointer:coarse)]:w-11");
  expect(trash.className).toContain("size-9");
  expect(trash.className).toContain("[@media(pointer:coarse)]:size-11");
  expect(trash.className).toContain("opacity-0");
  expect(trash.className).toContain("group-hover:opacity-100");
  expect(trash.className).toContain("group-focus-within:opacity-100");
});
```

- [ ] **Step 3: Run both new tests and verify the expected failures**

Run:

```bash
bunx vitest run src/routes/_layout/todos/-TodoRow.test.tsx -t "clamps compact names|keeps compact actions stable"
```

Expected: FAIL because the name still uses `truncate`, trash precedes calendar, and the compact actions still use the overlay structure and 44 px targets.

- [ ] **Step 4: Add conditional compact name classes**

Import is not required because `cn` is already present. Replace the name span with:

```tsx
<span className={cn("min-w-0", compact ? "line-clamp-2 leading-5" : "truncate")}>{todo.name}</span>
```

Keep the name button, click-to-edit behavior, pending label, and full accessible text unchanged.

- [ ] **Step 5: Replace the compact action overlay with a stable rail**

Replace only the `compact ? (...)` action branch with:

```tsx
<div className="flex shrink-0 items-center gap-0.5">
  <div
    className={cn(
      "shrink-0 text-right",
      todo.due_date ? "w-32" : "w-9 [@media(pointer:coarse)]:w-11",
      todo.due_date && (isOverdue ? "text-destructive" : "text-muted-foreground"),
    )}
  >
    <TodoDueDatePicker
      value={todo.due_date}
      onChange={(due_date, due_date_has_time) =>
        onUpdate({ id: todo.id, due_date, due_date_has_time })
      }
      label={`Edit due date for "${todo.name}"`}
      compact
      hasTime={todo.due_date_has_time}
      disabled={isPending}
    />
  </div>

  <Button
    variant="ghost"
    size="icon"
    onClick={() => onDelete(todo.id)}
    disabled={isPending}
    aria-label={`Delete "${todo.name}"`}
    className="size-9 shrink-0 opacity-0 transition-opacity motion-reduce:transition-none hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(pointer:coarse)]:size-11 [@media(pointer:coarse)]:opacity-100"
  >
    <Trash2 />
  </Button>
</div>
```

Do not change the full-page action branch.

- [ ] **Step 6: Run the complete row and bento-card test files**

Run:

```bash
bunx vitest run src/routes/_layout/todos/-TodoRow.test.tsx src/routes/_layout/todos/-TodoBentoCard.test.tsx
```

Expected: PASS. Existing edit, date, delete, pending, drag, focus, and bento mutation tests remain green.

- [ ] **Step 7: Commit the compact row layout**

```bash
git add src/routes/_layout/todos/-TodoRow.tsx src/routes/_layout/todos/-TodoRow.test.tsx
git commit -m "style: improve Todo bento rows"
```

---

### Task 3: Regression and browser verification

**Files:**

- Modify: `docs/superpowers/specs/2026-08-11-todo-bento-actions-wrap-design.md:4`
- Verify: `src/routes/_layout/todos/`
- Verify: `.github/workflows/build-images.yml:44-57`

**Interfaces:**

- Consumes: The finished compact date trigger and Todo row from Tasks 1 and 2.
- Produces: Repository-wide verification evidence and a design status of `Implemented; merge and deployment pending`.

- [ ] **Step 1: Run the focused Todo suite**

```bash
bunx vitest run src/routes/_layout/todos
```

Expected: PASS with no failed Todo tests.

- [ ] **Step 2: Run all repository gates**

```bash
bun run test
bun run lint
bun run fmt:check
bun run build
bun run build:gateway
```

Expected: Every command exits with status 0. The build produces the dashboard and gateway outputs without TypeScript, lint, or format errors.

- [ ] **Step 3: Start the local dashboard for read-only browser checks**

Run in a dedicated terminal session:

```bash
bun run dev --host 127.0.0.1
```

Open `http://127.0.0.1:3000/`. Use the existing Overview data only. Do not click completion, edit, calendar, trash, Add, or drag controls.

- [ ] **Step 4: Verify the desktop bento card in a real browser**

At 1280 by 900 px, verify:

- short names remain one line
- the long name uses no more than two lines and ends with an ellipsis when needed
- calendar is before trash in DOM and visual order
- empty icon targets measure 36 by 36 px
- the gap between the two action target boxes measures 2 px
- row hover reveals calendar and trash without changing the row width or name wrap
- keyboard focus reveals hidden actions
- the console has zero errors and zero warnings

- [ ] **Step 5: Verify the narrow bento card in a real browser**

At 360 by 800 px, verify:

- the page has no horizontal overflow
- long names use at most two lines
- actions stay inside the card
- coarse-pointer CSS gives icon-only actions 44 by 44 px when coarse-pointer emulation is active
- the console has zero errors and zero warnings

- [ ] **Step 6: Mark the design implemented**

Change the design header to:

```markdown
Status: Implemented; merge and deployment pending
```

- [ ] **Step 7: Commit the verified design status**

```bash
git add docs/superpowers/specs/2026-08-11-todo-bento-actions-wrap-design.md
git commit -m "docs: mark Todo bento polish implemented"
```

- [ ] **Step 8: Confirm the branch is clean and summarize evidence**

Run:

```bash
git status --short --branch
git log --oneline origin/v1..HEAD
```

Expected: The branch is clean and contains the design, compact calendar, compact row, and implemented-status commits.
