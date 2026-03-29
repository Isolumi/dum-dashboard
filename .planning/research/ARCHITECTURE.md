# Architecture Research

**Domain:** Personal dashboard / modular tool aggregator (TanStack Start + Supabase + shadcn/ui)
**Researched:** 2026-03-28
**Confidence:** HIGH (TanStack Router file-based routing is stable and well-documented; Supabase patterns are well-established; shadcn/ui Tailwind v4 theming is current)

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (React)                            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │               _app Layout (Sidebar + Outlet)                │  │
│  │                                                             │  │
│  │  ┌──────────┐   ┌─────────────────────────────────────┐    │  │
│  │  │ Sidebar  │   │             Outlet                   │    │  │
│  │  │          │   │  ┌──────────┐  ┌──────────────────┐  │    │  │
│  │  │ /        │   │  │ Overview │  │   Tool Page      │  │    │  │
│  │  │ /todos   │   │  │  Page    │  │  (e.g. /todos)   │  │    │  │
│  │  │          │   │  │          │  │                  │  │    │  │
│  │  │  (nav    │   │  │ Bento    │  │  Full tool UI    │  │    │  │
│  │  │  links)  │   │  │ Grid of  │  │  + its own data  │  │    │  │
│  │  │          │   │  │ widgets  │  │  fetching        │  │    │  │
│  │  └──────────┘   │  └──────────┘  └──────────────────┘  │    │  │
│  │                 └─────────────────────────────────────┘    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │               TanStack Query (client cache)                 │  │
│  └──────────────────────────────┬──────────────────────────────┘  │
└─────────────────────────────────┼────────────────────────────────┘
                                  │ createServerFn (RPC)
┌─────────────────────────────────┼────────────────────────────────┐
│                    Server (Node via Vinxi)                         │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │           *.functions.ts (createServerFn wrappers)          │  │
│  └──────────────────────────────┬──────────────────────────────┘  │
│                                 │                                  │
│  ┌──────────────────────────────▼──────────────────────────────┐  │
│  │            *.server.ts (Supabase query helpers)             │  │
│  └──────────────────────────────┬──────────────────────────────┘  │
└─────────────────────────────────┼────────────────────────────────┘
                                  │ supabase-js
┌─────────────────────────────────┼────────────────────────────────┐
│                     Supabase (Postgres + Realtime)                │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │  todos table │  │ [next tool]  │  │  Realtime publication │   │
│  └──────────────┘  └──────────────┘  └───────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `__root.tsx` | Document shell (html, head, body, global providers) | All routes via Outlet |
| `_app.tsx` (pathless layout) | Sidebar + main area scaffold; renders Outlet | All child pages |
| `Sidebar` component | Navigation links; lists registered tools | `toolRegistry` (reads nav entries) |
| Overview page (`index.tsx`) | Bento grid of all tool widgets | `toolRegistry` (reads widget list) |
| Tool page (e.g., `todos.tsx`) | Full tool UI; owns its own data loading | Tool's `.functions.ts` |
| Tool widget (e.g., `TodoWidget`) | Compact summary card for overview bento grid | Tool's `.functions.ts` |
| `toolRegistry` | Central list of all tools with metadata | Sidebar, Overview page |
| `*.functions.ts` | `createServerFn` wrappers — safe to import anywhere | `*.server.ts` helpers |
| `*.server.ts` | Supabase queries; server-only, never in client bundle | Supabase singleton client |
| `src/lib/supabase.ts` | Singleton Supabase client; typed with generated DB types | All `*.server.ts` files |
| `src/styles/theme.css` | CSS variable token definitions; single source of truth for colours | Tailwind via `@theme inline` |

---

## Recommended Project Structure

