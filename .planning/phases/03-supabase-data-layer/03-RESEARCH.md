# Phase 3: Supabase Data Layer - Research

**Researched:** 2026-03-29
**Domain:** Supabase JS client, TanStack Start server functions, Zod validation, TypeScript type generation
**Confidence:** HIGH

## Summary

Phase 3 is a pure data-layer phase: no UI, no route page. The work is installing two packages (`@supabase/supabase-js`, `zod`), adding a third (`@tanstack/zod-adapter`), configuring env vars, creating the Postgres schema in the hosted project, generating TypeScript types, and writing CRUD server functions. The decisions captured in CONTEXT.md are solid and match verified current APIs.

The key architectural constraint is **server-side isolation**: the Supabase client singleton must live in a file that only server functions import. TanStack Start's `createServerFn` compiler automatically strips handler implementations from client bundles and replaces them with RPC stubs — the isolation is compiler-enforced, not just convention. Keeping the singleton at `src/lib/supabase.ts` and importing it only from `*.functions.ts` files is sufficient.

**Primary recommendation:** Use `createServerFn({ method: 'POST' }).inputValidator(zodValidator(schema)).handler(async ({ data }) => {...})` for mutations, and `createServerFn({ method: 'GET' })` for reads. Use `@tanstack/zod-adapter`'s `zodValidator` wrapper to connect Zod schemas — do not pass Zod schemas raw to `.inputValidator()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Hosted Supabase project only — no local Supabase CLI, no Docker, no migrations. Dev and production both point at the same hosted cloud project via env vars.
- **D-02:** Project already exists — Phase 3 just configures `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. No project creation step needed.
- **D-03:** Disable RLS entirely on the `todos` table (`ALTER TABLE todos DISABLE ROW LEVEL SECURITY`). Personal no-auth tool — no sensitive data, no threat model.
- **D-04:** Priority and status stored as Postgres enums: `CREATE TYPE todo_priority AS ENUM ('high', 'medium', 'low')` and `CREATE TYPE todo_status AS ENUM ('not_started', 'started', 'complete')`.
- **D-05:** `due_date` stored as `DATE` (date only, no time). TODOV2-03 deferred.
- **D-06:** Full todos table schema:
  - `id` — `uuid` PRIMARY KEY DEFAULT `gen_random_uuid()`
  - `name` — `text NOT NULL`
  - `priority` — `todo_priority NOT NULL DEFAULT 'medium'`
  - `status` — `todo_status NOT NULL DEFAULT 'not_started'`
  - `due_date` — `date` (nullable)
  - `created_at` — `timestamptz NOT NULL DEFAULT now()`
- **D-07:** Server functions at `src/routes/todos/todos.functions.ts`.
- **D-08:** Supabase client singleton at `src/lib/supabase.ts` — imported by server functions only.
- **D-09:** Use `supabase gen types typescript --project-id <id> > src/lib/database.types.ts`.

### Claude's Discretion

- Exact Zod schema structure (one combined schema vs. separate per-operation schemas)
- Whether to export typed helper aliases (e.g., `type Todo = Database['public']['Tables']['todos']['Row']`)
- Error handling approach within server functions

### Deferred Ideas (OUT OF SCOPE)

- Local Supabase CLI / migration workflow
- Service role key server-side pattern
- `due_date` as TIMESTAMPTZ with time-of-day
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TODO-07 | Todo data is persisted to Supabase and survives page refresh | CRUD server functions + Supabase client. Persistence verified by Phase 4 loading todos via server function on route mount. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.100.1 | Postgres queries via REST/Realtime | Official Supabase JS client; no auth wrapper needed for this project |
| `zod` | 4.3.6 | Schema validation for server function inputs | CLAUDE.md-mandated; pairs with `.inputValidator()` via zod-adapter |
| `@tanstack/zod-adapter` | 1.166.9 | Bridges Zod schemas to TanStack's `inputValidator` API | Required adapter — raw Zod schemas cannot be passed directly |

Note: `@supabase/supabase-js` and `zod` are not yet in package.json. `@tanstack/zod-adapter` is also new. All three must be installed.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `supabase` (CLI, npx) | ≥1.8.1 | Type generation only — `npx supabase gen types` | One-off command; no local install required |

**Version verification (run against npm registry 2026-03-29):**
- `@supabase/supabase-js`: 2.100.1
- `zod`: 4.3.6
- `@tanstack/zod-adapter`: 1.166.9
- `vitest` (already installed in devDeps): 3.0.5

**Installation:**

```bash
bun add @supabase/supabase-js zod @tanstack/zod-adapter
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/supabase-js` direct | `@supabase/ssr` | `@supabase/ssr` is auth-focused cookie handling; unneeded here — CLAUDE.md explicitly forbids it |
| `@tanstack/zod-adapter` | Raw Zod in `.inputValidator()` | Raw Zod schemas fail type inference in `.inputValidator()` — adapter is required |

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── utils.ts          # existing — cn() helper
│   ├── supabase.ts       # NEW — Supabase client singleton (server-only)
│   └── database.types.ts # NEW — generated via `npx supabase gen types`
└── routes/
    └── todos/
        └── todos.functions.ts  # NEW — createServerFn CRUD wrappers
```

