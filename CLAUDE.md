<!-- GSD:project-start source:PROJECT.md -->

## Project

**Personal Dashboard**

A personal dashboard that centralizes all of your tools in one place. Each tool gets its own dedicated page, plus a centralized bento-box overview page showing summaries across all tools. Starting with a todo app; designed for easy expansion as new tools are added.

**Core Value:** A single place to see and manage all your personal tools — starting with todos, built to grow.

### Constraints

- **Tech Stack**: TanStack Start + Tailwind + shadcn + Lucide + OXC + Supabase — locked, no deviations
- **Colour System**: All colours defined via a single Tailwind CSS config palette — no hardcoded colour values in components
- **Modularity**: Each tool must be self-contained (its own page, its own bento card, its own DB schema) so it can be added, swapped, or removed independently
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology               | Version               | Purpose                                                               | Why Recommended                                                                                                                                                                                                                                                                                                        |
| ------------------------ | --------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@tanstack/react-start`  | ^1.167.13             | Full-stack meta-framework (SSR, file-based routing, server functions) | Vite-native, built on TanStack Router, ships stable v1 with type-safe server functions and route loaders. Migrated from Vinxi to Vite in v1.121.0 — current versions are stable and production-ready.                                                                                                                  |
| `@tanstack/react-router` | ^1.167.13             | Client-side routing (included transitively via Start)                 | Underpins TanStack Start; provides type-safe, file-based routing with auto-generated route tree (`routeTree.gen.ts`). Use `createFileRoute` in every route file.                                                                                                                                                       |
| React                    | ^19.0.0               | UI rendering                                                          | Required peer dep for TanStack Start v1; removes `forwardRef` requirement that shadcn/ui now also drops.                                                                                                                                                                                                               |
| `tailwindcss`            | ^4.2.2                | Utility-first CSS                                                     | v4 is the current stable series (last patch: 4.2.2 as of 2026-03-18). CSS-first config — no `tailwind.config.js`, all config lives in the main CSS file via `@theme`. Natively supported by oxfmt for class sorting.                                                                                                   |
| `@shadcn/ui`             | CLI-managed (latest)  | Pre-built accessible component library                                | Fully updated for Tailwind v4 and React 19. Components are copied into the project (not installed as a package) via `bunx --bun shadcn@latest add`. The CLI handles Tailwind v4 `@theme inline` setup automatically when you run `bunx --bun shadcn@latest init -t start`. HSL colors converted to OKLCH in the v4 update. |
| `lucide-react`           | ^1.7.0                | Icon set                                                              | Canonical icon library for shadcn/ui. Tree-shakable named exports, consistent stroke-based design. Used by shadcn/ui internally.                                                                                                                                                                                       |
| `@supabase/supabase-js`  | ^2.100.1              | Supabase client: Postgres queries + realtime subscriptions            | Isomorphic client with built-in WebSocket-based realtime. v2.x is the current stable major; no SSR-specific wrapper needed for a personal, auth-free project.                                                                                                                                                          |
| `oxlint`                 | ^1.x (v1.0 stable)    | Linting (Rust-powered, replaces ESLint)                               | v1.0 stable released June 2025. 50–100x faster than ESLint. 500+ rules covering ESLint, TypeScript, React, unicorn, import. Zero-config default works immediately.                                                                                                                                                     |
| `oxfmt`                  | ^0.x (beta, Feb 2026) | Formatting (replaces Prettier)                                        | Beta as of Feb 2026, passes 100% of Prettier's JS/TS conformance tests. 30x faster than Prettier. Built-in Tailwind CSS class sorting (replaces `prettier-plugin-tailwindcss`), built-in import sorting. Used in production by Vue.js, Turborepo, Sentry-JS.                                                           |

### Supporting Libraries

| Library                 | Version | Purpose                                       | When to Use                                                                                                                                                                                                                                                  |
| ----------------------- | ------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@tanstack/react-query` | ^5.95.0 | Client-side data caching + background refetch | Use for client-side state derived from server data. Pair with `createServerFn` for the fetcher: server function handles DB access, TanStack Query handles caching/refetch on the client. Especially useful when Supabase realtime does NOT cover a use case. |
| `zod`                   | ^3.x    | Schema validation                             | Validate `createServerFn` inputs with `.inputValidator(zodSchema)`. Also validates Supabase insert/update payloads before hitting the DB.                                                                                                                    |
| `tw-animate-css`        | ^1.x    | CSS animations                                | Replaces deprecated `tailwindcss-animate` (deprecated March 2025). Import with `@import "tw-animate-css"` in the main CSS file. Required for shadcn/ui component animations (dialogs, dropdowns, etc.).                                                      |
| `vite`                  | ^6.x    | Build tool / dev server                       | Used by TanStack Start v1 (replaced Vinxi in v1.121.0). Do not configure directly — TanStack Start's Vite plugin wraps it.                                                                                                                                   |
| `typescript`            | ^5.x    | Type safety                                   | Required. TanStack Start's type inference (route params, server function I/O, loader data) is the primary DX benefit; turning off TypeScript defeats the purpose.                                                                                            |

