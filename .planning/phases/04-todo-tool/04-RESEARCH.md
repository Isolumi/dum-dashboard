# Phase 4: Todo Tool - Research

**Researched:** 2026-03-30
**Domain:** React UI — inline editing, list CRUD, TanStack Start route, shadcn/base-ui composition
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**List layout**
- D-01: Compact task rows — linear rows, one todo per line, no table headers
- D-02: Row structure: status icon (left) + name (center-left, takes remaining space) + priority badge + due date dot+date (right)
- D-03: No card borders or card elevation per row — flat list with subtle row hover state

**Inline editing**
- D-04: Click any individual field to edit it in place — no row-level "edit mode" button
- D-05: Name field: click → inline text input, auto-width, Enter saves, Escape reverts, blur saves
- D-06: Priority/status chips: click → small dropdown/popover to select new value, auto-saves on select
- D-07: Due date: click → date picker or inline date input, auto-saves on select/blur

**New todo entry**
- D-08: Persistent placeholder row at the top of the list: "+ Add a todo..." text as placeholder
- D-09: Clicking or typing activates the row — name field, priority selector, due date field appear inline
- D-10: Enter submits and creates the todo; row returns to placeholder state
- D-11: Escape cancels and collapses back to placeholder without creating anything
- D-12: Tab moves focus between name → priority → due date → back to name

**Status & priority visuals**
- D-13: Status icons: `not_started` → `Circle`, `started` → `CircleDot`, `complete` → `CircleCheck`
- D-14: Priority badges: `high` → destructive, `medium` → amber/yellow, `low` → muted-foreground
- D-15: Clicking the status icon cycles through states (not_started → started → complete → not_started)
- D-16: Completed todos: name gets strikethrough, row opacity reduced

**Delete**
- D-17: Delete revealed on row hover — Lucide `Trash2` icon button on the far right
- D-18: No confirmation dialog — instant delete

### Claude's Discretion

- Exact row padding, spacing, and font size (resolved in UI-SPEC)
- Loading skeleton shape (resolved in UI-SPEC — 5 rows, Skeleton component)
- Empty state design (resolved in UI-SPEC — CheckSquare icon + "Nothing here yet")
- Error handling UI (resolved in UI-SPEC — inline error at list top for fetch; inline timed message for mutations)
- Whether to use Select or Popover for priority dropdown (resolved in UI-SPEC — Popover)

### Deferred Ideas (OUT OF SCOPE)

- Realtime Supabase subscription (INSERT/UPDATE/DELETE events) — separate phase
- Sorting or filtering todos by priority/status/due date — separate phase
- TodoBentoCard for the overview page — separate phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TODO-01 | User can create a todo item with a name, priority (high/medium/low), status (not started/started/complete), and optional due date | AddTodoRow component with Input + Popover for priority + date input; calls `createTodo` server function |
| TODO-02 | User can view a list of all todo items | `getTodos` server function called on route load; list rendered as TodoRow per item |
| TODO-03 | User can edit a todo item's name, priority, status, and due date | Inline field editing per D-04–D-07; calls `updateTodo` server function |
| TODO-04 | User can delete a todo item | Trash2 icon button revealed on hover; calls `deleteTodo` server function; D-17, D-18 |
| TODO-05 | User can toggle a todo item's status directly from the list without opening an edit view | Status icon click cycles through 3 states; D-15 |
| TODO-06 | User can create a todo item by typing and pressing Enter; Escape cancels entry; Tab moves between fields | AddTodoRow keyboard interaction per D-10, D-11, D-12 |
</phase_requirements>

---

## Summary

Phase 4 is a pure UI wiring phase. The Supabase data layer (server functions, DB schema, Zod schemas) is fully implemented in Phase 3. No new server-side work is needed. The task is to build the `/todos` route page with a compact list UI, inline field editing, a persistent add-todo row, and status cycling.

The key technical challenge is managing multiple independent pieces of local edit state per row (name edit mode, priority popover open, date edit mode) without a global "row edit mode" flag. Each field is independently clickable, which means each `TodoRow` component needs several boolean state flags. This is well-understood React local state management — no exotic library needed.

