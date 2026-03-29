# Pitfalls Research

**Domain:** Personal dashboard — TanStack Start + Supabase + shadcn/ui + Tailwind v4 + OXC
**Researched:** 2026-03-28
**Confidence:** MEDIUM-HIGH (verified with official docs and GitHub issues across all areas)

---

## Critical Pitfalls

### Pitfall 1: Server Code Leaking into the Client Bundle via createServerFn

**What goes wrong:**
Server-only code (database credentials, Node.js modules like `fs`, Supabase service role keys) ends up in the browser bundle. The app appears to work in development but may throw runtime errors or expose secrets in production builds.

**Why it happens:**
TanStack Start's `createServerFn` wraps server code, but if you place server-only logic (imports from `.server.ts` files, direct `process.env` reads) directly in route loaders or shared files that run isomorphically, the bundler cannot strip them. Dynamic imports of server functions also break the bundler's dead-code elimination for server stubs.

**How to avoid:**
- Use the three-file-suffix convention strictly: `.functions.ts` for `createServerFn` wrappers (safe to import anywhere), `.server.ts` for server-only helpers (only called inside handler bodies), plain `.ts` for shared types and schemas.
- Never use dynamic imports (`await import('./foo.server')`) for server functions — use static imports only.
- Add `@tanstack/react-start/server-only` as a top-level import in any file that must never reach the client.
- Keep the Supabase `service_role` key exclusively inside `.server.ts` files; the `VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY` is safe for client use.

**Warning signs:**
- Build output includes Node.js built-in module warnings in the client chunk.
- `process is not defined` errors in the browser console.
- Network tab shows API secrets in JS bundle source.

**Phase to address:** Foundation / project scaffolding phase (day one — set up file conventions before writing any data access code).

---

### Pitfall 2: Supabase Realtime Subscriptions Not Cleaned Up on Unmount

**What goes wrong:**
WebSocket connections accumulate. Each navigation to a page that subscribes to a Supabase channel creates a new connection without removing the previous one. Over time this exhausts the free-tier limit of 200 concurrent connections and causes stale handlers to fire on unmounted components.

**Why it happens:**
React's strict mode in development mounts components twice. Without a cleanup function in `useEffect`, the subscription setup runs twice and teardown never runs. The pattern is easy to miss because it works silently in single-tab development.

**How to avoid:**
- Always return a cleanup function from `useEffect` that calls `supabase.removeChannel(channel)`.
- Use TanStack Query's `useQuery` + `invalidateQueries` pattern: subscribe to realtime changes in a single top-level effect that calls `queryClient.invalidateQueries` on change, rather than subscribing inside every component.
- Create the Supabase client as a singleton (one instance for the whole app) to prevent multiple WebSocket connections.

**Warning signs:**
- Realtime events fire multiple times for one database change.
- Supabase dashboard shows steadily climbing connection count.
- Console logs from unmounted components after navigating away.

**Phase to address:** Supabase / data layer phase (when wiring up realtime for the todo tool).

---

### Pitfall 3: Hardcoded Colours in Components Instead of CSS Variable Tokens

**What goes wrong:**
Tailwind utility classes like `text-gray-500`, `bg-blue-600`, or inline `style={{ color: '#3b82f6' }}` appear inside components. When the colour palette needs adjustment — or when dark mode is added — every component must be hunted down and updated individually. shadcn/ui components added later use the token system, creating visual inconsistency.

**Why it happens:**
shadcn/ui components generate code that uses Tailwind's raw colour scale by default when `cssVariables: false` in `components.json`. Developers also reach for familiar utility names during rapid prototyping and forget to replace them.

**How to avoid:**
- Set `cssVariables: true` in `components.json` before installing any shadcn/ui components.
- Define all project colours as CSS custom properties in `:root` (and `.dark`) and expose them through `@theme inline` in your Tailwind v4 CSS entry file.
- Never use raw Tailwind colour scale classes (`text-gray-*`, `bg-blue-*`) in application code — use semantic tokens only (`text-muted-foreground`, `bg-primary`, or project-specific tokens like `--color-brand`).
- Lint for hardcoded colour values: add an oxlint custom rule or a Tailwind-specific lint plugin that flags raw palette classes in component files.
- Do not repurpose shadcn's `--primary` as a brand colour — it is reserved for interactive element semantics. Add a `--brand` token if you need one.

