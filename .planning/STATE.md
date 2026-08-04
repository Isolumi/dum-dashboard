---
gsd_state_version: 1.0
milestone: v1
milestone_name: Personal Dashboard MVP
status: milestone_complete
stopped_at: v1 milestone complete — all 6 phases, 18 plans, 20 requirements shipped
last_updated: "2026-05-22"
last_activity: 2026-05-22
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 18
  completed_plans: 18
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-02)

**Core value:** A single place to see and manage all your personal tools — starting with todos, built to grow.
**Current focus:** v1 complete — planning next milestone

## Current Position

Phase: All complete (6/6)
Status: v1 milestone shipped 2026-04-02
Last activity: 2026-05-22 - Completed quick task 260522-calendar-token-vault: Secure server-side Google Calendar token refresh

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
| ----- | ----- | ----- | -------- |
| -     | -     | -     | -        |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

_Updated after each plan completion_
| Phase 01-foundation P01 | 9min | 2 tasks | 14 files |
| Phase 01-foundation P02 | 259s | 2 tasks | 6 files |
| Phase 02-route-shell-and-tool-registry P01 | 175s | 2 tasks | 11 files |
| Phase 02-route-shell-and-tool-registry P02 | 25min | 2 tasks | 5 files |
| Phase 03-supabase-data-layer P01 | 98 | 1 tasks | 4 files |
| Phase 03-supabase-data-layer P01 | 900 | 3 tasks | 5 files |
| Phase 03-supabase-data-layer P02 | 142 | 2 tasks | 2 files |
| Phase 04-todo-tool P01 | 396 | 2 tasks | 8 files |
| Phase 04-todo-tool P03 | 300 | 1 tasks | 1 files |
| Phase 04-todo-tool P02 | 129 | 1 tasks | 2 files |
| Phase 04-todo-tool P06 | 593 | 1 tasks | 3 files |
| Phase 03-supabase-data-layer PGAP | 252 | 3 tasks | 7 files |
| Phase 04-todo-tool P07 | 62 | 1 tasks | 1 files |
| Phase 04-todo-tool P08 | 94 | 1 tasks | 1 files |
| Phase 05-bento-overview-registration P01 | 163 | 2 tasks | 4 files |
| Phase 05-bento-overview-registration P02 | 1200 | 2 tasks | 4 files |
| Phase 06-realtime P01 | 149 | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- (decisions will be logged as phases execute)
- [Phase 01-foundation]: shadcn preset syntax: use -b base -p nova (not --preset base-nova which is invalid in CLI v4.1.1)
- [Phase 01-foundation]: CSS file at src/styles.css; theme.css adjacent at src/theme.css (not src/styles/ subdirectory)
- [Phase 01-foundation]: Dark-only :root in styles.css; scaffold demo CSS/components removed (FOUN-01/D-01 compliance)
- [Phase 01-foundation]: Wave 1 created complete token system; Wave 2 verified all 7 gates and ran oxfmt normalization
- [Phase 02-route-shell-and-tool-registry]: BentoCard typed as ComponentType<{ tool: ToolEntry }> for consistent prop contract
- [Phase 02-route-shell-and-tool-registry]: Overview nav item hardcoded (not in registry) — keeps registry clean for actual tools
- [Phase 02-route-shell-and-tool-registry]: tool.route cast as any for Link to prop — /todos route doesn't exist yet; typed safety deferred to Phase 4
- [Phase 02-route-shell-and-tool-registry]: Active sidebar item uses sidebar-primary (violet) not sidebar-accent (grey) — sidebar-primary is the brand violet token
- [Phase 02-route-shell-and-tool-registry]: Dev utility pages placed at \_layout/dev-\*.tsx — sidebar-wrapped but not in tool registry
- [Phase 03-supabase-data-layer]: zod pinned to v3 (^3.24.2) — @tanstack/zod-adapter peer requires ^3.23.8; v4 incompatible
- [Phase 03-supabase-data-layer]: supabase.ts import boundary: only \*.functions.ts files may import it — enforced by createServerFn compiler transform
- [Phase 03-supabase-data-layer]: zod pinned to v3 (^3.24.2) — @tanstack/zod-adapter@1.166.9 peer requires zod@^3.23.8; v4 breaks compatibility
- [Phase 03-supabase-data-layer]: supabase.ts import boundary: only \*.functions.ts files may import it — enforced by createServerFn compiler transform
- [Phase 03-supabase-data-layer]: Zod schemas exported from todos.functions.ts — enables direct unit testing without mocking createServerFn
- [Phase 03-supabase-data-layer]: Test file prefixed with - (-todos.functions.test.ts) — TanStack Router ignores files with - prefix, preventing spurious route warnings
- [Phase 04-todo-tool]: Todo route files in \_layout/todos/ (not todos/) for correct TanStack Router layout nesting
- [Phase 04-todo-tool]: todos.functions.ts stays in routes/todos/; component files import via #/routes/todos/todos.functions alias
- [Phase 04-todo-tool]: Alert variant=destructive for all error states per composition.md callout rule
- [Phase 04-todo-tool]: hover:bg-accent used instead of hover:bg-neutral-800 in AddTodoRow — FOUN-02 prohibits raw palette classes; semantic token maps to correct visual
- [Phase 04-todo-tool]: AddTodoRow PopoverTrigger uses render prop (base-ui) not asChild (Radix) — confirmed from base-vs-radix.md skill
- [Phase 04-todo-tool]: TodoRow files in \_layout/todos/ (not todos/) for correct TanStack Router layout nesting — confirmed by actual file structure
- [Phase 04-todo-tool]: base-ui render prop on PopoverTrigger (not asChild) confirmed working for priority dropdown
- [Phase 04-todo-tool]: Vitest dual-project config: unit tests (tanstackStart plugin, node env) + component tests (jsdom, no TanStack Start) to support both pure-function and React render tests
- [Phase 04-todo-tool]: AddTodoRow outer wrapper pattern: bg-accent/50 rounded-md outer div wraps both flex row and keyboard hint
- [Phase 04-todo-tool]: Supabase select() null guard: always apply data ?? [] when returning array results from server functions
- [Phase 03-GAP]: routeFileIgnorePattern belongs inside router: {} sub-object in tanstackStart(), not at top level — TypeScript declared it at TanStackStartInputConfig.router.routeFileIgnorePattern
- [Phase 03-GAP]: bun run test (vitest run) is the correct test command; bun test runs bun's native runner which does not support vitest test files
- [Phase 03-GAP]: Component files in routes/ should use - prefix to prevent TanStack Router from scanning them as route candidates; test file dynamic imports must be updated after component renames
- [Quick 260401-vj3]: supabase-admin.ts uses process.env (no VITE\_ prefix) for SUPABASE_SECRET_KEY — Vite never inlines it into the client bundle; crash-on-startup via ! assertion preferred over silent RLS bypass failure
- [Quick 260401-vj3]: supabase-admin.ts import boundary: only \*.functions.ts files may import it (mirrors existing supabase.ts constraint)
- [Phase 04-todo-tool]: useEffect([isExpanded]) with \!isExpanded guard handles both initial mount focus and post-resetForm focus in AddTodoRow
- [Phase 04-todo-tool]: Explicit dateTriggerRef on PopoverTrigger Button child required because base-ui render-prop doesn't participate in natural Tab order
- [Phase 04-todo-tool]: Use getByRole('button', { name: /select due date/i }) to query Calendar trigger — matches aria-label set on PopoverTrigger render-prop Button
- [Phase 05-bento-overview-registration]: BentoCard prop type now ComponentType<{ tool: ToolEntry; data: unknown }> to support data-carrying overview loader
- [Phase 05-bento-overview-registration]: TodoBentoCard attention row hidden from DOM when overdueCount=0 and highPriorityCount=0 (D-04)
- [Phase 05-bento-overview-registration]: Overview loader uses Promise.all over tools registry — parallel data fetch, null-coalesced for tools with no loadData
- [Phase 05-bento-overview-registration]: routeTree.gen.ts added to .prettierignore — oxfmt uses .prettierignore as ignore file; generated files must not be checked for format
- [Phase 06-realtime]: useRef (onEventRef) pattern for stable callback in useTodosRealtime -- prevents channel churn when TodosPage re-renders; empty deps [] ensures single-mount channel lifecycle
- [Phase 06-realtime]: LiveIndicator uses text-muted-foreground for dot and text in all states -- low-prominence informational indicator (violet reserved for interactive elements, destructive reserved for actual errors)