The second challenge is the AddTodoRow, which has two display states (collapsed placeholder vs. expanded entry form) and must handle keyboard shortcuts (Enter, Escape, Tab wrapping). This is self-contained local state in a single component.

Server calls follow the pattern established in Phase 3: `createServerFn` functions imported directly and called from event handlers or effects. TanStack Query is **not installed** in this project (not in package.json) — the pattern for this phase is to fetch todos with a `loader` on the route and call mutations directly via async event handlers with local state updates.

**Primary recommendation:** Build `src/routes/todos/index.tsx` with three co-located sub-components (`AddTodoRow`, `TodoRow`, `TodoList`) in the same file or in the same `src/routes/todos/` directory. Use route `loader` to fetch todos, local React state for optimistic UI, and call server functions directly from event handlers.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-start` | latest (^1.167) | Route file with `loader` export for data fetching | Already installed; `loader` runs on server, feeds initial data |
| `@tanstack/react-router` | latest (^1.167) | `createFileRoute`, `useLoaderData` | Already installed; transitively pulled by Start |
| `@base-ui/react` | ^1.3.0 | Primitives backing all shadcn/ui components | Already installed; component layer sits on top |
| `lucide-react` | ^0.545.0 | `Circle`, `CircleDot`, `CircleCheck`, `Trash2`, `Plus`, `CheckSquare`, `AlertCircle` icons | Already installed |
| `shadcn/ui` | CLI-managed | `Button`, `Input`, `Skeleton`, `Tooltip`, `Separator`, `Popover` | Already installed (except Popover — needs `bunx --bun shadcn@latest add popover`) |
| `zod` | ^3.24.2 (pinned to v3) | Schema types re-used from `todos.functions.ts` | Already installed; pinned per Phase 3 decision |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cn()` from `#/lib/utils` | — | Conditional className merging | Every component with conditional styling |
| `class-variance-authority` | ^0.7.1 | (already used by Button) | Only if new CVA variants needed — unlikely for this phase |

### Not Needed This Phase

| Library | Why Not Needed |
|---------|---------------|
| `@tanstack/react-query` | Not installed; no `QueryClient` in root; pattern for this phase is `loader` + local state |
| `sonner` | Not installed; UI-SPEC specifies inline error messages (not toasts) |
| `date-fns` | No date manipulation logic — native `<input type="date">` returns ISO strings directly; comparison to today uses `new Date()` |

### New Component to Install

```bash
bunx --bun shadcn@latest add popover
```

This is the only installation action needed for Phase 4. All other components are already installed.

**Version verification:** All packages already locked in `package.json`. Popover will install at the version resolved by the shadcn CLI against the current `@base-ui/react@^1.3.0` peer.

---

## Architecture Patterns

### Recommended File Structure

```
src/routes/todos/
├── index.tsx            # Route file: loader, page component, sub-components
├── todos.functions.ts   # Already exists — all CRUD server functions (DO NOT MODIFY)
└── -todos.functions.test.ts  # Already exists — Zod schema unit tests
```

Sub-components (`AddTodoRow`, `TodoRow`) may live in `index.tsx` or in co-located files in the same directory. Given the moderate size of this page, co-locating in `index.tsx` is acceptable. If the file grows past ~300 lines, extract to separate files in the same directory.

### Pattern 1: Route Loader for Initial Data Fetch

**What:** The route `loader` export runs on the server before the page renders. It calls `getTodos()` and returns the result. The page component accesses it via `useLoaderData()`.

**When to use:** Anytime a page needs server data before it renders. This is the TanStack Start recommended pattern when TanStack Query is not set up.

**Example:**
```typescript
// src/routes/todos/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { getTodos } from "./todos.functions";

export const Route = createFileRoute("/_layout/todos/")({
  loader: async () => {
    return { todos: await getTodos() };
  },
  component: TodosPage,
});

function TodosPage() {
  const { todos } = Route.useLoaderData();
  // ...
}
```

**Pitfall:** `Route.useLoaderData()` is the correct API — not `useLoaderData()` from the module. Each route's `Route` object exposes a type-safe `useLoaderData` hook.

### Pattern 2: Local State for Mutations (No Query Client)

**What:** Since TanStack Query is not installed, mutations are handled by calling `createServerFn` functions directly and managing the resulting state updates locally.

