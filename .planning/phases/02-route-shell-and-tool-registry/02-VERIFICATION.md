---
phase: 02-route-shell-and-tool-registry
verified: 2026-03-29T20:00:00Z
status: human_needed
score: 8/9 must-haves verified
human_verification:
  - test: "Navigate between Overview and Todos sidebar links in browser"
    expected: "Page content changes without a full browser reload (no visible page flash, network tab shows no document request)"
    why_human: "NAV-02 client-side SPA navigation cannot be verified programmatically without a running browser"
  - test: "Open app at / and confirm sidebar renders with Overview and Todos nav items"
    expected: "Sidebar visible with 'Dashboard' header, 'Overview' and 'Todos' links; active link has violet accent"
    why_human: "Visual rendering and active state styling require browser confirmation"
  - test: "Collapse sidebar using SidebarRail toggle"
    expected: "Sidebar collapses to icon-only mode; tooltips appear on hover over icons in collapsed state"
    why_human: "Interactive collapse behaviour and tooltip rendering require browser testing"
  - test: "Hover over the Todos bento card on the overview page"
    expected: "Card border transitions to violet-400 (150ms ease)"
    why_human: "CSS transition and hover state requires browser visual confirmation"
---

# Phase 02: Route Shell and Tool Registry — Verification Report

**Phase Goal:** Build the navigable app skeleton — pathless layout route wrapping all pages with a collapsible sidebar, tool registry as single source of truth, and registry-driven overview bento page.
**Verified:** 2026-03-29T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A tool registry exists as a typed array at `src/tools/registry.ts` exporting `ToolEntry` type and `tools` array | VERIFIED | File exists, exports `ToolEntry` interface with `id/label/route/icon/BentoCard` fields, exports `tools: ToolEntry[]` with Todos entry |
| 2 | Registry contains at least one tool entry (Todos) with id, label, route, icon, and BentoCard fields | VERIFIED | `tools` array at line 14: `{ id: "todos", label: "Todos", route: "/todos", icon: CheckSquare, BentoCard: PlaceholderBentoCard }` |
| 3 | AppSidebar renders a collapsible shadcn Sidebar with header, nav items from registry, and SidebarRail | VERIFIED | `collapsible="icon"`, `SidebarHeader` with LayoutDashboard + "Dashboard" text, `tools.map` iterates registry, `SidebarRail` rendered |
| 4 | Active nav item is driven by `useMatchRoute` and `isActive` prop on `SidebarMenuButton` using violet accent | VERIFIED | `useMatchRoute()` at line 38; `isActive={isOverviewActive}` and `isActive={isActive}` on `NavItem`; sidebar.tsx uses `data-active:bg-sidebar-primary` (violet via `oklch(0.65 0.2 270)`) |
| 5 | PlaceholderBentoCard renders a card with tool name and "Coming soon" muted text | VERIFIED | Renders `{tool.label}` in `text-neutral-100` heading and "Coming soon" in `text-neutral-400`; wrapped in TanStack Router `Link` |
| 6 | User sees a sidebar when opening the app at `/` | HUMAN NEEDED | `_layout.tsx` wires `SidebarProvider + AppSidebar + SidebarInset + Outlet`, routeTree confirms `/_layout` wraps `/_layout/`; visual confirmation needed |
| 7 | The pathless layout route wraps all pages with the sidebar via SidebarProvider | VERIFIED | `createFileRoute("/_layout")` exists; `SidebarProvider` wraps `AppSidebar + SidebarInset + Outlet`; routeTree.gen.ts confirms `/_layout` as parent of all child routes |
| 8 | Overview page renders a responsive bento grid of cards sourced from the registry | VERIFIED | `createFileRoute("/_layout/")` renders `tools.map((tool) => <tool.BentoCard key={tool.id} tool={tool} />)` with `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` |
| 9 | Client-side navigation without full page reload (NAV-02) | HUMAN NEEDED | TanStack Router `Link` in `render={}` prop is the mechanism; SPA navigation can only be confirmed in a running browser |

