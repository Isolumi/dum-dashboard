# Phase 6: Realtime - Research

**Researched:** 2026-04-02
**Domain:** Supabase Realtime `postgres_changes` + React `useEffect` lifecycle
**Confidence:** HIGH

## Summary

Phase 6 adds a Supabase Realtime subscription to the todos page so that INSERT, UPDATE, and DELETE events on the `todos` table propagate to all open browser tabs automatically. The implementation is narrow: a single `useEffect` (or extracted custom hook) that calls `supabase.channel("todos-realtime").on("postgres_changes", ...)` and returns a cleanup function that calls `supabase.removeChannel(channel)`. Because TanStack Router unmounts route components on navigation, the cleanup function naturally prevents subscription accumulation — no special router integration is required.

The refetch-on-event strategy (D-01) is the correct choice here: rather than merging realtime payload diffs into local state, the event handler simply calls the existing `getTodos()` server function and assigns the result to `setTodos`. This eliminates dedup/merge logic, gives consistent data, and is a no-op cost on the mutating tab where the optimistic update is already applied. The only complexity in this phase is getting the Supabase channel status callback wired up correctly for the live indicator (D-04).

One infrastructure prerequisite exists: the `todos` table must be added to the `supabase_realtime` publication before subscriptions will fire. In production (cloud Supabase) this is done once via SQL. If the Supabase project was provisioned without this step, postgres_changes events will be silently ignored.

**Primary recommendation:** Implement `useTodosRealtime(onEvent)` as a standalone custom hook in `src/hooks/useTodosRealtime.ts`. Call it from `TodosPage`, passing a callback that calls `getTodos()` and `setTodos`. Consume the returned `ChannelStatus` to drive the `<LiveIndicator>` component inline with the page heading.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use **refetch-on-event** — when any `postgres_changes` event fires (INSERT, UPDATE, or DELETE on the `todos` table), call `getTodos()` to replace local state with fresh data from the DB. No payload merging, no dedup logic for same-tab optimistic echoes.
- **D-02:** Subscription lives on the todos page only. `TodoBentoCard` is NOT subscribed — it shows SSR loader data until next navigation/refresh.
- **D-03:** Set up the Supabase channel in a `useEffect` inside `TodosPage` (or a hook called from it), returning a cleanup function (`supabase.removeChannel(channel)`) to tear it down on unmount.
- **D-04:** Show a subtle live indicator on the todos page. `SUBSCRIBED` → "● Live" dot/badge. Reconnecting/disconnected → "Reconnecting...". Track via channel status callback.

### Claude's Discretion

- Exact indicator placement and visual style (near page title vs. inline at top of list)
- Lucide icon choice for the live dot (or a custom CSS pulsing dot)
- Whether to extract the subscription logic into a custom `useTodosRealtime` hook
- Exact channel name (e.g. `"todos-realtime"`)
- Whether to debounce rapid successive events before calling `getTodos()`

### Deferred Ideas (OUT OF SCOPE)

- Bento card realtime updates — bento card stays static (SSR loader data). Can be added in a future phase.
- Debounced refetch for high-frequency events — not needed for a personal tool.
- Offline support with IndexedDB / service workers — explicitly out of scope (REQUIREMENTS.md §Out of Scope).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REAL-01 | Todo changes (create/edit/delete) made in one browser tab are reflected in other open tabs without a manual refresh | Supabase `postgres_changes` subscription with refetch-on-event strategy (D-01); `useTodosRealtime` hook wires INSERT/UPDATE/DELETE events to `getTodos()` + `setTodos` |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