```
src/
├── routes/
│   ├── __root.tsx              # Document shell, global providers (QueryClient, etc.)
│   ├── _app.tsx                # Pathless layout: sidebar + Outlet (no URL segment added)
│   ├── _app/
│   │   ├── index.tsx           # /  — Overview / bento grid page
│   │   └── todos.tsx           # /todos — Todo tool full page
├── tools/
│   ├── registry.ts             # toolRegistry: array of ToolDefinition objects
│   ├── todos/
│   │   ├── TodoPage.tsx        # Full-page tool component (used in routes/_app/todos.tsx)
│   │   ├── TodoWidget.tsx      # Bento summary card (used in Overview bento grid)
│   │   ├── todos.functions.ts  # createServerFn wrappers (getTodos, createTodo, etc.)
│   │   └── todos.server.ts     # Supabase query helpers (server-only)
│   └── [next-tool]/
│       ├── [Tool]Page.tsx
│       ├── [Tool]Widget.tsx
│       ├── [tool].functions.ts
│       └── [tool].server.ts
├── components/
│   ├── ui/                     # shadcn/ui generated components (do not hand-edit)
│   ├── Sidebar.tsx             # Nav sidebar; reads toolRegistry for link list
│   └── BentoGrid.tsx           # Responsive bento grid layout shell
├── lib/
│   ├── supabase.ts             # Singleton Supabase client (typed with Database)
│   └── queryClient.ts          # TanStack Query client singleton
├── types/
│   └── database.types.ts       # Generated by: supabase gen types typescript
└── styles/
    └── theme.css               # CSS variable token definitions + @theme inline block
```

### Structure Rationale

- **`routes/`:** TanStack Router owns this directory. Files here map directly to URL paths. The `_app.tsx` pathless layout wraps all dashboard routes without adding a `/app` prefix to URLs.
- **`tools/`:** Each tool is a vertical slice. Everything a tool needs lives here — its page, its widget, its server functions, its DB queries. Adding a new tool means adding a new folder; removing one means deleting a folder.
- **`tools/registry.ts`:** The single place to declare that a tool exists. The sidebar and bento overview both read from it, so a tool is surfaced in both places by registering once.
- **`components/ui/`:** Managed by the shadcn CLI. Never manually edited — re-run `shadcn add` to update. Custom overrides go in `components/` at the same level, not inside `ui/`.
- **`lib/supabase.ts`:** One client instance for the whole app. Server-side queries use this directly; client-side queries go through `createServerFn` wrappers.
- **`styles/theme.css`:** All colour and radius tokens live here. No colour values anywhere else in the codebase.

---

## Architectural Patterns

### Pattern 1: Pathless Layout Route for Sidebar Shell

**What:** A `_app.tsx` file (underscore prefix = pathless) acts as the layout wrapper for all dashboard routes. It renders the `<Sidebar />` and an `<Outlet />`. Child routes placed in `_app/` get the sidebar for free without their URLs gaining an `/app` prefix.

**When to use:** Any time you want a persistent shell (sidebar, topbar) around a group of pages without that shell being part of the URL.

**Trade-offs:** Simple and zero-config. The only constraint is that `routes/index.tsx` and `routes/_app/index.tsx` cannot coexist — the home page must live inside `_app/`.

**Example:**

```
src/routes/
├── __root.tsx           → renders <html>, global providers
├── _app.tsx             → renders <Sidebar /> + <Outlet />
└── _app/
    ├── index.tsx        → / (Overview page)
    └── todos.tsx        → /todos (Todo tool page)
```

```tsx
// src/routes/_app.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Sidebar } from '~/components/Sidebar'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

### Pattern 2: Tool Registry for Modular Discovery

**What:** A central `registry.ts` file exports an array of `ToolDefinition` objects. Each tool self-registers by adding an entry. The sidebar iterates this array to build nav links; the overview page iterates it to render bento widgets.

**When to use:** Any time you need two or more places in the app to know "what tools exist" — prevents the sidebar and overview from getting out of sync when a tool is added.

**Trade-offs:** Slightly more indirection than hardcoding, but the payoff is that adding a tool is a single-file change plus creating the tool folder. No need to touch sidebar or overview code.

**Example:**

```typescript
// src/tools/registry.ts
import { lazy } from 'react'

export interface ToolDefinition {
  id: string
  label: string
  href: string
  icon: string          // Lucide icon name
  Widget: React.ComponentType  // Bento card component
}

export const toolRegistry: ToolDefinition[] = [
  {
    id: 'todos',
    label: 'Todos',
    href: '/todos',
    icon: 'CheckSquare',
    Widget: lazy(() => import('./todos/TodoWidget')),
  },
  // Add future tools here
]
```

```tsx
// src/components/Sidebar.tsx
import { toolRegistry } from '~/tools/registry'
import { Link } from '@tanstack/react-router'