**When to use:** This phase only. If TanStack Query is added in a future phase, this pattern would be replaced.

**Example:**
```typescript
// Optimistic delete
const [localTodos, setLocalTodos] = useState(initialTodos);

async function handleDelete(id: string) {
  setLocalTodos(prev => prev.filter(t => t.id !== id)); // optimistic
  try {
    await deleteTodo({ data: { id } });
  } catch {
    setLocalTodos(initialTodos); // revert on failure
    setMutationError("Save failed — check your connection and try again.");
  }
}
```

**Key rule:** Initialize `localTodos` from `useLoaderData()`. Use `useState(loaderData.todos)` to seed local state. All mutations operate on `localTodos`, not the loader result directly.

### Pattern 3: Inline Edit State Per Field

**What:** Each `TodoRow` tracks independent edit-mode booleans for name, priority popover, and date. No global "editing" flag.

**Example structure:**
```typescript
function TodoRow({ todo, onUpdate, onDelete }: TodoRowProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(todo.name);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  // ...
}
```

**Key rule:** On blur/Enter, call `onUpdate` callback (which calls the server function) only if the value actually changed. Always revert local state on Escape.

### Pattern 4: Popover with Base UI (not Radix)

**What:** This project uses `base` primitives, not Radix. `PopoverTrigger` requires `render` prop instead of `asChild`.

**Critical difference:**
```typescript
// WRONG (Radix pattern):
<PopoverTrigger asChild>
  <Button variant="ghost">High</Button>
</PopoverTrigger>

// CORRECT (base pattern):
<PopoverTrigger render={<Button variant="ghost" />}>
  High
</PopoverTrigger>
```

Source: `.claude/skills/shadcn/rules/base-vs-radix.md` (HIGH confidence — project skill file)

### Pattern 5: Status Cycle Click Handler

**What:** The status icon is a `Button` that cycles through three states on each click. The cycle order is `not_started` → `started` → `complete` → `not_started`.

**Example:**
```typescript
const STATUS_CYCLE: Record<TodoStatus, TodoStatus> = {
  not_started: "started",
  started: "complete",
  complete: "not_started",
};

function handleStatusCycle() {
  const nextStatus = STATUS_CYCLE[todo.status];
  onUpdate({ id: todo.id, status: nextStatus }); // calls updateTodo
}
```

### Pattern 6: AddTodoRow Keyboard Control

**What:** The AddTodoRow has two display states. Key events must be captured on the row container and individual fields.

**Tab wrapping implementation:** Use `onKeyDown` on the date input to detect Tab (with no Shift) and manually `focus()` the name input ref. Use `onKeyDown` on the name input to detect Shift+Tab from name (rare, but name is first) and manually focus the date input.

**Collapsed → expanded:** Track with `const [isExpanded, setIsExpanded] = useState(false)`. On click anywhere on the collapsed row, set `isExpanded(true)`. The name `Input` should have `autoFocus` when the row transitions to expanded.

**Type-to-expand:** Add `onKeyDown` to the collapsed placeholder that checks if the key is a printable character, sets `isExpanded(true)`, and prepopulates the name state with the typed character.

### Anti-Patterns to Avoid

- **Row-level edit mode flag:** Do not use a single `isEditing` boolean per row. The design requires per-field edit activation (D-04). A global edit flag would collapse all fields into edit mode at once.
- **Direct `loaderData` mutation:** Do not mutate the object returned by `useLoaderData()` directly. Seed `useState` from it and operate on local state.
- **Using `asChild` on Popover:** This project uses base-ui. `asChild` does not exist on base-ui components. Use `render` prop.
- **Using `space-x-*` or `space-y-*`:** Use `flex` + `gap-*` per shadcn skill rules.
- **Hardcoded color values in components:** All colors must come from `@theme` tokens. The amber-400 token must be added to `src/theme.css` before use in components.
- **`dark:` prefixed classes in new code:** Project is dark-only. Existing shadcn component files have `dark:` internally — leave those as-is. New code must not use `dark:` prefixes per FOUN-01.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Popover for priority dropdown | Custom positioned `div` | shadcn `Popover` (base-ui backed) | Focus trapping, keyboard navigation, auto-dismiss, and portal rendering are complex to hand-roll correctly |
| Loading skeleton | Custom `animate-pulse` divs | shadcn `Skeleton` | Consistent animation and sizing per project convention |
| Icon buttons | Styled `<button>` elements | shadcn `Button` with `variant="ghost" size="icon"` | Focus ring, disabled state, and accessible touch target sizing are handled |
| Conditional classNames | Manual template literals | `cn()` from `#/lib/utils` | Avoids Tailwind class conflicts; already the project standard |
| Empty state | Custom div layout | Follow UI-SPEC pattern using Lucide icon + text | shadcn `Empty` component is not installed and UI-SPEC already defines the pattern explicitly |

