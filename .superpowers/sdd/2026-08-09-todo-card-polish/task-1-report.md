# Task 1 report: due_date server contract and Supabase migration

Date: 2026-08-09
Worktree: `/Users/isolumi/Documents/CS/dum-dashboard/.worktrees/homelab-dashboard`
Task: Task 1 only — due_date server contract and Supabase migration

## Files changed

- `src/routes/todos/-todos.functions.test.ts`
- `src/routes/todos/todos.functions.ts`
- `supabase/migrations/20260809000000_todo_due_datetime.sql`
- `src/lib/database.types.ts` was regenerated and verified, but no necessary change was kept
- `.superpowers/sdd/2026-08-09-todo-card-polish/task-1-report.md`

## RED

Command:

```bash
bunx vitest run src/routes/todos/-todos.functions.test.ts
```

Observed failure reason:

- `CreateTodoSchema > accepts an ISO timestamp with an offset for due_date`
- `UpdateTodoSchema > accepts an ISO timestamp in UpdateTodoSchema`
- Both failed with `expected false to be true` because the current schemas only accepted `z.string().date()` date-only values.

## GREEN

Schema change:

- Added shared `TodoDueDateSchema = z.union([z.string().date(), z.string().datetime({ offset: true })])`
- Used `TodoDueDateSchema.nullable().optional()` in both `CreateTodoSchema` and `UpdateTodoSchema`
- Preserved the public field name `due_date`
- Left priority, status, and all other validation unchanged

Command:

```bash
bunx vitest run src/routes/todos/-todos.functions.test.ts
```

Observed output:

- `✓ |unit| src/routes/todos/-todos.functions.test.ts (32 tests)`
- `Test Files  1 passed (1)`
- `Tests  32 passed (32)`

## Migration

Created:

- `supabase/migrations/20260809000000_todo_due_datetime.sql`

SQL summary:

- Converts `public.todos.due_date` from date to `timestamptz`
- Preserves null values
- Interprets existing date-only values as UTC midnight via `due_date::timestamp at time zone 'UTC'`
- Does not rename the column
- Does not change nullability
- Does not touch todo priority or status data

## Database type regeneration and verification

Command run exactly from the brief:

```bash
bunx supabase gen types typescript --linked > src/lib/database.types.ts
```

Verification:

- Confirmed `todos.Row.due_date`, `todos.Insert.due_date`, and `todos.Update.due_date` are still `string | null`
- The generator output introduced unrelated formatting/manual-alias churn, so no `src/lib/database.types.ts` change was kept in the final diff

## Final verification

Commands:

```bash
bunx vitest run src/routes/todos/-todos.functions.test.ts
git diff --check
```

Results:

- Focused todo server-function tests passed
- `git diff --check` returned clean
- Final diff scoped to the Task 1 schema tests, server schema change, and migration

## Commit

The final task commit hash is reported in the task handoff response. Embedding the post-amend final hash inside this committed report would change the commit hash again.