### Development Tools

| Tool         | Purpose                         | Notes                                                                                                                                                                                                            |
| ------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `oxlint`     | Linting                         | Run via `oxlint .` or add to `package.json` scripts. Config in `.oxlintrc.json`. Enable `react` and `typescript` plugins. Zero-config works; `.oxlintrc.json` adds React version setting and rule customization. |
| `oxfmt`      | Formatting                      | Run via `oxfmt` (format) or `oxfmt --check` (CI). Config mirrors `.prettierrc` key names. Tailwind class sorting is on by default when `tailwindcss` is detected.                                                |
| `bun`        | Package manager                 | Faster installs with bun.lock. Use `bunx --bun shadcn@latest` for the shadcn/ui CLI.                                                                                                                             |
| Supabase CLI | Local DB + migration management | Run `supabase start` to spin up a local Postgres instance with realtime enabled. Use `supabase db push` to apply schema migrations.                                                                              |

## Installation

# 1. Scaffold TanStack Start project

# 2. Init shadcn/ui for TanStack Start (Tailwind v4 setup handled automatically)

# 3. Core runtime dependencies (most pre-installed by scaffold)

# 4. Supporting shadcn components (add as needed)

# 5. Dev dependencies: linting + formatting

# 6. Lucide icons (often pre-installed by shadcn init)

## Alternatives Considered

| Recommended             | Alternative                   | When to Use Alternative                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TanStack Start          | Next.js 15                    | Next.js is more mature and has RSC today; choose it if you need a larger plugin ecosystem or server components are a primary design constraint. TanStack Start is the better fit here because the stack is already locked and it aligns with TanStack Router's type safety model.                                               |
| TanStack Start          | Remix / React Router v7       | Remix has a more established community but overlaps heavily with TanStack Start's model. Not recommended unless you already have Remix experience.                                                                                                                                                                              |
| oxlint                  | ESLint                        | Use ESLint if you need rules from niche ESLint plugins not yet ported to oxlint (e.g., certain accessibility or testing plugins). For a React/TypeScript/Tailwind project, oxlint v1 covers the entire required ruleset.                                                                                                        |
| oxfmt                   | Prettier                      | Use Prettier if you need Prettier plugin support not yet available in oxfmt (e.g., project-specific AST plugins). For this project, oxfmt's built-in Tailwind class sorting is a net win over Prettier + `prettier-plugin-tailwindcss`. Note: oxfmt is beta — if instability is encountered, fall back to Prettier temporarily. |
| oxfmt                   | Biome                         | Biome bundles linting + formatting; oxlint+oxfmt keeps concerns separate and lets each tool evolve independently. Biome's formatting output has historically diverged from Prettier; oxfmt's 100% conformance is preferable for shadcn/ui generated code.                                                                       |
| `@supabase/supabase-js` | Drizzle ORM + direct Postgres | Drizzle gives better type-safe query building but loses realtime and Supabase Auth out of the box. Not worth the added complexity for a personal tool with no auth.                                                                                                                                                             |
| `@tanstack/react-query` | SWR                           | TanStack Query v5 integrates natively with TanStack Start's loader/server function pattern and supports SSR hydration cleanly. SWR has no official TanStack Start integration.                                                                                                                                                  |

## What NOT to Use

| Avoid                                        | Why                                                                                        | Use Instead                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `tailwindcss-animate`                        | Deprecated March 2025 by shadcn/ui team                                                    | `tw-animate-css` — drop-in replacement, `@import "tw-animate-css"` in CSS |
| `tailwind.config.js`                         | Obsolete in Tailwind v4 — config moved entirely to CSS                                     | `@theme` block in main CSS file                                           |
| `prettier` + `prettier-plugin-tailwindcss`   | Slower alternative; Tailwind class sorting now built into oxfmt                            | `oxfmt` (handles both)                                                    |
| ESLint                                       | Slower at scale; oxlint v1.0 covers the complete ESLint ruleset for this project           | `oxlint`                                                                  |
| `@supabase/ssr`                              | Only needed for auth-based SSR cookie handling; this project has no auth in v1             | `@supabase/supabase-js` directly                                          |
| Vinxi                                        | Removed from TanStack Start in v1.121.0; any docs referencing it are outdated              | Vite (used natively by TanStack Start now)                                |
| `React.forwardRef`                           | Removed in React 19 and no longer needed; shadcn/ui v4-compatible components do not use it | Plain function components with `ref` prop                                 |
| Hardcoded hex/rgb color values in components | Violates the project's single source of truth constraint                                   | Tailwind CSS custom properties defined in `@theme` block                  |

