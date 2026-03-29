---
phase: 02-route-shell-and-tool-registry
plan: 01
subsystem: navigation
tags: [shadcn-sidebar, tool-registry, navigation, lucide, tanstack-router]

# Dependency graph
requires:
  - 01-01 (shadcn/ui initialized with base-nova preset, Tailwind v4 CSS token system)
  - 01-02 (sidebar CSS variables defined in src/styles.css)
provides:
  - shadcn sidebar/tooltip/separator UI primitives at src/components/ui/
  - Tool registry at src/tools/registry.ts (FOUN-03 single source of truth)
  - PlaceholderBentoCard at src/tools/PlaceholderBentoCard.tsx
  - AppSidebar component at src/components/AppSidebar.tsx (NAV-01)
affects:
  - 02-02 (AppSidebar consumed by _layout.tsx; registry consumed by overview page)
  - All future tool phases (registry entries drive sidebar and bento grid automatically)

# Tech tracking
tech-stack:
  added:
    - "shadcn sidebar (collapsible icon-only sidebar with tooltip support)"
    - "shadcn tooltip (auto-used by SidebarMenuButton tooltip prop)"
    - "shadcn separator (sidebar section dividers)"
    - "shadcn button/input/sheet/skeleton (sidebar deps installed transitively)"
    - "src/hooks/use-mobile.ts (mobile detection hook, installed by sidebar)"
  patterns:
    - "Tool registry pattern: src/tools/registry.ts exports ToolEntry[] as single import for sidebar + overview"
    - "BentoCard typed as ComponentType<{ tool: ToolEntry }> — consistent prop contract across all tools"
    - "SidebarMenuButton with render prop (base-ui pattern, NOT asChild) for TanStack Router Link"
    - "Active state: useMatchRoute() + isActive prop on SidebarMenuButton"
    - "No icon sizing classes on icons inside SidebarMenuButton (sidebar CSS handles sizing)"
    - "Overview as hardcoded first sidebar entry (not in registry — keeps registry clean for tools)"

key-files:
  created:
    - src/components/ui/sidebar.tsx (shadcn sidebar primitives: SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarRail)
    - src/components/ui/tooltip.tsx (shadcn tooltip primitives)
    - src/components/ui/separator.tsx (shadcn separator primitive)
    - src/components/ui/button.tsx (shadcn button, installed as sidebar dep)
    - src/components/ui/input.tsx (shadcn input, installed as sidebar dep)
    - src/components/ui/sheet.tsx (shadcn sheet, installed as sidebar dep for mobile)
    - src/components/ui/skeleton.tsx (shadcn skeleton, installed as sidebar dep)
    - src/hooks/use-mobile.ts (mobile detection hook)
    - src/tools/registry.ts (ToolEntry interface + tools array — FOUN-03)
    - src/tools/PlaceholderBentoCard.tsx (shared placeholder bento card for Phase 2)
    - src/components/AppSidebar.tsx (registry-driven collapsible sidebar with active state)
  modified: []

key-decisions:
  - "BentoCard typed as ComponentType<{ tool: ToolEntry }> (not zero-props ComponentType) — allows real BentoCards to receive tool context without separate prop threading"
  - "Overview nav item hardcoded (not in tools registry) — keeps registry clean for actual tools; first entry always present"
  - "tool.route cast as any for Link to prop — /todos route doesn't exist yet; typed safety deferred to Phase 4 when route is created"
  - "fmt:check failure on routeTree.gen.ts is pre-existing (out of scope per deviation Rule scope boundary)"

# Metrics
duration: 3min
completed: 2026-03-29
---

# Phase 02 Plan 01: Sidebar Components + Tool Registry + AppSidebar Summary

