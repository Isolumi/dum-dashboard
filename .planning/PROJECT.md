# Personal Dashboard

## What This Is

A personal dashboard that centralizes all of your tools in one place. Each tool gets its own dedicated page, plus a centralized bento-box overview page showing summaries across all tools. v1 shipped with a full todo app (create/edit/delete, priorities, due dates, realtime sync); designed for easy expansion as new tools are added.

## Core Value

A single place to see and manage all your personal tools — starting with todos, built to grow.

## Current State

**v1 shipped 2026-04-02** — 6 phases, 18 plans, 45 tests passing, 3,493 LOC TypeScript.

Stack: TanStack Start v1.167 + Tailwind v4 OKLCH + shadcn/ui base-nova + OXC (oxlint + oxfmt) + Supabase (Postgres + Realtime)

What's live:
- Sidebar navigation with active state, driven by tool registry
- Overview page with bento grid (TodoBentoCard with live status counts and attention flags)
- Full todo CRUD: create (keyboard-first), inline edit, status cycling, priority popover, due date with overdue detection
- Supabase realtime sync: create/edit/delete in one tab reflects in all others within ~3s
- Optimistic LiveIndicator showing connection status

## Requirements

### Validated

- [x] Predefined colour palette with single source of truth — v1 (FOUN-01, FOUN-02)
- [x] Tool registry as single source of truth for sidebar + overview — v1 (FOUN-03, FOUN-04)
- [x] Sidebar navigation with active state indication — v1 (NAV-01, NAV-02, NAV-03)
- [x] Bento box overview page with per-tool summary cards — v1 (OVER-01, OVER-02, BENT-01, BENT-02, BENT-03)
- [x] Full todo CRUD with priority, status, due date, keyboard shortcuts — v1 (TODO-01 through TODO-06)
- [x] Todo data persisted to Supabase, survives page refresh — v1 (TODO-07)
- [x] Todo changes synced in real time across tabs — v1 (REAL-01)

### Active (v2 candidates)

- [ ] Sort/filter todo list by priority, status, or due date (TODOV2-01)
- [ ] Additional tools: habit tracker, notes/journal, bookmarks (TOOLV2-01, TOOLV2-02, TOOLV2-03)
- [ ] Mobile-optimised layout (MOBL-01)

### Out of Scope

- Authentication / multi-user — personal tool only, no login needed
- Subtasks / nested todos — schema complexity disproportionate to value
- Tags / labels / projects — priority + status sufficient for v1
- Drag-and-drop reordering — deferred
- Recurring tasks — non-trivial rule engine, deferred
- Push / browser notifications — overkill for personal use
- Offline support — significant infra, deferred

## Context

**v1 complete** — all 20 v1 requirements shipped and verified. Tool registry pattern established; adding a new tool requires only a registry entry, route directory, and bento card component — no changes to shared layout code.

Notable: TDD used throughout. OXC (oxlint + oxfmt) enforced zero violations at every phase. Supabase realtime uses optimistic LiveIndicator with `hasSubscribed` guard to prevent false error flashes during channel setup handshake.

## Key Decisions

| Decision | Rationale | Outcome |
| -------- | --------- | ------- |
| TanStack Start for routing/SSR | File-based routing, full-stack React, matches the ecosystem | ✓ v1 — scaffold complete, type-safe server functions throughout |
| Supabase for database + realtime | Hosted Postgres with realtime, easy setup, scales for personal tools | ✓ v1 — CRUD + realtime both working |
| Sidebar + bento overview layout | Each tool gets full-page focus; overview gives bird's-eye view | ✓ v1 — tool registry drives both with zero hardcoded references |
| OXC (oxlint + oxfmt) | Faster than ESLint/Prettier, modern replacement | ✓ v1 — 0 violations throughout, Tailwind class sorting built-in |
| OKLCH token system via @theme | Single source of truth for all colours, Tailwind v4 native | ✓ v1 — FOUN-01/02 enforced, no hardcoded values in any component |
| onEventRef + hasSubscribed pattern | Stable callback ref + guard prevents channel churn and error flashes | ✓ v1 — realtime works cleanly with optimistic 'live' initial state |
| TDD throughout | Tests written before implementation; catches regressions early | ✓ v1 — 45 tests, 0 regressions across all phases |

## Constraints

- **Tech Stack**: TanStack Start + Tailwind + shadcn + Lucide + OXC + Supabase — locked, no deviations
- **Colour System**: All colours defined via a single Tailwind CSS config palette — no hardcoded colour values in components
- **Modularity**: Each tool must be self-contained (its own page, its own bento card, its own DB schema) so it can be added, swapped, or removed independently

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements validated? → Move to Validated with phase reference
2. New requirements emerged? → Add to Active
3. Decisions to log? → Add to Key Decisions

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Current State

---

_Last updated: 2026-04-02 after v1 milestone completion — all 20 requirements shipped_
