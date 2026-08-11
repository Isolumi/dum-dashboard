# Todo Density and Centered Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Todo row left spacing, make all new Todos Low, and center the add-form calendar in an accessible dialog.

**Architecture:** Keep the existing Todo board and drag controller. Standardize related overlays on the installed Base UI primitives: existing Todo dates use Base UI Popover, the add-form date uses Base UI Dialog, and both reuse the current React DayPicker calendar and one shared date-and-time panel.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tailwind CSS, Base UI Dialog and Popover, React DayPicker, dnd-kit

## Global Constraints

- New Todos always submit with `priority: "low"`.
- Dragging into the High section is the only add-card path that promotes a Todo.
- Keep the drag grip on the left and move the Todo name start from about 84 px to about 68 px.
- Use Base UI and React DayPicker. Do not add another dialog, popover, calendar, or drag-and-drop dependency.
- The add calendar is a centered modal dialog. Existing Todo-row calendars remain anchored popovers.
- The dialog must fit a 360 px viewport with at least 16 px at each side.
- Preserve all current completion, editing, due-date, delete, keyboard, and drag behavior.
- Do not mutate live Todo data during browser verification.

---

## File map

- Create `src/components/ui/dialog.tsx`: shared project styling over `@base-ui/react/dialog`; Base UI owns focus, modal, and dismissal behavior.
- Modify `src/routes/_layout/todos/-TodoDueDatePicker.tsx`: add the `popover | dialog` presentation boundary and share one DayPicker-backed panel.
- Modify `src/routes/_layout/todos/-TodoDueDatePicker.test.tsx`: prove both presentations and date behavior.
- Modify `src/routes/_layout/todos/-AddTodoRow.tsx`: remove priority UI/state, always create Low, and request the dialog presentation.
- Modify `src/routes/_layout/todos/-AddTodoRow.test.tsx`: prove the control is absent, Low is fixed, and the compact three-control grid is correct.
- Modify `src/routes/_layout/todos/-TodoBoard.tsx`: remove the obsolete `defaultPriority` property.
- Modify `src/routes/_layout/todos/-TodoRow.tsx`: reduce compact row padding, grid gap, and grip width.
- Modify `src/routes/_layout/todos/-TodoRow.test.tsx`: lock the approved compact geometry.

---

### Task 1: Standard Base UI dialog and due-date presentations

**Files:**
- Create: `src/components/ui/dialog.tsx`
- Modify: `src/routes/_layout/todos/-TodoDueDatePicker.tsx`
- Test: `src/routes/_layout/todos/-TodoDueDatePicker.test.tsx`

**Interfaces:**
- Produces: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogTitle`, and `DialogClose` wrappers over `@base-ui/react/dialog`.
- Produces: `TodoDueDatePickerProps.presentation?: "popover" | "dialog"`, defaulting to `"popover"`.
- Preserves: `onChange(value: string | null, hasTime: boolean): void`.

- [ ] **Step 1: Add failing tests for both presentations**

Add a `#/components/ui/dialog` mock with controlled open state. Add tests that prove the default presentation uses the popover mock and `presentation="dialog"` uses the dialog mock.

```tsx
it("uses an anchored popover by default", () => {
  render(
    <TodoDueDatePicker value={null} onChange={vi.fn()} label="Edit due date" />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit due date" }));
  expect(screen.getByTestId("due-date-popover")).toBeTruthy();
  expect(screen.queryByTestId("due-date-dialog")).toBeNull();
});

it("uses a centered dialog when requested", () => {
  render(
    <TodoDueDatePicker
      value={null}
      onChange={vi.fn()}
      label="Choose date and time"
      presentation="dialog"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Choose date and time" }));
  expect(screen.getByTestId("due-date-dialog")).toBeTruthy();
  expect(screen.getByRole("button", { name: /close date and time picker/i })).toBeTruthy();
  expect(screen.queryByTestId("due-date-popover")).toBeNull();
});
```

The dialog mock must expose `Dialog`, `DialogTrigger`, `DialogContent`, `DialogTitle`, and `DialogClose`. The close control calls `onOpenChange(false)`.

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
npm test -- src/routes/_layout/todos/-TodoDueDatePicker.test.tsx
```

Expected: failure because `presentation` and `#/components/ui/dialog` behavior do not exist.