**Warning signs:**
- Grep for `text-(gray|slate|zinc|stone|neutral|red|orange|yellow|green|teal|blue|indigo|violet|purple|fuchsia|pink|rose)-` in component files returns hits.
- Any shadcn component added after initial setup looks visually different from existing UI.

**Phase to address:** Foundation phase (establish colour token system before writing any UI components).

---

### Pitfall 4: Hydration Mismatch from Non-Deterministic Values in SSR Output

**What goes wrong:**
TanStack Start renders the page on the server and sends HTML to the browser. If a component uses `Date.now()`, `Math.random()`, `new Intl.DateTimeFormat()`, or reads browser-only globals (`window`, `localStorage`), the server output differs from the client render, causing React to throw hydration errors and potentially re-render the entire tree.

**Why it happens:**
Route loaders are isomorphic — they run server-side on initial load and client-side on navigation. It is easy to write code that assumes it always runs in one environment. Time-zone differences between server and client are a particularly silent form of this bug.

**How to avoid:**
- Use `ssr: "data-only"` for any route or component that depends on browser-only APIs. This sends loader data to the client but skips server rendering the component.
- Never read `window`, `localStorage`, or `navigator` at module evaluation time — guard with `typeof window !== 'undefined'` or move into `useEffect`.
- Use `useId()` instead of `Math.random()` for generated IDs.
- Format dates on the client only (in `useEffect` or in a client-side component) or pass pre-formatted strings from the server.
- Test SSR output explicitly: run `vite build && vite preview` and compare server HTML to client render in DevTools.

**Warning signs:**
- Console warning: "Hydration failed because the server rendered HTML didn't match the client".
- Components flash or re-render on first page load.
- Any `useEffect` that reads a value and immediately sets state to format it for display.

**Phase to address:** Foundation phase (during SSR config) and whenever new components read dynamic values.

---

### Pitfall 5: Modular Tool Architecture That Isn't Actually Isolated

**What goes wrong:**
Tool modules (todo, future tools) share a single global state slice or bleed Supabase query subscriptions into each other. Adding a second tool requires modifying the first tool's code. The bento overview page becomes tightly coupled to each tool's internals rather than consuming a stable public interface.

**Why it happens:**
The easiest path is a single top-level store with all state. Developers add keys to a shared store as they build each tool, and the bento card for each tool directly imports the tool's internal store or hooks.

**How to avoid:**
- Establish a tool registration contract from the start: each tool exports exactly two things to the outside world — a `<FullPage />` component and a `<BentoCard />` component. Nothing else is imported cross-module.
- Each tool owns its own Supabase subscription and data-fetching hooks. No cross-tool shared queries.
- The bento overview page imports only from a `tools/registry.ts` manifest — an array of `{ slug, BentoCard }` objects — never from individual tool internals.
- Each tool has its own DB schema namespace (e.g., `todos` table, not a generic `items` table that all tools share).

**Warning signs:**
- `import` statements in bento overview that reach into `tools/todo/store.ts` or `tools/todo/hooks.ts`.
- Adding a new tool requires editing an existing tool's files.
- A bug in one tool's realtime subscription causes another tool's data to stale.

**Phase to address:** Architecture / scaffolding phase (define and document the tool registration interface before implementing the first tool).

---

### Pitfall 6: OXC Formatter (oxfmt) Is Beta — Not Suitable as the Sole Formatter

**What goes wrong:**
The project spec says "OXC for linting + formatting." Oxlint (linter) is production-stable and used by Shopify, Preact, ByteDance. However, Oxfmt (the formatter) is in **beta** as of February 2026. Adopting it as the sole formatter may cause inconsistent output, missing Prettier edge-case coverage, or CI failures when the formatter output changes between patch versions.

**Why it happens:**
"OXC" as a project umbrella is conflated with both tools being production-ready. The linter and formatter have separate maturity levels.

