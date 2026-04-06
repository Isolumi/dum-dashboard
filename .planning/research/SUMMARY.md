# Project Research Summary

**Project:** dum-dashboard (personal dashboard / modular tool aggregator)
**Domain:** Personal dashboard — todo-first, bento grid overview, extensible tool registry
**Researched:** 2026-03-28
**Confidence:** HIGH

## Executive Summary

This is a personal dashboard built on TanStack Start v1 with a modular "tool registry" architecture: each tool (starting with a todo list) is a self-contained vertical slice that self-registers into a central registry, which drives both sidebar navigation and the bento-grid overview page without any additional wiring. The recommended stack is fully locked: TanStack Start 1.167+ (Vite-native, file-based routing, type-safe server functions), React 19, Tailwind v4 (CSS-first config via `@theme`), shadcn/ui (CLI-managed, Tailwind v4-aware), Supabase (Postgres + Realtime), and OXC tooling (oxlint stable v1, oxfmt beta). All technologies are current-version and compatible with each other as of March 2026.

The recommended approach follows a strict dependency chain: establish the colour token system and Supabase schema before writing any UI; build the route shell and tool registry before the first tool; wire realtime as a layer on top of working CRUD. Features are deliberately scoped: a three-state status enum (not started / started / complete) and bento summary cards are the meaningful differentiators over commodity todo apps. Everything else — subtasks, tags, drag-and-drop, notifications, mobile layout — is explicitly deferred to v2+. The MVP is tight: Supabase schema, full CRUD on todos, a bento overview card, sidebar navigation, and the tool registry pattern in place.

The primary risks are all architectural defaults that are easy to get wrong at setup time: server code leaking into the client bundle (mitigated by the `.functions.ts` / `.server.ts` file-suffix convention), realtime subscription leaks (mitigated by `removeChannel` cleanup in every `useEffect`), and hardcoded colour values in components (mitigated by defining all colours as CSS custom properties before touching any component code). All three risks are preventable at the foundation phase with no recovery cost. The one tooling risk is oxfmt's beta status — exact-pin the version in `package.json` and fall back to Prettier if instability appears.

---

## Key Findings

### Recommended Stack

The entire stack is already decided and fully compatible. TanStack Start v1 (currently 1.167.13) migrated from Vinxi to Vite in v1.121.0; any documentation referencing Vinxi is outdated. React 19 is required — React 18 is not supported. Tailwind v4's configuration is CSS-first; there is no `tailwind.config.js`. The shadcn/ui CLI handles Tailwind v4 `@theme inline` setup automatically when initialised with `-t start`. Animation support comes from `tw-animate-css` (not the deprecated `tailwindcss-animate`).

See `.planning/research/STACK.md` for full version table, installation commands, and alternatives considered.

**Core technologies:**

- `@tanstack/react-start` ^1.167.13: full-stack meta-framework — file-based routing, SSR, type-safe `createServerFn` RPC
- `tailwindcss` ^4.2.2: utility CSS with CSS-first config (`@theme` block in CSS, not `tailwind.config.js`)
- `@shadcn/ui` (CLI-managed): accessible component library, fully updated for Tailwind v4 and React 19
- `@supabase/supabase-js` ^2.100.1: Postgres + WebSocket-based Realtime; no auth wrapper needed for a personal app
- `@tanstack/react-query` ^5.95.0: client cache and background refetch; pairs with `createServerFn` for the fetcher
- `oxlint` ^1.x (stable): production-ready linting, 500+ rules, replaces ESLint
- `oxfmt` (beta): fast formatter with built-in Tailwind class sorting — pin exact version, keep Prettier as fallback
- `zod` ^3.x: validates `createServerFn` inputs and Supabase insert/update payloads

### Expected Features

The MVP is small and well-defined. All P1 features fit in a single focused build sprint.

See `.planning/research/FEATURES.md` for full feature table, dependency graph, and competitor analysis.

**Must have (table stakes):**

- Todo CRUD: create, view list, inline edit, delete — single `todos` Supabase table
- Status toggle (not started / started / complete) — three-state enum, quick-action UX
- Priority field (high / medium / low) and due date field on every todo
- Supabase realtime sync — changes persist live without page reload
- Bento overview card: todo counts by status + overdue/high-priority highlights
- Sidebar navigation: overview + todo page links
- Tool registry pattern: `registry.ts` drives both sidebar and bento overview; must be in place before the first tool is built
- Colour palette as single source of truth: all tokens in `theme.css`, zero hardcoded values

