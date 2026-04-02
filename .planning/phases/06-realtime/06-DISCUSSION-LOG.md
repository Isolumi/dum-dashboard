# Phase 6: Realtime - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 06-realtime
**Areas discussed:** Realtime update strategy, Bento card scope, Connection status UX

---

## Realtime Update Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Refetch on event | Call getTodos() whenever any INSERT/UPDATE/DELETE event fires. Always consistent with DB, simple — no dedup logic needed. Optimistic updates stay on the mutating tab; other tabs get a fresh fetch. Minor extra network call per event. | ✓ |
| Merge event payload | Apply raw INSERT/UPDATE/DELETE payloads directly into state. No extra network call. Requires dedup logic to avoid double-applying changes already applied optimistically on the mutating tab. | |
| Realtime-only (drop optimistic) | Remove optimistic mutations entirely; wait for the realtime event to confirm and update state. Simplest architecture, zero dedup, but same-tab mutations feel sluggish. | |

**User's choice:** Refetch on event
**Notes:** Optimistic updates stay in place on the mutating tab. The refetch from a same-tab echo is a no-op cost, not a problem.

---

## Bento Card Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — bento card too | Overview bento card also subscribes to realtime events and refetches its data when changes arrive. | |
| No — todos page only | Realtime applies only to the todos page. Bento card shows stale SSR loader data until next navigation/refresh. | ✓ |

**User's choice:** Todos page only
**Notes:** REAL-01 is satisfied by the todos page alone. Overview bento card staleness is acceptable.

---

## Connection Status UX

| Option | Description | Selected |
|--------|-------------|----------|
| Silent reconnect | Let the Supabase SDK auto-reconnect silently. No UI change. | |
| Subtle live indicator | Show a small "Live" badge/dot when connected, "Reconnecting..." when dropped. | ✓ |
| Alert on reconnect failure only | No indicator during normal use; destructive Alert only if subscription fails to establish. | |

**User's choice:** Subtle live indicator
**Notes:** Small "Live" dot when `SUBSCRIBED`, "Reconnecting..." when channel drops/reconnects.

---

## Claude's Discretion

- Exact indicator placement and visual style
- Lucide icon choice for the live dot
- Whether to extract subscription logic into a `useTodosRealtime` hook
- Channel name convention
- Whether to debounce rapid successive events

## Deferred Ideas

- Bento card realtime updates — reviewed and deferred; bento card stays static for now