### Pending Todos

None yet.

### Blockers/Concerns

- oxfmt is beta-status: exact-pin version in package.json; keep Prettier as fallback. Validate in Phase 1 by running `oxfmt --check` on scaffolded project.
- RLS policy approach resolved: RLS enabled on todos table; server functions use supabaseAdmin (secret key) to bypass RLS — no per-user policies needed for this personal tool.

### Quick Tasks Completed

| #                           | Description                                                                   | Date       | Commit  | Directory                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------- | ---------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| 260329-3ht                  | Switch package manager from pnpm to bun                                       | 2026-03-29 | 473b214 | [260329-3ht-switch-package-manager-from-pnpm-to-bun](./quick/260329-3ht-switch-package-manager-from-pnpm-to-bun/)   |
| 260401-vj3                  | Add server-only Supabase admin client using SUPABASE_SECRET_KEY to bypass RLS | 2026-03-30 | 731fbf2 | [260401-vj3-add-server-only-supabase-admin-client-us](./quick/260401-vj3-add-server-only-supabase-admin-client-us/) |
| 260401-vuw                  | Change AddTodoRow default priority from medium to low                         | 2026-03-30 | dc54891 | [260401-vuw-addtodorow-default-priority-to-low-repla](./quick/260401-vuw-addtodorow-default-priority-to-low-repla/) |
| 260402-13d                  | AddTodoRow UI polish — name/date inputs get visible underline affordance      | 2026-03-30 | 88b17dd | [260402-13d-addtodorow-ui-polish-name-input-visible-](./quick/260402-13d-addtodorow-ui-polish-name-input-visible-/) |
| 260402-1a5                  | Todo page calendar popup for date input                                       | 2026-04-02 | d173f48 | [260402-1a5-todo-page-calendar-popup-for-date-input-](./quick/260402-1a5-todo-page-calendar-popup-for-date-input-/) |
| 260402-1gu                  | AddTodoRow name input modern Apple-style restyle                              | 2026-04-02 | 12c0935 | [260402-1gu-todo-page-addtodorow-text-input-modern-a](./quick/260402-1gu-todo-page-addtodorow-text-input-modern-a/) |
| 260402-tcs                  | Add Cloudflare Workers deployment support                                     | 2026-04-03 | cef3115 | [260402-tcs-add-cloudflare-workers-deployment-suppor](./quick/260402-tcs-add-cloudflare-workers-deployment-suppor/) |
| 260402-vav                  | Change tab name to Dumq and use public favicon                                | 2026-04-03 | de46269 | [260402-vav-change-the-tab-name-to-dumq-and-use-publ](./quick/260402-vav-change-the-tab-name-to-dumq-and-use-publ/) |
| 260402-vwa                  | Draggable priority-grouped todos with sort_order persistence                  | 2026-04-02 | 88ae608 | [260402-vwa-the-todos-should-be-draggable-and-reorde](./quick/260402-vwa-the-todos-should-be-draggable-and-reorde/) |
| 260522-calendar-token-vault | Secure server-side Google Calendar token refresh                              | 2026-05-22 | —       | [260522-calendar-token-vault](./quick/260522-calendar-token-vault/)                                                 |

## Session Continuity

Last session: 2026-04-02T00:00:00Z
Stopped at: Completed quick task 260402-vwa — Draggable priority-grouped todos (approved)
Resume file: None
