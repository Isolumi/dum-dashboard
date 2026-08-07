# Todo Overview Card Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard Todo bento card a complete inline Todo editor and reduce priority to High and Low while migrating existing Medium data to Low.

**Architecture:** Extract the full page's state and mutation behavior into a reusable `useTodoController` hook, then render both the bento card and full page through a shared `TodoBoard`. Existing row and section components gain compact variants and a High/Low priority control. A transactional Supabase migration moves Medium rows, rebuilds the enum, and changes the database default to Low.

**Tech Stack:** React 19, TypeScript, TanStack Start, Vitest, Testing Library, Supabase/PostgreSQL, dnd-kit, Tailwind CSS, GitHub Actions, Argo CD.

## Global Constraints

- The bento card must support create, status cycling, rename, priority changes, due dates, delete, and drag reorder without navigation.
- Priority must be exactly `high | low`; existing `medium` rows migrate to `low` without data loss.
- Medium rows append after existing Low rows while preserving their relative order.
- New Todos default to Low unless created from the High section.
- The bento card keeps a bounded height and scrolls internally.
- Both Todo surfaces use shared interaction and mutation code.
- Mutations are optimistic, roll back on failure, and cannot be overwritten by stale polling responses.
- Preserve keyboard access, 44px touch targets, visible focus, and reduced-motion behavior.

---

### Task 1: Replace Medium priority in validation, types, grouping, and the database

**Files:**
- Create via CLI: `supabase/migrations/*_remove_medium_todo_priority.sql`
- Modify: `src/lib/database.types.ts`
- Modify: `src/routes/todos/todos.functions.ts`
- Modify: `src/routes/todos/-todos.functions.test.ts`
- Modify: `src/routes/_layout/todos/-todoUtils.ts`
- Test: `src/routes/_layout/todos/-todoUtils.test.ts`

**Interfaces:**
- Produces: `TodoPriority = "high" | "low"` through generated database types.
- Produces: `PRIORITY_ORDER = ["high", "low"]` and `groupAndSortTodos(todos)` returning High and Low groups only.
- Produces: create/update schemas that reject `medium` and default creates to `low`.

- [ ] **Step 1: Write failing validation and grouping tests**

Update schema tests to assert the new contract:

```ts
it("uses default priority of low when omitted", () => {
  const result = CreateTodoSchema.safeParse({ name: "Test todo" });
  expect(result.success).toBe(true);
  if (result.success) expect(result.data.priority).toBe("low");
});

it("rejects the retired medium priority", () => {
  expect(CreateTodoSchema.safeParse({ name: "Test", priority: "medium" }).success).toBe(false);
  expect(UpdateTodoSchema.safeParse({ id: TODO_ID, priority: "medium" }).success).toBe(false);
});
```

Create utility tests that use only High and Low and assert completed items still sort after active items.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
bunx vitest run src/routes/todos/-todos.functions.test.ts src/routes/_layout/todos/-todoUtils.test.ts
```

Expected: failures because Medium is still accepted/defaulted and the priority order still contains Medium.

- [ ] **Step 3: Create the migration file with the current Supabase CLI**

Run:

```bash
bunx supabase migration new remove_medium_todo_priority
```

Use the exact emitted file under `supabase/migrations/`; do not invent a timestamped filename manually.

- [ ] **Step 4: Implement the transactional migration**

Put this SQL in the generated migration:

```sql
begin;

alter table public.todos alter column priority drop default;

with low_max as (
  select coalesce(max(sort_order), -1) as value
  from public.todos
  where priority = 'low'
),
medium_order as (
  select
    id,
    row_number() over (order by sort_order, created_at, id) - 1 as offset
  from public.todos
  where priority = 'medium'
)
update public.todos as todo
set
  priority = 'low',
  sort_order = low_max.value + 1 + medium_order.offset
from low_max, medium_order
where todo.id = medium_order.id;

alter type public.todo_priority rename to todo_priority_old;
create type public.todo_priority as enum ('high', 'low');

alter table public.todos
  alter column priority type public.todo_priority
  using priority::text::public.todo_priority;

alter table public.todos
  alter column priority set default 'low'::public.todo_priority;

drop type public.todo_priority_old;

notify pgrst, 'reload schema';