| Directive | Enforcement |
|-----------|-------------|
| Tech stack locked: TanStack Start + Tailwind + shadcn + Lucide + Supabase | No new libraries. `supabase.ts` client (anon key) is used client-side for the channel subscription. |
| All colours via single Tailwind CSS config palette — no hardcoded values | Live indicator must use `text-muted-foreground`, `bg-muted-foreground` tokens only. No hex/rgb/oklch in `.ts`/`.tsx`. |
| Each tool self-contained | Realtime hook lives under `src/hooks/` (aliased `#/hooks`) not inside any other tool's directory. |
| GSD workflow enforcement | All file changes go through `gsd:execute-phase`. |
| `supabase.ts` import boundary | `supabase.ts` (anon key client) may be imported in client-side files (hooks, components). `supabase-admin.ts` is server-only — must NOT be used in `useTodosRealtime`. |

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.100.1 | Realtime channel API (`supabase.channel().on().subscribe()`) | Only JS client that exposes the Supabase Realtime WebSocket protocol |
| React `useEffect` | (React 19, built-in) | Mount/unmount lifecycle for channel setup and cleanup | Standard React pattern; TanStack Router unmounts on navigation |
| `tailwindcss` `animate-pulse` | (v4, built-in via tw-animate-css) | Pulsing dot animation for "Live" state | Built into tw-animate-css, respects `prefers-reduced-motion` |

No new packages are required for this phase. All dependencies are already present.

**Installation:** None required.

### Supabase Realtime Prerequisites

The `todos` table must be enrolled in the `supabase_realtime` publication. If not already done:

```sql
alter publication supabase_realtime add table todos;
```

This is a one-time cloud Supabase operation (run in the Supabase SQL editor or via migration). Without it, the channel subscribes successfully but no events fire — the bug is silent and hard to diagnose.

---

## Architecture Patterns

### Recommended Project Structure (delta only — existing structure unchanged)

```
src/
├── hooks/
│   └── useTodosRealtime.ts   # NEW: custom hook (already has use-mobile.ts here)
├── routes/
│   └── _layout/
│       └── todos/
│           ├── index.tsx         # MODIFIED: consume hook + render LiveIndicator
│           └── -LiveIndicator.tsx # NEW: presentational component for the indicator
│                                 # (prefixed with - so TanStack Router ignores it)
```

The `src/hooks/` directory is already present (contains `use-mobile.ts`) and is aliased as `#/hooks` in both `tsconfig.json` and `components.json`. No `-` prefix needed for hook files in `src/hooks/` — TanStack Router only scans `src/routes/`.

### Pattern 1: Custom Hook `useTodosRealtime`

**What:** Encapsulates channel setup, teardown, and status tracking in a single reusable hook.

**When to use:** When subscription logic would otherwise clutter the page component with multiple `useState` + `useEffect` calls.

**Hook contract (from UI-SPEC):**

```typescript
// Source: 06-UI-SPEC.md §New Hook + @supabase/realtime-js RealtimeChannel.ts
type ChannelStatus = 'connecting' | 'live' | 'reconnecting';

function useTodosRealtime(onEvent: () => void): ChannelStatus
```

**Implementation skeleton:**

```typescript
// src/hooks/useTodosRealtime.ts
import { useEffect, useState } from "react";
import { supabase } from "#/lib/supabase";

type ChannelStatus = "connecting" | "live" | "reconnecting";

export function useTodosRealtime(onEvent: () => void): ChannelStatus {
  const [status, setStatus] = useState<ChannelStatus>("connecting");

  useEffect(() => {
    const channel = supabase
      .channel("todos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todos" },
        () => onEvent(),
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED")
          setStatus("reconnecting");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // empty deps — channel created once per mount

  return status;
}
```

**CRITICAL:** `onEvent` must NOT be in the dependency array. If it is, the channel will be torn down and recreated on every render where `onEvent` identity changes (e.g. every `TodosPage` render). Pass a stable callback or use `useRef` if needed.

### Pattern 2: `<LiveIndicator>` Presentational Component

**What:** A pure presentational component that takes `ChannelStatus` and renders the correct UI.

**Contract (from UI-SPEC):**

```tsx
// src/routes/_layout/todos/-LiveIndicator.tsx
// Prefixed with - to prevent TanStack Router scanning this as a route file

type ChannelStatus = "connecting" | "live" | "reconnecting";

function LiveIndicator({ status }: { status: ChannelStatus }) {
  if (status === "connecting") return null;  // no flash on initial load

  if (status === "live") {
    return (
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        <span className="size-2 rounded-full bg-muted-foreground animate-pulse" />
        Live
      </span>
    );
  }

  return (
    <span className="text-sm text-muted-foreground">
      Reconnecting...
    </span>
  );
}
```

