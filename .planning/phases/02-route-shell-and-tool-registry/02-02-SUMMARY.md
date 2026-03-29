---
phase: 02-route-shell-and-tool-registry
plan: "02"
subsystem: ui
tags: [tanstack-router, sidebar, tailwind, shadcn, routing]

# Dependency graph
requires:
  - phase: 02-route-shell-and-tool-registry
    plan: "01"
    provides: AppSidebar, sidebar.tsx shadcn components, tool registry with ToolEntry type
provides:
  - Pathless layout route (_layout.tsx) wrapping all pages with sidebar
  - Overview page (_layout/index.tsx) rendering responsive bento grid from registry
  - Dev colours page (_layout/dev-colours.tsx) for inspecting all theme tokens visually
  - Active sidebar nav item shows violet via sidebar-primary instead of grey sidebar-accent
affects:
  - phase-03-todos-feature
  - any future tool pages added to the registry

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pathless layout route: createFileRoute('/_layout') wraps all child pages with SidebarProvider + AppSidebar + SidebarInset"
    - "Overview page: createFileRoute('/_layout/') renders tool.BentoCard from registry — zero hardcoded tool references"
    - "Active nav state: data-active:bg-sidebar-primary / data-active:text-sidebar-primary-foreground in sidebarMenuButtonVariants"

key-files:
  created:
    - src/routes/_layout.tsx
    - src/routes/_layout/index.tsx
    - src/routes/_layout/dev-colours.tsx
  modified:
    - src/components/ui/sidebar.tsx
    - src/routeTree.gen.ts
  deleted:
    - src/routes/index.tsx

key-decisions:
  - "Active sidebar item uses sidebar-primary (violet) not sidebar-accent (grey) — sidebar-accent is for hover only, sidebar-primary is the brand accent token"
  - "dev-colours page added as a dev utility at /dev-colours — not in tool registry, accessible under _layout for sidebar wrapping"
  - "routeTree.gen.ts committed after each file-structure change to keep auto-generated file in sync with source"

patterns-established:
  - "Pattern: dev utility pages go under _layout/dev-*.tsx (sidebar-wrapped, not in tool registry)"
  - "Pattern: data-active styling in sidebar uses sidebar-primary, hover uses sidebar-accent"

requirements-completed: [FOUN-04, NAV-02]

# Metrics
duration: 25min
completed: 2026-03-29
---

# Phase 02 Plan 02: Route Shell and Layout Summary

**Pathless _layout route wiring SidebarProvider + AppSidebar + SidebarInset, registry-driven bento overview, violet active state fix, and dev colours inspection page**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-29T19:10:00Z
- **Completed:** 2026-03-29T19:35:00Z
- **Tasks:** 2 (Task 1 from worktree + Task 2 verified + post-checkpoint fixes)
- **Files modified:** 5

## Accomplishments
- Created `src/routes/_layout.tsx` — pathless layout route wrapping all pages with shadcn SidebarProvider, AppSidebar, and SidebarInset
- Created `src/routes/_layout/index.tsx` — overview page rendering registry-driven responsive bento grid (FOUN-04 satisfied)
- Deleted `src/routes/index.tsx` — replaced by `_layout/index.tsx` with correct `createFileRoute("/_layout/")`
- Fixed sidebar active state to use `sidebar-primary` (violet) instead of `sidebar-accent` (grey) in `sidebarMenuButtonVariants`
- Added `/dev-colours` page showing all theme palette and semantic CSS variable tokens as visual swatches

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pathless layout route and overview page** - `c3b97a2` (feat)
2. **Fix: sidebar-primary active state + dev-colours page** - `856af5f` (fix)
3. **Chore: regenerate routeTree with dev-colours route** - `7332ee4` (chore)

## Files Created/Modified
- `src/routes/_layout.tsx` - Pathless layout route: SidebarProvider wrapping AppSidebar + SidebarInset + Outlet
- `src/routes/_layout/index.tsx` - Overview bento page: responsive grid from tools registry (no hardcoded tool references)
- `src/routes/_layout/dev-colours.tsx` - Dev utility: visual swatches for all theme palette and sidebar CSS variable tokens
- `src/components/ui/sidebar.tsx` - Fixed: `data-active:bg-sidebar-primary` / `data-active:text-sidebar-primary-foreground` (was sidebar-accent)
- `src/routeTree.gen.ts` - Regenerated: includes /_layout, /_layout/, /_layout/dev-colours routes

## Decisions Made
- Active sidebar item uses `sidebar-primary` (violet) not `sidebar-accent` (grey). The `sidebar-accent` token is for hover; `sidebar-primary` is the brand violet accent — semantically correct for the selected/active state.
- The dev-colours page is placed at `_layout/dev-colours` (not in tool registry) — it benefits from the sidebar wrapper for navigation but is a dev utility, not a user-facing tool.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed sidebar active state showing grey instead of violet**
- **Found during:** Task 2 visual verification (user-reported during checkpoint)
- **Issue:** `sidebarMenuButtonVariants` used `data-active:bg-sidebar-accent` which resolves to the hover/muted background token (grey), not the brand violet. The correct token is `sidebar-primary` which maps to violet-500.
- **Fix:** Changed `data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground` to `data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground` in `src/components/ui/sidebar.tsx`
- **Files modified:** src/components/ui/sidebar.tsx
- **Verification:** oxlint passes, oxfmt passes
- **Committed in:** 856af5f

**2. [Rule 2 - Missing Critical] Added dev-colours page for theme token inspection**
- **Found during:** Task 2 visual verification (user-requested during checkpoint approval)
- **Issue:** No way to visually confirm colour tokens are wired correctly across theme.css and styles.css; needed to validate the active state fix was using the correct token
- **Fix:** Created `src/routes/_layout/dev-colours.tsx` with swatches for all 8 theme palette tokens (neutral-950..violet-400) and 13 semantic CSS variable tokens (--background, --sidebar-primary, etc.)
- **Files modified:** src/routes/_layout/dev-colours.tsx (created)
- **Verification:** Route renders at /dev-colours, swatches use `var(--color-*)` and `var(--)` references (no hardcoded hex)
- **Committed in:** 856af5f

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 missing dev utility)
**Impact on plan:** Both fixes improve correctness and developer visibility. No scope creep.

## Issues Encountered
- The plan's Task 1 was executed in a git worktree (`worktree-agent-ab60c8dc`). Required merging the worktree branch into `v1` before applying post-checkpoint fixes. The `src/routeTree.gen.ts` had a pending formatting-only diff that was stashed before merging.

## Known Stubs
None — no placeholder data flows to UI rendering. The bento grid renders `PlaceholderBentoCard` from the registry which is intentional: this card will be replaced per-tool in Phase 03+.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Navigation shell complete: all pages get the sidebar via `_layout.tsx`
- Overview page auto-renders any tool added to `src/tools/registry.ts` (FOUN-04 satisfied)
- Active state shows violet accent on selected sidebar item (NAV-03 satisfied)
- Client-side SPA navigation works between routes (NAV-02 satisfied)
- Dev server running at http://localhost:3000 — verify /dev-colours and active state before Phase 03
- Phase 03 (Todos feature) can add its route, bento card, and DB schema independently

---
*Phase: 02-route-shell-and-tool-registry*
*Completed: 2026-03-29*