export function Sidebar() {
  return (
    <nav>
      <Link to="/">Overview</Link>
      {toolRegistry.map((tool) => (
        <Link key={tool.id} to={tool.href}>{tool.label}</Link>
      ))}
    </nav>
  )
}
```

### Pattern 3: Server Function / Server Helper Split

**What:** Split database logic into two files per tool. `*.server.ts` contains raw Supabase queries (server-only, never imported by client code). `*.functions.ts` wraps them with `createServerFn`, which are safe to import anywhere and become RPC endpoints.

**When to use:** All data access. Even for a single-user app with no auth, this separation keeps server secrets out of the browser bundle and gives you a clean place to add validation later.

**Trade-offs:** Two files instead of one. Worth it — the build system strips `*.server.ts` from the client bundle automatically, so you cannot accidentally leak DB credentials.

**Example:**

```typescript
// src/tools/todos/todos.server.ts  (server-only)
import { supabase } from '~/lib/supabase'

export async function fetchAllTodos() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function insertTodo(todo: InsertTodo) {
  const { data, error } = await supabase
    .from('todos')
    .insert(todo)
    .select()
    .single()
  if (error) throw error
  return data
}
```

```typescript
// src/tools/todos/todos.functions.ts  (safe to import anywhere)
import { createServerFn } from '@tanstack/react-start'
import { fetchAllTodos, insertTodo } from './todos.server'

export const getTodos = createServerFn({ method: 'GET' }).handler(fetchAllTodos)

export const createTodo = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: InsertTodo }) => insertTodo(data))
```

### Pattern 4: Realtime via Invalidation (Not Direct State)

**What:** Use TanStack Query as the primary client state layer. Subscribe to Supabase Realtime channels in a `useEffect` hook; when a change event fires, call `queryClient.invalidateQueries()` to trigger a refetch rather than manually patching local state.

**When to use:** Any table with realtime enabled. This avoids building a manual merge/patch layer for optimistic updates and keeps the local cache consistent with the server.

**Trade-offs:** One extra round-trip per realtime event (invalidate triggers a fetch). For a personal dashboard with one user, this is irrelevant. Scales to multi-user if auth is added later.

**Example:**

```typescript
// Inside a tool page or custom hook
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '~/lib/supabase'

function useTodosRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('todos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' },
        () => queryClient.invalidateQueries({ queryKey: ['todos'] })
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient])
}
```

### Pattern 5: Single-Source Colour Palette via CSS Variables

**What:** Define all colour tokens as CSS custom properties in `src/styles/theme.css`. Use `@theme inline` to expose them to Tailwind as utilities. No colour values live anywhere else in the codebase — not in components, not in tailwind config, not in shadcn component overrides.

**When to use:** Always, from day one. The entire shadcn/ui component library reads from these tokens. Swapping the colour palette means editing one block in `theme.css`.

**Trade-offs:** Requires discipline to not reach for `bg-blue-500` directly. Enforce via an OXC rule if needed. The payoff is trivial theme swapping.

**Example:**

```css
/* src/styles/theme.css */

:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(222 47% 11%);
  --primary: hsl(250 60% 45%);
  --primary-foreground: hsl(0 0% 98%);
  --secondary: hsl(210 40% 96%);
  --secondary-foreground: hsl(222 47% 11%);
  --muted: hsl(210 40% 96%);
  --muted-foreground: hsl(215 16% 47%);
  --accent: hsl(210 40% 96%);
  --accent-foreground: hsl(222 47% 11%);
  --destructive: hsl(0 84% 60%);
  --border: hsl(214 32% 91%);
  --input: hsl(214 32% 91%);
  --ring: hsl(250 60% 45%);
  --radius: 0.5rem;
}

.dark {
  --background: hsl(222 47% 11%);
  --foreground: hsl(210 40% 98%);
  --primary: hsl(250 60% 60%);
  --primary-foreground: hsl(222 47% 11%);
  /* ... invert all tokens */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
}
```

---

## Data Flow

### Request Flow (Read Path)

```
User navigates to /todos
        ↓
TanStack Router matches _app/todos.tsx
        ↓
Route loader calls getTodos() [todos.functions.ts — createServerFn]
        ↓
Server executes fetchAllTodos() [todos.server.ts]
        ↓
Supabase client queries todos table
        ↓
Data returned → TanStack Query caches under ['todos']
        ↓
TodoPage renders with data from useQuery(['todos'])
```

### Write Path (Mutation)

```
User creates a todo
        ↓
Form submits → useMutation calls createTodo() [todos.functions.ts]
        ↓
Server executes insertTodo() [todos.server.ts]
        ↓
Supabase INSERT → Postgres
        ↓
Supabase Realtime fires postgres_changes event
        ↓
useTodosRealtime hook receives event
        ↓
queryClient.invalidateQueries(['todos'])
        ↓
