# Phase 5: Bento Overview & Registration - Research

**Researched:** 2026-04-02
**Domain:** TanStack Start route loaders, tool registry contract, React component composition, Tailwind v4 semantic tokens
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Status counts displayed as inline icon+count badges in a horizontal row using `Circle / CircleDot / CircleCheck` icons from `TodoRow` — same color tokens as `TodoRow`.
- **D-02:** Status icon colors: `text-muted-foreground` for not_started, `text-primary` (violet) for started, `text-muted-foreground` for complete.
- **D-03:** Attention flags as count badges: "⚠ N overdue" in `destructive` token, "▲ N high" in `amber-400` token — mirrors existing `PRIORITY_STYLES` tokens.
- **D-04:** Attention row hidden entirely when no overdue/high-priority items (no invisible/opacity-0 — absent from DOM).
- **D-05:** Overdue definition: `due_date !== null AND due_date < today AND status !== 'complete'` — mirrors overdue detection in TodoRow.
- **D-06:** Overview page TanStack Router `loader` calls each tool's `loadData()` and passes result as `data` prop alongside `tool`.
- **D-07:** Extend `ToolEntry` in `src/tools/registry.ts` with optional `loadData?: () => Promise<unknown>`.
- **D-08:** Update `BentoCard` type in `ToolEntry` to `ComponentType<{ tool: ToolEntry; data: unknown }>`. `TodoBentoCard` casts `data` to `Todo[]` internally. `PlaceholderBentoCard` ignores `data`.
- **D-09:** `loadData` for todos calls existing `getTodos()` server function — no new server function. Stats computed client-side in `TodoBentoCard` from `Todo[]`.
- **D-10:** Card style: `bg-card`, `border-border`, `rounded-lg`. Hover: `border-primary/50` ring (violet semi-transparent).
- **D-11:** Entire card is clickable via `Link to="/todos"` — no separate button.
- **D-12:** Card layout: title row (icon + label + arrow right-aligned) → status badges row → optional attention flags row.
- **D-13:** `TodoBentoCard` at `src/routes/_layout/todos/-TodoBentoCard.tsx` (- prefix prevents TanStack Router scanning). Overview imports only via registry.

### Claude's Discretion

- Exact card padding and spacing
- Lucide icon choice for attention flags (e.g. `AlertCircle` for overdue, `ArrowUp` for high-priority)
- Exact hover/focus ring implementation
- Whether to use a `Skeleton` loading state on the overview page while `loadData` resolves

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OVER-01 | User sees a bento box grid on the overview page with one summary card per registered tool | Overview page loader pattern + registry iteration already scaffolded; loader needs `loadData` wiring |
| OVER-02 | Each bento card is provided by its tool (not hardcoded in the overview page) | Registry `BentoCard` prop + `loadData` contract (D-07, D-08) enables this; no direct overview→todo imports |
| BENT-01 | Todo bento card shows count of todos grouped by status (not started / started / complete) | `getTodos()` returns `Todo[]`; status counts computed client-side; `TodoStatus` enum confirmed in `database.types.ts` |
| BENT-02 | Todo bento card visually flags overdue items and high-priority items | Overdue detection pattern confirmed in `TodoRow`; `PRIORITY_STYLES` tokens confirmed; `destructive` + `amber-400` tokens in `styles.css` |
| BENT-03 | User can click the todo bento card to navigate to the full todo page | `Link` from TanStack Router already used in `PlaceholderBentoCard`; `/todos` route confirmed in `_layout/todos/index.tsx` |
</phase_requirements>

---

## Summary

Phase 5 is a well-scoped wiring task. The overview page, tool registry, and `PlaceholderBentoCard` already exist from Phase 2. The todo data layer (`getTodos()`, `Todo` type, status/priority enums) is fully operational from Phases 3–4. The `TodoBentoCard` component is the primary new artifact.

The core pattern is straightforward: extend `ToolEntry` with `loadData?` and a `data: unknown` prop on `BentoCard`, update the overview loader to collect data from each registered tool's `loadData()` in parallel, and implement `TodoBentoCard` that casts `data as Todo[]`, computes five derived counts, and renders the card mockup from CONTEXT.md.

The UI-SPEC (05-UI-SPEC.md, status: approved) is the design contract the executor must follow. No new shadcn components need to be installed. The PlaceholderBentoCard has FOUN-02 violations (raw palette classes) that must be fixed as part of the prop-type update.

