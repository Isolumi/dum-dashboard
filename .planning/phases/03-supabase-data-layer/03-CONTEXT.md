# Phase 3: Supabase Data Layer - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Install `@supabase/supabase-js` and `zod`, configure the Supabase connection via env vars, define the `todos` table schema in the hosted Supabase project, generate TypeScript types from the schema, and expose typed CRUD operations via `createServerFn` wrappers with Zod input validation — all server-side. No UI, no route page.

Requirements in scope: TODO-07

</domain>

<decisions>
## Implementation Decisions

### Supabase Dev Setup

- **D-01:** Hosted Supabase project only — no local Supabase CLI, no Docker, no migrations. Dev and production both point at the same hosted cloud project via env vars.
- **D-02:** Project already exists — Phase 3 just configures `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. No project creation step needed.

### RLS Policy

- **D-03:** Disable RLS entirely on the `todos` table (`ALTER TABLE todos DISABLE ROW LEVEL SECURITY`). Personal no-auth tool — no sensitive data, no threat model. Do not leave RLS enabled with no policies defined (STATE.md blocker resolved).

### Schema Design

- **D-04:** Priority and status stored as Postgres enums:
  - `CREATE TYPE todo_priority AS ENUM ('high', 'medium', 'low')`
  - `CREATE TYPE todo_status AS ENUM ('not_started', 'started', 'complete')`
  - DB enforces valid values; `supabase gen types` produces literal union types in TypeScript.
- **D-05:** `due_date` stored as `DATE` (date only, no time). Matches v1 requirement. TODOV2-03 (time-of-day) deferred — migration to TIMESTAMPTZ is trivial if needed later.
- **D-06:** Full todos table schema:
  - `id` — `uuid` PRIMARY KEY DEFAULT `gen_random_uuid()`
  - `name` — `text NOT NULL`
  - `priority` — `todo_priority NOT NULL DEFAULT 'medium'`
  - `status` — `todo_status NOT NULL DEFAULT 'not_started'`
  - `due_date` — `date` (nullable — no due date means NULL)
  - `created_at` — `timestamptz NOT NULL DEFAULT now()`

### Server Function File Layout

- **D-07:** Server functions live at `src/routes/todos/todos.functions.ts` per the CLAUDE.md pattern (`src/routes/<tool-name>/<tool>.functions.ts`). The `todos/` directory is created in Phase 3 (without the page route, which arrives in Phase 4).
- **D-08:** Supabase client singleton at `src/lib/supabase.ts` — imported by server functions only. Never imported in client components (ensures Supabase helpers stay server-side, satisfying success criterion 3).

### TypeScript Types

- **D-09:** Use `supabase gen types typescript --project-id <id> > src/lib/database.types.ts` to generate the type file. This gives a `Database` type with table row types and enum unions derived from the actual schema — the "generated TypeScript types match the schema" success criterion.

### Claude's Discretion

- Exact Zod schema structure (one combined schema vs. separate per-operation schemas)
- Whether to export typed helper aliases (e.g., `type Todo = Database['public']['Tables']['todos']['Row']`)
- Error handling approach within server functions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack Reference
- `CLAUDE.md` §Technology Stack — `@supabase/supabase-js` direct (no `@supabase/ssr`), `zod` for `.inputValidator()`, `createServerFn` pattern, env var naming (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`)
- `CLAUDE.md` §What NOT to Use — `@supabase/ssr` (only needed for auth), no hardcoded colour values

### Phase Constraints (inherited)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-01 (dark mode only), D-05 (Tailwind `@theme` tokens)
- `.planning/phases/02-route-shell-and-tool-registry/02-CONTEXT.md` — tool registry contract, `src/tools/registry.ts` structure

### Requirements
- `.planning/REQUIREMENTS.md` §Todo Tool — TODO-07 (persisted to Supabase, survives page refresh)
- `.planning/ROADMAP.md` §Phase 3 — success criteria (CRUD via createServerFn, data persists, no Supabase in client bundle)

No external ADRs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/utils.ts` — `cn()` utility (class merging); not directly relevant but available
- `src/tools/registry.ts` — todos entry exists with `route: '/todos'`; Phase 3 creates `src/routes/todos/` directory

### Established Patterns
- `createFileRoute` used in every route file — server functions in `todos.functions.ts` use `createServerFn` (not `createFileRoute`)
- `src/styles.css` holds the Tailwind `@theme` colour token system — no colour tokens needed in Phase 3 (data layer only)
- oxfmt for formatting — all generated/written files must pass `oxfmt --check`

### Integration Points
- `src/routes/todos/todos.functions.ts` — created in Phase 3, imported by Phase 4's todo page
- `src/lib/supabase.ts` — Supabase client singleton; imported only from server function files
- `src/lib/database.types.ts` — generated type file; imported by supabase.ts and todos.functions.ts

</code_context>

<specifics>
## Specific Ideas

- Enum value casing: snake_case for multi-word values (`not_started`, `not_started`) matches Postgres convention and the generated TypeScript literals.

</specifics>

<deferred>
## Deferred Ideas

- Local Supabase CLI / migration workflow — explicitly deferred (D-01); revisit if project needs schema versioning in future
- Service role key server-side pattern — not needed without auth; would add complexity for no benefit in v1
- `due_date` as TIMESTAMPTZ with time-of-day — deferred to TODOV2-03

</deferred>

---

*Phase: 03-supabase-data-layer*
*Context gathered: 2026-03-29*