TanStack Query refetches → UI updates
```

### Bento Overview Data Flow

```
User navigates to / (Overview)
        ↓
Overview page renders BentoGrid
        ↓
BentoGrid iterates toolRegistry → renders each tool's Widget
        ↓
Each Widget is a lazy-loaded React component
        ↓
Each Widget independently calls its own useQuery (e.g., ['todos'])
        ↓
Widgets fetch from already-cached data where possible
        ↓
Bento grid composes into overview layout
```

### Key Data Flow Properties

1. **Unidirectional:** Data flows from Supabase → server functions → TanStack Query cache → React components. Components never write directly to Supabase.
2. **Tool isolation:** Each tool's queries use a namespaced query key (`['todos']`, `['notes']`, etc.). A tool's realtime subscription only invalidates its own queries.
3. **Realtime as cache invalidation:** Supabase Realtime is used solely to trigger refetches. It does not push full state into React state — TanStack Query remains the source of truth on the client.

---

## Component Boundaries

| Boundary | Communication Method | Direction | Notes |
|----------|----------------------|-----------|-------|
| Route → Tool Page | Import (direct) | One-way | Route file imports `TodoPage` from `tools/todos/` |
| Overview → Tool Widget | Import via registry | One-way | Overview iterates `toolRegistry`, lazy-loads Widget |
| Sidebar → Registry | Import (direct) | One-way | Sidebar reads `toolRegistry` for nav links |
| Tool Page → Server Fn | `createServerFn` RPC call | Request/response | Type-safe; server code never reaches browser |
| Server Fn → Supabase | `supabase-js` SDK | Request/response | Only in `*.server.ts` files |
| Supabase → Client | Realtime channel | Push (server→client) | Used only to invalidate TanStack Query cache |
| Components → Theme | CSS custom properties | One-way | Components use `bg-primary`, never hardcoded values |
| Tools → Each Other | None | — | Tools must not import from sibling tool folders |

---

## Suggested Build Order

Build order follows hard dependencies. Each step produces something the next step needs.

```
1. Theme foundation
   └── theme.css CSS variables → Tailwind utilities available

2. Supabase foundation
   ├── Create todos table in Supabase
   ├── Generate database.types.ts
   └── src/lib/supabase.ts singleton client

3. Route shell
   ├── __root.tsx (providers: QueryClientProvider, etc.)
   ├── _app.tsx (pathless layout with placeholder sidebar)
   └── _app/index.tsx (empty overview page)

4. Tool registry
   └── src/tools/registry.ts (empty array to start)

5. Sidebar component
   └── Reads from registry (initially empty; just renders the shell)

6. Todo tool — server layer
   ├── todos.server.ts (Supabase query helpers)
   └── todos.functions.ts (createServerFn wrappers)

7. Todo tool — UI
   ├── TodoPage.tsx (full-page CRUD UI)
   └── _app/todos.tsx (route file that imports TodoPage)

8. Todo tool — bento widget
   └── TodoWidget.tsx (compact summary card)

9. Register todo tool
   └── Add entry to toolRegistry → sidebar and overview pick it up

10. Overview / bento page
    └── _app/index.tsx renders BentoGrid with widget from registry

11. Realtime wiring
    └── useTodosRealtime hook added to TodoPage