## Stack Patterns by Variant

- Use `createServerFn` in a TanStack Start route loader (`loader` export)
- Hydrate TanStack Query cache from the loader result using `dehydrate`/`HydrationBoundary`
- Client gets SSR-rendered HTML + pre-populated cache on first load
- Set up a Supabase channel subscription in a `useEffect` inside the relevant component
- Enable table replication via `alter publication supabase_realtime add table todos;`
- On INSERT/UPDATE/DELETE events, update local React state (or invalidate TanStack Query cache)
- Clean up the channel in the `useEffect` return function
- Each tool lives in `src/routes/<tool-name>/` with its own `index.tsx` (full page)
- Each tool exports a `<ToolBentoCard />` component used by the bento overview page
- Each tool owns its own Supabase table and `createServerFn` set in `<tool>.functions.ts`

## Version Compatibility

| Package A                      | Compatible With                | Notes                                                                                                                                                             |
| ------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@tanstack/react-start@^1.167` | React 19                       | React 19 is required (not optional). React 18 is not supported in current v1.x.                                                                                   |
| `tailwindcss@^4.2`             | `@shadcn/ui` (latest CLI)      | shadcn/ui CLI automatically configures Tailwind v4 `@theme inline` on `init -t start`. Do not mix v3 config patterns.                                             |
| `tw-animate-css`               | `tailwindcss@^4`               | Import as CSS: `@import "tw-animate-css"`. Not a Tailwind plugin — no `@plugin` directive needed.                                                                 |
| `oxfmt` (beta)                 | `oxlint@^1.x`                  | Separate tools, no integration required. Run independently in scripts.                                                                                            |
| `@supabase/supabase-js@^2.100` | Node.js >=20                   | Node 18 was dropped in supabase-js v2.79.0. Use Node 20+ in CI.                                                                                                   |
| `@tanstack/react-query@^5.95`  | `@tanstack/react-start@^1.167` | TanStack Start ships its own `@tanstack/react-start/client` entry that handles QueryClient hydration. Use the `routerWithQueryClient` helper for SSR dehydration. |

## Sources

- [TanStack Start v1 Release Candidate announcement](https://tanstack.com/blog/announcing-tanstack-start-v1) — confirmed v1 RC, React 19 requirement
- [TanStack/router GitHub releases](https://github.com/TanStack/router/releases) — latest version 1.167.13 as of 2026-03-28 (HIGH confidence)
- [LogRocket: Migrating TanStack Start from Vinxi to Vite](https://blog.logrocket.com/migrating-tanstack-start-vinxi-vite/) — confirmed Vinxi removal in v1.121.0 (MEDIUM confidence)
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — Tailwind v4 migration path, tw-animate-css, OKLCH colors (HIGH confidence)
- [shadcn/ui TanStack Start install docs](https://ui.shadcn.com/docs/installation/tanstack) — `init -t start` command (HIGH confidence)
- [tailwindcss npm page](https://www.npmjs.com/package/tailwindcss) — v4.2.2 latest stable (HIGH confidence)
- [oxlint v1.0 stable release post](https://oxc.rs/blog/2025-06-10-oxlint-stable) — v1.0 released June 2025 (HIGH confidence)
- [oxfmt beta release post](https://oxc.rs/blog/2026-02-24-oxfmt-beta) — beta Feb 2026, 100% Prettier JS/TS conformance (HIGH confidence)
- [oxfmt usage docs](https://oxc.rs/docs/guide/usage/formatter.html) — install command and basic usage (HIGH confidence)
- [@supabase/supabase-js npm page](https://www.npmjs.com/package/@supabase/supabase-js) — v2.100.1 latest (HIGH confidence)
- [Supabase realtime postgres-changes docs](https://supabase.com/docs/guides/realtime/postgres-changes) — subscription API and setup (HIGH confidence)
- [Supabase TanStack Start quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/tanstack) — env variable naming (VITE_SUPABASE_PUBLISHABLE_KEY) (HIGH confidence)
- [lucide-react npm page](https://www.npmjs.com/package/lucide-react) — v1.7.0 latest (HIGH confidence)
- [@tanstack/react-query npm](https://www.npmjs.com/package/@tanstack/react-query) — v5.95.0 latest (HIGH confidence)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.

<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.

<!-- GSD:profile-end -->
