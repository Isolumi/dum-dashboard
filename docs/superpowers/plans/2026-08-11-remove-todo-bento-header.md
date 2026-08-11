# Remove the Todo Bento Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the visible header row from the Overview Todo bento card while preserving its accessible region name and all Todo behavior.

**Architecture:** Keep `TodoBentoCard` as the accessible card boundary and render `TodoBoard` directly in its padded content container. Remove only the header markup and its unused router dependency; do not change the Todo controller, board, rows, or full-page route.

**Tech Stack:** React, TypeScript, TanStack Router, Testing Library, Vitest, Tailwind CSS, Bun

## Global Constraints

- Keep the card section labeled with `aria-label="Todos"`.
- Keep the card border, background, radius, and current `p-2` content padding.
- Add no replacement label, icon, tooltip, or navigation control.
- Do not change Todo data, actions, drag-and-drop, or the `/todos` page.
- Do not merge or deploy without a separate user request.

---

### Task 1: Remove the Visible Header

**Files:**

- Modify: `src/routes/_layout/todos/-TodoBentoCard.test.tsx`
- Modify: `src/routes/_layout/todos/-TodoBentoCard.tsx`
- Modify: `docs/superpowers/specs/2026-08-11-remove-todo-bento-header-design.md`

**Interfaces:**

- Consumes: `TodoBoard`, `useTodoController`, and the existing `TodoBentoCard({ tool, data })` component contract.
- Produces: The same `TodoBentoCard` component contract with no visible header or card navigation link.

- [ ] **Step 1: Write the failing card-structure test**

Replace the existing test named `keeps only the Todos heading linked to the full page` with:

```tsx
it("removes the visible card header while keeping an accessible region name", () => {
  renderCard([]);

  const region = screen.getByRole("region", { name: "Todos" });
  expect(region.tagName).toBe("SECTION");
  expect(within(region).queryByRole("heading")).toBeNull();
  expect(within(region).queryByRole("link")).toBeNull();
  expect(screen.queryByText("Open full page")).toBeNull();
});
```

- [ ] **Step 2: Run the test and verify the red state**

Run:

```bash
bunx vitest run src/routes/_layout/todos/-TodoBentoCard.test.tsx
```

Expected: FAIL because the current card still contains the `Todos` heading and link.

- [ ] **Step 3: Remove the header markup**

Delete the `Link` import. Keep the existing controller setup and replace the returned markup with:

```tsx
return (
  <section aria-label="Todos" className="rounded-lg border border-border bg-card">
    <div className="p-2">
      <TodoBoard controller={controller} variant="compact" />
    </div>
  </section>
);
```

- [ ] **Step 4: Run the focused tests and verify the green state**

Run:

```bash
bunx vitest run \
  src/routes/_layout/todos/-TodoBentoCard.test.tsx \
  src/routes/_layout/-OverviewPage.test.tsx
```

Expected: both test files pass, including all existing compact Todo behavior tests.

- [ ] **Step 5: Update the design status**

Change the design status to:

```markdown
**Status:** Implemented; merge and deployment pending
```

- [ ] **Step 6: Run repository verification**

Run:

```bash
bunx vitest run
bun run lint
bun run fmt:check
bun run build
bun run build:gateway
git diff --check
```

Expected: 46 test files and 635 tests pass or increase, lint and formatting pass, both builds pass, and `git diff --check` prints no errors.

- [ ] **Step 7: Commit the implementation**

```bash
git add \
  src/routes/_layout/todos/-TodoBentoCard.test.tsx \
  src/routes/_layout/todos/-TodoBentoCard.tsx \
  docs/superpowers/specs/2026-08-11-remove-todo-bento-header-design.md
git commit -m "style: remove Todo bento header"
```