commit;
```

- [ ] **Step 5: Implement the TypeScript priority contract**

Change generated enum declarations/constants, Zod schemas, labels, groups, and explicit function argument types from `high | medium | low` to `high | low`. Default `CreateTodoSchema.priority` to `low`.

- [ ] **Step 6: Run focused tests and type checking through the production build**

Run:

```bash
bunx vitest run src/routes/todos/-todos.functions.test.ts src/routes/_layout/todos/-todoUtils.test.ts
bun run build
```

Expected: focused tests and build pass with no TypeScript reference to Todo Medium priority.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations src/lib/database.types.ts src/routes/todos src/routes/_layout/todos/-todoUtils.ts src/routes/_layout/todos/-todoUtils.test.ts
git commit -m "feat: simplify todo priorities"
```

---

### Task 2: Extract the reusable optimistic Todo controller

**Files:**
- Create: `src/routes/_layout/todos/-useTodoController.ts`
- Test: `src/routes/_layout/todos/-useTodoController.test.tsx`
- Modify: `src/routes/_layout/todos/index.tsx`

**Interfaces:**
- Consumes: `Todo`, `TodoPriority`, `getTodos`, `createTodo`, `updateTodo`, `deleteTodo`, and `reorderTodos`.
- Produces:

```ts
export interface TodoController {
  todos: Todo[];
  grouped: Record<TodoPriority, Todo[]>;
  status: "loading" | "ready" | "error";
  loadError: string | null;
  mutationError: string | null;
  retry(): Promise<void>;
  create(fields: { name: string; priority: TodoPriority; due_date: string | null }): Promise<void>;
  update(fields: TodoUpdateFields): Promise<void>;
  remove(id: string): Promise<void>;
  reorder(priority: TodoPriority, orderedIds: string[]): Promise<void>;
}

export type TodoUpdateFields = {
  id: string;
  name?: string;
  priority?: TodoPriority;
  status?: TodoStatus;
  due_date?: string | null;
};

export function useTodoController(initialTodos?: Todo[]): TodoController;
```

- [ ] **Step 1: Write failing controller tests**

Use `renderHook` and mocked server functions to prove:

```ts
it("uses initial todos without showing a loading state", () => {
  const { result } = renderHook(() => useTodoController([highTodo]));
  expect(result.current.status).toBe("ready");
  expect(result.current.todos).toEqual([highTodo]);
});

it("rolls an optimistic update back when the server rejects it", async () => {
  vi.mocked(updateTodo).mockRejectedValueOnce(new Error("offline"));
  const { result } = renderHook(() => useTodoController([highTodo]));
  await act(() => result.current.update({ id: highTodo.id, status: "complete" }));
  expect(result.current.todos[0]?.status).toBe("not_started");
  expect(result.current.mutationError).toMatch(/save failed/i);
});
```

Add tests for create, delete, reorder, retry after load failure, server-returned update replacement, and polling skipped while a mutation is in flight.

- [ ] **Step 2: Run controller tests and verify RED**

Run:

```bash
bunx vitest run src/routes/_layout/todos/-useTodoController.test.tsx
```

Expected: module-not-found failure for `-useTodoController`.

- [ ] **Step 3: Implement the minimal controller**

Move the full page's state, refs, polling, optimistic mutation logic, and error timers into `useTodoController`. Track an in-flight mutation count in a ref; background refreshes may fetch during a mutation but must not call `setTodos` until the count returns to zero. Replace optimistic create/update records with the server-returned Todo on success.

- [ ] **Step 4: Refactor the full page to consume the controller without changing its UI**

Replace local state and handlers in `index.tsx` with:

```ts
const controller = useTodoController();
```

Pass `controller.create`, `controller.update`, `controller.remove`, and `controller.reorder` to the existing sections. Preserve loading and error rendering.

- [ ] **Step 5: Run focused controller and full-page tests**

```bash
bunx vitest run src/routes/_layout/todos/-useTodoController.test.tsx src/routes/_layout/todos
```

Expected: all Todo tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/_layout/todos
git commit -m "refactor: share todo state management"
```

---

### Task 3: Add shared High/Low inline row controls and compact layout support

**Files:**
- Modify: `src/routes/_layout/todos/-TodoRow.tsx`
- Create: `src/routes/_layout/todos/-TodoRow.test.tsx`
- Modify: `src/routes/_layout/todos/-AddTodoRow.tsx`
- Modify: `src/routes/_layout/todos/-AddTodoRow.test.tsx`
- Modify: `src/routes/_layout/todos/-PrioritySection.tsx`
- Create: `src/routes/_layout/todos/-PrioritySection.test.tsx`

**Interfaces:**
- Produces: `TodoRowProps.compact?: boolean`.
- Produces: `AddTodoRowProps.compact?: boolean`.
- Produces: `PrioritySectionProps.compact?: boolean`.
- Todo priority controls call `onUpdate({ id, priority })` with the opposite High/Low value.

- [ ] **Step 1: Write failing interaction tests**

Add row tests that click status, rename, priority, due date, and delete controls and assert exact callbacks. Add compact tests that verify controls remain accessible by role and the row uses compact typography/padding without reducing the 44px minimum height.

Example priority assertion:

```ts
await user.click(screen.getByRole("button", { name: /change .* priority to low/i }));
expect(onUpdate).toHaveBeenCalledWith({ id: highTodo.id, priority: "low" });
```

Update add-row tests to assert only High and Low appear in the selector.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
bunx vitest run src/routes/_layout/todos/-TodoRow.test.tsx src/routes/_layout/todos/-AddTodoRow.test.tsx src/routes/_layout/todos/-PrioritySection.test.tsx
```