The `todos/` directory is created here without a page route; the index route arrives in Phase 4.

### Pattern 1: Supabase Client Singleton

**What:** A single `createClient<Database>()` call exported from `src/lib/supabase.ts`. Only imported by `*.functions.ts` files.

**When to use:** Always — one client per server process.

**Example:**
```typescript
// src/lib/supabase.ts
// Source: Supabase official docs — https://supabase.com/docs/reference/javascript/typescript-support
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
```

This file is safe to use with `VITE_` prefixed env vars because `createServerFn` handlers run on the server. The `VITE_SUPABASE_PUBLISHABLE_KEY` is the anon/publishable key (not a service role secret) — exposing it is acceptable per Supabase's design.

### Pattern 2: Typed Database Helper Aliases (Claude's discretion — recommended)

**What:** Export named helper types from `database.types.ts` so call sites avoid verbose `Database['public']['Tables']['todos']['Row']` paths.

**Example:**
```typescript
// src/lib/database.types.ts — add at bottom after generated content
// Source: https://supabase.com/docs/reference/javascript/typescript-support
import type { Database } from './database.types'

export type Todo = Database['public']['Tables']['todos']['Row']
export type TodoInsert = Database['public']['Tables']['todos']['Insert']
export type TodoUpdate = Database['public']['Tables']['todos']['Update']
export type TodoPriority = Database['public']['Enums']['todo_priority']
export type TodoStatus = Database['public']['Enums']['todo_status']
```

Alternatively these can live in `todos.functions.ts` co-located with the server functions.

### Pattern 3: createServerFn with Zod Validation

**What:** The standard pattern for typed, validated server functions.

**When to use:** All CRUD operations that accept client-supplied input.

**Example (create):**
```typescript
// src/routes/todos/todos.functions.ts
// Source: TanStack Start docs — https://deepwiki.com/TanStack/router/5.3-server-functions
import { createServerFn } from '@tanstack/react-start'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { supabase } from '#/lib/supabase'

const CreateTodoInput = z.object({
  name: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  status: z.enum(['not_started', 'started', 'complete']).default('not_started'),
  due_date: z.string().nullable().optional(), // ISO date string e.g. "2026-04-01"
})

export const createTodo = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(CreateTodoInput))
  .handler(async ({ data }) => {
    const { data: todo, error } = await supabase
      .from('todos')
      .insert(data)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return todo
  })
```

**Example (read all):**
```typescript
export const getTodos = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  })
```

**Calling from client/loader:**
```typescript
// In a route loader or component
const todos = await getTodos()

// With input — must pass as { data: ... }
const newTodo = await createTodo({ data: { name: 'Buy milk', priority: 'low' } })
```

### Pattern 4: TypeScript Type Generation

**What:** Run `npx supabase gen types` once against the hosted project to produce `src/lib/database.types.ts`.

**Command:**
```bash
npx supabase gen types typescript --project-id <SUPABASE_PROJECT_ID> > src/lib/database.types.ts
```

The `SUPABASE_PROJECT_ID` is the project reference (not the full URL) — found in the Supabase dashboard URL: `https://supabase.com/dashboard/project/<project-id>`.

**Generated structure for enums:**
```typescript
// Generated output for todo_priority and todo_status enums
export type Database = {
  public: {
    Tables: {
      todos: {
        Row: {
          id: string
          name: string
          priority: Database['public']['Enums']['todo_priority']
          status: Database['public']['Enums']['todo_status']
          due_date: string | null
          created_at: string
        }
        Insert: { /* non-generated columns, generated columns omitted */ }
        Update: { /* all optional */ }
      }
    }
    Enums: {
      todo_priority: 'high' | 'medium' | 'low'
      todo_status: 'not_started' | 'started' | 'complete'
    }
  }
}
```

Enums become TypeScript string literal unions — this is the "generated TypeScript types match the schema" success criterion.

