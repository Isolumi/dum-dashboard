# Phase 5: Bento Overview & Registration - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Register the todo tool in the tool registry with a real `TodoBentoCard` component that shows live status counts and attention flags. The overview page bento grid is already scaffolded from Phase 2 — the work is the card content, the registry `loadData` contract, and wiring the overview loader to feed data to each card.

Requirements in scope: OVER-01, OVER-02, BENT-01, BENT-02, BENT-03

Out of scope: Supabase Realtime subscriptions (Phase 6), sorting/filtering, any tool other than todos.

</domain>

<decisions>
## Implementation Decisions

### Status Count Layout

- **D-01:** Display the three status buckets as inline icon+count badges in a horizontal row: ○ N  ◔ N  ✓ N — uses the same Circle / CircleDot / CircleCheck icons already established in `TodoRow`, keeping the visual language consistent.
- **D-02:** Status icons use the same color tokens as in `TodoRow`: `text-muted-foreground` for not_started, `text-primary` (violet) for started, `text-muted-foreground` for complete.

### Attention Item Treatment (BENT-02)

- **D-03:** Overdue and high-priority items are flagged with count badges: e.g. "⚠ 2 overdue" in destructive color token, "▲ 3 high" in amber color token — same `destructive` and `amber-400` tokens already used in the todo list priority styles.
- **D-04:** The attention section is **hidden entirely** when no items are flagged (no overdue, no high-priority). Card is clean by default; flags appear only when they need attention.
- **D-05:** Overdue definition: `due_date` is not null AND `due_date < today` AND `status !== 'complete'` — mirrors the overdue detection pattern already used in the todo list.

### Card Data Fetching

- **D-06:** The overview page's TanStack Router `loader` fetches all registered tool data — one fetch per tool. It calls each tool's `loadData()` function (see D-07) and passes the results as a `data` prop alongside `tool`.
- **D-07:** Extend `ToolEntry` in `src/tools/registry.ts` with an optional `loadData?: () => Promise<unknown>` field. The overview loader calls each tool's `loadData()` if present and passes the result as `data: unknown` to the `BentoCard` component.
- **D-08:** Update `BentoCard` type in `ToolEntry` to `ComponentType<{ tool: ToolEntry; data: unknown }>`. `TodoBentoCard` casts `data` to `Todo[]` internally. `PlaceholderBentoCard` ignores the `data` prop. This satisfies FOUN-04 (adding a new tool requires only registry entry + route + bento card — no changes to the overview page).
- **D-09:** The `loadData` for todos calls the existing `getTodos()` server function — no new server function needed. Stats are computed client-side inside `TodoBentoCard` from the returned `Todo[]`.

### Card Visual Style

- **D-10:** Use `bg-card` (slightly elevated surface token) with a `border-border` border and rounded-lg corners. On hover: `border-primary/50` ring (violet, semi-transparent) — more polished than the placeholder's flat `border-neutral-700` hover.
- **D-11:** Card is fully clickable (wrapped in `Link to="/todos"`) — satisfies BENT-03. Click target is the entire card, not just a button inside it.
- **D-12:** Card layout: title row (icon + "Todos" label + arrow icon right-aligned), then status badges row, then optional attention flags row at bottom.

### File Location

- **D-13:** `TodoBentoCard` lives at `src/routes/_layout/todos/-TodoBentoCard.tsx` (prefixed with `-` to prevent TanStack Router scanning it as a route candidate). The overview page imports it only via the registry — no direct import from overview to todo tool files.

### Claude's Discretion

- Exact card padding and spacing
- Lucide icon choice for the attention flags (e.g. `AlertCircle` for overdue, `ArrowUp` for high-priority)
- Exact hover/focus ring implementation
- Whether to use a `Skeleton` loading state on the overview page while `loadData` resolves

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Overview — OVER-01 (bento grid), OVER-02 (cards from tools)
- `.planning/REQUIREMENTS.md` §Todo Bento Card — BENT-01 (status counts), BENT-02 (overdue + high-priority flags), BENT-03 (click to navigate)
- `.planning/ROADMAP.md` §Phase 5 — goal, success criteria (all 5 must be TRUE)

### Existing code — read before implementing
- `src/tools/registry.ts` — current `ToolEntry` interface and `tools` array (needs `loadData` + `BentoCard` prop type update)
- `src/tools/PlaceholderBentoCard.tsx` — existing placeholder; needs `data` prop added (can ignore it)
- `src/routes/index.tsx` — current overview page (may need to read its loader pattern)
- `src/routes/_layout/todos/-TodoRow.tsx` — status icon constants (`STATUS_ICONS`, `PRIORITY_STYLES`) and overdue detection pattern to mirror in the bento card
- `src/routes/todos/todos.functions.ts` — `getTodos()` server function signature; `Todo` type
- `src/lib/database.types.ts` — `Todo`, `TodoPriority`, `TodoStatus` types
- `src/styles.css` — all `@theme` tokens; destructive, amber-400, primary, muted-foreground, card, border
- `CLAUDE.md` §Colour System — no hardcoded hex/oklch in components, all via `@theme` tokens

### Phase constraints (inherited)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-01 (dark mode only), D-05 (all Tailwind utilities via `@theme` tokens)
- `.planning/phases/02-route-shell-and-tool-registry/02-CONTEXT.md` — tool registry contract, overview grid structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Circle`, `CircleDot`, `CircleCheck` (Lucide): already used in `TodoRow` for status icons — reuse exact same icons in `TodoBentoCard`
- `PRIORITY_STYLES` record in `-TodoRow.tsx`: `high: "bg-destructive/20 text-destructive"`, `medium: "bg-amber-400/20 text-amber-400"`, `low: "text-muted-foreground"` — mirror the same token-based approach for attention flags
- `getTodos()` server function: already exists in `todos.functions.ts`, returns `Todo[]`
- `Link` from TanStack Router: used in `PlaceholderBentoCard` — reuse for card click navigation
- `Skeleton` from shadcn/ui: available for loading state on overview page

### Established Patterns
- Route files prefixed with `-` to prevent TanStack Router scanning (`-TodoRow.tsx`, `-AddTodoRow.tsx`)
- All colors via `@theme` semantic tokens — no raw OKLCH or hex in components
- Server functions called from route loaders (not client-side useQuery) for SSR-compatible data loading
- `createFileRoute("/_layout/...")` for all routes inside the sidebar layout

### Integration Points
- `src/tools/registry.ts`: add `loadData` to `ToolEntry`, update `BentoCard` prop type, replace `PlaceholderBentoCard` for todos entry with `TodoBentoCard`
- Overview page loader: iterate `tools`, call each `loadData()`, pass results to card renders
- `src/routes/_layout/todos/`: new `-TodoBentoCard.tsx` file in the todo tool directory

</code_context>

<specifics>
## Specific Ideas

- The card mockup confirmed during discussion:
  ```
  ┌─────────────────────────────┐
  │ ☑ Todos               →  │
  │                             │
  │  ○ 4  ◔ 2  ✓ 8             │
  │                             │
  │  ⚠ 2 overdue  ▲ 3 high       │
  └─────────────────────────────┘
  ```
- Attention row hidden entirely when no overdue/high-priority items exist
- Card is the whole clickable area (not a button inside it)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-bento-overview-registration*
*Context gathered: 2026-04-02*
