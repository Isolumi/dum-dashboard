# Todo Row Density and High Checkbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the large empty area before each Todo name and replace the add form's Low/High slider with one compact High checkbox.

**Architecture:** Keep the existing Todo components and data contracts. Change only compact row sizing and the add form's priority control; priority remains the existing `"high" | "low"` state and submission payload.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide React, Vitest, Testing Library, Vite.

## Global Constraints

- Keep one drag handle at the far left.
- Use a 24 px drag column and a 44 px status column.
- Keep the drag handle 44 px tall and faintly visible at rest.
- Use one checkbox named `High priority`; unchecked means Low and checked means High.
- Put the word `High` inside the visible checkbox box.
- Do not add priority arrows, a Low label, or other row controls.
- Keep current Todo actions, dates, keyboard behavior, pending behavior, and form submission behavior.
- Keep the compact form free of horizontal overflow at 360 px.

---

### Task 1: Reduce the Todo row's leading space

**Files:**

- Modify: `src/routes/_layout/todos/-TodoRow.tsx`
- Test: `src/routes/_layout/todos/-TodoRow.test.tsx`

**Interfaces:**

- Consumes: `TodoRowProps` and existing DnD listeners.
- Produces: the same `TodoRow` interface with a 24 px drag control and unchanged Todo actions.

- [ ] **Step 1: Write the failing compact-row test**

Update the compact layout test to require the new grid and visible narrow handle:

```tsx
expect(row.className).toContain("grid-cols-[1.5rem_2.75rem_minmax(0,1fr)_auto]");
expect(dragControl.className).toContain("w-6");
expect(dragControl.className).toContain("opacity-40");
expect(dragControl.className).not.toContain("min-w-11");
expect(row.firstElementChild).toBe(dragControl);
expect(row.children[1]).toBe(statusControl);
```

This test catches a regression back to a hidden 44 px drag column.

- [ ] **Step 2: Run the test and verify the expected failure**

Run:

```bash
bunx vitest run --maxWorkers=2 src/routes/_layout/todos/-TodoRow.test.tsx
```

Expected: FAIL because the row still uses `2.75rem` for the drag column and the drag button still uses `min-w-11 opacity-0`.

- [ ] **Step 3: Implement the narrow visible drag handle**

Change the row layout to:

```tsx
compact
  ? "grid grid-cols-[1.5rem_2.75rem_minmax(0,1fr)_auto] gap-1 px-2"
  : "flex gap-1 px-4"
```

Change the drag button sizing and resting opacity to:

```tsx
className="h-11 w-6 min-w-0 shrink-0 cursor-grab rounded-md text-muted-foreground opacity-40 transition-opacity motion-reduce:transition-none group-hover:opacity-100 focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing disabled:cursor-default"
```

Do not change drag listeners, ordering, status behavior, or action controls.

- [ ] **Step 4: Run the Todo row tests**

Run:

```bash
bunx vitest run --maxWorkers=2 src/routes/_layout/todos/-TodoRow.test.tsx
```

Expected: all Todo row tests pass.

- [ ] **Step 5: Commit the row fix**

```bash
git add src/routes/_layout/todos/-TodoRow.tsx src/routes/_layout/todos/-TodoRow.test.tsx
git commit -m "fix: tighten Todo row drag spacing"
```

### Task 2: Replace the priority switch with a High checkbox

**Files:**

- Modify: `src/routes/_layout/todos/-AddTodoRow.tsx`
- Test: `src/routes/_layout/todos/-AddTodoRow.test.tsx`

**Interfaces:**

- Consumes: existing `priority: TodoPriority` state and `onCreate` payload.
- Produces: one accessible checkbox named `High priority`; checked maps to `"high"`, unchecked maps to `"low"`.

- [ ] **Step 1: Write failing checkbox behavior tests**

Replace switch queries with checkbox queries and require one compact visible box:

```tsx
const highCheckbox = screen.getByRole("checkbox", { name: /high priority/i });
const checkboxBox = highCheckbox.nextElementSibling;

expect(highCheckbox).not.toBeChecked();
expect(checkboxBox?.textContent).toContain("High");
expect(checkboxBox?.textContent).not.toContain("Low");
expect(checkboxBox?.getAttribute("data-slot")).toBe("priority-checkbox-box");

fireEvent.click(highCheckbox);
expect(highCheckbox).toBeChecked();
expect(checkboxBox?.querySelector('[data-slot="priority-checkbox-check"]')).toBeTruthy();
```

Update the high-priority submission and Escape-path tests to use `getByRole("checkbox", { name: /high priority/i })`.

- [ ] **Step 2: Run the add form tests and verify the expected failure**

Run:

```bash
bunx vitest run --maxWorkers=2 src/routes/_layout/todos/-AddTodoRow.test.tsx
```

Expected: FAIL because the control still has `role="switch"` and renders both Low and High labels.

- [ ] **Step 3: Implement the compact High checkbox**

Import `Check` from Lucide React. Replace the slider label with:

```tsx
<label className="relative inline-flex h-9 shrink-0 cursor-pointer items-center rounded-md">
  <input
    type="checkbox"
    aria-label="High priority"
    checked={priority === "high"}
    onChange={(event) => setPriority(event.target.checked ? "high" : "low")}
    className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
  />
  <span
    data-slot="priority-checkbox-box"
    className="inline-flex h-9 min-w-[3.75rem] items-center justify-center gap-1 rounded-md border border-border bg-muted/40 px-2 text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out motion-reduce:transition-none peer-focus-visible:ring-2 peer-focus-visible:ring-muted-foreground/40 peer-checked:border-primary/40 peer-checked:bg-primary/15 peer-checked:text-foreground"
  >
    <Check
      data-slot="priority-checkbox-check"
      className={cn(
        "size-3.5 transition-opacity duration-150 ease-out motion-reduce:transition-none",
        priority === "high" ? "opacity-100" : "opacity-0",
      )}
    />
    <span>High</span>
  </span>
</label>
```

Keep the current grid columns. The checkbox replaces the switch in the same `auto` column.

- [ ] **Step 4: Run add form and Todo card tests**

Run:

```bash
bunx vitest run --maxWorkers=2 \
  src/routes/_layout/todos/-AddTodoRow.test.tsx \
  src/routes/_layout/todos/-TodoBentoCard.test.tsx
```

Expected: all tests pass; Low remains the default submitted priority and checking High submits `priority: "high"`.

- [ ] **Step 5: Commit the checkbox change**

```bash
git add src/routes/_layout/todos/-AddTodoRow.tsx src/routes/_layout/todos/-AddTodoRow.test.tsx
git commit -m "style: use a compact High checkbox"
```

### Task 3: Verify, review, and deploy

**Files:**

- Verify all changed files.

**Interfaces:**

- Consumes: repository CI, GHCR workflow, deploy branch, and Argo CD application `dum-dashboard-dumachine`.
- Produces: merged PR, healthy live image, and desktop/mobile browser evidence.

- [ ] **Step 1: Run all local checks**

```bash
bunx vitest run --maxWorkers=2
bun run lint
bun run fmt:check
bunx tsc --noEmit
bun run build
git diff --check origin/v1...HEAD
```

Expected: 0 failed tests, 0 lint errors, correct formatting, successful type checking, and a successful production build.

- [ ] **Step 2: Review and publish**

Review the complete branch against the approved spec. Fix all Critical and Important findings. Push `agent/todo-row-density-checkbox`, open a PR to `v1`, wait for the required `verify` check, and squash-merge it.

- [ ] **Step 3: Verify deployment**

Wait for the `v1` release workflow. Confirm Argo CD is `Synced` and `Healthy`, both deployments use the merged commit image, and both pods are `1/1 Running` with zero restarts.

- [ ] **Step 4: Verify the live UI**

At `https://doh.lumilumi.xyz`, verify:

- the drag grip is faintly visible and directly beside the status circle;
- no 44 px empty drag slot remains;
- the add form has one checkbox box containing `High` and no Low label;
- checking the box changes its checkmark and tint without sliding;
- the calendar icon remains visible;
- desktop and 360 px layouts have no horizontal overflow;
- the browser console has zero errors and warnings.

Do not create, edit, delete, reorder, or submit a real Todo during browser verification.
