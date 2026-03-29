# Phase 2: Route Shell & Tool Registry - Research

**Researched:** 2026-03-29
**Domain:** TanStack Router pathless layout routes, shadcn Sidebar (base-ui variant), tool registry pattern
**Confidence:** HIGH

## Summary

Phase 2 builds the navigable app skeleton: a pathless layout route wrapping all pages with a collapsible shadcn Sidebar, and a central tool registry driving both the sidebar and the bento overview grid. No business logic or real data — just the structural scaffolding that all downstream tool phases slot into.

The most important pre-planning discoveries are: (1) this project uses **base-ui primitives** (not Radix), which changes `SidebarMenuButton`'s Link integration from `asChild` to `render` prop; (2) wiring a TanStack Router `Link` into `SidebarMenuButton` requires a specific pattern because of a now-fixed tooltip/render prop conflict; (3) moving `index.tsx` inside a `_layout/` directory is the correct file-based approach for making all routes children of the pathless layout; (4) `isActive` on `SidebarMenuButton` must be driven by `useMatchRoute` since the sidebar is not a native `<Link>` tree.

**Primary recommendation:** Install `sidebar`, `tooltip`, and `separator` components via the shadcn CLI, create `_layout.tsx` + `_layout/` directory structure, wire `SidebarMenuButton` with `render={<Link to={...} />}` and `isActive` derived from `useMatchRoute`, and drive both sidebar and overview from a single `src/tools/registry.ts` export.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sidebar component**
- Use shadcn's Sidebar component — do not build a custom sidebar from scratch
- Collapsible — expands to icon+label, collapses to icon-only
- When collapsed, tooltips appear on hover to show the item label (shadcn's `SidebarMenuButton` handles this automatically)
- Header area: icon (Lucide icon, e.g. `LayoutDashboard`) + app name "Dashboard" at the top of the sidebar

**Active nav indicator**
- Use shadcn's built-in `isActive` prop on `SidebarMenuButton`
- Override accent colour to violet (from D-02 / `violet-500` family) — subtle background fill + text/icon in violet
- Do not add a custom left border or extra chrome; keep it to shadcn's default isActive shape with the colour override

**Tool registry**
- File lives at `src/tools/registry.ts`
- Each entry is an all-in-one object from day one:
  ```ts
  {
    id: string,
    label: string,
    route: string,
    icon: LucideIcon,
    BentoCard: React.ComponentType,
  }
  ```
- Phase 2 placeholder entries use a shared generic `PlaceholderBentoCard` component
- No schema change required in future phases — tools just fill in the real `BentoCard`

**Layout structure**
- A TanStack Router pathless layout route (e.g. `_layout.tsx`) wraps all tool and overview pages with the sidebar
- The root route (`__root.tsx`) stays as a bare HTML wrapper — it does not get the sidebar
- The sidebar renders inside the pathless layout; all routed pages are rendered via `<Outlet />` beside it

**Overview page placeholder**
- `/` renders a responsive grid of BentoCards sourced from the registry
- Phase 2 uses the shared `PlaceholderBentoCard` for every entry (shows tool name + placeholder label)
- Grid structure is established here; real cards slot in during later phases with no structural changes

### Claude's Discretion
- Exact sidebar width (expanded and collapsed)
- `PlaceholderBentoCard` visual design — whatever communicates "placeholder" clearly
- Grid column count / breakpoints on the overview page
- TypeScript type name for the registry entry shape

### Deferred Ideas (OUT OF SCOPE)
- Real tool bento cards — Phase 3+ (each tool phase provides its own `BentoCard`)
- Mobile/responsive sidebar behaviour (hamburger menu, drawer) — not in scope for Phase 2; this is a personal desktop dashboard
- Sidebar footer area (settings link, user profile) — deferred to a later phase if needed
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUN-03 | A tool registry exists as the single source of truth for all registered tools (sidebar + overview read from it) | Registry pattern at `src/tools/registry.ts`; typed `ToolEntry` shape exported as array |
| FOUN-04 | Adding a new tool requires only: a registry entry, a route directory, and a bento card component — no changes to shared layout code | Registry-driven import eliminates all hardcoded nav or card references in `_layout.tsx` and `index.tsx` |
| NAV-01 | User sees a sidebar with links to the overview page and each registered tool's page | shadcn `Sidebar` + `SidebarMenu` mapping over registry entries |
| NAV-02 | User can navigate between the overview page and tool pages via the sidebar without a full page reload | TanStack Router `Link` via `render` prop on `SidebarMenuButton` — client-side SPA navigation |
| NAV-03 | The current active page is visually indicated in the sidebar | `isActive` prop on `SidebarMenuButton` driven by `useMatchRoute()` hook |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

Directives the planner must verify compliance against:

| Directive | Constraint |
|-----------|------------|
| Tech stack locked | TanStack Start + Tailwind + shadcn + Lucide + OXC + Supabase — no deviations |
| Colour system | All colours via Tailwind CSS config palette tokens — no hardcoded values in components |
| Modularity | Each tool self-contained; no changes to shared layout when adding tools |
| Package manager | `bun` — use `bunx --bun shadcn@latest add` |
| No tailwind.config.js | All Tailwind config lives in CSS `@theme` block |
| No dark: prefix | Dark mode only; single theme in `:root` |
| No raw Tailwind palette | No `gray-*`, `slate-*`, `blue-*` etc. — only project tokens |
| shadcn base | `"base": "base"` in components.json — use `render` prop, NOT `asChild` for SidebarMenuButton |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-router` | ^1.167.13 | File-based routing, pathless layout routes, `Link`, `useMatchRoute` | Already installed (transitively via `@tanstack/react-start`) |
| `shadcn/ui sidebar` | CLI-managed | Collapsible icon-only sidebar with tooltip support | Locked decision; eliminates building collapse/tooltip/icon logic from scratch |
| `shadcn/ui tooltip` | CLI-managed | Collapsed sidebar icon tooltips | Auto-used by `SidebarMenuButton` tooltip prop |
| `shadcn/ui separator` | CLI-managed | Sidebar section dividers if needed | Preferred over raw `<hr>` (SKILL.md composition rule) |
| `lucide-react` | ^1.7.0 | Icons for sidebar header and nav items | Already installed; project's icon library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cn()` from `src/lib/utils.ts` | — | Conditional class merging | Any conditional Tailwind class logic in new components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn `Sidebar` | Custom sidebar div | No — locked decision. shadcn Sidebar handles collapse animation, icon-only state, tooltip wiring, and keyboard toggle (Cmd+B / Ctrl+B) |

**Installation:**
```bash
bunx --bun shadcn@latest add sidebar
bunx --bun shadcn@latest add tooltip
bunx --bun shadcn@latest add separator
```

**No npm version verification needed** — these are installed from the shadcn registry directly, not via npm. The CLI installs the source files at their current registry version.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── routes/
│   ├── __root.tsx               # bare HTML shell — unchanged
│   ├── _layout.tsx              # pathless layout route (sidebar lives here)
│   └── _layout/
│       └── index.tsx            # overview page at "/" (moved from routes/index.tsx)
├── tools/
│   ├── registry.ts              # FOUN-03 single source of truth
│   └── PlaceholderBentoCard.tsx # shared placeholder component (Phase 2 only)
└── components/
    └── AppSidebar.tsx           # sidebar component (imported by _layout.tsx)
```

> Note: `src/routes/index.tsx` currently exists at the root level. It must be **moved** to `src/routes/_layout/index.tsx` so it becomes a child of the pathless layout. The TanStack Router bundler plugin regenerates `routeTree.gen.ts` automatically on next dev server start.

### Pattern 1: TanStack Router Pathless Layout Route

**What:** A file prefixed with `_` creates a layout route that contributes UI (sidebar) without adding a URL path segment. Child routes live in the matching `_layout/` directory.

**When to use:** Wrapping all app pages with persistent chrome (sidebar) while keeping `__root.tsx` as a bare HTML shell.

**File naming:**
```
src/routes/_layout.tsx           → pathless layout (id: /_layout)
src/routes/_layout/index.tsx     → route at "/"
src/routes/_layout/todos/index.tsx  → route at "/todos" (Phase 3+)
```

**`_layout.tsx` pattern:**
```tsx
// Source: TanStack Router file-based routing docs
import { Outlet, createFileRoute } from "@tanstack/react-router"
import { SidebarProvider, SidebarInset } from "#/components/ui/sidebar"
import { AppSidebar } from "#/components/AppSidebar"

export const Route = createFileRoute("/_layout")({
  component: LayoutComponent,
})

function LayoutComponent() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
```

### Pattern 2: Tool Registry Shape

**What:** A typed array of tool entries at `src/tools/registry.ts` that both the sidebar and overview page consume.

**When to use:** Anytime you need a list of tools — sidebar menu, overview bento grid.

**Implementation:**
```ts
// Source: 02-CONTEXT.md locked decision
import type { LucideIcon } from "lucide-react"
import type { ComponentType } from "react"

export interface ToolEntry {
  id: string
  label: string
  route: string
  icon: LucideIcon
  BentoCard: ComponentType
}

export const tools: ToolEntry[] = [
  // entries added here drive both sidebar and overview automatically
]
```

### Pattern 3: SidebarMenuButton with TanStack Router Link (base-ui)

**What:** Integrating TanStack Router's `Link` into `SidebarMenuButton` using the `render` prop (base-ui pattern, NOT `asChild`).

**Critical detail:** This project uses `"base": "base"` (base-ui primitives). The shadcn/ui Sidebar component's `SidebarMenuButton` uses `render` prop, not `asChild`. The pattern is:
```tsx
// Source: shadcn sidebar example (base variant)
// Source: .agents/skills/shadcn/rules/base-vs-radix.md
<SidebarMenuButton
  render={<Link to={tool.route} />}
  isActive={isActiveRoute}
>
  <tool.icon />
  <span>{tool.label}</span>
</SidebarMenuButton>
```

**Active state detection** — `isActive` prop must be a boolean driven by `useMatchRoute`:
```tsx
// Source: TanStack Router docs - useMatchRoute hook
import { useMatchRoute } from "@tanstack/react-router"

function NavItem({ tool }: { tool: ToolEntry }) {
  const matchRoute = useMatchRoute()
  const isActiveRoute = Boolean(matchRoute({ to: tool.route }))
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link to={tool.route} />}
        isActive={isActiveRoute}
      >
        <tool.icon />
        <span>{tool.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
```

### Pattern 4: AppSidebar Component Structure

**What:** The sidebar component imported by `_layout.tsx`, mapping registry entries to menu items.

**Structure matching UI-SPEC:**
```tsx
// Matches 02-UI-SPEC.md §Sidebar Structure
<Sidebar collapsible="icon">
  <SidebarHeader>
    <div className="flex items-center gap-2 px-4 py-3">
      <LayoutDashboard className="size-6 text-neutral-100" />
      <span className="text-sm font-semibold text-neutral-100">Dashboard</span>
    </div>
  </SidebarHeader>
  <SidebarContent>
    <SidebarGroup>
      <SidebarMenu>
        {tools.map((tool) => (
          <SidebarMenuItem key={tool.id}>
            <NavItem tool={tool} />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  </SidebarContent>
  <SidebarRail />
</Sidebar>
```

### Pattern 5: Overview Page Bento Grid

**What:** Overview page at `/` rendering one card per registry entry, grid established here for Phase 5 slot-in.

**Implementation:**
```tsx
// Source: 02-UI-SPEC.md §Bento Grid
import { tools } from "#/tools/registry"

function IndexPage() {
  return (
    <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:gap-6">
      {tools.map((tool) => (
        <tool.BentoCard key={tool.id} />
      ))}
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Hardcoded nav items:** Never list sidebar links directly in `_layout.tsx` — always import from registry
- **`asChild` on SidebarMenuButton:** This project uses base-ui, not Radix. Use `render` prop instead
- **Colour tokens inline in components:** No `oklch(...)` values in `.tsx` files — use Tailwind utilities (`bg-neutral-900`, `text-violet-500`) that reference `src/theme.css` tokens
- **`dark:` prefix on any class:** Single dark theme — `dark:` prefix is never needed
- **Icon sizing classes on icons inside SidebarMenuButton:** The sidebar CSS handles icon sizing. Do not add `size-4` or `w-5 h-5` on icons inside `SidebarMenuButton` unless overriding deliberately
- **Importing `Outlet` from `@tanstack/react-start`:** Use `@tanstack/react-router` for `Outlet` in layout components

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible sidebar | Custom `useState(isOpen)` + conditional widths | shadcn `Sidebar` with `collapsible="icon"` | Handles animation, keyboard toggle (Cmd+B), ARIA, icon-only state, `SidebarRail` toggle |
| Tooltips on collapsed sidebar icons | Manual `onMouseEnter` tooltip logic | shadcn `SidebarMenuButton` tooltip prop | Automatic tooltip display when sidebar is in icon-only state |
| Active nav indicator | Custom `usePathname` + className conditional | `isActive` prop on `SidebarMenuButton` + `useMatchRoute()` | Clean, semantically correct — no custom CSS needed |
| Class merging | Manual template literal ternaries | `cn()` from `#/lib/utils` | Handles edge cases, consistent across project |

**Key insight:** The shadcn Sidebar component absorbs all the collapse/expand/tooltip/ARIA complexity. The implementation task is wiring it up, not implementing it.

---

## Common Pitfalls

### Pitfall 1: asChild vs render — Wrong Prop for base-ui
**What goes wrong:** Using `<SidebarMenuButton asChild><Link to="/" /></SidebarMenuButton>` fails silently or throws a prop error. `asChild` is a Radix prop; this project uses base-ui where the correct prop is `render`.
**Why it happens:** Most shadcn documentation examples show the Radix variant. The base-ui variant was introduced more recently and is less documented in tutorials.
**How to avoid:** Always check `components.json` `"base"` field. This project has `"base": "base"` → always use `render` prop.
**Warning signs:** Component renders but navigation does not work, or TypeScript error `Property 'asChild' does not exist`.

### Pitfall 2: render Prop Lost When tooltip is Present (Issue #9277)
**What goes wrong:** When `SidebarMenuButton` has both a `tooltip` prop and a `render` prop, older versions of the component replace the `render` prop with `TooltipTrigger`, losing the `Link` entirely. Navigation stops working.
**Why it happens:** The sidebar component conditionally replaces `render` with `TooltipTrigger` when a tooltip is set.
**Resolution:** This was fixed in PR #9758 (merged March 3, 2026). However, since no shadcn UI components are installed yet, when components are added via `bunx --bun shadcn@latest add sidebar`, the installed version should include the fix. Verify post-install by running the app collapsed and clicking a nav item.
**How to avoid:** Add `sidebar` via CLI immediately before coding; verify the installed `sidebar.tsx` does not have the broken conditional. If it does, apply the fix: always compose `TooltipTrigger` around the `render` element rather than replacing it.
**Warning signs:** Clicking sidebar items in icon-only (collapsed) mode does not navigate.

### Pitfall 3: routes/index.tsx Must Move
**What goes wrong:** If `src/routes/index.tsx` stays at the root level alongside `_layout.tsx`, TanStack Router treats it as a direct child of `__root__`, not of `_layout`. The sidebar never renders on the overview page.
**Why it happens:** Flat file `_layout.tsx` + directory `_layout/` is the correct pattern. Routes at the same level as `_layout.tsx` are siblings, not children.
**How to avoid:** Move `src/routes/index.tsx` to `src/routes/_layout/index.tsx`. The `routeTree.gen.ts` regenerates automatically on next dev server start.
**Warning signs:** Sidebar does not appear at `/` — page renders directly from `__root__` → `IndexRoute` with no layout wrapper.

### Pitfall 4: registry.ts importing React types without "use client"
**What goes wrong:** `PlaceholderBentoCard.tsx` uses `useState`/`useEffect` or event handlers — but `rsc: false` in `components.json` means this is NOT an RSC project. No `"use client"` directive is needed.
**Why it happens:** Cargo-culting Next.js App Router patterns.
**How to avoid:** The shadcn project context shows `"rsc": false`. Never add `"use client"` to new components in this project.

### Pitfall 5: Violet Colour Classes Require Exact Token Names
**What goes wrong:** Writing `text-violet-600` or `bg-violet-500` — `violet-600` does not exist in `src/theme.css`, and the default Tailwind palette is purged by `--color-*: initial`.
**Why it happens:** Only `--color-violet-500` and `--color-violet-400` are defined (Phase 1 token system). Any other violet step renders transparent.
**How to avoid:** Only use `text-violet-500`, `bg-violet-500`, `text-violet-400`, `bg-violet-400` from the violet scale. Use the semantic sidebar tokens (`bg-sidebar-primary`, `text-sidebar-primary`) where possible — these are already wired to violet-500 in `src/styles.css`.

### Pitfall 6: Sidebar token overrides are already in styles.css
**What goes wrong:** Attempting to re-declare `--sidebar-primary` or other sidebar CSS variables, creating duplicate definitions.
**Why it happens:** Phase 1 already set all sidebar CSS variables in `src/styles.css` `:root` block (confirmed in codebase read).
**How to avoid:** Do NOT add sidebar CSS variables in Phase 2. They are already defined:
- `--sidebar: oklch(0.13 0 0)` (neutral-900)
- `--sidebar-primary: oklch(0.65 0.2 270)` (violet-500)
- `--sidebar-accent: oklch(0.2 0 0)` (neutral-800)
- `--sidebar-border: oklch(0.28 0 0)` (neutral-700)

---

## Code Examples

Verified patterns from official sources and project context:

### Pathless Layout Route (createFileRoute)
```tsx
// Source: TanStack Router file-based routing — GitHub Discussion #1102
// File: src/routes/_layout.tsx
import { Outlet, createFileRoute } from "@tanstack/react-router"
import { SidebarProvider, SidebarInset } from "#/components/ui/sidebar"
import { AppSidebar } from "#/components/AppSidebar"

export const Route = createFileRoute("/_layout")({
  component: LayoutComponent,
})

function LayoutComponent() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
```

### Child Route Under Pathless Layout
```tsx
// Source: TanStack Router file-based routing docs
// File: src/routes/_layout/index.tsx  (was: src/routes/index.tsx)
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/")({
  component: IndexPage,
})

function IndexPage() {
  // ...
}
```

### SidebarMenuButton with render prop and isActive (base-ui variant)
```tsx
// Source: shadcn sidebar-example.tsx (base variant), .agents/skills/shadcn/rules/base-vs-radix.md
import { Link, useMatchRoute } from "@tanstack/react-router"
import { SidebarMenuButton } from "#/components/ui/sidebar"
import type { ToolEntry } from "#/tools/registry"

function NavItem({ tool }: { tool: ToolEntry }) {
  const matchRoute = useMatchRoute()
  const isActiveRoute = Boolean(matchRoute({ to: tool.route }))

  return (
    <SidebarMenuButton
      render={<Link to={tool.route} />}
      isActive={isActiveRoute}
      tooltip={tool.label}
    >
      <tool.icon />
      <span>{tool.label}</span>
    </SidebarMenuButton>
  )
}
```

### Tool Registry Shape
```ts
// Source: 02-CONTEXT.md locked decision
// File: src/tools/registry.ts
import type { LucideIcon } from "lucide-react"
import type { ComponentType } from "react"
import { PlaceholderBentoCard } from "./PlaceholderBentoCard"
import { LayoutGrid } from "lucide-react"

export interface ToolEntry {
  id: string
  label: string
  route: string
  icon: LucideIcon
  BentoCard: ComponentType
}

export const tools: ToolEntry[] = [
  {
    id: "todos",
    label: "Todos",
    route: "/todos",
    icon: LayoutGrid,
    BentoCard: PlaceholderBentoCard,
  },
]
```

### Overview isActive Detection for Overview Nav Item
```tsx
// The overview/"/" route requires exact matching to avoid marking as active on all routes
const matchRoute = useMatchRoute()
const isOverviewActive = Boolean(matchRoute({ to: "/" }))
// Note: TanStack Router matchRoute is exact by default for "/"
```

### Bento Grid
```tsx
// Source: 02-UI-SPEC.md §Bento Grid
import { tools } from "#/tools/registry"

export function BentoGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
      {tools.map((tool) => (
        <tool.BentoCard key={tool.id} />
      ))}
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `asChild` on SidebarMenuButton | `render` prop (base-ui) | shadcn base-ui variant launch (~2025) | Different prop name; same conceptual behaviour |
| `tailwindcss-animate` | `tw-animate-css` | March 2025 (deprecated) | Already handled in Phase 1; no action needed in Phase 2 |
| `tailwind.config.js` | `@theme` block in CSS | Tailwind v4 | Already established in Phase 1 |

**Deprecated/outdated:**
- `asChild` pattern: valid in Radix-based projects, but this project is `"base": "base"` — use `render`
- Vinxi: removed from TanStack Start — irrelevant; already on Vite

---

## Open Questions

1. **routeTree.gen.ts auto-update timing**
   - What we know: TanStack Router's bundler plugin regenerates `routeTree.gen.ts` on dev server start when file structure changes
   - What's unclear: Whether the dev server hot-reloads on file moves or requires a restart
   - Recommendation: Plan a dev server restart step after moving `index.tsx` to `_layout/index.tsx`

2. **Overview nav item in registry or hardcoded?**
   - What we know: CONTEXT.md says "Overview" is the first sidebar entry, links to `/`; copywriting contract shows it as a fixed item
   - What's unclear: Should Overview be in the tool registry (making it a tool) or rendered as a separate header item?
   - Recommendation: Treat Overview as a hardcoded sidebar entry (not in `tools` registry), rendered above the `SidebarMenu` that maps over `tools`. This keeps the registry clean for actual tools. The planner should make this call explicit.

3. **TypeScript type for `to` prop on Link**
   - What we know: TanStack Router generates typed route paths; `tool.route` as a plain string loses type-safety
   - What's unclear: Whether Phase 2 needs full type-safe routing for tool routes that don't exist yet
   - Recommendation: Use `as` cast for `to={tool.route as string}` in Phase 2; tools add their own typed routes in later phases. This avoids TypeScript errors before `/todos` route exists.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | TanStack Start dev server | ✓ | v25.8.2 | — |
| bun | Package manager | ✓ | 1.3.11 | — |
| shadcn CLI | Component installation | ✓ (via bunx) | latest | — |
| lucide-react | Nav icons | ✓ (installed) | ^1.7.0 | — |
| `@tanstack/react-router` | Routing, `useMatchRoute` | ✓ (transitively installed) | ^1.167.13 | — |

**No missing dependencies.** All required tools are available.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test config files, no test directories, no test scripts in package.json |
| Config file | None (Wave 0 must establish) |
| Quick run command | TBD (Wave 0) |
| Full suite command | TBD (Wave 0) |

Phase 2 is entirely structural/UI — no server functions, no async data, no business logic. The meaningful verification is visual and behavioral (sidebar renders, collapses, navigates, shows active state) rather than unit-testable logic.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUN-03 | Registry is sole import in sidebar and overview | code-review | `grep -r "hardcoded" src/routes/ src/components/` — zero matches; inspect imports | N/A |
| FOUN-04 | No layout changes when new registry entry added | code-review | Confirm no hardcoded lists in `_layout.tsx` or `index.tsx` | N/A |
| NAV-01 | Sidebar renders with links | manual smoke | Open app, verify sidebar visible with entries | N/A |
| NAV-02 | Client-side navigation on sidebar click | manual smoke | Click link → check Network tab for no full reload | N/A |
| NAV-03 | Active link visually distinguished | manual smoke | Navigate to each route, verify violet accent on active item | N/A |

### Automated Gate Commands (from UI-SPEC)

These grep-based gates can run in CI or as Wave 3 verification:

```bash
# Gate 1: No hardcoded colour values in new components
grep -r --include="*.tsx" "oklch\|hsl\|rgb\|#[0-9a-f]\{3,6\}" src/routes/ src/components/

# Gate 2: No raw Tailwind default palette classes
grep -r --include="*.tsx" "gray-\|slate-\|zinc-\|blue-\|red-\|green-" src/routes/ src/components/

# Gate 3: Tool registry is single source of truth (no hardcoded nav items)
grep -r --include="*.tsx" "label.*Todos\|label.*Overview" src/routes/_layout.tsx src/routes/_layout/index.tsx
```

### Sampling Rate
- **Per task commit:** Manual spot-check (open app, click links)
- **Per wave merge:** Run the 3 grep gates above
- **Phase gate:** All 3 grep gates green + sidebar collapses + navigation works + active state visible

### Wave 0 Gaps
- No test framework exists; Phase 2 is UI-only with no automatable logic tests
- The grep-based verification gates above serve as the automated quality check
- Framework install: not applicable — no unit tests planned for this phase

---

## Sources

### Primary (HIGH confidence)
- `components.json` — `"base": "base"` confirmed; `"style": "base-nova"`; no installed components
- `src/styles.css` — sidebar CSS variables already defined in `:root`; no new token declarations needed in Phase 2
- `src/theme.css` — project colour scale; only `neutral-950/900/800/700/400/100` and `violet-500/400` exist
- `.agents/skills/shadcn/rules/base-vs-radix.md` — `render` prop vs `asChild` for base-ui; `SidebarMenuButton` explicitly listed
- `shadcn sidebar example` (GitHub raw) — confirmed `render={<a href={...} />}` and `isActive` pattern
- `02-CONTEXT.md` — all locked decisions
- `02-UI-SPEC.md` — sidebar dimensions, bento grid breakpoints, CSS variable values, interaction contract
- `01-CONTEXT.md` — D-01 (dark only), D-02 (violet accent), D-04/D-05 (token naming)

### Secondary (MEDIUM confidence)
- TanStack Router Discussion #1102 — pathless layout route `_auth.tsx` + `_auth/` directory pattern; verified against multiple sources
- `bunx --bun shadcn@latest info --json` — live project state; 0 installed components
- shadcn Issue #9277 + PR #9758 — `render` prop lost with tooltip; fixed March 3, 2026

### Tertiary (LOW confidence)
- WebSearch: TanStack Router `useMatchRoute` for active state detection — described consistently across multiple sources; documentation URL returned 303; treat as MEDIUM

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from `components.json`, `package.json`, project CLAUDE.md
- Architecture (routing structure): HIGH — confirmed pattern from multiple TanStack Router sources
- Sidebar integration (base-ui render prop): HIGH — confirmed from skill file + live shadcn example
- Pitfalls (tooltip/render bug): HIGH — confirmed from GitHub issue + PR with resolution date
- Active state (useMatchRoute): MEDIUM — multiple sources agree but official docs URL returned 303

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (stable stack; shadcn CLI at latest means sidebar component always current)