**How to avoid:**
- Use oxlint for all linting — it is production-ready and 50-100x faster than ESLint.
- Use Prettier (or Biome) as the formatter until oxfmt reaches stable v1.0, unless you are comfortable with beta software.
- Alternatively, adopt oxfmt but pin to an exact version and review the changelog before updating. Review oxfmt's "Unsupported features" list at `oxc.rs/docs/guide/usage/formatter` before committing.
- If you proceed with oxfmt, lock the version in `package.json` with an exact version pin (no `^` or `~`).

**Warning signs:**
- Formatter output differs between developer machines on the same codebase (version drift).
- CI reports formatting errors that pass locally.
- Edge cases in TypeScript generics or complex JSX produce unexpected whitespace.

**Phase to address:** Foundation phase (tooling setup — decide the formatter before first commit).

---

### Pitfall 7: loaderDeps Returning the Entire Search Object

**What goes wrong:**
A route's `loaderDeps` returns the whole search params object. Any URL param change — including UI-only params like `sortDirection` or `viewMode` — triggers a full loader re-fetch even when the data-relevant params did not change. This causes unnecessary server round-trips and loader flashes.

**Why it happens:**
`loaderDeps` is easy to write as `({ search }) => search` when prototyping. Developers overlook that all active route loaders in the tree re-run when deps change.

**How to avoid:**
- In `loaderDeps`, extract only the specific search params that affect data fetching: `({ search }) => ({ todoId: search.todoId })`.
- Separate data-fetching params from UI-state params. Store sort/filter UI state in component-local state or in a URL param that is not included in `loaderDeps`.

**Warning signs:**
- Changing a sort dropdown triggers a network request visible in the browser DevTools Network tab.
- Loader runs more frequently than expected during normal UI interaction.