**shadcn sidebar primitives installed, tool registry at src/tools/registry.ts establishes ToolEntry as the single source of truth (FOUN-03), and AppSidebar reads from registry with useMatchRoute active state detection (NAV-01, NAV-03).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-29T18:59:31Z
- **Completed:** 2026-03-29T19:02:26Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Installed shadcn `sidebar`, `tooltip`, `separator` (plus transitive deps: button, input, sheet, skeleton)
- Created `src/tools/registry.ts` with typed `ToolEntry` interface (id, label, route, icon, BentoCard) and `tools` array with Todos entry
- Created `src/tools/PlaceholderBentoCard.tsx` using project color tokens (neutral-900/700/100/400, violet-400) with Link wrapper and "Coming soon" text
- Created `src/components/AppSidebar.tsx` with collapsible sidebar (icon-only mode), registry-driven nav items, and useMatchRoute active state
- No hardcoded color values in any new component (all Tailwind project palette tokens)
- Lint passes with 0 warnings and 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn sidebar components and create tool registry with PlaceholderBentoCard** - `41d56fc` (feat)
2. **Task 2: Create AppSidebar component with registry-driven nav and active state** - `f803c86` (feat)

## Files Created/Modified

- `src/components/ui/sidebar.tsx` — Full shadcn sidebar component suite with base-ui render prop pattern
- `src/components/ui/tooltip.tsx` — shadcn tooltip for collapsed sidebar hover states
- `src/components/ui/separator.tsx` — shadcn separator primitive
- `src/components/ui/button.tsx`, `input.tsx`, `sheet.tsx`, `skeleton.tsx` — sidebar transitive deps
- `src/hooks/use-mobile.ts` — mobile detection hook (installed with sidebar)
- `src/tools/registry.ts` — ToolEntry interface + tools array; Todos entry with CheckSquare icon; BentoCard typed as `ComponentType<{ tool: ToolEntry }>`
- `src/tools/PlaceholderBentoCard.tsx` — Card with Link wrapper, tool.label heading (text-base/neutral-100), "Coming soon" (text-sm/neutral-400), hover:border-violet-400 transition
- `src/components/AppSidebar.tsx` — Collapsible sidebar (collapsible="icon"), hardcoded Overview entry (LayoutGrid icon), registry-driven tool items, render prop for Link, isActive via useMatchRoute, SidebarRail toggle

## Decisions Made

- **BentoCard prop contract:** Used `ComponentType<{ tool: ToolEntry }>` (with tool prop) instead of zero-props `ComponentType`. This allows real BentoCards in later phases to receive their tool entry context without changing the registry shape.
- **Overview in hardcoded position:** The Overview nav item ("/" → LayoutGrid) is hardcoded as the first sidebar entry rather than added to the tools registry. This keeps the registry clean for actual tool entries and avoids mixing meta-navigation with tool entries.
- **Type cast for tool.route:** `tool.route as any` used for the Link `to` prop because `/todos` route doesn't exist in routeTree.gen.ts yet. Full type safety will be added in Phase 4 when the todos route is created.

## Deviations from Plan

None — plan executed exactly as written.

The `fmt:check` gate reports a format issue in `src/routeTree.gen.ts`, but this file is a pre-existing modified file (already in `git status` before this plan started) that is auto-generated by TanStack Router. This is out of scope per the deviation rules scope boundary.

## Known Stubs

- `src/tools/PlaceholderBentoCard.tsx` — The `PlaceholderBentoCard` component is an intentional placeholder that renders "Coming soon" for all tools in Phase 2. This stub is by design: real BentoCards (e.g., `TodosBentoCard`) replace it in Phase 3+ by updating the registry entry's `BentoCard` field. The stub does not prevent Phase 2's goal (establishing the registry contract and navigation shell).

## Self-Check: PASSED

All key files verified present:

- FOUND: src/components/ui/sidebar.tsx
- FOUND: src/components/ui/tooltip.tsx
- FOUND: src/components/ui/separator.tsx
- FOUND: src/tools/registry.ts
- FOUND: src/tools/PlaceholderBentoCard.tsx
- FOUND: src/components/AppSidebar.tsx

All commits verified:

- FOUND: 41d56fc (Task 1: sidebar components + registry)
- FOUND: f803c86 (Task 2: AppSidebar)

---

_Phase: 02-route-shell-and-tool-registry_
_Completed: 2026-03-29_