**Placement in `TodosPage`:**

```tsx
// Replace: <h1 className="text-xl font-semibold">Todos</h1>
// With:
<div className="flex items-center justify-between">
  <h1 className="text-xl font-semibold">Todos</h1>
  <LiveIndicator status={channelStatus} />
</div>
```

### Supabase Channel Status → ChannelStatus Mapping

| Supabase `REALTIME_SUBSCRIBE_STATES` | Internal `ChannelStatus` |
|--------------------------------------|--------------------------|
| (initial — before first callback) | `'connecting'` |
| `"SUBSCRIBED"` | `'live'` |
| `"CHANNEL_ERROR"` | `'reconnecting'` |
| `"TIMED_OUT"` | `'reconnecting'` |
| `"CLOSED"` | `'reconnecting'` |

Source: `@supabase/realtime-js` `RealtimeChannel.ts` — `REALTIME_SUBSCRIBE_STATES` enum confirmed via source inspection.

### Anti-Patterns to Avoid

- **Including `onEvent` in `useEffect` deps:** Causes channel to be torn down and recreated on every render, defeating cleanup and generating duplicate subscriptions. Use `useRef` to hold a stable reference if the callback must change.
- **Using `supabase-admin` client for the channel:** `supabase-admin.ts` is server-only (uses `process.env` without `VITE_` prefix, never inlined into the browser bundle). Use `src/lib/supabase.ts` (anon key) for all client-side realtime subscriptions.
- **Creating multiple channels with different names on re-render:** If the component re-renders and the `useEffect` runs again without proper deps (or with wrong deps), `supabase.channel("todos-realtime")` will create a new channel without removing the old one. The empty deps array `[]` ensures single-run setup.
- **Not calling `supabase.removeChannel(channel)`:** Without cleanup, navigating away and back accumulates WebSocket connections. Each tab would have N channels after N navigations.
- **Merging realtime payload into state:** The payload from `postgres_changes` does not include related fields (e.g. computed columns). The refetch-on-event approach is locked (D-01) and is simpler.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket reconnection | Custom reconnection timer/loop | Supabase Realtime client auto-reconnects | The `@supabase/realtime-js` client handles reconnection internally; the status callback will fire `CHANNEL_ERROR` → (eventually) `SUBSCRIBED` on recovery |
| Cross-tab event bus | BroadcastChannel or SharedWorker | Supabase `postgres_changes` | The DB is the source of truth; all tabs subscribe independently |
| CSS pulsing dot animation | Custom `@keyframes` in styles.css | Tailwind `animate-pulse` (via tw-animate-css) | Already in the project; respects `prefers-reduced-motion` |

**Key insight:** The Supabase Realtime client already handles reconnection, back-off, and WebSocket lifecycle. The hook's only job is to set up the channel, forward events, expose status, and clean up.

---

## Runtime State Inventory

