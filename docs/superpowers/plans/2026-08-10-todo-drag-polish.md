# Todo Drag and Input Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Todos move within and between High and Low by drag-and-drop, then polish the handle, add form, and priority switch.

**Architecture:** Move DnD Kit ownership from each priority section to `TodoBoard`, while each section remains a sortable and droppable container. Add one optimistic controller operation for cross-priority movement, and keep presentation changes inside `TodoRow` and `AddTodoRow`.

**Tech Stack:** React 19, TypeScript, DnD Kit, Tailwind CSS, Vitest, Testing Library, TanStack Start, Supabase.

## Global Constraints

- Use `.yml` for YAML files. This change does not add YAML.
- Keep High and Low as the only Todo priorities.
- Do not add priority arrow or text controls to Todo rows.
- Keep keyboard drag support and visible keyboard focus.
- Disable switch motion when `prefers-reduced-motion` is active.
- Do not create, edit, or delete live Todo data during browser verification.

---

### Task 1: Board-level drag and cross-priority persistence

**Files:**

- Modify: `src/routes/_layout/todos/-TodoBoard.tsx`
- Modify: `src/routes/_layout/todos/-PrioritySection.tsx`
- Modify: `src/routes/_layout/todos/-useTodoController.ts`
- Test: `src/routes/_layout/todos/-TodoBoard.test.tsx`
- Test: `src/routes/_layout/todos/-PrioritySection.test.tsx`
- Test: `src/routes/_layout/todos/-useTodoController.test.tsx`

**Interfaces:**

- Consumes: `TodoController.grouped`, `TodoController.reorder(priority, orderedIds)`, DnD Kit `DragEndEvent`.
- Produces: `TodoController.move(id, targetPriority, targetIndex): Promise<void>` and priority container ids `priority-high` and `priority-low`.

- [ ] **Step 1: Write failing board tests**

Add tests that send a drag-end event from a High Todo to a Low Todo and expect:

```ts
expect(controller.move).toHaveBeenCalledWith(highTodo.id, "low", 0);
```

Add a same-section case and expect the existing reorder contract:

```ts
expect(controller.reorder).toHaveBeenCalledWith("high", [second.id, first.id]);
```

- [ ] **Step 2: Write a failing controller test**

Call the wished-for operation and assert the immediate grouped state:

```ts
act(() => {
  mutation = result.current.move(first.id, "low", 0);
});
expect(result.current.grouped.low.map((todo) => todo.id)).toEqual([first.id, lowTodo.id]);
```

Reject persistence and assert that both priority and order return to the original values.

- [ ] **Step 3: Run focused tests and confirm RED**

Run:

```bash
bun run test -- src/routes/_layout/todos/-TodoBoard.test.tsx src/routes/_layout/todos/-PrioritySection.test.tsx src/routes/_layout/todos/-useTodoController.test.tsx
```

Expected: failures because `move` does not exist and the two separate `DndContext` instances cannot report a cross-section drop.

- [ ] **Step 4: Implement one board-level drag context**

In `TodoBoard`, create pointer and keyboard sensors and handle drag end by finding the source Todo and destination Todo or priority container. Call `reorder` for the same priority and `move` for a different priority.

In `PrioritySection`, remove its `DndContext`, add `useDroppable({ id: \`priority-${priority}\` })`, keep one `SortableContext`, and pass the priority in sortable metadata.

- [ ] **Step 5: Implement optimistic `move` persistence**

Add this controller method:

```ts
move(id: string, targetPriority: TodoPriority, targetIndex: number): Promise<void>;
```

Build normalized source and target arrays, update `todosRef` immediately, then call `updateTodo` with the moved priority and sort order plus `reorderTodos` with the affected ids. On failure, restore the captured Todo array and show `REORDER_ERROR`.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run the same focused command. Expected: all selected tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/routes/_layout/todos/-TodoBoard.tsx src/routes/_layout/todos/-PrioritySection.tsx src/routes/_layout/todos/-useTodoController.ts src/routes/_layout/todos/-TodoBoard.test.tsx src/routes/_layout/todos/-PrioritySection.test.tsx src/routes/_layout/todos/-useTodoController.test.tsx
git commit -m "feat: drag Todos between priorities"
```

### Task 2: Left drag handle and remove priority controls

**Files:**

- Modify: `src/routes/_layout/todos/-TodoRow.tsx`
- Test: `src/routes/_layout/todos/-TodoRow.test.tsx`
- Test: `src/routes/_layout/todos/-TodoBentoCard.test.tsx`

**Interfaces:**

- Consumes: existing `TodoRowProps.dragListeners` and `dragDisabled`.
- Produces: one left-side drag handle with `aria-label="Drag to move <name>"`; no row priority button.

- [ ] **Step 1: Write failing row tests**

Assert that the drag handle occurs before the status control in DOM order for compact and full rows. Assert that no button name starts with `Change` for priority.

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
bun run test -- src/routes/_layout/todos/-TodoRow.test.tsx src/routes/_layout/todos/-TodoBentoCard.test.tsx
```