### Anti-Patterns to Avoid

- **Importing `supabase.ts` from client components:** Supabase client would then appear in the client bundle. Only import from `*.functions.ts` server-side files.
- **Passing raw Zod schemas to `.inputValidator()`:** Type inference breaks. Always wrap with `zodValidator()` from `@tanstack/zod-adapter`.
- **Checking bundle isolation via source code grep:** Use `vite build` then inspect the output chunks in `dist/`. Search for `createClient` or `@supabase` strings in client JS files.
- **Creating enums after the table:** `CREATE TABLE` must reference enum types; create enums first in the SQL script.
- **Leaving RLS enabled with no policies:** Every query returns empty results. Per D-03, use `ALTER TABLE todos DISABLE ROW LEVEL SECURITY` explicitly after table creation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zod ↔ inputValidator bridging | Custom validation adapter | `zodValidator` from `@tanstack/zod-adapter` | Type inference relies on adapter shape |
| TypeScript ↔ DB type sync | Manual type files | `npx supabase gen types typescript` | Types drift with manual maintenance; generator is authoritative |
| Server/client code isolation | File naming conventions only | `createServerFn` compiler transform | TanStack Start strips handler code at build time — it's enforced, not assumed |
| UUID generation | `crypto.randomUUID()` in app code | `gen_random_uuid()` in Postgres DEFAULT | DB-level generation is atomic and consistent |

**Key insight:** The `createServerFn` compiler transform is the real isolation mechanism. Supabase imports inside a `.handler()` callback are stripped from the client bundle at build time. This is why the pattern works without any `server-only` package or special file naming.

## Common Pitfalls

### Pitfall 1: Missing VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY

**What goes wrong:** The `.env.local` currently only contains `VITE_SUPABASE_DATABASE_URL`. The `createClient()` call needs `VITE_SUPABASE_URL` (the REST API URL) and `VITE_SUPABASE_PUBLISHABLE_KEY` (the anon key) — not the Postgres connection string.

**Why it happens:** The Postgres connection string is for direct DB access (e.g., Drizzle, pg); the REST API URL is what `@supabase/supabase-js` uses.

**How to avoid:** Add both missing vars to `.env.local` before any code changes. Values are in the Supabase dashboard under Project Settings > API.

**Warning signs:** `createClient` throws or returns a client that errors on every query with 401/404.

### Pitfall 2: Raw Zod Schema in .inputValidator()

**What goes wrong:** TypeScript type errors, runtime validation failures, or silent no-op validation when a Zod schema is passed directly to `.inputValidator()` instead of via `zodValidator()`.

**Why it happens:** `.inputValidator()` expects a specific validator function shape; Zod objects don't implement it directly. Known GitHub issue #2759.

**How to avoid:** Always: `.inputValidator(zodValidator(myZodSchema))` with `zodValidator` from `@tanstack/zod-adapter`.

**Warning signs:** TypeScript errors on `data` type in handler, or input passes through unvalidated.

### Pitfall 3: Enum Order in SQL Script

**What goes wrong:** `CREATE TABLE todos` fails with "type does not exist" if enums are created after the table.

**Why it happens:** Postgres resolves type references at DDL execution time.

**How to avoid:** Always create enum types before the table that uses them in the SQL script.

**Warning signs:** Supabase SQL editor error: `type "todo_priority" does not exist`.

### Pitfall 4: Importing supabase.ts in Client Code

**What goes wrong:** The Supabase client and its deps appear in the client JS bundle, violating success criterion 3.

**Why it happens:** Any file imported by a route component (not via `createServerFn`) is included in the client bundle.

**How to avoid:** `src/lib/supabase.ts` must only be imported from `*.functions.ts` files. Never import it in route components, `__root.tsx`, or `_layout.tsx`.

**Warning signs:** `vite build` bundle contains `supabase`, `realtime-js`, or `createClient` strings in client JS files.

### Pitfall 5: oxfmt Formatting Failures on Generated File

**What goes wrong:** `database.types.ts` is generated by the Supabase CLI and may not pass `oxfmt --check` due to style differences (e.g., trailing commas, quote style).

**Why it happens:** The CLI outputs its own formatting that may not match oxfmt's defaults.

**How to avoid:** Run `oxfmt` on `database.types.ts` after generation. The file will be reformatted; commit the result.

**Warning signs:** `oxfmt --check` fails in CI after type regeneration.

### Pitfall 6: Zod v4 Compatibility with @tanstack/zod-adapter