**Phase to address:** Todo tool implementation phase (when implementing search/filter params on the todo page).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding `text-gray-500` instead of a token | Faster to type during prototyping | Every colour reference must be hunted and replaced when palette changes | Never — takes 10 seconds to add a token instead |
| Putting all tool state in one Zustand/Jotai store | Simple to set up initially | Adding a third tool requires restructuring shared state; tools cannot be removed cleanly | Never for this project — tool isolation is a first-class requirement |
| Skipping `removeChannel` cleanup in `useEffect` | One fewer line of code | WebSocket connection leak; realtime events fire on unmounted components | Never |
| Running `supabase gen types` manually ad-hoc | No automation setup needed | Types drift from schema; TypeScript stops catching DB mismatches | MVP only — automate before first production use |
| Skipping `inputValidator` on `createServerFn` | Faster to prototype | Network boundary becomes unvalidated; type errors only surface at runtime | Never — use Zod schema from day one |
| Using `--primary` as your brand colour | Convenient semantic name | Breaks shadcn/ui button and interactive component intent; confusing for future maintainers | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase + TanStack Start | Reading `SUPABASE_SERVICE_ROLE_KEY` directly in a loader function | Keep service role key in `.server.ts` only; loaders use the anon/publishable key via `createServerFn` |
| Supabase Realtime + React Strict Mode | Subscription fires twice on mount; cleanup doesn't run correctly | Create subscription inside `useEffect` and always return `supabase.removeChannel(channel)` in the cleanup |
| Supabase types + CI | `supabase gen types` output has non-deterministic field ordering across runs | Pin Supabase CLI version; use `supabase gen types` in a GitHub Action that commits the result; treat the file as generated (don't hand-edit) |
| shadcn/ui + Tailwind v4 | Installing shadcn components when `cssVariables: false` is set | Set `cssVariables: true` in `components.json` before running any `shadcn add` commands |
| shadcn/ui v4 + `tailwindcss-animate` | Old animation plugin not included in v4 setup | Use the built-in `tw-animate-css` package or the new `@theme inline` animation tokens instead |
| TanStack Start + Supabase anon key | Prefixing the anon key with `VITE_` thinking it makes it "private" | `VITE_` prefix makes env vars public in the client bundle by design — this is correct for the anon key, but never use `VITE_` for the service role key |
| OXC + type-aware linting | Expecting oxlint to replace ESLint type-aware rules | Type-aware linting in oxlint is preview-only as of late 2025 — run `tsc --noEmit` in CI for type checking |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Supabase Realtime subscription per component | Network tab shows N WebSocket connections for N tool components | Single subscription at the app level per table; use TanStack Query invalidation to propagate updates | When bento overview + tool page are both mounted |
| Overly broad `loaderDeps` (whole search object) | Every UI interaction triggers a loader network request | Extract only data-relevant search params in `loaderDeps` | Immediately, as soon as sort/filter UI is added |
| RLS policies with `auth.uid()` without index | Slow queries as todo list grows (even at 1k rows it matters) | Add index on `user_id` column; for no-auth apps, use simple permissive RLS or disable RLS with service-role client on server | At ~500+ rows with complex policies |
| CSS Grid bento layout using fixed `px` spans | Cards overflow or collapse on narrow viewports | Use `minmax()` with `auto-fill` and `span` keyword, not fixed pixel column definitions | When viewport is narrower than card minimum width |
| All bento cards loaded eagerly | Slow initial page load as tool count grows | Use `React.lazy` + `Suspense` for each tool's bento card import | When more than 4-5 tools are registered |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Using the Supabase `service_role` key in a client-side Supabase instance | Full database access bypass — any user can read/write all rows, bypassing RLS | Never expose service role key via `VITE_` prefix; only use in `.server.ts` files via `createServerFn` |
| Tables with RLS enabled but no policies defined | All queries return zero rows silently — data appears missing | After `ENABLE ROW LEVEL SECURITY`, always create at least one permissive policy; test queries immediately |
| Returning raw error objects from `createServerFn` | Internal server details (file paths, stack traces, DB schema names) leaked to client | Catch errors in server functions and throw sanitised, user-facing messages only |
| Serialising data with `JSON.stringify` in custom SSR setup | XSS vulnerability via injected `</script>` in serialised data | Use `devalue` or `serialize-javascript` for SSR data serialisation, not raw `JSON.stringify` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Bento cards with no loading state | Page appears blank or broken while Supabase data loads | Each bento card renders a skeleton immediately; data populates in place |
| Realtime updates cause jarring re-renders | List items visibly jump when a todo changes in another tab | Use optimistic updates in TanStack Query; animate list item changes with CSS transitions |
| Todo due-date formatted server-side | Dates show in server timezone, not user's timezone | Format dates client-side only in a `useEffect` or use `Intl.DateTimeFormat` on the client |
| Priority and status displayed as raw enum values | "NOT_STARTED" instead of "Not started"; "HIGH" instead of "High" | Map enum values to human labels in a shared constants file; never display raw DB values |
| Sidebar navigation has no active-state highlight | Users lose their place in the app | TanStack Router's `Link` component provides `data-status="active"` — use it to apply active styles |

---

## "Looks Done But Isn't" Checklist

- [ ] **Colour system:** Every colour in every component traces to a CSS variable token — grep for raw palette classes (`text-gray-`, `bg-blue-`, etc.) should return zero results in `src/`.
- [ ] **Realtime subscriptions:** Every `supabase.channel()` call has a corresponding `removeChannel` in a `useEffect` cleanup — inspect React DevTools for lingering effects.
- [ ] **Server function security:** No `process.env` reads outside of `.server.ts` files — check with `grep -r 'process\.env' src/ --include='*.ts' --include='*.tsx'` excluding `.server.ts`.
- [ ] **Types in sync:** `supabase gen types` output matches current DB schema — run the command and confirm no git diff.
- [ ] **Tool isolation:** No file in `src/tools/todo/` is imported by any file outside `src/tools/todo/` except through `src/tools/registry.ts` — verify with a circular dependency check.
- [ ] **Bento cards responsive:** Bento grid renders correctly at 320px, 768px, and 1280px viewport widths — test with browser DevTools device emulation.
- [ ] **OXC formatter pinned:** `oxfmt` version is exact-pinned in `package.json` (no `^`) if used — check `package.json`.
- [ ] **loaderDeps scoped:** Every route with search params has `loaderDeps` extracting only the data-affecting params — not the whole search object.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hardcoded colours found throughout components | MEDIUM | Audit with grep; create a token for each unique hardcoded value; find-replace per component |
| Server bundle leakage discovered post-build | HIGH | Identify leaking file via bundle analyser (`npx vite-bundle-visualizer`); move to `.server.ts` convention; rebuild |
| Realtime subscription leak (connections piling up) | LOW | Add `useEffect` cleanup in every subscription site; single-instance Supabase client check |
| Type generation producing non-deterministic diffs in CI | LOW | Pin `supabase` CLI version exactly; check GitHub issue tracker for the specific CLI version |
| Tool isolation violated (cross-tool imports) | MEDIUM-HIGH | Refactor to registry pattern; move shared logic to a `src/lib/` layer; update import paths |
| Hydration mismatch in production | MEDIUM | Identify the non-deterministic value (usually date/time or random ID); move formatting to client-only `useEffect` or switch route to `ssr: "data-only"` |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Server code leaking into client bundle | Foundation / scaffolding | Run `vite build` and inspect bundle; check for Node.js module warnings |
| Realtime subscriptions not cleaned up | Supabase / data layer | Monitor Supabase dashboard connection count across page navigations |
| Hardcoded colours in components | Foundation / design system | Grep for raw Tailwind palette classes in `src/` returning zero results |
| Hydration mismatch from non-deterministic values | Foundation / SSR config | Run `vite build && vite preview` and compare server HTML to client render |
| Tool architecture not actually isolated | Architecture / scaffolding | Verify no cross-tool imports via dependency graph tool |
| OXC formatter beta instability | Foundation / tooling setup | CI formatting check passes on two separate machines with clean installs |
| loaderDeps returning entire search object | Todo tool / data loading | Open Network tab; confirm sort/filter UI changes produce zero network requests |
| Supabase types drifting from schema | Any DB schema change milestone | `supabase gen types` in CI; fail build on diff |

---

## Sources

- [TanStack Start: Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions) — bundle leakage, file conventions
- [TanStack Start: Hydration Errors](https://tanstack.com/start/latest/docs/framework/react/guide/hydration-errors) — hydration mismatch causes
- [TanStack Start: Environment Variables](https://tanstack.com/start/latest/docs/framework/react/guide/environment-variables) — env var exposure
- [TanStack Router: Data Loading](https://tanstack.com/router/latest/docs/guide/data-loading) — loaderDeps pitfalls
- [GitHub Issue: createServerFn leaking into client bundle #3990](https://github.com/TanStack/router/issues/3990) — confirmed bundle leakage issue
- [GitHub Issue: Middleware included in client bundle #2783](https://github.com/TanStack/router/issues/2783) — middleware leak
- [Supabase: Realtime Concepts](https://supabase.com/docs/guides/realtime/concepts) — connection limits, channel gotchas
- [Supabase: Realtime Limits](https://supabase.com/docs/guides/realtime/limits) — free tier caps (200 concurrent connections)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS enablement, empty policy trap
- [Supabase: Generating TypeScript Types](https://supabase.com/docs/guides/api/rest/generating-types) — type generation workflow
- [GitHub Issue: Type generation inconsistent field ordering #3900](https://github.com/supabase/cli/issues/3900) — CI diff failures
- [GitHub Issue: Realtime strict mode subscriptions #169](https://github.com/supabase/realtime-js/issues/169) — React strict mode double-mount
- [shadcn/ui: Theming](https://ui.shadcn.com/docs/theming) — CSS variable token system
- [shadcn/ui: Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) — breaking changes, OKLCH migration
- [OXC: Oxlint](https://oxc.rs/docs/guide/usage/linter.html) — linter production readiness
- [OXC: Oxfmt](https://oxc.rs/docs/guide/usage/formatter) — formatter beta status, unsupported features
- [Announcing Oxlint 1.0](https://voidzero.dev/posts/announcing-oxlint-1-stable) — linter stable release
- [LogRocket: Selective SSR in TanStack Start](https://blog.logrocket.com/selective-ssr-tanstack-start/) — ssr: "data-only" pattern

---
*Pitfalls research for: Personal dashboard — TanStack Start + Supabase + shadcn/ui + Tailwind v4 + OXC*
*Researched: 2026-03-28*