**Primary recommendation:** Implement the registry extension and `TodoBentoCard` in two focused tasks. Keep the overview page loader minimal (one `Promise.all` over `tools.map(t => t.loadData?.())`). Do not introduce TanStack Query — the SSR loader pattern is sufficient and already established.

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-start` | latest (~1.167) | Route `loader` for SSR data fetching | Established in Phase 2; `createFileRoute` loader pattern is the project standard |
| `@tanstack/react-router` | latest (~1.167) | `Link` component for card navigation | Already used in `PlaceholderBentoCard` and throughout the project |
| `lucide-react` | ^0.545.0 | Icons: `Circle`, `CircleDot`, `CircleCheck`, `CheckSquare`, `ArrowRight`, `AlertCircle`, `ArrowUp` | All confirmed in `TodoRow` and UI-SPEC; tree-shakable named exports |
| `tailwindcss` | ^4.1.18 (v4) | Utility classes via `@theme` semantic tokens | Project standard — CSS-first config in `styles.css` |
| TypeScript | ^5.7.2 | Type safety for registry contract change | Required; `ComponentType<{ tool: ToolEntry; data: unknown }>` is the new type |

### No New Dependencies

This phase requires zero new npm packages. All needed libraries are already installed.

---

## Architecture Patterns

### Existing Structure (confirmed by reading source)

```
src/
├── tools/
│   ├── registry.ts               # ToolEntry interface + tools array — NEEDS loadData + BentoCard type update
│   └── PlaceholderBentoCard.tsx  # Existing placeholder — NEEDS data prop + FOUN-02 fixes
├── routes/
│   └── _layout/
│       ├── index.tsx             # Overview page — NEEDS loader + data prop pass-through
│       └── todos/
│           ├── index.tsx         # Todos page (existing, untouched)
│           ├── -TodoRow.tsx      # Status icons + PRIORITY_STYLES to mirror (read-only reference)
│           ├── -AddTodoRow.tsx   # Existing (untouched)
│           └── -TodoBentoCard.tsx  # NEW — primary deliverable
└── routes/todos/
    └── todos.functions.ts        # getTodos() server function — called by loadData
```

### Pattern 1: Registry `loadData` Extension

**What:** Add optional `loadData?: () => Promise<unknown>` to `ToolEntry`. Overview loader calls it per tool.
**When to use:** Every tool that needs data in its bento card implements `loadData`.
**Example:**

```typescript
// src/tools/registry.ts
import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckSquare } from "lucide-react";
import { PlaceholderBentoCard } from "./PlaceholderBentoCard";
import { TodoBentoCard } from "#/routes/_layout/todos/-TodoBentoCard";
import { getTodos } from "#/routes/todos/todos.functions";

export interface ToolEntry {
  id: string;
  label: string;
  route: string;
  icon: LucideIcon;
  BentoCard: ComponentType<{ tool: ToolEntry; data: unknown }>;
  loadData?: () => Promise<unknown>;
}

export const tools: ToolEntry[] = [
  {
    id: "todos",
    label: "Todos",
    route: "/todos",
    icon: CheckSquare,
    BentoCard: TodoBentoCard,
    loadData: getTodos,
  },
];
```

### Pattern 2: Overview Loader with Parallel Data Fetching

**What:** Route `loader` in `_layout/index.tsx` calls all registered `loadData()` functions in parallel, passes per-tool results to cards.
**When to use:** Overview page must aggregate data across all registered tools.
**Example:**

```typescript
// src/routes/_layout/index.tsx
export const Route = createFileRoute("/_layout/")({
  loader: async () => {
    const results = await Promise.all(
      tools.map((tool) => tool.loadData?.() ?? Promise.resolve(null))
    );
    const toolData: Record<string, unknown> = {};
    tools.forEach((tool, i) => {
      toolData[tool.id] = results[i];
    });
    return { toolData };
  },
  pendingComponent: OverviewLoading,
  errorComponent: OverviewError,
  component: OverviewPage,
});