Step 2.5: SKIPPED — This phase is not a rename/refactor/migration. It adds new runtime behavior but does not rename any stored identifiers.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/supabase-js` | Realtime channel API | Yes (installed) | ^2.100.1 | — |
| Supabase cloud project (with Realtime enabled) | `postgres_changes` events | Assumed yes (used in Phase 3+) | — | Local Supabase CLI (`supabase start`) |
| `todos` table in `supabase_realtime` publication | Events actually firing | Unknown — must verify | — | Run `alter publication supabase_realtime add table todos;` |
| `tw-animate-css` | `animate-pulse` for live dot | Yes (imported in styles.css) | ^1.x | — |

**Missing dependencies with no fallback:** None blocking code execution.

**Action required before events fire:** Verify the `todos` table is enrolled in `supabase_realtime` publication. Check via Supabase SQL editor: `select * from pg_publication_tables where pubname = 'supabase_realtime';`. If `todos` is absent, run the `alter publication` statement. This is a DB-level prerequisite — the code will compile and run without it, but no events will arrive.

---

## Common Pitfalls

### Pitfall 1: `onEvent` Callback Causes Channel Churn

**What goes wrong:** The `useEffect` dependency array includes `onEvent`. Because `getTodos` is a `createServerFn` call (a new function reference each render), the channel is torn down and recreated on every render. Supabase connection count climbs. No events arrive during the reconnect window.

**Why it happens:** React's exhaustive-deps linting suggests adding all referenced values to deps. But for a subscription that should only set up once per mount, the callback must be stable.

**How to avoid:** Keep the `useEffect` deps array empty `[]`. If the ESLint/OXC rule flags `onEvent`, use a `useRef` to hold the latest callback:

```typescript
const onEventRef = useRef(onEvent);
useEffect(() => { onEventRef.current = onEvent; });
// In the channel handler: () => onEventRef.current()
```

**Warning signs:** Supabase dashboard shows connection count increasing with each `TodosPage` render.

### Pitfall 2: Publication Not Configured — Silent No-Events

**What goes wrong:** The channel subscribes successfully (status reaches `SUBSCRIBED`), but no INSERT/UPDATE/DELETE events ever arrive. Cross-tab sync appears to "not work".

**Why it happens:** `postgres_changes` subscriptions only fire for tables that are enrolled in the `supabase_realtime` Postgres publication. If the table was created without adding it to the publication, the subscription is established but no WAL changes are forwarded.

**How to avoid:** Add to the Wave 0 / pre-implementation checklist: run `select * from pg_publication_tables where pubname = 'supabase_realtime';` and confirm `todos` is present. If missing, run `alter publication supabase_realtime add table todos;` before verifying cross-tab sync.

**Warning signs:** Channel status reaches `SUBSCRIBED` but other tabs never update.

### Pitfall 3: Stale Closure Over `setTodos` in the Event Callback

**What goes wrong:** If `setTodos` is captured in the `useEffect` closure at mount time and the component re-renders (replacing the state setter reference), the event callback calls a stale setter that does nothing.

**Why it happens:** In React, `useState` returns a stable `setTodos` reference — this is NOT actually a problem for `setTodos`. However, if the pattern is modified to capture `todos` directly (e.g. for a diff-and-merge approach), the closure would be stale.

**How to avoid:** The refetch-on-event strategy (D-01) avoids this entirely: the event callback calls `getTodos()` and then calls `setTodos(result)` — `setTodos` from `useState` is stable, and `getTodos()` fetches fresh data each time. No captured state references needed.

**Warning signs:** Events fire (network tab shows WebSocket messages) but `todos` state does not update.

### Pitfall 4: Duplicate Channel Names Across Multiple Mounts

**What goes wrong:** Navigating away and back rapidly (before the previous cleanup runs) can result in two channels with the same name `"todos-realtime"` existing simultaneously.

**Why it happens:** React's cleanup function runs asynchronously after the paint. In concurrent mode, a second mount can begin before the first cleanup completes.

**How to avoid:** `supabase.removeChannel(channel)` is safe to call on an already-closed channel. The Supabase client handles the case where the same channel name is reused — it will replace the old channel. This is standard behavior and not a correctness issue for this use case.

**Warning signs:** Occasional duplicate events arriving (each event fires twice).

---

## Code Examples

### Complete `useTodosRealtime` Hook

```typescript
// Source: @supabase/realtime-js RealtimeChannel.ts (status enum)
//         Supabase postgres_changes docs (channel.on API)
//         06-UI-SPEC.md (hook contract)
import { useEffect, useRef, useState } from "react";
import { supabase } from "#/lib/supabase";

type ChannelStatus = "connecting" | "live" | "reconnecting";