```

**Rationale for this order:**
- Theme first: every component depends on Tailwind utilities existing.
- DB + client before UI: routes need typed queries to load data.
- Shell before tools: tools need a place to render (the Outlet).
- Server functions before UI: the page needs something to call.
- Registry last (before overview): the overview is useless until at least one tool is registered.

---

## Anti-Patterns

### Anti-Pattern 1: Hardcoded Colour Values in Components

**What people do:** `className="bg-blue-500 text-white"` directly in components.

**Why it's wrong:** Breaks the single-source-of-truth colour system. Swapping the palette requires grep-and-replace across the entire codebase instead of editing one CSS file. shadcn/ui components will use the token system; custom components that don't are visually inconsistent.

**Do this instead:** `className="bg-primary text-primary-foreground"` — always reference semantic tokens, never specific colour scales.

### Anti-Pattern 2: Importing Between Tool Folders

**What people do:** `TodoWidget.tsx` imports a utility from `notes/notesHelpers.ts`.

**Why it's wrong:** Creates hidden coupling between tools. Removing or refactoring one tool breaks another. The self-contained tool constraint exists specifically to prevent this.

**Do this instead:** Move shared utilities to `src/lib/` or `src/utils/`. If two tools share logic, that logic is not tool-specific.

### Anti-Pattern 3: Multiple Supabase Client Instances

**What people do:** `createClient(url, key)` called inline in each component or server function that needs the DB.

**Why it's wrong:** Multiple client instances break realtime subscriptions (each has its own connection), waste resources, and can cause auth state desync (even for no-auth apps, multiple clients add unnecessary overhead).

**Do this instead:** `src/lib/supabase.ts` exports one singleton. All server functions import from there.

### Anti-Pattern 4: Client-Side Supabase Queries (Bypassing Server Functions)

**What people do:** Import `supabase` from `lib/supabase.ts` directly in a React component and call `.from('todos').select()` in a `useEffect` or `useQuery`.

**Why it's wrong:** Exposes the Supabase anon key logic on the client, makes it harder to add validation or auth middleware later, and bypasses the clean server/client boundary that `createServerFn` provides.

**Do this instead:** All DB queries go through `createServerFn` wrappers in `*.functions.ts`. Components only call server functions — they never call Supabase directly. The one exception is realtime channel subscriptions (those must be client-side) but they should only invalidate cache, not query data.

### Anti-Pattern 5: Registering Tools by Editing Sidebar and Overview Separately

**What people do:** Add nav links to `Sidebar.tsx` and add widget imports to the overview page whenever a new tool is added.

**Why it's wrong:** Two places to update means two places to forget. The sidebar and overview get out of sync.

**Do this instead:** Add one entry to `toolRegistry` in `registry.ts`. The sidebar and overview both read from it.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Postgres | `supabase-js` client in `*.server.ts` files via `createServerFn` | Singleton client in `src/lib/supabase.ts`; types generated via CLI |
| Supabase Realtime | Client-side channel subscriptions in React hooks | Used only to call `invalidateQueries`; one channel per tool table |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Route files ↔ Tool pages | Direct import | Route is thin; imports tool's page component |
| Overview page ↔ Tool widgets | Via `toolRegistry` | Decoupled; overview doesn't know about specific tools |
| Sidebar ↔ Tool nav entries | Via `toolRegistry` | Same registry drives both nav and bento |
| Components ↔ Colour system | CSS custom properties | Zero JS — purely CSS; no theme context or React context needed |
| shadcn/ui components ↔ Custom components | Shared CSS token layer | Both read from same `--primary`, `--muted`, etc. variables |

---

## Scaling Considerations

This is a personal tool — single user, no auth, no multi-tenancy. Scaling concerns are minimal.

| Concern | Current scope | If it grows |
|---------|--------------|-------------|
| Data volume | Hundreds of todos | Pagination in server functions; add `.range()` to Supabase queries |
| Tool count | 1 tool (todos) | Registry pattern handles 10+ tools with no architecture changes |
| Bundle size | Tiny — 1 tool | Tool widgets are lazy-loaded from registry; each loads only when rendered |
| Realtime connections | 1 channel | One channel per tool; Supabase free tier handles dozens |
| DB schema | 1 table | Each tool owns its own table(s); no cross-tool tables |

---

## Sources

- [TanStack Router: File-Based Routing](https://tanstack.com/router/latest/docs/routing/file-based-routing) — MEDIUM confidence (redirected; content extracted via search)
- [TanStack Start: Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions) — HIGH confidence (fetched directly)
- [Supabase: TanStack Start Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/tanstack) — HIGH confidence (fetched directly)
- [Supabase: TypeScript Support](https://supabase.com/docs/reference/javascript/typescript-support) — HIGH confidence (fetched directly)
- [shadcn/ui: Theming](https://ui.shadcn.com/docs/theming) — HIGH confidence (fetched directly)
- [shadcn/ui: Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) — HIGH confidence (fetched directly)
- [Custom Layout for Specific Route Group in TanStack Router](https://dev.to/xb16/custom-layout-for-specific-route-group-in-tanstack-router-solution-2ndp) — HIGH confidence (fetched directly)
- [Supabase + TanStack Query: makerkit.dev](https://makerkit.dev/blog/saas/supabase-react-query) — HIGH confidence (fetched directly)
- [TanStack Start + shadcn/ui Dashboard: freeCodeCamp](https://www.freecodecamp.org/news/build-an-admin-dashboard-with-shadcnui-and-tanstack-start/) — HIGH confidence (fetched directly)

---

*Architecture research for: personal dashboard / modular tool aggregator*
*Researched: 2026-03-28*