**Should have (competitive, v1.x):**

- Keyboard shortcuts for task entry (Enter to save, Escape to cancel)
- Sort/filter within the todo list (by priority, due date, status)
- Visual overdue indicator per-item (not just on bento card)
- Bulk complete / bulk delete

**Defer (v2+):**

- Second tool (habit tracker, notes, etc.)
- Mobile-optimised layout
- Offline / service worker support
- Push notifications / reminders
- Subtasks, tags, drag-and-drop reordering, recurring tasks, collaboration

### Architecture Approach

The architecture is a vertical-slice tool system wrapped in a single TanStack Start shell. A pathless `_app.tsx` layout route provides the sidebar + Outlet without adding a URL prefix. Each tool lives in `src/tools/<tool-name>/` and owns its page component, bento widget, `createServerFn` wrappers (`*.functions.ts`), and Supabase query helpers (`*.server.ts`). Tools register in `src/tools/registry.ts`; the sidebar and overview page both read from this registry — tools are discovered in both places by a single registration. All colour tokens live in `src/styles/theme.css`; no colour values appear anywhere else.

See `.planning/research/ARCHITECTURE.md` for full directory structure, code examples, and data flow diagrams.

**Major components:**

1. `__root.tsx` — document shell, global providers (QueryClientProvider, etc.)
2. `_app.tsx` (pathless layout) — sidebar + Outlet; wraps all dashboard routes
3. `src/tools/registry.ts` — central tool manifest; drives sidebar links and bento widgets
4. `*.functions.ts` per tool — `createServerFn` wrappers; safe to import anywhere
5. `*.server.ts` per tool — Supabase query helpers; server-only, never in client bundle
6. `src/styles/theme.css` — CSS variable token definitions via `@theme inline`
7. `src/lib/supabase.ts` — singleton Supabase client (typed with generated DB types)

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for full descriptions, warning signs, and recovery strategies.

1. **Server code leaking into the client bundle** — enforce the `.functions.ts` / `.server.ts` file-suffix convention from day one; never place server imports in isomorphic files; confirm with `vite build` and inspect bundle output
2. **Realtime subscription leaks** — always return `supabase.removeChannel(channel)` in `useEffect` cleanup; use a singleton Supabase client; confirm by monitoring Supabase dashboard connection count across navigations
3. **Hardcoded colours in components** — define all colour tokens as CSS custom properties before writing any components; set `cssVariables: true` in `components.json` before any `shadcn add` command; grep for raw Tailwind palette classes before shipping
4. **Tool architecture not actually isolated** — establish the tool registration contract (each tool exports only `<FullPage />` and `<BentoCard />` to the outside world) before building the first tool; no cross-tool imports
5. **Hydration mismatch from non-deterministic values** — never use `Date.now()`, `Math.random()`, or browser globals at render time on the server; format dates client-side only; test with `vite build && vite preview`

---

## Implications for Roadmap

The architecture research provides an explicit 11-step build order with hard dependencies. The suggested phase structure maps directly onto that order. All phases follow standard, well-documented patterns — no phase requires a deep-dive research spike before execution.

### Phase 1: Foundation

**Rationale:** Three pitfalls (server bundle leakage, hydration mismatch, hardcoded colours) are only preventable at setup time. The colour token system and Supabase client must exist before any UI or data code is written. This phase has zero product-visible output but eliminates all recovery-cost risks.
**Delivers:** Scaffolded TanStack Start project, Tailwind v4 + shadcn/ui configured with `cssVariables: true`, `theme.css` CSS variable token system, OXC tooling configured (oxlint + exact-pinned oxfmt), Supabase project created with `supabase.ts` singleton client, `database.types.ts` generated, `.env` configured
**Addresses:** Colour palette as single source of truth (FEATURES.md P1)
**Avoids:** Hardcoded colour pitfall, server bundle leakage pitfall, hydration mismatch pitfall (all must be addressed here)

### Phase 2: Route Shell and Tool Registry

**Rationale:** Routes and the registry must exist before any tool can be built. The `_app.tsx` pathless layout provides the sidebar + Outlet shell. `registry.ts` starts empty — tools register themselves in a later phase. This phase produces a navigable app skeleton with no tool content.
**Delivers:** `__root.tsx` (providers), `_app.tsx` (sidebar + Outlet), `_app/index.tsx` (empty overview), `Sidebar.tsx` (reads registry, initially empty), `src/tools/registry.ts` (empty array), `BentoGrid.tsx` layout shell
**Uses:** TanStack Router file-based routing, shadcn Sidebar component
**Implements:** Pathless layout pattern, tool registry pattern (Architecture patterns 1 and 2)