function OverviewPage() {
  const { toolData } = Route.useLoaderData();
  return (
    <main className="p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {tools.map((tool) => (
          <tool.BentoCard key={tool.id} tool={tool} data={toolData[tool.id]} />
        ))}
      </div>
    </main>
  );
}
```

### Pattern 3: TodoBentoCard — Data Cast and Count Derivation

**What:** `TodoBentoCard` receives `data: unknown`, casts to `Todo[]`, derives five counts, renders card.
**When to use:** Any bento card that requires typed data from an `unknown` loader result.
**Key insight:** Counts are derived inline (filter + length) — no memoization needed at this scale.

```typescript
// src/routes/_layout/todos/-TodoBentoCard.tsx
import type { ToolEntry } from "#/tools/registry";
import type { Todo } from "#/lib/database.types";

export function TodoBentoCard({ tool, data }: { tool: ToolEntry; data: unknown }) {
  const todos = Array.isArray(data) ? (data as Todo[]) : [];
  const today = new Date().toISOString().split("T")[0];

  const notStartedCount = todos.filter((t) => t.status === "not_started").length;
  const startedCount = todos.filter((t) => t.status === "started").length;
  const completeCount = todos.filter((t) => t.status === "complete").length;
  const overdueCount = todos.filter(
    (t) => t.due_date !== null && t.due_date < today && t.status !== "complete"
  ).length;
  const highPriorityCount = todos.filter(
    (t) => t.priority === "high" && t.status !== "complete"
  ).length;
  // ... render
}
```

### Pattern 4: Pending (Skeleton) Component

**What:** `pendingComponent` on the overview route renders skeleton cards while loader runs.
**When to use:** TanStack Router shows `pendingComponent` automatically during loader suspension.
**Example structure** (from UI-SPEC):

```tsx
function OverviewLoading() {
  return (
    <main className="p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {tools.map((tool) => (
          <div key={tool.id} className="rounded-lg border border-border bg-card p-6">
            <Skeleton className="mb-4 h-4 w-24" />
            <Skeleton className="mb-3 h-4 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </main>
  );
}
```

### Pattern 5: Error Component

**What:** TanStack Router `errorComponent` receives `{ error }` prop and renders inline error message.
**When to use:** When the loader throws (e.g. Supabase unreachable).
**Copy from UI-SPEC:** "Could not load overview. Refresh to try again." — `text-sm text-destructive`.

### Anti-Patterns to Avoid

- **Importing TodoBentoCard directly in overview page:** Violates OVER-02 and FOUN-04. All card access must go through the registry.
- **Computing counts in `loadData`:** `loadData` returns raw `Todo[]` — stats are computed inside the card component (D-09). Keeps `loadData` generic.
- **Using `data-prop` TanStack Query on the overview:** The route `loader` already provides SSR-compatible data fetching. No need to add `useQuery` for a personal tool with no concurrent updates to the overview.
- **Hardcoded hex/oklch/rgb in component files:** FOUN-01/FOUN-02 are hard constraints. Use only semantic tokens from `@theme`.
- **Raw palette classes in PlaceholderBentoCard:** The existing `neutral-700`, `neutral-900`, `neutral-100`, `neutral-400`, `violet-400` classes must be replaced with semantic tokens during the `data` prop update.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parallel data fetching across tools | Custom async sequencing | `Promise.all(tools.map(...))` | Standard JS concurrency; no library needed |
| Loading skeleton UI | Custom `animate-pulse` divs | `Skeleton` from shadcn (already installed at `src/components/ui/skeleton.tsx`) | Consistent with Phase 4 pattern in `TodosLoading` |
| Navigation on card click | `onClick` + `router.navigate()` | `Link` from `@tanstack/react-router` wrapping the entire card | Handles prefetch, keyboard navigation, accessibility automatically |
| Overdue date comparison | Custom date library | Native `new Date().toISOString().split("T")[0]` string comparison | Mirrors exact pattern already used in `TodoRow.tsx` line 63–64 |

**Key insight:** This phase is almost entirely wiring existing primitives — the hardest part is the TypeScript interface change to `ToolEntry` flowing through `PlaceholderBentoCard` and the overview page simultaneously.

---

## Common Pitfalls

### Pitfall 1: TypeScript Error Cascade from ToolEntry Change

**What goes wrong:** Changing `BentoCard: ComponentType<{ tool: ToolEntry }>` to `ComponentType<{ tool: ToolEntry; data: unknown }>` breaks `PlaceholderBentoCard` (which currently only declares `{ tool: ToolEntry }`), and any existing call site that renders `<tool.BentoCard tool={tool} />` without `data`.
**Why it happens:** TypeScript's assignability check fails — a component that accepts `{ tool }` is not assignable to `ComponentType<{ tool; data }>` because the `data` prop is required.
**How to avoid:** Update `PlaceholderBentoCard` to accept `{ tool: ToolEntry; data: unknown }` (even if `data` is ignored). Update every `<tool.BentoCard ... />` call site to pass `data={toolData[tool.id]}`.
**Warning signs:** TS2322 / TS2769 errors on `BentoCard` assignment in registry or render in overview.

### Pitfall 2: FOUN-02 Violation in PlaceholderBentoCard

**What goes wrong:** Leaving raw palette classes (`neutral-700`, `neutral-900`, `neutral-100`, `neutral-400`, `violet-400`) in `PlaceholderBentoCard` after the update.
**Why it happens:** The component was written in Phase 2 before FOUN-02 was fully enforced.
**How to avoid:** When touching the file for the `data` prop addition, simultaneously fix all colour violations per the UI-SPEC mapping: `neutral-900` → `bg-card`, `neutral-700` → `border-border`, `neutral-100` → `text-foreground`, `neutral-400` → `text-muted-foreground`, `violet-400` hover → `hover:border-primary/50`.
**Warning signs:** Verification gate check `grep "neutral-\|violet-400" src/tools/PlaceholderBentoCard.tsx` returns matches.

### Pitfall 3: Circular Import Between Registry and TodoBentoCard

**What goes wrong:** `registry.ts` imports `TodoBentoCard`, which imports from `todos.functions.ts`, which imports `supabaseAdmin`. If the registry is imported in a client-only context, the server-only supabase client would be bundled client-side.
**Why it happens:** `createServerFn` compiler transform only isolates server code in files that call it. The `getTodos` function reference is passed as a value to `loadData`, not called at module load.
**How to avoid:** `loadData: getTodos` passes the server function as a reference (safe). The transform ensures `getTodos` body runs server-side when called. Registry import chain is fine because `getTodos` is a `createServerFn` handle, not a raw function.
**Warning signs:** Build errors about `process.env` or Supabase imports in client bundle. (Unlikely given existing pattern, but worth verifying.)

### Pitfall 4: Overdue Count Uses Wrong Date Comparison

**What goes wrong:** Using `new Date(t.due_date) < new Date()` (with time component) instead of a date-only comparison. A todo due "today" would appear overdue after midnight until `new Date()` exceeds midnight of the due date, which works correctly — but compare to the exact pattern in `TodoRow`.
**Why it happens:** `TodoRow` uses `new Date(new Date().toISOString().split("T")[0])` to strip time, then compares. `TodoBentoCard` should use the same pattern to stay consistent.
**How to avoid:** Use string comparison: `t.due_date < new Date().toISOString().split("T")[0]` (ISO date strings are lexicographically comparable). This is cleaner than constructing Date objects and is identical in behaviour to the `TodoRow` pattern.
**Warning signs:** Overdue count in card differs from overdue indication in TodoRow for same-day due items.

### Pitfall 5: `_layout.tsx` Has FOUN-02 Violation Too

**What goes wrong:** `_layout.tsx` line 14 uses `border-neutral-700` in the header (`border-b border-neutral-700`). This is a pre-existing violation.
**Why it happens:** Scaffolded before FOUN-02 was strictly applied.
**How to avoid:** The Phase 5 plan should include a fix for this violation since the executor will be touching layout-adjacent files. Replace with `border-border`.
**Warning signs:** Visible token inconsistency in layout header; if a colour audit is run it will flag this.

---

## Code Examples

Verified patterns from existing source files:

### Status Icon Reuse (from `-TodoRow.tsx` lines 30–34)

```typescript
// Source: src/routes/_layout/todos/-TodoRow.tsx
const STATUS_ICONS: Record<TodoStatus, React.ReactNode> = {
  not_started: <Circle className="text-muted-foreground" />,
  started: <CircleDot className="text-primary" />,
  complete: <CircleCheck className="text-muted-foreground" />,
};
```

In `TodoBentoCard`, these are rendered inline (not via a shared constant) with `size-4` override per UI-SPEC (16px vs TodoRow's 20px default).

### Overdue Detection (from `-TodoRow.tsx` line 61–64)

```typescript
// Source: src/routes/_layout/todos/-TodoRow.tsx
const isOverdue =
  todo.due_date &&
  todo.status !== "complete" &&
  new Date(todo.due_date) < new Date(new Date().toISOString().split("T")[0]);