- [ ] **Step 3: Add the project Dialog wrapper**

Create `src/components/ui/dialog.tsx` with the same wrapper pattern as `src/components/ui/sheet.tsx`.

```tsx
import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title className={cn("font-heading font-medium", className)} {...props} />;
}

function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          render={<Button type="button" variant="ghost" size="icon-sm" className="absolute right-2 top-2" />}
          aria-label="Close date and time picker"
        >
          <XIcon />
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger };
```

Keep the wrapper generic except for visual styling. If the close label must be generic, expose `closeLabel?: string` on `DialogContent` and pass `"Close date and time picker"` from the Todo picker.

- [ ] **Step 4: Refactor the due-date picker around installed primitives**

Add the presentation property:

```ts
export type TodoDueDatePickerPresentation = "popover" | "dialog";

export interface TodoDueDatePickerProps {
  // existing fields
  presentation?: TodoDueDatePickerPresentation;
}
```

Extract the existing `Calendar`, date input, time input, and Clear button into one local `DueDatePanel` component. It receives the current values and callback functions; it does not own separate date state.

Render the same trigger and panel through one of two installed Base UI primitives:

```tsx
if (presentation === "dialog") {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={renderTrigger()} />
      <DialogContent data-testid="due-date-dialog" aria-labelledby={titleId}>
        <DialogTitle id={titleId} className="sr-only">{label}</DialogTitle>
        {panel}
      </DialogContent>
    </Dialog>
  );
}

return (
  <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={renderTrigger()} />
    <PopoverContent
      data-testid="due-date-popover"
      aria-labelledby={titleId}
      className="w-auto p-0"
      align="end"
    >
      <PopoverTitle id={titleId} className="sr-only">{label}</PopoverTitle>
      {panel}
    </PopoverContent>
  </Popover>
);
```

Do not copy the date conversion logic into each branch.

- [ ] **Step 5: Run the focused tests and make them pass**

Run:

```bash
npm test -- src/routes/_layout/todos/-TodoDueDatePicker.test.tsx
```

Expected: all due-date picker tests pass, including date typing, time typing, calendar selection, Clear, Escape, popover presentation, and dialog presentation.

- [ ] **Step 6: Commit the standard overlay work**

```bash
git add src/components/ui/dialog.tsx \
  src/routes/_layout/todos/-TodoDueDatePicker.tsx \
  src/routes/_layout/todos/-TodoDueDatePicker.test.tsx
git commit -m "refactor: standardize Todo date overlays"
```

---

### Task 2: Make all new Todos Low and simplify the inline form

**Files:**
- Modify: `src/routes/_layout/todos/-AddTodoRow.tsx`
- Modify: `src/routes/_layout/todos/-TodoBoard.tsx`
- Test: `src/routes/_layout/todos/-AddTodoRow.test.tsx`

**Interfaces:**
- Consumes: `TodoDueDatePicker presentation="dialog"` from Task 1.
- Produces: `AddTodoRowProps` with only `onCreate` and optional `compact`.
- Preserves: `onCreate` payload shape, with `priority` fixed to `"low"`.

- [ ] **Step 1: Replace priority-control tests with fixed-Low tests**

Remove tests that click or escape from the High checkbox. Update the expanded-form test:

```tsx
it("shows only the name, calendar, and Add controls", () => {
  renderExpanded();
  expect(screen.getByRole("textbox", { name: /new todo name/i })).toBeTruthy();
  expect(screen.getByRole("button", { name: /choose date and time/i })).toBeTruthy();
  expect(screen.getByRole("button", { name: /^add$/i })).toBeTruthy();
  expect(screen.queryByRole("checkbox", { name: /high priority/i })).toBeNull();
});
```

Keep the existing low-priority submission test. Add a compact grid assertion:

```tsx
expect(controls?.className).toContain("grid-cols-[minmax(5rem,1fr)_auto_auto]");
expect(controls?.className).not.toContain("sm:grid-cols");
expect(addButton.className).not.toContain("col-span");
```