### Phase 3: Supabase Schema and Todo Data Layer

**Rationale:** All todo CRUD and the bento card depend on the `todos` table existing. The server function / server helper split must be established before UI is built so that no DB code ends up in the client bundle. This phase has no visible UI but is the prerequisite for everything in Phase 4.
**Delivers:** `todos` Supabase table (id, name, priority enum, status enum, due_date, created_at, updated_at), replication enabled for Realtime, `todos.server.ts` (Supabase query helpers), `todos.functions.ts` (`createServerFn` wrappers with Zod input validation), regenerated `database.types.ts`
**Uses:** Supabase CLI, `createServerFn`, zod
**Avoids:** Server code leakage pitfall (server/functions split enforced here)

### Phase 4: Todo Tool Full Page (CRUD)

**Rationale:** CRUD is the core of the product. Building the full-page todo UI proves the data layer works end-to-end before adding the bento summary. Inline editing, status toggle, priority, and due date are all table stakes that must be present from the first working build.
**Delivers:** `TodoPage.tsx` with full CRUD (create, list, inline edit, delete), status toggle as quick action, priority and due date fields visible and editable, `_app/todos.tsx` route file, TanStack Query integration (SSR loader + client cache), data persisting across page refreshes
**Addresses:** All P1 todo CRUD features (FEATURES.md table stakes)
**Avoids:** loaderDeps pitfall (scope `loaderDeps` to data-relevant params only)

### Phase 5: Bento Overview and Tool Registration

**Rationale:** The bento card can only be built after CRUD exists (it reads todo data). Registering the todo tool in `registry.ts` wires the sidebar link and the bento overview simultaneously — this is the first moment the "dashboard" premise is visible.
**Delivers:** `TodoWidget.tsx` (bento summary card: counts by status, overdue/high-priority highlights), registered todo tool in `registry.ts`, `_app/index.tsx` rendering `BentoGrid` with the widget, bento card loading skeleton
**Addresses:** Bento overview feature (FEATURES.md P1), modular tool registry differentiator
**Avoids:** Tool isolation pitfall (widget only imports from its own tool folder; overview reads only from registry)

### Phase 6: Realtime Wiring

**Rationale:** Realtime is an enhancement layer, not a prerequisite. CRUD must be confirmed working before adding subscriptions. This phase is separated specifically so that subscription bugs do not obscure CRUD bugs.
**Delivers:** `useTodosRealtime` hook with `queryClient.invalidateQueries` on change events, `removeChannel` cleanup verified, Supabase realtime publication confirmed for `todos` table, live updates across browser tabs confirmed
**Uses:** Supabase Realtime, TanStack Query `invalidateQueries` pattern
**Avoids:** Realtime subscription leak pitfall, multiple Supabase client instances pitfall

### Phase Ordering Rationale

- Foundation before everything: colour tokens and tooling conventions are free to establish at setup but expensive to retrofit. Server bundle leakage and hydration issues cannot be caught after the fact without a build-analyse step.
- Registry before tools: the tool registry contract defines what a tool exposes to the outside world. If the first tool is built without a registry, retrofitting the interface is a refactor.
- Server layer before UI: the page component needs something to call. Building `*.server.ts` and `*.functions.ts` first means the UI has typed, validated server functions from the start.
- CRUD before bento: the bento summary card reads todo data. It cannot be built until that data exists.
- Realtime last: it is an enhancement. Keeping it separate confirms that baseline CRUD is solid before adding the subscription layer.

### Research Flags

Phases with standard patterns (skip dedicated research — existing docs are sufficient):

- **Phase 1:** TanStack Start scaffold + shadcn/ui init is well-documented; oxlint config is zero-config; Tailwind v4 CSS setup is documented in STACK.md
- **Phase 2:** TanStack Router pathless layout is documented in ARCHITECTURE.md with code examples
- **Phase 3:** Supabase table creation and `createServerFn` split is documented in ARCHITECTURE.md
- **Phase 4:** TanStack Query + `createServerFn` loader pattern is documented in STACK.md (stack patterns section)
- **Phase 5:** Tool registry pattern is fully specified in ARCHITECTURE.md (Pattern 2)
- **Phase 6:** Realtime invalidation pattern is fully specified in ARCHITECTURE.md (Pattern 4)