**Key insight:** The shadcn SKILL.md mentions an `Empty` component for empty states, but it is not installed in this project (not in the `components` list from `bunx shadcn info`). The UI-SPEC already defines the empty state as a simple icon + text block — implement it directly without installing `Empty`.

---

## Runtime State Inventory

Phase 4 is a UI-only phase (no renames, no migrations). Skipped per instructions — not a rename/refactor/migration phase.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Package installs, `bun run dev` | ✓ | (in package.json scripts) | — |
| Node.js >=20 | TanStack Start runtime | ✓ | Platform default | — |
| Supabase local instance | `getTodos` / mutations | ✓ | Running (Phase 3 completed) | — |
| shadcn CLI | `bunx --bun shadcn@latest add popover` | ✓ | shadcn@4.1.1 in deps | — |
| Popover component | Priority/status dropdowns | ✗ (not yet installed) | — | Must install before use |

**Missing dependencies with no fallback:**
- `Popover` shadcn component — must be installed via `bunx --bun shadcn@latest add popover` before implementation begins. This is the only Wave 0 installation action.

**Missing dependencies with fallback:**
- None.

---

## Common Pitfalls

### Pitfall 1: `asChild` on Popover Trigger (Base UI vs Radix)

**What goes wrong:** Developer writes `<PopoverTrigger asChild><Button>...</Button></PopoverTrigger>` — this is the Radix pattern and will cause a runtime error or silently fail in base-ui.
**Why it happens:** Most shadcn documentation examples target Radix. This project uses `base` (base-ui), which uses the `render` prop instead.
**How to avoid:** Always use `<PopoverTrigger render={<Button ... />}>content</PopoverTrigger>`.
**Warning signs:** TypeScript error on `asChild` prop — base-ui components don't accept it.

### Pitfall 2: `Route.useLoaderData()` vs `useLoaderData()`

**What goes wrong:** Importing `useLoaderData` from `@tanstack/react-router` directly produces untyped data or a TypeScript error.
**Why it happens:** Each route file's `Route` object exposes a type-safe version scoped to that route's loader return type.
**How to avoid:** Always call `Route.useLoaderData()` where `Route` is the export from `createFileRoute(...)`.

### Pitfall 3: `createServerFn` Calling Convention

**What goes wrong:** Calling `getTodos()` without `{ data: ... }` argument works fine (no input). But calling `updateTodo({ id, status })` directly will fail — it must be `updateTodo({ data: { id, status } })`.
**Why it happens:** TanStack Start's `createServerFn` wraps the input under a `data` key when using `inputValidator`.
**How to avoid:** All server functions with `inputValidator` require `{ data: { ...fields } }` at the call site. Functions without `inputValidator` (`getTodos`) take no arguments.

### Pitfall 4: Blur-on-Tab Fires Before Tab Navigation Completes

**What goes wrong:** An `onBlur` handler on the name input fires when Tab is pressed (moving to the priority selector). If the blur handler immediately calls `updateTodo`, it races with the popover opening.
**Why it happens:** `blur` fires synchronously on Tab, before focus lands on the next element.
**How to avoid:** In the name input's `onBlur`, check `event.relatedTarget` — if it's within the same row (the priority button), skip the save. This is standard "blur within a group" handling.

### Pitfall 5: Hardcoded `amber-400` Without Theme Token