Update the date-picker mock path so the add-form test observes the dialog presentation from Task 1. Remove the duplicated final compact-state describe block.

- [ ] **Step 2: Run the add-row tests and confirm failure**

Run:

```bash
npm test -- src/routes/_layout/todos/-AddTodoRow.test.tsx
```

Expected: failures because the High checkbox and `defaultPriority` state still exist.

- [ ] **Step 3: Remove priority state and use the dialog date picker**

In `-AddTodoRow.tsx`:

```tsx
export interface AddTodoRowProps {
  onCreate: (fields: {
    name: string;
    priority: "high" | "low";
    due_date: string | null;
    due_date_has_time: boolean;
  }) => void;
  compact?: boolean;
}
```

Delete the `Check` and `TodoPriority` imports, `defaultPriority`, `priority` state, checkbox markup, and priority reset. Submit this exact field:

```ts
priority: "low",
```

Use the approved three-control compact grid:

```tsx
compact
  ? "grid grid-cols-[minmax(5rem,1fr)_auto_auto] gap-1 px-2 py-1 sm:py-0"
  : "flex gap-2 px-4"
```

Use the centered presentation:

```tsx
<TodoDueDatePicker
  presentation="dialog"
  value={dueDate}
  onChange={handleDueDateChange}
  label="Choose date and time"
  compact={compact}
  showValue={false}
/>
```

Remove the obsolete column-span classes from the Add button.

- [ ] **Step 4: Remove the obsolete board property**

Change the board call to:

```tsx
<AddTodoRow compact={compact} onCreate={controller.create} />
```

Do not change `handleDragEnd`; it already calls `controller.move(active.id, targetPriority, targetIndex)` and remains the only priority promotion path.

- [ ] **Step 5: Run the focused Todo form and board tests**

Run:

```bash
npm test -- \
  src/routes/_layout/todos/-AddTodoRow.test.tsx \
  src/routes/_layout/todos/-TodoBoard.test.tsx
```

Expected: all selected tests pass, and new Todo payloads always contain `priority: "low"`.

- [ ] **Step 6: Commit the fixed-Low form**

```bash
git add src/routes/_layout/todos/-AddTodoRow.tsx \
  src/routes/_layout/todos/-AddTodoRow.test.tsx \
  src/routes/_layout/todos/-TodoBoard.tsx
git commit -m "feat: default new Todos to low priority"
```

---

### Task 3: Tighten compact Todo row geometry

**Files:**
- Modify: `src/routes/_layout/todos/-TodoRow.tsx`
- Test: `src/routes/_layout/todos/-TodoRow.test.tsx`

**Interfaces:**
- Preserves all `TodoRowProps` and callbacks.
- Produces the compact geometry `1rem + 0.125rem + 2.75rem + 0.125rem`, with 4 px row padding.

- [ ] **Step 1: Change the compact geometry test first**

Replace the current compact class checks with:

```tsx
expect(row.className).toContain("grid-cols-[1rem_2.75rem_minmax(0,1fr)_auto]");
expect(row.className).toContain("gap-0.5");
expect(row.className).toContain("px-1");
expect(dragControl.className).toContain("w-4");
expect(dragControl.className).not.toContain("w-6");
```

Keep assertions that the drag grip is first, status is second, the name can truncate, the grip is focusable, and coarse-pointer visibility works.

- [ ] **Step 2: Run the row test and confirm failure**

Run:

```bash
npm test -- src/routes/_layout/todos/-TodoRow.test.tsx
```

Expected: the new compact geometry assertions fail against the 24 px grip, 4 px gap, and 8 px padding.

- [ ] **Step 3: Apply the approved compact classes**

Change only the compact row classes:

```tsx
compact
  ? "grid grid-cols-[1rem_2.75rem_minmax(0,1fr)_auto] gap-0.5 px-1"
  : "flex gap-1 px-4"
```

Change the drag button width to `w-4` while keeping `h-11`, its focus ring, cursor behavior, opacity behavior, and accessible label. Use `GripVertical className="size-3.5"` if the 16 px column clips the current icon.

- [ ] **Step 4: Run the row test and make it pass**

Run:

```bash
npm test -- src/routes/_layout/todos/-TodoRow.test.tsx
```

Expected: all row tests pass.

- [ ] **Step 5: Commit the row-density change**

```bash
git add src/routes/_layout/todos/-TodoRow.tsx \
  src/routes/_layout/todos/-TodoRow.test.tsx
git commit -m "style: tighten compact Todo rows"
```

---

### Task 4: Integration review and repository verification

**Files:**
- Review: all files changed in Tasks 1 through 3
- Modify: only changed files if verification finds a concrete defect

**Interfaces:**
- Consumes all prior task outputs.
- Produces one reviewed, formatted, test-passing branch ready to publish.

- [ ] **Step 1: Verify that related overlays use one platform**

Run:

```bash
rg -n "@base-ui/react/(dialog|popover)|react-day-picker|TodoDueDatePicker" \
  src/components src/routes/_layout/todos package.json
```

Expected:

- `dialog.tsx` and `sheet.tsx` wrap Base UI Dialog.
- `popover.tsx` wraps Base UI Popover.
- `calendar.tsx` wraps React DayPicker.
- Todo date UI imports only the project wrappers.
- No new overlay or calendar dependency appears.

- [ ] **Step 2: Format and inspect the diff**

Run:

```bash
npm run fmt
git diff --check
git diff --stat origin/v1...HEAD
git status --short
```

Expected: no formatting errors or whitespace errors; only planned source, test, and design/plan files differ.

- [ ] **Step 3: Run static checks**

Run:

```bash
npm run fmt:check
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 4: Run all tests and the production build**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and Vite produces a production build.

- [ ] **Step 5: Run two-stage review and fix confirmed findings**

First review the implementation against `docs/superpowers/specs/2026-08-10-todo-density-calendar-center-design.md`. Then run a code-quality review. For each confirmed finding, add or update a failing test before changing source, rerun focused tests, and rerun the checks from Steps 2 through 4.

- [ ] **Step 6: Commit verification fixes if needed**

```bash
git add src docs/superpowers
git commit -m "fix: address Todo dialog review findings"
```

Skip this commit when review requires no changes.

---

### Task 5: Publish, deploy, and verify the live UI

**Files:**
- No planned source changes

**Interfaces:**
- Consumes the verified feature branch.
- Produces a merged change and a healthy live deployment.

- [ ] **Step 1: Push the feature branch and open a pull request**

Push `agent/todo-density-calendar-center` and open a PR to `v1`. The PR summary must state:

- new Todos always start Low
- dragging remains the promotion path
- Todo rows use tighter compact spacing
- the add calendar uses centered Base UI Dialog and existing React DayPicker
- full test, lint, format, and build results

- [ ] **Step 2: Check required CI**

Wait for required GitHub Actions checks. If a check fails, inspect its logs and fix only confirmed repository failures. Ignore unrelated Cloudflare status checks only if they are not required for merge and this repository no longer deploys through Cloudflare.

- [ ] **Step 3: Merge the pull request**

Use the repository's normal merge method after required checks pass.

- [ ] **Step 4: Verify GitOps deployment state**

Confirm that the merged `v1` commit reaches the image workflow, GHCR tag, Argo CD application, and the live dum-dashboard workload. Record the deployed commit or image tag.

- [ ] **Step 5: Verify the live desktop UI without data mutation**

At `https://doh.lumilumi.xyz`:

- open the Overview Todo bento card
- confirm the High control is absent
- confirm the name field uses the freed width
- open the calendar and confirm it is centered in the viewport
- close it with Escape and confirm focus returns to the trigger
- confirm Todo names start closer to the left while the drag grip remains usable
- check the browser console for errors

Do not submit, complete, edit, delete, or drag a live Todo.

- [ ] **Step 6: Verify the 360 px layout without data mutation**

At a 360 px viewport:

- confirm the dialog has at least 16 px at both sides
- confirm there is no horizontal page scroll
- confirm the name, calendar, and Add controls remain usable
- confirm the calendar content stays inside the dialog

- [ ] **Step 7: Record final evidence**

Report the PR, merge commit, deployed revision, automated check results, and desktop/mobile browser findings.