Expected: failures because the priority control and compact props do not exist and Medium is still expected by old tests.

- [ ] **Step 3: Implement High/Low priority switching**

Add a compact labeled priority button to each row. Its label must communicate both current and next state, for example `Change "Deploy app" priority to Low`. Keep color as a secondary cue: High uses destructive styling and Low uses muted styling.

- [ ] **Step 4: Implement compact variants**

Use `compact` only for spacing and typography. Keep the same component tree and callbacks across both modes. The compact card may hide controls until hover/focus on pointer devices, but every control must become visible through `focus-within` and remain reachable by keyboard.

- [ ] **Step 5: Run the focused interaction tests**

```bash
bunx vitest run src/routes/_layout/todos/-TodoRow.test.tsx src/routes/_layout/todos/-AddTodoRow.test.tsx src/routes/_layout/todos/-PrioritySection.test.tsx
```

Expected: all focused interaction tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/_layout/todos
git commit -m "feat: add compact todo editing controls"
```

---

### Task 4: Build the shared Todo board

**Files:**
- Create: `src/routes/_layout/todos/-TodoBoard.tsx`
- Test: `src/routes/_layout/todos/-TodoBoard.test.tsx`
- Modify: `src/routes/_layout/todos/index.tsx`

**Interfaces:**
- Consumes: `TodoController` from `-useTodoController`.
- Produces:

```ts
export interface TodoBoardProps {
  controller: TodoController;
  variant: "compact" | "full";
}

export function TodoBoard(props: TodoBoardProps): React.ReactElement;
```

- [ ] **Step 1: Write failing shared-board tests**

Test that both variants always render High and Low sections, including empty sections with add rows. Test that compact mode has a bounded scroll region and full mode does not. Test that load failure exposes a Retry button wired to `controller.retry` and mutation failure renders the compact/full error treatment.

- [ ] **Step 2: Run board tests and verify RED**

```bash
bunx vitest run src/routes/_layout/todos/-TodoBoard.test.tsx
```

Expected: module-not-found failure for `-TodoBoard`.

- [ ] **Step 3: Implement the shared board**

Render `PRIORITY_ORDER.map(...)` into shared `PrioritySection` components. Use `variant === "compact"` to select bounded scrolling and compact child props. Keep loading skeletons and errors within the board boundary.

- [ ] **Step 4: Replace the full page's section markup with `TodoBoard`**

The page retains its `Todos` heading and max-width layout, then renders:

```tsx
<TodoBoard controller={controller} variant="full" />
```

- [ ] **Step 5: Run Todo tests**

```bash
bunx vitest run src/routes/_layout/todos
```

Expected: all Todo component and page tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/_layout/todos
git commit -m "feat: share todo board across dashboard views"
```

---

### Task 5: Turn the bento card into the complete inline editor

**Files:**
- Modify: `src/routes/_layout/todos/-TodoBentoCard.tsx`
- Modify: `src/routes/_layout/todos/-TodoBentoCard.test.tsx`

**Interfaces:**
- Consumes: `useTodoController(initialTodos)` and `<TodoBoard variant="compact" />`.
- The card root is a neutral container, not a link.
- The only navigation element is a header link labeled `Open full page` pointing to `/todos`.

- [ ] **Step 1: Rewrite bento tests for the interactive contract**

Mock the controller's server functions and assert:

```ts
expect(screen.queryByLabelText("Open Todos tool")).toBeNull();
expect(screen.getByRole("link", { name: /open full page/i }).getAttribute("href")).toBe("/todos");
```

Add tests that perform every action from the rendered card: create, status cycle, rename, priority switch, due-date update, delete, and reorder. Assert none of these interactions navigate to `/todos`.