**What goes wrong:** GitHub issue #6626 documents type errors when `z.looseObject()` (a Zod v4 pattern) is used as inputValidator — the inferred type includes `[x: string]: unknown` which conflicts with createServerFn internals.

**Why it happens:** Zod v4 changed some type shapes.

**How to avoid:** Use `z.object()` (not `z.looseObject()`) for server function inputs. `z.object()` works cleanly with `zodValidator`.

**Warning signs:** TypeScript error on `inputValidator` call mentioning `[x: string]: unknown`.

## Code Examples

### SQL: Create Enums and Table

```sql
-- Run in Supabase SQL Editor
-- Source: D-04, D-05, D-06 from CONTEXT.md

-- 1. Create enum types first
CREATE TYPE todo_priority AS ENUM ('high', 'medium', 'low');
CREATE TYPE todo_status AS ENUM ('not_started', 'started', 'complete');

-- 2. Create todos table
CREATE TABLE todos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  priority   todo_priority NOT NULL DEFAULT 'medium',
  status     todo_status NOT NULL DEFAULT 'not_started',
  due_date   date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Disable RLS (D-03)
ALTER TABLE todos DISABLE ROW LEVEL SECURITY;
```

### Bundle Isolation Verification

```bash
# Build the project
bun run build

# Search client chunks for Supabase-related strings
# (should return nothing)
grep -r "createClient\|@supabase\|realtime-js" dist/assets/*.js || echo "PASS: No Supabase in client bundle"
```

### Zod Schema Approach (Claude's Discretion — Recommendation)

Separate schemas per operation are cleaner for Phase 4 consumers:

```typescript
// Separate schemas — recommended
export const CreateTodoSchema = z.object({
  name: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low'] as const).default('medium'),
  status: z.enum(['not_started', 'started', 'complete'] as const).default('not_started'),
  due_date: z.string().date().nullable().optional(),
})

export const UpdateTodoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  priority: z.enum(['high', 'medium', 'low'] as const).optional(),
  status: z.enum(['not_started', 'started', 'complete'] as const).optional(),
  due_date: z.string().date().nullable().optional(),
})

export const DeleteTodoSchema = z.object({
  id: z.string().uuid(),
})
```

Using `as const` on enum arrays makes TypeScript infer the narrower literal union type.

### Error Handling Pattern (Claude's Discretion — Recommendation)

Throw on Supabase errors; let TanStack Start's error boundary handle them:

```typescript
.handler(async ({ data }) => {
  const { data: result, error } = await supabase.from('todos').insert(data).select().single()
  if (error) throw new Error(`Failed to create todo: ${error.message}`)
  return result
})
```

Do not swallow errors with `console.error` — thrown errors surface to the caller cleanly via the RPC mechanism.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/ssr` for server-side | `@supabase/supabase-js` direct (no auth) | N/A — `@supabase/ssr` was always auth-specific | No wrapper needed for personal tools |
| `zodValidator` from `@tanstack/router-zod-adapter` | `zodValidator` from `@tanstack/zod-adapter` | TanStack Start v1 era | Different package — use `@tanstack/zod-adapter` not the router-specific one |
| Vinxi-based server functions | `createServerFn` from `@tanstack/react-start` | TanStack Start v1.121.0 | Any docs mentioning Vinxi are outdated |
| Zod v3 raw in `.validator()` | `zodValidator()` adapter wrapping Zod v4 | Zod v4 release + zod-adapter alignment | Must use adapter |

**Deprecated/outdated:**
- `.validator()` (older API): Some older docs show `.validator()` instead of `.inputValidator()` — use `.inputValidator()` in current versions.
- `createServerFn` called as `createServerFn(method, handler)` (pre-builder API): Now uses builder pattern `.handler()`.

## Open Questions

1. **Supabase Project ID**
   - What we know: The hosted project exists (D-02); `.env.local` has `VITE_SUPABASE_DATABASE_URL` already.
   - What's unclear: The `VITE_SUPABASE_URL` (REST API URL) and `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key) still need to be added to `.env.local`. The planner should include a task step instructing the user to retrieve these from the Supabase dashboard.
   - Recommendation: Add a task step: "Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to `.env.local` from Supabase dashboard > Project Settings > API."

2. **Type generation without local CLI install**
   - What we know: `npx supabase gen types` works without a local install; it downloads on demand. Alternatively, types can be downloaded directly from the Supabase dashboard.
   - What's unclear: Whether the npx download works cleanly in this environment.
   - Recommendation: Primary path is `npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts`. Fallback: download JSON from Supabase dashboard and convert, or copy from dashboard's TypeScript types tab.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Bun/Vite build | ✓ | v25.8.2 | — |