**What goes wrong:** Writing `className="bg-amber-400/20 text-amber-400"` in a component file without adding the token to `src/theme.css` first. Tailwind v4 with `--color-*: initial` in `theme.css` purges all default palette colors — `amber-400` will resolve to nothing.
**Why it happens:** Developers assume Tailwind's default palette is available; the `--color-*: initial` rule in `theme.css` removes it.
**How to avoid:** Add `--color-amber-400: oklch(0.82 0.17 85);` to the `@theme` block in `src/theme.css` before using any `amber-400` utilities. This is the first action in Wave 0.
**Warning signs:** The `medium` priority badge renders with no color; dev tools show the amber CSS variable is undefined.

### Pitfall 6: `Input` Height Mismatch in Inline Edit

**What goes wrong:** The `Input` component has a default `h-8` class. Replacing a `<span>` with `<Input>` causes the row to jump height.
**Why it happens:** The row is `min-h-[44px]` centered. The input's default border and padding add visual bulk.
**How to avoid:** Override the input with `className="h-auto border-0 shadow-none p-0 focus-visible:ring-1 focus-visible:ring-ring/50 text-base"` to strip default chrome and match the span height visually.

### Pitfall 7: Empty Name Submission

**What goes wrong:** Pressing Enter in the AddTodoRow with an empty name field calls `createTodo({ data: { name: "" } })`. The Zod schema rejects it with an error.
**Why it happens:** No guard at the call site.
**How to avoid:** Before calling `createTodo`, check `nameValue.trim().length > 0`. If empty, do nothing (UI-SPEC interaction contract: "Enter in add row (name empty) → No-op").

---

## Code Examples

Verified patterns from existing codebase and skill rules.

### Route File Structure with Loader

```typescript
// src/routes/todos/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { getTodos } from "./todos.functions";
import type { Todo } from "#/lib/database.types";

export const Route = createFileRoute("/_layout/todos/")({
  loader: async () => {
    const todos = await getTodos();
    return { todos };
  },
  component: TodosPage,
});

function TodosPage() {
  const { todos: initialTodos } = Route.useLoaderData();
  // seed local state from loader
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  // ...
}
```

Source: Existing `_layout.tsx` and `_layout/index.tsx` patterns, TanStack Start docs (HIGH confidence).

### Server Function Call Pattern (with inputValidator)

```typescript
// Correct: fields wrapped in { data: { ... } }
await updateTodo({ data: { id: todo.id, status: nextStatus } });
await deleteTodo({ data: { id: todo.id } });
await createTodo({ data: { name, priority, status: "not_started", due_date: dueDate || null } });

// Correct: no-argument function
const todos = await getTodos();
```

Source: `src/routes/todos/todos.functions.ts` — inputValidator usage (HIGH confidence).

### Popover Trigger (Base UI pattern)

```typescript
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "#/components/ui/popover";
import { Button } from "#/components/ui/button";

// CORRECT for base-ui:
<Popover open={isPriorityOpen} onOpenChange={setIsPriorityOpen}>
  <PopoverTrigger render={<Button variant="ghost" size="sm" />}>
    High
  </PopoverTrigger>
  <PopoverContent className="w-32 p-1">
    {/* option buttons */}
  </PopoverContent>
</Popover>
```

Source: `.claude/skills/shadcn/rules/base-vs-radix.md` (HIGH confidence).

### Button with Icon (base-ui `data-icon` pattern)

```typescript
// Icons inside Button use data-icon attribute, not size classes:
<Button variant="ghost" size="icon" onClick={handleDelete} aria-label={`Delete "${todo.name}"`}>
  <Trash2 data-icon />
</Button>
```

Source: `.claude/skills/shadcn/SKILL.md` — icons section (HIGH confidence). Note: the Button's CVA definition includes `[&_svg:not([class*='size-'])]:size-4`, so icons inside Button are auto-sized. Do not add `size-4` or `className` to the icon.

### Status Icon Rendering

```typescript
import { Circle, CircleDot, CircleCheck } from "lucide-react";
import type { TodoStatus } from "#/lib/database.types";

const STATUS_ICONS: Record<TodoStatus, React.ReactNode> = {
  not_started: <Circle className="text-muted-foreground" />,
  started: <CircleDot className="text-primary" />,
  complete: <CircleCheck className="text-muted-foreground" />,
};

// Inside TodoRow:
<Button
  variant="ghost"
  size="icon"
  onClick={handleStatusCycle}
  aria-label={`Toggle status for "${todo.name}"`}
>
  {STATUS_ICONS[todo.status]}
</Button>
```

