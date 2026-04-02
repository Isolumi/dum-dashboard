# Phase 6: Realtime - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a Supabase Realtime subscription to the todos table so that INSERT/UPDATE/DELETE events propagate to all open browser tabs automatically. The subscription must be set up on mount and cleaned up on unmount (navigation away from the todos page). Only the todos page gets realtime — the overview bento card stays static.

Requirements in scope: REAL-01

Out of scope: bento card live updates (SSR loader data is acceptable for the overview page), any other tool's realtime.

</domain>

<decisions>
## Implementation Decisions

### Realtime Update Strategy

- **D-01:** Use **refetch-on-event** — when any `postgres_changes` event fires (INSERT, UPDATE, or DELETE on the `todos` table), call `getTodos()` to replace local state with fresh data from the DB. No payload merging, no dedup logic for same-tab optimistic echoes. The refetch is a no-op cost on the mutating tab (optimistic update is already applied); other tabs get consistent state.

### Realtime Scope

- **D-02:** Subscription lives on the todos page only. The overview bento card (`TodoBentoCard`) is NOT subscribed — it shows SSR loader data until next navigation/refresh. REAL-01 ("reflected in other open tabs") is fully satisfied by the todos page; bento card staleness is low-impact for a personal tool.

### Subscription Lifecycle

- **D-03:** Set up the Supabase channel in a `useEffect` inside `TodosPage`, returning a cleanup function (`supabase.removeChannel(channel)`) to tear it down when the component unmounts. TanStack Router unmounts route components on navigation, so this naturally prevents subscription accumulation — satisfying success criterion 2 (no duplicate subscriptions after navigating away and back).

### Connection Status Indicator

- **D-04:** Show a **subtle live indicator** on the todos page. When the Supabase channel status is `SUBSCRIBED`, display a small "Live" dot/badge. When the channel is reconnecting or disconnected, show "Reconnecting...". Track connection state via the channel status callback.

### Claude's Discretion

- Exact indicator placement and visual style (near page title vs. inline at top of list)
- Lucide icon choice for the live dot (e.g. `Dot`, `Radio`, or a custom CSS pulsing dot)
- Whether to extract the subscription logic into a custom `useTodosRealtime` hook
- Exact channel name (e.g. `"todos-realtime"`)
- Whether to debounce rapid successive events before calling `getTodos()`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Realtime — REAL-01 (changes in one tab reflected in others, no manual refresh)
- `.planning/ROADMAP.md` §Phase 6 — goal and success criteria (both must be TRUE)

### Existing code — read before implementing
- `src/lib/supabase.ts` — Supabase client singleton; import this client-side for `supabase.channel()`
- `src/routes/_layout/todos/index.tsx` — current page; `useState<Todo[]>` local state, existing `useEffect` pattern, `setTodos` mutation handlers
- `src/routes/todos/todos.functions.ts` — `getTodos()` server function to call on realtime events
- `src/lib/database.types.ts` — `Todo` type
- `src/styles.css` — `@theme` tokens for indicator styling (no hardcoded colours)
- `CLAUDE.md` §Colour System — all colours via `@theme` tokens

### Phase constraints (inherited)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-01 (dark mode only), D-05 (all Tailwind utilities via `@theme` tokens)
- `.planning/phases/03-supabase-data-layer/03-CONTEXT.md` — D-08 (`supabase.ts` client; `supabase-admin.ts` is server-only and must NOT be used here)

No external ADRs — Supabase Realtime API is standard `postgres_changes` subscription via `@supabase/supabase-js`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase` client at `src/lib/supabase.ts` — already instantiated with anon key; use `supabase.channel(name).on('postgres_changes', ...)` directly
- `getTodos()` in `todos.functions.ts` — existing server function; call this on realtime events to refresh state
- `setTodos` — existing state setter in `TodosPage`; assign the `getTodos()` result to it on events
- Existing `useEffect` pattern in `TodosPage` — mutation error timer uses same cleanup pattern as the subscription will need

### Established Patterns
- `useEffect` with cleanup return in `TodosPage` — mirrors exactly what the subscription setup will look like
- All colours via `@theme` semantic tokens — indicator must use tokens (e.g. `text-primary`, `text-muted-foreground`, `text-destructive`)
- Route files prefixed with `-` to prevent TanStack Router scanning — a custom hook file at `src/hooks/` doesn't need this prefix

### Integration Points
- `TodosPage` component (`src/routes/_layout/todos/index.tsx`) — add `useEffect` for channel setup/teardown and a state value for connection status
- New state field: `channelStatus: 'connecting' | 'live' | 'reconnecting'` (or similar) for the indicator
- No changes needed to `todos.functions.ts`, `registry.ts`, or the overview page

</code_context>

<specifics>
## Specific Ideas

- The live indicator behaviour:
  - Channel `SUBSCRIBED` status → small "● Live" dot (using a `text-primary` or green semantic token)
  - Channel `CHANNEL_ERROR` / closed / reconnecting → "Reconnecting..." text with muted style
  - No indicator shown during initial page load before channel is established (to avoid flash)

</specifics>

<deferred>
## Deferred Ideas

- Bento card realtime updates — reviewed, deferred; bento card stays static (SSR loader data). Can be added in a future phase if needed.
- Debounced refetch for high-frequency events — not needed for a personal tool; direct refetch on each event is fine.
- Offline support with IndexedDB / service workers — explicitly out of scope (REQUIREMENTS.md §Out of Scope)

</deferred>

---

*Phase: 06-realtime*
*Context gathered: 2026-04-02*
