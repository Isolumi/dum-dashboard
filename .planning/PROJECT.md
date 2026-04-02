# Personal Dashboard

## What This Is

A personal dashboard that centralizes all of your tools in one place. Each tool gets its own dedicated page, plus a centralized bento-box overview page showing summaries across all tools. Starting with a todo app; designed for easy expansion as new tools are added.

## Core Value

A single place to see and manage all your personal tools — starting with todos, built to grow.

## Requirements

### Validated

- [x] Predefined colour palette with a single source of truth for all colours — Validated in Phase 01: Foundation (FOUN-01, FOUN-02)
- [x] Todo data persisted to Supabase and survives page refresh — Validated in Phase 03: Supabase Data Layer (TODO-07)

### Active

- [ ] Bento box overview page showing a summary card for each active tool
- [ ] Sidebar navigation to switch between the overview and individual tool pages
- [x] Todo tool: create, view, edit, and delete todo items with name, priority (high/medium/low), status (not started/started/complete), and due date — Validated in Phase 04: Todo Tool (TODO-01 through TODO-06)
- [ ] Todo data synced to Supabase in real time
- [ ] Modular tool architecture so new tools can be added without restructuring

### Out of Scope

- Authentication / multi-user — personal tool only, no login needed for v1
- Other tools beyond todos — deferred until todo tool is complete and validated
- Mobile-specific layout — not a current priority

## Context

- Phase 04 complete — Todo tool live: full CRUD UI with inline editing, status cycling, priority popover, due date with overdue detection, optimistic mutations, error dismissal
- Phase 03 complete — Supabase data layer live: typed client singleton, todos table with enums, 5 CRUD server functions (Zod-validated), bundle isolation confirmed
- Phase 01 complete — TanStack Start scaffold running with shadcn/ui base-nova, Tailwind v4 OKLCH token system, OXC tooling
- Greenfield project starting from scratch
- Personal use only (no auth, no multi-tenancy)
- Stack is fully decided: TanStack Start, Tailwind CSS, shadcn/ui, Lucide icons, OXC (linting + formatting), Supabase (Postgres + realtime)
- Modularity is a first-class concern — the bento overview page should be composed from per-tool summary components that tools register themselves

## Constraints

- **Tech Stack**: TanStack Start + Tailwind + shadcn + Lucide + OXC + Supabase — locked, no deviations
- **Colour System**: All colours defined via a single Tailwind CSS config palette — no hardcoded colour values in components
- **Modularity**: Each tool must be self-contained (its own page, its own bento card, its own DB schema) so it can be added, swapped, or removed independently

## Key Decisions

| Decision                        | Rationale                                                                 | Outcome   |
| ------------------------------- | ------------------------------------------------------------------------- | --------- |
| Supabase for database           | Hosted Postgres with real-time, easy to set up, scales for personal tools | ✓ Validated Phase 03 — client singleton, todos table, CRUD functions all working |
| Sidebar + bento overview layout | Each tool gets full-page focus; overview gives a bird's-eye view          | — Pending |
| OXC for linting/formatting      | Faster than ESLint/Prettier, modern replacement                           | ✓ Validated Phase 01 — oxlint 1.57.0 + oxfmt 0.42.0 pass with 0 violations |
| TanStack Start for routing/SSR  | File-based routing, full-stack React, matches the ecosystem               | ✓ Validated Phase 01 — scaffold complete, dev server starts cleanly |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-04-02 after Phase 04 completion (all 30 tests passing, gap plans closed)_