Expected: failures because compact mode still puts the handle in the right hover actions and renders a priority arrow.

- [ ] **Step 3: Implement the left handle**

Render one small handle before the status button in both variants. Remove `ArrowUp`, `ArrowDown`, all `PRIORITY_*` maps, and both priority buttons. Keep delete in compact hover actions and keep due-date controls unchanged.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run the same focused command. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_layout/todos/-TodoRow.tsx src/routes/_layout/todos/-TodoRow.test.tsx src/routes/_layout/todos/-TodoBentoCard.test.tsx
git commit -m "refactor: simplify Todo row actions"
```

### Task 3: Full-width add input and animated priority switch

**Files:**

- Modify: `src/routes/_layout/todos/-AddTodoRow.tsx`
- Test: `src/routes/_layout/todos/-AddTodoRow.test.tsx`

**Interfaces:**

- Consumes: existing `AddTodoRow` form state and native checkbox switch.
- Produces: a compact desktop grid without a blank first column and a 200 ms reduced-motion-aware switch animation.

- [ ] **Step 1: Write failing presentation tests**

Assert that compact expanded mode does not render an `aria-hidden` spacer and uses the desktop columns:

```text
sm:grid-cols-[minmax(5rem,1fr)_auto_auto_auto]
```

Assert that track, labels, and thumb contain `duration-200`, `ease-out`, and motion-reduction classes. Assert that both Low and High labels stay mounted so opacity can animate.

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
bun run test -- src/routes/_layout/todos/-AddTodoRow.test.tsx
```

Expected: failures because the blank `2.75rem` column remains and only one priority label is mounted.

- [ ] **Step 3: Implement the form and motion changes**

Remove the compact spacer and its column. Keep the narrow three-column layout and full-width second-row Add button. Render fixed Low and High labels and animate their opacity while the thumb and track use a 200 ms ease-out transition.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run the same focused command. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_layout/todos/-AddTodoRow.tsx src/routes/_layout/todos/-AddTodoRow.test.tsx
git commit -m "style: polish Todo add controls"
```

### Task 4: Full verification, linked migration, and live deployment

**Files:**

- Verify all changed files.

**Interfaces:**

- Consumes: repository CI, linked Supabase project, GHCR build workflow, Argo CD application `dum-dashboard-dumachine`.
- Produces: verified remote migration `20260810214100`, merged PR, healthy live image, and browser evidence.

- [ ] **Step 1: Run all local checks**

```bash
bun run test
bun run lint
bun run fmt:check
bunx tsc --noEmit
bun run build
git diff --check origin/v1...HEAD
```

Expected: every command exits zero.

- [ ] **Step 2: Apply and verify the atomic move migration on the linked Supabase project**

Do this before the branch is pushed, merged, or deployed. Confirm the pending set, apply only the
repository migration history, and confirm that `20260810214100_atomic_todo_priority_move.sql` is
recorded remotely:

```bash
bunx supabase migration list --linked
bunx supabase db push --linked --dry-run
bunx supabase db push --linked
bunx supabase migration list --linked
```

Do not use `--include-all`. In the final migration list, version `20260810214100` must appear in both
the Local and Remote columns. Then verify the function and its execution grants without changing Todo
data:

```bash
bunx supabase db query --linked "select p.proname, pg_get_function_identity_arguments(p.oid) as arguments, has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute, has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'move_todo_between_priorities';"
```

Expected: one `move_todo_between_priorities` row with arguments `uuid, todo_priority, uuid[], uuid[]`;
`service_role_execute` is true; `authenticated_execute` and `anon_execute` are false. Stop before
publish or merge if migration application or either verification fails.

- [ ] **Step 3: Review and publish**

Review the complete diff, push `agent/todo-drag-polish`, open a PR to `v1`, wait for the required check, and squash-merge it.

- [ ] **Step 4: Verify deployment**

Wait for the build workflow and Argo CD. Confirm `dum-dashboard-dumachine` is `Synced` and `Healthy`, the deployment uses the merged commit image, and the pod is ready.

- [ ] **Step 5: Verify the live UI**

At `https://doh.lumilumi.xyz`, verify desktop and 360 px mobile layouts, the left drag handle, no priority arrow controls, the full-width input, switch transition styles, no horizontal overflow, and no console errors. Do not submit or move a real Todo during this read-only browser check.