No phase requires a `/gsd:research-phase` spike. All patterns are verified and have working examples in the research files.

---

## Confidence Assessment

| Area         | Confidence  | Notes                                                                                                                                                                   |
| ------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH        | All versions verified against npm and official release pages as of 2026-03-28; compatibility matrix confirmed                                                           |
| Features     | MEDIUM-HIGH | Todo CRUD patterns are well-established; bento widget registry pattern is architectural inference from design trends — reasonable but less formally documented          |
| Architecture | HIGH        | TanStack Router file-based routing, Supabase Realtime patterns, and shadcn/ui theming are all stable and well-documented; code examples verified against official docs  |
| Pitfalls     | MEDIUM-HIGH | Critical pitfalls verified against GitHub issues and official docs; some (e.g., loaderDeps) are inferred from framework docs rather than confirmed production incidents |

**Overall confidence:** HIGH

### Gaps to Address

- **oxfmt beta stability:** oxfmt is the only beta-status dependency. It passes Prettier's conformance tests but has known unsupported edge cases. Mitigation: exact-pin the version; maintain Prettier as a fallback. Validate during Phase 1 by running `oxfmt --check` on the scaffolded project.
- **Bento grid responsive layout:** CSS Grid bento layout with `minmax` and `auto-fill` is well-understood but the specific card span ratios are not yet decided. Validate during Phase 5 at 320px, 768px, and 1280px viewports.
- **Supabase types CI automation:** PITFALLS.md flags non-deterministic field ordering in `supabase gen types` output across CLI versions. The research recommends pinning the Supabase CLI version and running type generation in CI. This is a setup detail to resolve during Phase 3.
- **RLS policy approach:** The project has no auth in v1. The research recommends simple permissive RLS or service-role queries via server functions. The exact policy decision should be made explicitly during Phase 3 schema work — do not leave tables with RLS enabled but no policies defined.

---

## Sources

### Primary (HIGH confidence)

- [TanStack Start v1 / TanStack Router v1.167 release pages](https://github.com/TanStack/router/releases) — version, React 19 requirement, Vinxi removal
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — tw-animate-css, OKLCH, cssVariables setup
- [shadcn/ui TanStack Start install docs](https://ui.shadcn.com/docs/installation/tanstack) — `init -t start` command
- [Supabase TanStack Start quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/tanstack) — env var naming, client setup
- [Supabase Realtime docs](https://supabase.com/docs/guides/realtime) and [limits](https://supabase.com/docs/guides/realtime/limits) — channel patterns, 200 connection free-tier cap
- [TanStack Start: Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions) — bundle leakage, file conventions
- [OXC: Oxlint 1.0 stable release](https://voidzero.dev/posts/announcing-oxlint-1-stable) — production readiness
- [OXC: Oxfmt beta release](https://oxc.rs/blog/2026-02-24-oxfmt-beta) — beta status, Prettier conformance

### Secondary (MEDIUM confidence)

- [LogRocket: Migrating TanStack Start from Vinxi to Vite](https://blog.logrocket.com/migrating-tanstack-start-vinxi-vite/) — Vinxi removal in v1.121.0
- [GitHub Issue: createServerFn leaking into client bundle #3990](https://github.com/TanStack/router/issues/3990) — confirmed bundle leakage
- [GitHub Issue: Realtime strict mode subscriptions #169](https://github.com/supabase/realtime-js/issues/169) — React strict mode double-mount
- [GitHub Issue: Type generation inconsistent field ordering #3900](https://github.com/supabase/cli/issues/3900) — CI diff failures
- [Makerkit: Supabase + TanStack Query](https://makerkit.dev/blog/saas/supabase-react-query) — query + realtime integration patterns
- [freeCodeCamp: TanStack Start + shadcn/ui dashboard](https://www.freecodecamp.org/news/build-an-admin-dashboard-with-shadcnui-and-tanstack-start/) — practical integration

### Tertiary (LOW confidence)

- [Orbix Studio: Bento Grid Dashboard Design](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics) — bento UX patterns (design trend inference)
- [Time Management Ninja: 12 Top Features for the Perfect Todo App](https://timemanagementninja.com/2017/04/12-top-features-for-the-perfect-todo-app/) — todo feature expectations (general guidance)

---

_Research completed: 2026-03-28_
_Ready for roadmap: yes_