| Bun | Package manager | ✓ | 1.3.11 | — |
| Supabase CLI | `gen types` command | ✗ | — | `npx supabase` (on-demand) or dashboard download |
| Hosted Supabase project | All CRUD | ✓ (D-02) | — | — |
| `@supabase/supabase-js` | Supabase client | ✗ (not installed) | — | Must install |
| `zod` | Input validation | ✗ (not installed) | — | Must install |
| `@tanstack/zod-adapter` | zodValidator | ✗ (not installed) | — | Must install |

**Missing dependencies with no fallback:**
- `@supabase/supabase-js`, `zod`, `@tanstack/zod-adapter` — must be installed via `bun add`
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` env vars — must be added to `.env.local` by the user

**Missing dependencies with fallback:**
- Supabase CLI: `npx supabase` works without local install; dashboard type download is a secondary fallback

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.0.5 (installed in devDeps) |
| Config file | None — vitest resolves via vite.config.ts |
| Quick run command | `bun run test` |
| Full suite command | `bun run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TODO-07 | Supabase client initializes with env vars | unit | `vitest run src/lib/supabase.test.ts` | ❌ Wave 0 |
| TODO-07 | CRUD server functions return correct shapes | manual-only | Manual: `bun run dev`, call functions via browser console or test script | — |
| TODO-07 | No Supabase strings in client bundle | smoke | `bun run build && grep -r "createClient" dist/assets/*.js` | ❌ Wave 0 |

**Note on manual-only:** Server functions require a running TanStack Start server and live Supabase connection — unit testing them in isolation requires mocking the Supabase client. For this phase, manual testing via a simple test script is the success criterion; Supabase mock integration tests can be deferred to Phase 4.

### Sampling Rate

- **Per task commit:** `bun run test` (fast — vitest)
- **Per wave merge:** `bun run test && bun run build` (includes bundle check)
- **Phase gate:** Full suite green + manual CRUD verification before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/supabase.test.ts` — covers TODO-07 (client init, env var presence)
- [ ] `vitest.config.ts` or `vite.config.ts` vitest block — no vitest config detected; needs `test: { environment: 'node' }` block for server-side tests

*(If vitest config is added inline to `vite.config.ts`, the TanStack Start `tanstackStart()` plugin may conflict. A standalone `vitest.config.ts` is recommended.)*

## Sources

### Primary (HIGH confidence)
- `CLAUDE.md` §Technology Stack — locked stack, env var names, `createServerFn` pattern, no `@supabase/ssr`
- Supabase JS docs — https://supabase.com/docs/reference/javascript/typescript-support — `createClient<Database>()` API, `Tables`/`Enums` helpers
- Supabase type generation docs — https://supabase.com/docs/guides/api/rest/generating-types — `npx supabase gen types typescript --project-id` command, npx support
- TanStack Start server functions (DeepWiki mirror) — https://deepwiki.com/TanStack/router/5.3-server-functions — complete `createServerFn` builder API, Zod adapter pattern, bundle isolation mechanism
- Supabase TanStack Start quickstart — https://supabase.com/docs/guides/getting-started/quickstarts/tanstack — `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` env var names, `src/utils/supabase.ts` pattern

### Secondary (MEDIUM confidence)
- Mintlify TanStack docs mirror — https://www.mintlify.com/TanStack/router/start/react/server-functions — `.inputValidator(zodValidator(schema)).handler(async ({ data }) => {})` with `{ data }` destructuring
- WebSearch: @tanstack/zod-adapter npm — version 1.166.9 confirmed, `zodValidator` named export
- WebSearch: TanStack Start bundle isolation — compiler replaces handler with RPC stub; server code removed from client bundle

### Tertiary (LOW confidence)
- WebSearch: Zod v4 compatibility with zod-adapter (issue #6626) — `z.object()` not `z.looseObject()` recommendation; unverified against latest adapter version

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry confirms all versions; CLAUDE.md mandates the packages
- Architecture: HIGH — verified against official Supabase docs and TanStack Start docs mirror
- createServerFn API: HIGH — multiple sources confirm `.inputValidator(zodValidator()).handler({ data })` pattern
- Bundle isolation: HIGH — compiler-enforced per TanStack Start docs; confirmed by import-protection plugin description
- Pitfalls: MEDIUM-HIGH — most verified from GitHub issues or official docs; Zod v4 issue is LOW (single source)

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (stable libraries; zod-adapter and zod v4 compatibility worth re-checking if issues arise)