**Score:** 7/9 truths fully automated-verified; 2 require human confirmation (both runtime/visual)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/tools/registry.ts` | Single source of truth for all registered tools (FOUN-03) | VERIFIED | Exists, 23 lines, exports `ToolEntry` + `tools`; substantive, imported by `AppSidebar.tsx` and `_layout/index.tsx` |
| `src/tools/PlaceholderBentoCard.tsx` | Shared placeholder bento card for Phase 2 | VERIFIED | Exists, 14 lines, exports `PlaceholderBentoCard`; imported via registry's `BentoCard` field and rendered by overview page |
| `src/components/AppSidebar.tsx` | Sidebar component reading from registry (NAV-01) | VERIFIED | Exists, 78 lines, exports `AppSidebar`; imports `tools` from registry; used in `_layout.tsx` |
| `src/components/ui/sidebar.tsx` | shadcn Sidebar primitives | VERIFIED | Exists, 690 lines, exports `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarInset`, `SidebarRail`, and more |
| `src/routes/_layout.tsx` | Pathless layout route wrapping all pages with sidebar | VERIFIED | Exists, `createFileRoute("/_layout")`, wires `SidebarProvider + AppSidebar + SidebarInset + Outlet` |
| `src/routes/_layout/index.tsx` | Overview page at `/` with bento grid from registry | VERIFIED | Exists, `createFileRoute("/_layout/")`, renders `tools.map` with `tool.BentoCard` |
| `src/routeTree.gen.ts` | Auto-generated route tree includes `_layout` | VERIFIED | Contains `/_layout`, `/_layout/`, `/_layout/dev-colours` routes; `src/routes/index.tsx` confirmed deleted |
| `src/components/ui/tooltip.tsx` | shadcn tooltip for collapsed sidebar | VERIFIED | Exists, 52 lines |
| `src/components/ui/separator.tsx` | shadcn separator primitive | VERIFIED | Exists |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `AppSidebar.tsx` | `src/tools/registry.ts` | `import { tools } from "#/tools/registry"` | WIRED | Line 13: `import { tools } from "#/tools/registry"` — used in `tools.map()` at line 63 |
| `AppSidebar.tsx` | `src/components/ui/sidebar.tsx` | `import shadcn Sidebar components` | WIRED | Lines 3-12: imports `Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarHeader`, `SidebarMenu`, `SidebarMenuButton`, `SidebarMenuItem`, `SidebarRail` |
| `src/tools/registry.ts` | `src/tools/PlaceholderBentoCard.tsx` | `BentoCard` field references `PlaceholderBentoCard` | WIRED | Line 4: `import { PlaceholderBentoCard } from "./PlaceholderBentoCard"` — assigned as `BentoCard` field in `tools` array |
| `src/routes/_layout.tsx` | `src/components/AppSidebar.tsx` | `import { AppSidebar }` | WIRED | Line 3: `import { AppSidebar } from "#/components/AppSidebar"` — rendered in JSX at line 12 |
| `src/routes/_layout.tsx` | `src/components/ui/sidebar.tsx` | `import { SidebarProvider, SidebarInset }` | WIRED | Line 2: `import { SidebarInset, SidebarProvider } from "#/components/ui/sidebar"` — both used in JSX |
| `src/routes/_layout/index.tsx` | `src/tools/registry.ts` | `import { tools }` | WIRED | Line 2: `import { tools } from "#/tools/registry"` — used in `tools.map()` at line 12 |
| `src/routes/_layout/index.tsx` | `PlaceholderBentoCard` (via `tool.BentoCard`) | `tools.map` renders `tool.BentoCard` | WIRED | Line 13: `<tool.BentoCard key={tool.id} tool={tool} />` — dynamic dispatch through registry |

### Data-Flow Trace (Level 4)

The overview page and sidebar render static registry data (not server/DB data). The registry is a compile-time constant array — no async data source required for Phase 2.

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `AppSidebar.tsx` | `tools` | `src/tools/registry.ts` compile-time array | Yes — array has 1 entry (Todos) | FLOWING |
| `_layout/index.tsx` | `tools` | `src/tools/registry.ts` compile-time array | Yes — same array rendered as bento cards | FLOWING |
| `AppSidebar.tsx` | `isActive` / `isOverviewActive` | `useMatchRoute()` from TanStack Router | Yes — runtime route matching | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Registry exports `ToolEntry` and `tools` | `grep "export interface ToolEntry\|export const tools" src/tools/registry.ts` | Both found | PASS |
| `tools` array contains Todos entry | `grep '"todos"\|"Todos"\|"/todos"' src/tools/registry.ts` | All 3 present | PASS |
| AppSidebar imports from registry | `grep "import.*tools.*registry" src/components/AppSidebar.tsx` | Found at line 13 | PASS |
| `_layout/index.tsx` no hardcoded tool names | `grep -c "Todos" src/routes/_layout/index.tsx` | 0 | PASS |
| oxlint passes | `bun run lint` | 0 warnings, 0 errors | PASS |
| `routeTree.gen.ts` contains `/_layout` routes | `grep "_layout" src/routeTree.gen.ts` | `/_layout`, `/_layout/`, `/_layout/dev-colours` all present | PASS |
| Old `src/routes/index.tsx` deleted | `ls src/routes/index.tsx` | File not found | PASS |
| No `asChild` in new files | `grep "asChild" src/components/AppSidebar.tsx src/routes/_layout.tsx src/routes/_layout/index.tsx` | No matches | PASS |
| `render={}` prop used for Link | `grep "render=" src/components/AppSidebar.tsx` | Found: `render={<Link to={tool.route as any} />}` | PASS |
| `oxfmt --check` | `bun run fmt:check` | 1 issue in `src/routeTree.gen.ts` only (auto-generated, pre-existing) | INFO |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| FOUN-03 | 02-01-PLAN.md | Tool registry as single source of truth (sidebar + overview read from it) | SATISFIED | `src/tools/registry.ts` exported and imported by both `AppSidebar.tsx` and `_layout/index.tsx`; neither file hardcodes tool names |
| FOUN-04 | 02-02-PLAN.md | Adding a new tool requires only: registry entry + route + bento card — no changes to shared layout code | SATISFIED | `_layout.tsx` and `_layout/index.tsx` have 0 occurrences of "Todos" or any tool name; overview page renders `tool.BentoCard` dynamically |
| NAV-01 | 02-01-PLAN.md | User sees a sidebar with links to overview page and each registered tool's page | SATISFIED (human verify visual) | `AppSidebar` renders Overview (hardcoded) + registry-driven tool links; layout route wraps all pages |
| NAV-02 | 02-02-PLAN.md | User can navigate between overview page and tool pages via the sidebar | HUMAN NEEDED | TanStack Router `Link` in `render={}` provides client-side nav; browser confirmation required |
| NAV-03 | 02-01-PLAN.md | Current active page is visually indicated in the sidebar | SATISFIED (human verify visual) | `useMatchRoute()` drives `isActive` prop; `sidebar.tsx` applies `data-active:bg-sidebar-primary` (violet) |

No orphaned requirements: all 5 IDs claimed in plan frontmatter (FOUN-03, FOUN-04, NAV-01, NAV-02, NAV-03) are accounted for and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `src/tools/PlaceholderBentoCard.tsx` | All | "Coming soon" text | INFO | Intentional placeholder per plan — real BentoCards replace `BentoCard` field in registry per-tool in Phase 3+. The placeholder does not block Phase 2 goal. |
| `src/components/AppSidebar.tsx` | 27, 65 | `tool.route as any` | INFO | Type cast required because `/todos` route does not exist in `routeTree.gen.ts` yet. Deferred to Phase 4 when the todos route is created. Documented in 02-01-SUMMARY.md. |
| `src/routeTree.gen.ts` | All | `oxfmt --check` format issue | INFO | Auto-generated file; not editable by humans. Format inconsistency is pre-existing from Phase 1 and noted in 02-01-SUMMARY.md. No impact on functionality. |

No blockers or warnings found. All anti-patterns are intentional, documented, and non-blocking.

### Human Verification Required

#### 1. Sidebar Renders on App Load

**Test:** Open http://localhost:3000 in a browser (`bun run dev`)
**Expected:** Sidebar renders with "Dashboard" header containing LayoutDashboard icon; two nav links visible: "Overview" (with LayoutGrid icon) and "Todos" (with CheckSquare icon); the active page (Overview at `/`) shows violet accent on its nav item
**Why human:** Visual rendering requires a browser — cannot verify DOM paint or CSS computed styles programmatically

#### 2. Client-Side Navigation Without Full Page Reload (NAV-02)

**Test:** With browser dev tools Network tab open (filter: "Doc"), click "Todos" in sidebar, then click "Overview"
**Expected:** No document request fires on navigation; only the route content area updates; browser history updates (back button works)
**Why human:** SPA navigation behaviour requires a running browser; Network tab inspection cannot be automated here

#### 3. Sidebar Collapse via SidebarRail

**Test:** Click the SidebarRail handle on the right edge of the sidebar
**Expected:** Sidebar collapses to icon-only mode (approx. 56px wide); "Dashboard" text disappears; icon remains visible; hovering over an icon shows a tooltip with the tool label
**Why human:** Interactive collapse behaviour and tooltip rendering are runtime-only

#### 4. Bento Card Hover Transition

**Test:** Hover mouse over the "Todos" placeholder bento card on the overview page
**Expected:** Card border transitions from `neutral-700` to `violet-400` with a smooth 150ms ease transition
**Why human:** CSS transition and hover state requires visual browser confirmation

### Gaps Summary

No automated gaps detected. All artifacts exist, are substantive, are wired, and data flows through them. Two human verification items (visual rendering and runtime navigation behaviour) remain — these are expected for a UI phase and do not constitute automated gaps.

The `fmt:check` failure is isolated to `src/routeTree.gen.ts` (auto-generated by TanStack Router, excluded from manual formatting per convention). All handwritten source files pass formatting.

---

_Verified: 2026-03-29T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