export function useTodosRealtime(onEvent: () => void): ChannelStatus {
  const [status, setStatus] = useState<ChannelStatus>("connecting");
  // Stable ref so the effect doesn't need onEvent in its deps
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    const channel = supabase
      .channel("todos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todos" },
        () => onEventRef.current(),
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") {
          setStatus("live");
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          setStatus("reconnecting");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // empty — channel created once per mount

  return status;
}
```

### Consuming the Hook in `TodosPage`

```typescript
// Source: 06-CONTEXT.md D-01, D-04; 06-UI-SPEC.md §Placement
function TodosPage() {
  const { todos: initialTodos, error } = Route.useLoaderData();
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  // ...existing state...

  const channelStatus = useTodosRealtime(async () => {
    const fresh = await getTodos();
    setTodos(fresh);
  });

  // ...existing handlers + JSX...
  // Replace the <h1> with:
  // <div className="flex items-center justify-between">
  //   <h1 className="text-xl font-semibold">Todos</h1>
  //   <LiveIndicator status={channelStatus} />
  // </div>
}
```

### DB Publication Check (SQL)

```sql
-- Run in Supabase SQL editor to verify todos table is enrolled
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime';

-- If todos is absent, enroll it:
alter publication supabase_realtime add table todos;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/realtime-js` v1 direct (separate package) | Bundled into `@supabase/supabase-js` v2 | supabase-js v2 (2022) | No separate install needed; `supabase.channel()` is the entry point |
| `supabase.from('table').on('INSERT', cb).subscribe()` | `supabase.channel(name).on('postgres_changes', filter, cb).subscribe()` | supabase-js v2 | The old `.from().on()` API is removed; channel-based API is the only way |
| Vinxi-based TanStack Start | Vite-based TanStack Start | v1.121.0 | No impact on this phase; realtime is client-side only |

**Deprecated/outdated:**
- `supabase.from('table').on('*', callback)` — removed in supabase-js v2. Any docs showing this pattern are pre-v2.

---

## Open Questions

1. **Is `todos` already enrolled in `supabase_realtime` publication?**
   - What we know: The Supabase project was provisioned in Phase 3. The migration files are not in the repo (no `supabase/` directory found).
   - What's unclear: Whether the `alter publication` statement was run at project setup time.
   - Recommendation: Add a Wave 0 verification step: run the `pg_publication_tables` check in the Supabase SQL editor. If missing, add `alter publication supabase_realtime add table todos;` as a Wave 0 task.

2. **Should `useTodosRealtime` reset status to `'connecting'` on `removeChannel` cleanup?**
   - What we know: React strict mode double-invokes effects in dev. The cleanup runs and a new channel is created immediately. If status is not reset, the indicator may briefly show "Live" before the new channel reconnects.
   - What's unclear: Whether this flicker is visible in practice (the reconnect is usually <100ms).
   - Recommendation: The UI-SPEC defines "connecting" as invisible (render nothing), so resetting status in the cleanup (`setStatus("connecting")`) avoids any "Live" → invisible → "Live" flicker sequence that could be jarring in strict mode dev. Low-risk addition.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (dual-project config) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `bun run test` |
| Full suite command | `bun run test` |

**Project split:**
- `unit` project: `src/**/-*.test.ts` — node environment, TanStack Start transform
- `components` project: `src/**/-*.test.tsx` — jsdom environment, React

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REAL-01 | `useTodosRealtime` calls `onEvent` when a postgres_changes event fires | unit (hook logic) | `bun run test --project=components` | ❌ Wave 0 |
| REAL-01 | `useTodosRealtime` returns `'live'` when subscribe callback fires `"SUBSCRIBED"` | unit (hook logic) | `bun run test --project=components` | ❌ Wave 0 |
| REAL-01 | `useTodosRealtime` returns `'reconnecting'` when subscribe callback fires `"CHANNEL_ERROR"` | unit (hook logic) | `bun run test --project=components` | ❌ Wave 0 |
| REAL-01 | `useTodosRealtime` calls `removeChannel` on unmount | unit (hook logic) | `bun run test --project=components` | ❌ Wave 0 |
| REAL-01 | `<LiveIndicator>` renders nothing when status is `'connecting'` | component | `bun run test --project=components` | ❌ Wave 0 |
| REAL-01 | `<LiveIndicator>` renders "Live" text + pulsing dot when status is `'live'` | component | `bun run test --project=components` | ❌ Wave 0 |
| REAL-01 | `<LiveIndicator>` renders "Reconnecting..." text when status is `'reconnecting'` | component | `bun run test --project=components` | ❌ Wave 0 |
| REAL-01 | Cross-tab sync (create/edit/delete visible in other tab within ~3s) | manual only | — | manual |
| REAL-01 | No subscription accumulation after nav away/back 5x | manual only | — | manual |

**Note on hook testing:** `useTodosRealtime` uses `supabase.channel()` which must be mocked. The existing test pattern in `-AddTodoRow.test.tsx` and `-TodoBentoCard.test.tsx` uses `vi.mock()` for module-level mocking. The supabase client mock will need to return a chainable object: `{ channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })) }`.

**Note on naming:** Test files must use the `-` prefix convention: `src/hooks/-useTodosRealtime.test.ts` (unit) or `src/routes/_layout/todos/-LiveIndicator.test.tsx` (component). The vitest config matches `src/**/-*.test.ts` and `src/**/-*.test.tsx`.

### Sampling Rate

- **Per task commit:** `bun run test`
- **Per wave merge:** `bun run test && bun run lint && bun run fmt:check`
- **Phase gate:** Full suite green + manual cross-tab verification before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/hooks/-useTodosRealtime.test.ts` — covers REAL-01 hook behavior (mocked supabase channel)
- [ ] `src/routes/_layout/todos/-LiveIndicator.test.tsx` — covers REAL-01 indicator rendering across all three states

