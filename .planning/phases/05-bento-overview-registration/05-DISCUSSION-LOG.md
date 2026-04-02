# Phase 5: Bento Overview & Registration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 05-bento-overview-registration
**Areas discussed:** Status count layout, Attention item treatment, Card data fetching, Card visual weight

---

## Status Count Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Three inline badges | Horizontal row: ○ N  ◔ N  ✓ N — compact, uses same status icons as TodoRow | ✓ |
| Stacked label rows | Vertical list with label + count per row — more readable, more vertical space | |
| Big number + breakdown | Total count prominent, smaller breakdown below | |

**User's choice:** Three inline badges — horizontal row of icon+count using the same Circle/CircleDot/CircleCheck icons from TodoRow.

---

## Attention Item Treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Count badges | "⚠ 2 overdue" in destructive token, "▲ 3 high" in amber token | ✓ |
| Icon-only indicators | Warning/priority icon appears when items exist, no count | |

**Visibility question:**

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden when nothing flagged | Section disappears when no overdue/high items | ✓ |
| Always visible | Section always present, shows calm state | |

**User's choice:** Count badges, hidden when no flagged items. Clean by default, draws attention only when needed.

---

## Card Data Fetching

| Option | Description | Selected |
|--------|-------------|----------|
| Overview page loader | Loader calls getTodos(), passes data to card via props | ✓ |
| Card fetches its own data | Card calls getTodos() or getTodoStats() internally | |
| Dedicated getTodoStats() | New server function returning pre-aggregated counts | |

**Registry contract question:**

| Option | Description | Selected |
|--------|-------------|----------|
| Extend registry with loadData | Add loadData?: () => Promise<unknown> to ToolEntry; overview loader calls it per tool | ✓ |
| Keep registry minimal, just cast | Keep ToolEntry as-is; overview page explicitly fetches todos | |
| You decide | Claude picks approach satisfying FOUN-03/04 | |

**User's choice:** Extend registry with `loadData` — generic pattern that scales to future tools without changing the overview page.

---

## Card Visual Weight

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal stats | Title + status badges + attention flags when present | ✓ |
| Summary + next action | Stats + one highlighted item (most urgent overdue todo name) | |

**Visual style question:**

| Option | Description | Selected |
|--------|-------------|----------|
| Evolve the style | bg-card with violet hover ring — more polished than placeholder | ✓ |
| Keep placeholder style | border-neutral-700 bg-neutral-900 hover:border-violet-400 | |

**User's choice:** Minimal stats with evolved card style (bg-card, border-primary/50 hover).

---

## Claude's Discretion

- Exact card padding and spacing
- Lucide icon choice for attention flags
- Hover/focus ring implementation details
- Whether to use Skeleton on overview page while loadData resolves

## Deferred Ideas

None — discussion stayed within phase scope.
