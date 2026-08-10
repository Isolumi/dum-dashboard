# Todo Card Layout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Overview Todo card content-sized, left-aligned, and calm while preserving the complete inline Todo workflow.

**Architecture:** Keep the existing `TodoBoard`, `PrioritySection`, and `AddTodoRow` boundaries. Fix card height at the Overview grid boundary, reduce compact-only insets inside the Todo components, and separate initial render from focus restoration inside `AddTodoRow`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, TanStack Router, Vitest, Testing Library, Playwright CLI.

## Global Constraints

- Do not add dependencies.
- Preserve all Todo actions and data contracts.
- Keep High and Low as muted grouped sections.
- Use a native checkbox switch with `role="switch"` and a moving circular thumb.
- Use the existing Lucide calendar icon through `TodoDueDatePicker`.
- Do not focus the collapsed Add row on the initial page render.
- Restore Add-row focus after a user cancels or completes an opened form.

---

### Task 1: Stop card stretching and reduce compact insets

**Files:**

- Modify: `src/routes/_layout/index.tsx`
- Modify: `src/routes/_layout/todos/-PrioritySection.tsx`
- Modify: `src/routes/_layout/todos/-TodoRow.tsx`
- Modify: `src/routes/_layout/todos/-AddTodoRow.tsx`
- Test: `src/routes/_layout/index.test.tsx`
- Test: `src/routes/_layout/todos/-PrioritySection.test.tsx`
- Test: `src/routes/_layout/todos/-TodoRow.test.tsx`
- Test: `src/routes/_layout/todos/-AddTodoRow.test.tsx`

**Interfaces:**

- `OverviewPage` keeps the current two-column responsive structure.
- Compact Todo rows use `grid-cols-[2.25rem_minmax(0,1fr)_auto]`.
- Compact add rows use `grid-cols-[2.25rem_minmax(0,1fr)]`.
- Compact section labels use left padding that matches the Todo-name column.

- [ ] **Step 1: Write failing layout tests**

Add assertions that the Overview grid contains `items-start`, compact rows use a
`2.25rem` leading column, and section labels use the matching compact inset.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
bunx vitest run src/routes/_layout/index.test.tsx src/routes/_layout/todos/-PrioritySection.test.tsx src/routes/_layout/todos/-TodoRow.test.tsx src/routes/_layout/todos/-AddTodoRow.test.tsx
```

Expected: assertions fail because the grid stretches and compact controls use a
`2.75rem` leading column with a `3.75rem` section inset.

- [ ] **Step 3: Implement the compact layout**

Add `items-start` to the Overview grid. Change only compact component classes to
the `2.25rem` leading column, 8px horizontal padding, and the matching section
heading inset. Preserve 44px interactive targets inside the smaller visual
column.

- [ ] **Step 4: Run focused layout tests and verify GREEN**

Run the command from Step 2. Expected: all focused layout tests pass.

### Task 2: Correct Add-row focus and polish the switch

**Files:**

- Modify: `src/routes/_layout/todos/-AddTodoRow.tsx`
- Test: `src/routes/_layout/todos/-AddTodoRow.test.tsx`

**Interfaces:**

- `AddTodoRow` props and submitted data remain unchanged.
- The collapsed row is not focused on mount.
- A user-triggered close restores focus after the collapsed row renders.
- The switch remains a native checkbox and exposes `High priority`.

- [ ] **Step 1: Write failing focus and switch tests**

Add one test that renders the collapsed row and asserts it is not the active
element. Add one test that opens and cancels the form and asserts focus returns
to the collapsed row. Assert the switch track contains a circular thumb and the
Lucide calendar trigger remains present.

- [ ] **Step 2: Run the Add-row tests and verify RED**

Run:

```bash
bunx vitest run src/routes/_layout/todos/-AddTodoRow.test.tsx
```

Expected: the initial-focus test fails because the current effect focuses the
collapsed row immediately.

- [ ] **Step 3: Implement explicit focus restoration**

Replace the render-state focus effect with a `restoreFocusRef`. Set it only when
a user closes or submits the expanded form. After the collapsed row renders,
focus it once and clear the flag. Use neutral compact focus classes for the
form input, keep a visible keyboard outline, and refine the existing switch
track/thumb without changing its semantics.

- [ ] **Step 4: Run Add-row tests and verify GREEN**

Run the command from Step 2. Expected: all Add-row tests pass.

### Task 3: Verify, review, and deploy

**Files:**

- No planned source files. Change only a verified regression found below.

**Interfaces:**

- The deployed app remains at `https://doh.lumilumi.xyz`.
- The existing GitHub Actions, GHCR, deploy branch, and Argo CD flow remain
  unchanged.

- [ ] **Step 1: Run complete local verification**

Run:

```bash
bun run test
bun run lint
bun run fmt:check
bunx tsc --noEmit
bun run build
git diff --check
```

Expected: all commands exit with status 0.

- [ ] **Step 2: Verify the real UI locally**

Run the app and use Playwright at desktop and 360px widths. Confirm content
height, left alignment, no initial Add-row focus, keyboard focus visibility,
switch movement, calendar icon rendering, and zero console warnings or errors.

- [ ] **Step 3: Review and publish**

Inspect the final diff, commit the source change, push the branch, open a pull
request to `v1`, wait for required checks, merge, and wait for the image and
GitOps deployment workflows.

- [ ] **Step 4: Verify the deployed page**

Check the live page at desktop and 360px widths. Confirm the deployed image,
Argo CD sync and health, Todo behavior, and browser console output before
reporting completion.