Note: Icon color is set via `className` on the icon element directly (not `data-icon`) because this is a standalone icon button, not an inline icon inside a labeled button.

### Skeleton Loading Rows

```typescript
import { Skeleton } from "#/components/ui/skeleton";

function TodoSkeleton() {
  return (
    <div className="flex items-center gap-2 px-4 min-h-[44px]">
      <Skeleton className="size-5 rounded-full" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-5 w-14 rounded-sm" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}
// Render 5 instances
```

Source: UI-SPEC §Loading State (HIGH confidence — project-approved spec).

### cn() Conditional Class Usage

```typescript
import { cn } from "#/lib/utils";

// Completed row de-emphasis:
<div className={cn(
  "flex items-center gap-2 px-4 min-h-[44px] group hover:bg-neutral-800",
  todo.status === "complete" && "opacity-60"
)}>
  <span className={cn(
    "text-base flex-1",
    todo.status === "complete" && "line-through text-muted-foreground"
  )}>
    {todo.name}
  </span>
</div>
```

Source: `.claude/skills/shadcn/rules/styling.md` (HIGH confidence).

---

## Critical Discovered Facts

### TanStack Query Is Not Installed

**Finding:** `@tanstack/react-query` is absent from `package.json`. The root route (`__root.tsx`) has no `QueryClient` setup. The router (`router.tsx`) has no `routerWithQueryClient` call.

**Impact:** CLAUDE.md and prior phase documentation reference TanStack Query as the data-fetching layer. Phase 4 cannot use `useQuery`/`useMutation` without first installing and wiring up TanStack Query.

**Decision required for planner:** Two options:
1. (Recommended) Install TanStack Query and wire it into the router in Wave 0, then use `useQuery`/`useMutation` for all data operations. This aligns with CLAUDE.md's stated intent and enables cache invalidation.
2. Skip TanStack Query for Phase 4 — use route `loader` for initial fetch and `useState` for local optimistic mutations. Simpler, but will require refactoring if TanStack Query is added later.

**Recommendation:** Install TanStack Query in Wave 0. The setup is minimal (add `QueryClient`, wrap router), and using `useMutation` for create/update/delete gives proper loading states and error handling. The `loader` can still seed the initial data.

**Confidence:** HIGH — verified by reading `package.json` directly.

### `todos` Route Segment: `_layout/todos/`

**Finding:** All pages are wrapped in `_layout`. The route path prefix is `/_layout/`. The todos route file must be at `src/routes/todos/index.tsx` and the `createFileRoute` path must be `"/_layout/todos/"` to render inside the layout shell.

**Confidence:** HIGH — verified by reading `_layout.tsx`, `_layout/index.tsx`, and `routeTree.gen.ts` structure.

### Existing `todos` Directory Has No Route File

**Finding:** `src/routes/todos/` currently contains only `todos.functions.ts` and `-todos.functions.test.ts`. There is no `index.tsx`. The sidebar link in `registry.ts` (`route: "/todos"`) currently renders as a dead link because the route doesn't exist yet.

**Impact:** Creating `src/routes/todos/index.tsx` with `createFileRoute("/_layout/todos/")` will automatically register it in TanStack Router's file-based routing and fix the dead link.

### `--color-amber-400` Token Missing from `theme.css`

**Finding:** `src/theme.css` defines the project's full palette. The `amber-400` token (`oklch(0.82 0.17 85)`) is NOT present. Since `--color-*: initial` purges all Tailwind defaults, `bg-amber-400/20` and `text-amber-400` will be no-ops until the token is added.

**Impact:** The medium priority badge will render with no color until this token is added.

**Required action:** Add `--color-amber-400: oklch(0.82 0.17 85);` to the `@theme` block in `src/theme.css`. This must happen before any component uses the `amber-400` utilities.

**Confidence:** HIGH — verified by reading `src/theme.css` directly.

### `destructive-foreground` Token for Priority Badge

**Finding:** The `high` priority badge uses `bg-destructive/20 text-destructive` per the UI-SPEC (not `bg-destructive text-destructive-foreground`). This is the lighter variant used in the shadcn `Button` destructive variant too — confirmed by reading `button.tsx`.