- [ ] **Step 2: Run bento tests and verify RED**

```bash
bunx vitest run src/routes/_layout/todos/-TodoBentoCard.test.tsx
```

Expected: failures because the whole card is still a read-only link and has no mutation controls.

- [ ] **Step 3: Implement the interactive card shell**

Replace the outer `Link` with a bordered `section`. Add a compact header with `Todos` and `Open full page`. Initialize `useTodoController` from preloaded array data when present and render `<TodoBoard controller={controller} variant="compact" />`.

- [ ] **Step 4: Run bento and full-page tests**

```bash
bunx vitest run src/routes/_layout/todos
```

Expected: all Todo tests pass and no card action is nested inside a navigation link.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_layout/todos
git commit -m "feat: make todo bento card fully interactive"
```

---

### Task 6: Apply the migration, run complete verification, publish, and deploy

**Files:**
- Verify all files changed in Tasks 1-5.
- Update generated deployment artifacts only through the existing GitHub Actions workflow.

**Interfaces:**
- Consumes: protected `v1` workflow and Argo application `dum-dashboard-dumachine`.
- Produces: live Supabase enum `high | low` and live dashboard image tagged with the merged `v1` commit.

- [ ] **Step 1: Run local verification**

```bash
bun run test
bun run lint
bun run fmt:check
bash scripts/check-readonly-rbac.sh
bash -n scripts/check-tailnet-boundary.sh
bun run build
bun run build:gateway
git diff --check
```

Expected: every command exits zero.

- [ ] **Step 2: Validate and apply the Supabase migration immediately before application deployment**

Discover the installed CLI commands first:

```bash
bunx supabase db lint --help
bunx supabase db push --help
bunx supabase db query --help
```

Verify the linked project's pending migration set before changing the remote database:

```bash
bunx supabase migration list --linked
bunx supabase db push --linked --dry-run
bunx supabase db push --linked
```

Do not use `--include-all`; the remote migration history must agree with the repository before the
new migration is applied. Then run this exact verification query through the linked Management API:

```sql
select priority, count(*) from public.todos group by priority order by priority;
select enumlabel
from pg_enum
join pg_type on pg_type.oid = pg_enum.enumtypid
where pg_type.typname = 'todo_priority'
order by enumsortorder;
```

Expected: only `high` and `low` rows exist, and the enum labels are exactly `high`, `low`. Existing Medium rows appear in Low.

Run it with:

```bash
bunx supabase db query --linked "select priority, count(*) from public.todos group by priority order by priority; select enumlabel from pg_enum join pg_type on pg_type.oid = pg_enum.enumtypid where pg_type.typname = 'todo_priority' order by enumsortorder;"
```

- [ ] **Step 3: Push the branch and open a ready PR to `v1`**

```bash
git push -u origin agent/todo-overhaul
gh pr create --base v1 --head agent/todo-overhaul --title "Overhaul inline Todo dashboard" --body "Make the dashboard Todo card a complete inline editor, share its controller and board with the full page, migrate Medium priorities to Low, and restrict priority to High or Low. Includes focused interaction, migration-contract, rollback, complete test, lint, build, and security-boundary verification."
```

- [ ] **Step 4: Wait for required checks, merge, and monitor deployment**

```bash
gh pr checks --watch --interval 10
gh pr merge --squash
DEPLOY_RUN_ID="$(gh run list --workflow build-images.yml --branch v1 --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run watch "$DEPLOY_RUN_ID" --interval 10 --exit-status
```

Expected: `verify`, `build-and-push`, and `update-tags` succeed.

- [ ] **Step 5: Force an Argo refresh if the deploy revision remains stale, then verify rollout**

```bash
ssh dumachine 'kubectl -n argocd annotate app dum-dashboard-dumachine argocd.argoproj.io/refresh=hard --overwrite'
ssh dumachine 'kubectl -n dum-dashboard rollout status deployment/dum-dashboard --timeout=120s'
ssh dumachine 'kubectl -n argocd get app dum-dashboard-dumachine -o custom-columns=SYNC:.status.sync.status,HEALTH:.status.health.status,REV:.status.sync.revision'
curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' https://doh.lumilumi.xyz
```

Expected: rollout succeeds, Argo reports `Synced Healthy`, and the URL returns HTTP 200.

- [ ] **Step 6: Verify live Todo behavior**

In the Tailscale-only dashboard card, create a temporary Low Todo, rename it, move it to High, set and clear a due date, cycle status, drag reorder, and delete it. Confirm the full Todo page reflects each mutation and no Medium priority appears.
