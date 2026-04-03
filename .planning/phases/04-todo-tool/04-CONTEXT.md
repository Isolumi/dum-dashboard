# Phase 4: Todo Tool - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the full todo CRUD UI at `/todos`. Users can create, view, edit, delete, and toggle todo status. All CRUD server functions already exist (Phase 3) — this phase is purely UI wiring.

**Out of scope:** Supabase Realtime subscriptions, sorting/filtering, bento card implementation (those are separate concerns).

</domain>

<decisions>
## Implementation Decisions

### List layout
- **D-01:** Compact task rows — linear rows, one todo per line, no table headers
- **D-02:** Row structure: status icon (left) + name (center-left, takes remaining space) + priority badge + due date dot+date (right)
- **D-03:** No card borders or card elevation per row — flat list with subtle row hover state

### Inline editing
- **D-04:** Click any individual field to edit it in place — no row-level "edit mode" button
- **D-05:** Name field: click → inline text input, auto-width, Enter saves, Escape reverts, blur saves
- **D-06:** Priority/status chips: click → small dropdown/popover to select new value, auto-saves on select
- **D-07:** Due date: click → date picker or inline date input, auto-saves on select/blur

### New todo entry
- **D-08:** Persistent placeholder row at the top of the list: "+ Add a todo..." text as placeholder
- **D-09:** Clicking or typing activates the row — name field, priority selector, due date field appear inline
- **D-10:** Enter submits and creates the todo; row returns to placeholder state
- **D-11:** Escape cancels and collapses back to placeholder without creating anything
- **D-12:** Tab moves focus between name → priority → due date → back to name

### Status & priority visuals
- **D-13:** Status communicated via Lucide icon replacing/inside the checkbox:
  - `not_started` → `Circle` (empty circle, muted)
  - `started` → `CircleDot` or `CircleHalf` (partially filled, primary/violet accent)
  - `complete` → `CircleCheck` (checked, dimmed/muted — de-emphasized completed items)
- **D-14:** Priority shown as small text badge:
  - `high` → `destructive` token (red/orange)
  - `medium` → amber/yellow — use a custom token or inline `oklch` if not in theme yet; researcher to advise
  - `low` → `muted-foreground` (dimmed, nearly invisible — low noise)
- **D-15:** Clicking the status icon cycles through states (not_started → started → complete → not_started) — this satisfies TODO-05 toggle-from-list requirement
- **D-16:** Completed todos are visually de-emphasized: name gets strikethrough, row opacity reduced

### Delete
- **D-17:** Delete revealed on row hover — small trash icon button on the far right (Lucide `Trash2`)
- **D-18:** No confirmation dialog — instant delete (personal tool, no need for friction)

### Claude's Discretion
- Exact row padding, spacing, and font size
- Loading skeleton shape (must use Skeleton component from shadcn/ui)
- Empty state design when no todos exist
- Error handling UI for failed server function calls
- Whether to install `shadcn/ui` Select or Popover for the priority dropdown (researcher to recommend)

</decisions>

<specifics>
## Specific Ideas

- Status icon acts as a direct click-to-cycle toggle — satisfies TODO-05 without any extra "toggle" button
- The "Add a todo..." row is always visible (never hidden by a button) — lowest friction entry point
- Completed todos should feel finished and out of the way — strikethrough + opacity, not removed

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs or ADRs — requirements are fully captured in decisions above and in ROADMAP.md.

### Phase requirements
- `.planning/ROADMAP.md` §"Phase 4: Todo Tool" — goal, success criteria, requirement refs (TODO-01 through TODO-06)
- `.planning/REQUIREMENTS.md` — TODO-01 through TODO-06 detailed requirement definitions

### Existing code — read before implementing
- `src/routes/todos/todos.functions.ts` — all CRUD server functions (getTodos, getTodo, createTodo, updateTodo, deleteTodo); input schemas (CreateTodoSchema, UpdateTodoSchema, etc.)
- `src/lib/database.types.ts` — Todo type definition (id, name, priority, status, due_date, created_at)
- `src/tools/registry.ts` — ToolEntry interface; PlaceholderBentoCard currently wired for todos
- `src/styles.css` + `src/theme.css` — all Tailwind @theme tokens; dark-only theme; violet accent at `--primary`

### Available shadcn components
- `src/components/ui/button.tsx` — Button
- `src/components/ui/input.tsx` — Input (for name field editing)
- `src/components/ui/skeleton.tsx` — Skeleton (use for loading states)
- `src/components/ui/tooltip.tsx` — Tooltip (optional: hover labels on icons)
- `src/components/ui/separator.tsx` — Separator (optional: section dividers)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Input` component: already installed — use for inline name editing and new todo name entry
- `Button` component: already installed — use for delete icon button (variant="ghost", size="icon")
- `Skeleton` component: already installed — wrap list rows while `getTodos` loads
- All CRUD server functions: fully implemented with Zod validation — no server-side work needed

### Established Patterns
- Dark-only theme: all color values must come from `@theme` tokens (no raw hex/oklch in components)
- Server functions called from TanStack Query hooks (`useQuery` / `useMutation`) based on Phase 3 setup
- File location convention: route-specific code lives in `src/routes/todos/`

### Integration Points
- New route file: `src/routes/todos/index.tsx` — the todo page component
- Optional: `src/routes/todos/TodoList.tsx`, `TodoRow.tsx`, `AddTodoRow.tsx` as sub-components
- `src/tools/registry.ts` BentoCard slot — Phase 4 may wire up a real TodoBentoCard or leave as placeholder (not in scope per phase boundary)

</code_context>

<deferred>
## Deferred Ideas

- Realtime Supabase subscription (INSERT/UPDATE/DELETE events) — separate phase
- Sorting or filtering todos by priority/status/due date — separate phase
- TodoBentoCard for the overview page — separate phase (bento overview is a future tool)

</deferred>

---

*Phase: 04-todo-tool*
*Context gathered: 2026-03-30*