**Confidence:** HIGH — verified against UI-SPEC and existing button.tsx.

### Icon Sizing in Button vs Standalone

**Finding:** `button.tsx` contains `[&_svg:not([class*='size-'])]:size-4`. Icons inside `Button` are auto-sized to 4 (16px) — do not add `size={20}` or `className` to icons inside icon buttons. For the status icon (which must be 20px per UI-SPEC), the icon should be inside a `Button size="icon"` (which is `size-8`, 32px touch target) with the icon rendered without size props — the auto-size rule will make it 16px. To get 20px icons, pass `className="size-5"` on the icon (overrides the auto-size selector since `class*='size-'` check fails when `size-5` is present).

**Correct pattern for 20px status icon:**
```typescript
<Circle className="size-5 text-muted-foreground" />
```

**Confidence:** HIGH — verified by reading `button.tsx` CVA definition.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `asChild` on Popover triggers | `render` prop on Popover triggers | shadcn moved to base-ui in nova preset | Using `asChild` silently fails in base-ui |
| `tailwindcss-animate` | `tw-animate-css` | March 2025 | Already installed correctly in this project |
| Radix-based Select with JSX children | Base-ui Select with `items` prop | nova preset | Not needed this phase, but important for future |

---

## Open Questions

1. **TanStack Query installation in Wave 0**
   - What we know: Not installed. CLAUDE.md states it's part of the recommended stack. Phase 4 is the first phase with client-side mutation state.
   - What's unclear: Whether Phase 4 should install it or defer to a later phase.
   - Recommendation: Install `@tanstack/react-query` and `@tanstack/react-router-ssr-query` in Wave 0. Use `useMutation` for create/update/delete and `useQuery` (seeded from loader) for the list. This is the cleanest pattern and aligns with CLAUDE.md.

2. **Popover component API after installation**
   - What we know: The installed component will use base-ui primitives. The `render` prop pattern is correct for `PopoverTrigger`.
   - What's unclear: The exact sub-component exports from the to-be-installed popover (`PopoverContent` alignment options, available props).
   - Recommendation: After installing, read the generated `src/components/ui/popover.tsx` file before implementing to confirm the export API. Run `bunx --bun shadcn@latest docs popover` to get doc URLs.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.5 |
| Config file | None (inline in `vite.config.ts` via `test` key — none defined; vitest uses defaults) |
| Quick run command | `bun run test` |
| Full suite command | `bun run test` |

Note: No `vitest.config.ts` exists. Vitest runs via `bun run test` which executes `vitest run`. The existing test file (`-todos.functions.test.ts`) runs schema unit tests.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TODO-01 | Create todo with all fields via Enter | manual | — | ❌ manual only |
| TODO-02 | View list of all todos | manual | — | ❌ manual only |
| TODO-03 | Edit name/priority/status/due-date inline | manual | — | ❌ manual only |
| TODO-04 | Delete todo removes it from list | manual | — | ❌ manual only |
| TODO-05 | Status icon click cycles through 3 states | manual | — | ❌ manual only |
| TODO-06 | Enter creates, Escape cancels, Tab moves fields | manual | — | ❌ manual only |

**Rationale for manual-only:** All TODO-01 through TODO-06 requirements are DOM interaction tests (click, keyboard events, hover) that require a rendered browser environment. The project uses Vitest with jsdom but the existing tests are pure unit tests (Zod schema). UI interaction tests would require `@testing-library/react` rendering with mocked server functions. Given that the server functions are already unit-tested (Phase 3) and this phase is pure UI wiring, manual verification via the verification gates in UI-SPEC is appropriate.

### Sampling Rate

- **Per task commit:** `bun run test` (schema unit tests, < 5s)
- **Per wave merge:** `bun run test && bun run lint && bun run fmt:check`
- **Phase gate:** Full suite green + all UI-SPEC verification gates passed before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `bunx --bun shadcn@latest add popover` — install Popover component
- [ ] Add `--color-amber-400: oklch(0.82 0.17 85);` to `src/theme.css` `@theme` block
- [ ] (Optional but recommended) Install `@tanstack/react-query` and wire `QueryClient` into router

*(Existing test infrastructure covers all automated requirements. No new test files needed for this phase.)*

---

## Project Constraints (from CLAUDE.md)