```

In `TodoBentoCard`, this becomes a count (filter + length) using the same date comparison logic.

### Link-Wrapped Card (from `PlaceholderBentoCard.tsx`)

```typescript
// Source: src/tools/PlaceholderBentoCard.tsx
import { Link } from "@tanstack/react-router";
// Link wraps the entire card block element
<Link to={tool.route} className="block ...">
  ...
</Link>
```

`TodoBentoCard` uses `Link to="/todos"` directly (typed route, not `tool.route` cast to any — `/todos` route exists now).

### getTodos Server Function Signature (from `todos.functions.ts` line 31–38)

```typescript
// Source: src/routes/todos/todos.functions.ts
export const getTodos = createServerFn({ method: "GET" }).handler(async (): Promise<Todo[]> => {
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to fetch todos: ${error.message}`);
  return data ?? [];
});
```

`loadData: getTodos` — the function reference is passed directly. No wrapper needed.

### Existing Loader Pattern (from `todos/index.tsx` lines 12–26)

```typescript
// Source: src/routes/_layout/todos/index.tsx
export const Route = createFileRoute("/_layout/todos/")({
  loader: async () => {
    try {
      const todos = await getTodos();
      return { todos, error: null };
    } catch {
      return { todos: [] as Todo[], error: "Could not load todos..." };
    }
  },
  pendingComponent: TodosLoading,
  component: TodosPage,
});
```

Overview `loader` follows the same structure but with `try/throw` (not catch-and-return) so TanStack Router's `errorComponent` handles it.

### Current Overview Page (from `_layout/index.tsx` — full file, 18 lines)

```typescript
// Source: src/routes/_layout/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { tools } from "#/tools/registry";

export const Route = createFileRoute("/_layout/")({
  component: OverviewPage,
});

function OverviewPage() {
  return (
    <main className="p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {tools.map((tool) => (
          <tool.BentoCard key={tool.id} tool={tool} />
        ))}
      </div>
    </main>
  );
}
```

This file needs: `loader` added, `data={toolData[tool.id]}` on BentoCard render, `pendingComponent`, `errorComponent`.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| TanStack Start with Vinxi | TanStack Start with Vite (v1.121.0+) | Project already on current approach |
| `BentoCard: ComponentType<{ tool: ToolEntry }>` | `BentoCard: ComponentType<{ tool: ToolEntry; data: unknown }>` | Phase 5 registry upgrade |
| `PlaceholderBentoCard` for todos | `TodoBentoCard` registered | Phase 5 deliverable |
| No loader on overview page | `loader: async ()` with `Promise.all` | Phase 5 wiring |

---

## Open Questions

1. **Should `highPriorityCount` include completed high-priority todos?**
   - What we know: UI-SPEC line 213 says "todos where `priority === 'high'` AND `status !== 'complete'`"
   - What's unclear: Nothing — this is explicitly defined.
   - Recommendation: Exclude completed todos from high-priority count (only attention-worthy incomplete items).

2. **Should the overview page loader re-throw errors or return them?**
   - What we know: Todos page catches and returns `{ todos: [], error: "..." }`. TanStack Router also has `errorComponent`.
   - What's unclear: UI-SPEC §Copywriting says error message is for `errorComponent` (loader throw), not inline state.
   - Recommendation: Let the loader throw. Use `errorComponent` for error rendering. This is cleaner for a summary page where partial data isn't useful.

3. **Is `loadData: getTodos` type-safe without a wrapper?**
   - What we know: `getTodos` is typed as `() => Promise<Todo[]>`, which is assignable to `() => Promise<unknown>`.
   - What's unclear: Nothing — TypeScript covariance makes this safe.
   - Recommendation: Direct assignment is correct. No wrapper function needed.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 5 is purely code/config changes. No external dependencies beyond the project's own code and the already-running Supabase instance (established in Phase 3). No new CLIs, services, or runtimes required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (dual-project config) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `bun run test` |
| Full suite command | `bun run test` |

**Project config notes:**
- `unit` project: `src/**/-*.test.ts`, Node environment, TanStack Start plugin
- `components` project: `src/**/-*.test.tsx`, jsdom environment, viteReact plugin
- New test file for `TodoBentoCard` must be named `-TodoBentoCard.test.tsx` (- prefix, .tsx extension) to be picked up by the `components` project

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BENT-01 | Status counts computed correctly from Todo[] | unit (pure function) | `bun run test` (component project) | ❌ Wave 0 |
| BENT-02 | Overdue count: past due_date, not complete | unit (pure function) | `bun run test` (component project) | ❌ Wave 0 |
| BENT-02 | High-priority count: high priority, not complete | unit (pure function) | `bun run test` (component project) | ❌ Wave 0 |
| BENT-02 | Attention row hidden when overdueCount=0 and highPriorityCount=0 | component render | `bun run test` (component project) | ❌ Wave 0 |
| BENT-03 | Card renders as a Link to /todos | component render | `bun run test` (component project) | ❌ Wave 0 |
| OVER-01 | Overview page renders one card per tool | manual only | — | N/A |
| OVER-02 | Overview imports cards only via registry | static/manual | `grep "TodoBentoCard" src/routes/_layout/index.tsx` should be zero | N/A |

**Note on OVER-01/OVER-02:** These are integration-level behaviours that require a running router. Manual verification via the overview page is the appropriate check (confirmed by UI-SPEC verification gates).

### Sampling Rate

- **Per task commit:** `bun run test`
- **Per wave merge:** `bun run test && bun run lint && bun run fmt:check`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/routes/_layout/todos/-TodoBentoCard.test.tsx` — covers BENT-01, BENT-02, BENT-03
  - Test: correct status counts from fixture `Todo[]`
  - Test: overdue count excludes complete todos
  - Test: high-priority count excludes complete todos
  - Test: attention row absent from DOM when both counts are 0
  - Test: card renders `Link` to `/todos`
  - Pattern: mock `@tanstack/react-router` Link (same pattern as AddTodoRow test mocks portals)

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 5 |
|-----------|-------------------|
| Tech stack locked: TanStack Start + Tailwind + shadcn + Lucide + Supabase | No new libraries; all needed tools already installed |
| Colour system: all colours via `@theme` CSS custom properties | `TodoBentoCard` must use only semantic tokens; `PlaceholderBentoCard` FOUN-02 violations must be fixed |
| Modularity: each tool self-contained; no direct overview→tool imports | Overview accesses `TodoBentoCard` only via `tools[].BentoCard` — never a direct import |
| FOUN-04: adding a new tool requires only registry entry + route + bento card | The `loadData` + `BentoCard` contract being established here IS the FOUN-04 implementation |
| File-prefix `-` convention: component files in routes/ prefixed with `-` | `TodoBentoCard` filename must be `-TodoBentoCard.tsx` |
| GSD workflow: use entry points before direct edits | Execution must proceed through `/gsd:execute-phase` |
| Server functions: only `*.functions.ts` files import `supabase.ts` / `supabase-admin.ts` | `loadData: getTodos` passes the function reference; registry.ts does not import supabase directly |

---

## Sources

### Primary (HIGH confidence)

- Source code read directly: `src/tools/registry.ts` — current `ToolEntry` interface confirmed
- Source code read directly: `src/tools/PlaceholderBentoCard.tsx` — existing prop contract, FOUN-02 violations confirmed
- Source code read directly: `src/routes/_layout/index.tsx` — current overview page structure
- Source code read directly: `src/routes/_layout/todos/-TodoRow.tsx` — `STATUS_ICONS`, `PRIORITY_STYLES`, overdue pattern
- Source code read directly: `src/routes/todos/todos.functions.ts` — `getTodos()` signature
- Source code read directly: `src/lib/database.types.ts` — `Todo`, `TodoStatus`, `TodoPriority` types
- Source code read directly: `src/styles.css` — all `@theme` tokens confirmed
- Source code read directly: `vitest.config.ts` — dual-project test infrastructure
- `.planning/phases/05-bento-overview-registration/05-CONTEXT.md` — all locked decisions
- `.planning/phases/05-bento-overview-registration/05-UI-SPEC.md` — approved design contract (status: approved)
- `CLAUDE.md` — project constraints, stack, conventions

### Secondary (MEDIUM confidence)

- `package.json` — version numbers confirmed for all installed packages

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed from `package.json` and source files
- Architecture: HIGH — existing patterns read directly from source; no speculation needed
- Pitfalls: HIGH — TypeScript cascade identified from interface analysis; FOUN-02 violations confirmed by reading `PlaceholderBentoCard.tsx`
- Test patterns: HIGH — test infrastructure confirmed from `vitest.config.ts` and existing `-AddTodoRow.test.tsx`

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable framework versions; no time-sensitive ecosystem changes in scope)