*(No framework install needed — Vitest already configured.)*

---

## Sources

### Primary (HIGH confidence)
- `@supabase/realtime-js` `RealtimeChannel.ts` (GitHub source) — `REALTIME_SUBSCRIBE_STATES` enum values (`SUBSCRIBED`, `TIMED_OUT`, `CLOSED`, `CHANNEL_ERROR`), `subscribe()` signature
- Supabase Realtime postgres_changes docs (https://supabase.com/docs/guides/realtime/postgres-changes) — channel API, `alter publication supabase_realtime`, event types, filter syntax
- `src/lib/supabase.ts` — confirmed client-side singleton using anon key, correct import for hooks
- `src/routes/_layout/todos/index.tsx` — confirmed existing `useState<Todo[]>`, `useEffect` pattern, `getTodos()` import
- `src/routes/todos/todos.functions.ts` — confirmed `getTodos()` server function signature
- `src/styles.css` — confirmed `@import "tw-animate-css"` (animate-pulse available), confirmed semantic token names (`--muted-foreground`, etc.)
- `vitest.config.ts` — confirmed dual-project setup, `-*.test.ts` / `-*.test.tsx` file patterns, jsdom environment for components
- `components.json` — confirmed `#/hooks` alias, `base` (not radix) primitives, `lucide` icon library
- `06-UI-SPEC.md` — approved UI contract (hook contract, indicator states, placement, color tokens, copywriting)
- `06-CONTEXT.md` — all four locked decisions (D-01 through D-04)

### Secondary (MEDIUM confidence)
- Supabase `postgres_changes` subscription pattern: verified across official docs + multiple community discussions showing the same `channel().on().subscribe()` API
- `useRef`-based stable callback pattern for `useEffect` subscriptions: standard React pattern, verified against React docs concept of stable refs

### Tertiary (LOW confidence)
- None — all critical claims are backed by source inspection or official docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, confirmed via source files
- Architecture patterns: HIGH — hook contract defined in approved UI-SPEC; Supabase API confirmed via source
- Pitfalls: HIGH — publication prerequisite and `onEvent` deps trap are well-documented in Supabase community; confirmed via source inspection
- Test infrastructure: HIGH — vitest.config.ts read directly; existing test files provide exact mocking patterns

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (Supabase JS v2 is stable; API unlikely to change in 30 days)