Directives the planner must verify all tasks comply with:

| Directive | Source | Enforcement |
|-----------|--------|-------------|
| Tech stack locked: TanStack Start + Tailwind + shadcn + Lucide + OXC + Supabase — no deviations | CLAUDE.md §Constraints | No new libraries outside this list (exception: `@tanstack/react-query` is called out in CLAUDE.md §Recommended Stack as approved) |
| All colours via single Tailwind CSS config palette — no hardcoded values | CLAUDE.md §Constraints | `grep -r "oklch\|hsl\|rgb\|#[0-9a-f]" src/routes/todos/` must return zero matches |
| Each tool must be self-contained: own page, own bento card, own DB schema | CLAUDE.md §Constraints | All Phase 4 files live in `src/routes/todos/`; no changes to shared layout |
| Use `createServerFn` for server-side DB access | CLAUDE.md §Stack Patterns | All DB calls already in `todos.functions.ts`; never import `supabase.ts` from route files |
| Use `bunx --bun shadcn@latest add` for component installation | CLAUDE.md §Technology Stack | Use this command, not manual file creation |
| No `tailwind.config.js` — all config in CSS `@theme` block | CLAUDE.md §What NOT to Use | New tokens go in `src/theme.css`, not a separate config file |
| No `dark:` utility prefixes in new code | CLAUDE.md §Constraints (FOUN-01 / dark-only theme) | Single theme only; `dark:` is a no-op anyway since the project has no light mode |
| OXC for linting/formatting — `bun run lint` and `bun run fmt:check` must pass | CLAUDE.md §Development Tools | Run before every commit |
| Use `cn()` for conditional classNames | `.claude/skills/shadcn/rules/styling.md` | No manual template literal ternaries |
| No `space-x-*` / `space-y-*` — use `gap-*` | `.claude/skills/shadcn/rules/styling.md` | Enforced by oxlint |
| Icons inside Button use `data-icon` attribute | `.claude/skills/shadcn/SKILL.md` | No size classes on icons inside `Button` |
| `PopoverTrigger` uses `render` prop, not `asChild` | `.claude/skills/shadcn/rules/base-vs-radix.md` | TypeScript will error on `asChild` (base-ui doesn't have it) |

---

## Sources

### Primary (HIGH confidence)

- `src/routes/todos/todos.functions.ts` — all server function signatures and Zod schemas
- `src/lib/database.types.ts` — `Todo` type, `TodoPriority`, `TodoStatus` enums
- `src/components/ui/button.tsx` — Button variants, CVA, icon auto-sizing rule
- `src/components/ui/input.tsx` — Input default classes, height (h-8)
- `src/theme.css` — confirmed amber-400 is absent; existing token set documented
- `src/styles.css` — confirmed dark-only `:root`, semantic token assignments
- `package.json` — confirmed TanStack Query absent; confirmed vitest, oxlint, oxfmt versions
- `components.json` — confirmed `base: "base"` (base-ui, not Radix)
- `.claude/skills/shadcn/SKILL.md` — base vs radix rules, icon patterns, composition rules
- `.claude/skills/shadcn/rules/base-vs-radix.md` — `render` prop vs `asChild` with code examples
- `.claude/skills/shadcn/rules/styling.md` — `cn()`, no `space-*`, semantic colors
- `.claude/skills/shadcn/rules/composition.md` — Skeleton, Badge, Alert, Empty patterns
- `.planning/phases/04-todo-tool/04-UI-SPEC.md` — approved visual and interaction contract

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — Phase 3 decisions, `tool.route` cast as `any` documented
- `src/routes/__root.tsx` — no QueryClient setup confirmed
- `src/router.tsx` — no `routerWithQueryClient` confirmed

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages verified against `package.json`; versions confirmed
- Architecture patterns: HIGH — derived from existing working code in `_layout.tsx`, `index.tsx`, and `todos.functions.ts`
- Component API (Popover): MEDIUM — base-vs-radix rule is HIGH confidence; Popover-specific sub-component API must be confirmed after installation
- Pitfalls: HIGH — derived from direct code inspection, not speculation
- TanStack Query gap: HIGH — confirmed absent by reading `package.json`

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable libraries; valid until TanStack Start or shadcn releases a breaking change)
