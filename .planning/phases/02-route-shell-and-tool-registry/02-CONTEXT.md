# Phase 2: Route Shell & Tool Registry - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the navigable app skeleton: a persistent collapsible sidebar, a TanStack Router pathless layout route wrapping all pages, and a central tool registry that drives both sidebar links and the overview bento grid. No business logic; no real tool data. The registry contract is established here — downstream tool phases slot in by adding a registry entry and a route, nothing else.

</domain>

<decisions>
## Implementation Decisions

### Sidebar component
- Use **shadcn's Sidebar component** — do not build a custom sidebar from scratch
- Collapsible — expands to icon+label, collapses to icon-only
- When collapsed, **tooltips appear on hover** to show the item label (shadcn's `SidebarMenuButton` handles this automatically)
- **Header area**: icon (Lucide icon, e.g. `LayoutDashboard`) + app name "Dashboard" at the top of the sidebar

### Active nav indicator
- Use shadcn's built-in `isActive` prop on `SidebarMenuButton`
- Override accent colour to **violet** (from D-02 / `violet-500` family) — subtle background fill + text/icon in violet
- Do not add a custom left border or extra chrome; keep it to shadcn's default isActive shape with the colour override

### Tool registry
- File lives at **`src/tools/registry.ts`**
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

### Layout structure
- A TanStack Router **pathless layout route** (e.g. `_layout.tsx`) wraps all tool and overview pages with the sidebar
- The root route (`__root.tsx`) stays as a bare HTML wrapper — it does not get the sidebar
- The sidebar renders inside the pathless layout; all routed pages are rendered via `<Outlet />` beside it

### Overview page placeholder
- `/` renders a **responsive grid of BentoCards** sourced from the registry
- Phase 2 uses the shared `PlaceholderBentoCard` for every entry (shows tool name + placeholder label)
- Grid structure is established here; real cards slot in during later phases with no structural changes

### Claude's Discretion
- Exact sidebar width (expanded and collapsed)
- `PlaceholderBentoCard` visual design — whatever communicates "placeholder" clearly
- Grid column count / breakpoints on the overview page
- TypeScript type name for the registry entry shape

</decisions>

<specifics>
## Specific Ideas

- shadcn Sidebar chosen explicitly to avoid reimplementing collapse/tooltip/icon behaviour — use the component as-is and extend only the colour theming
- Active state should feel cohesive with the violet/indigo accent system already in place from Phase 1

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 decisions (inherited constraints)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-01 (dark mode only), D-02 (violet/indigo accent), D-04 (scale-based token names), D-05 (Tailwind `@theme` approach)

### Requirements
- `.planning/REQUIREMENTS.md` — FOUN-03 (tool registry drives sidebar), FOUN-04 (adding a tool requires only registry entry + route + bento card), NAV-01 (sidebar persistent), NAV-02 (client-side navigation, no full reload), NAV-03 (active link visually distinguished)

### Stack reference
- `CLAUDE.md` — locked tech stack (TanStack Start, shadcn, Tailwind v4, Lucide), shadcn install pattern (`bunx --bun shadcn@latest add`), file-based routing conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/routes/__root.tsx` — bare HTML shell, `<HeadContent />` + `<Outlet />` + `<Scripts />`. The pathless layout route inserts between this and the page routes
- `src/lib/utils.ts` — `cn()` utility (class merging), available for any component

### Established Patterns
- TanStack Router `createFileRoute` used in every route file — follow this pattern for the pathless layout route (`_layout.tsx`) and any new routes
- `src/styles.css` holds the Tailwind `@theme` colour token system from Phase 1 — sidebar colours must use these tokens, no hardcoded values

### Integration Points
- Sidebar component renders in `_layout.tsx`, receives registry data imported from `src/tools/registry.ts`
- Overview page (`src/routes/index.tsx`) imports registry and renders one `BentoCard` per entry
- New tool routes added under `src/routes/<tool-name>/index.tsx` — no changes to sidebar or overview needed

</code_context>

<deferred>
## Deferred Ideas

- Real tool bento cards — Phase 3+ (each tool phase provides its own `BentoCard`)
- Mobile/responsive sidebar behaviour (hamburger menu, drawer) — not in scope for Phase 2; this is a personal desktop dashboard
- Sidebar footer area (settings link, user profile) — deferred to a later phase if needed

</deferred>

---

*Phase: 02-route-shell-and-tool-registry*
*Context gathered: 2026-03-29*
