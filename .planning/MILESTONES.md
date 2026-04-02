# Milestones

## v1 Personal Dashboard MVP (Shipped: 2026-04-02)

**Phases completed:** 6 phases, 18 plans, 26 tasks

**Key accomplishments:**

- TanStack Start v1.167.13 scaffolded with shadcn/ui base-nova preset, dark-only OKLCH token system in Tailwind v4 @theme, and OXC (oxlint@1.57.0 + oxfmt@0.42.0) zero-config tooling — both linting and formatting pass with zero violations.
- Wave 1 created the complete token system in src/theme.css and src/styles.css; Wave 2 verified all 7 Phase 1 gates pass, ran oxfmt normalization across all source files, and confirmed FOUN-01/FOUN-02 compliance.
- shadcn sidebar primitives installed, tool registry at src/tools/registry.ts establishes ToolEntry as the single source of truth (FOUN-03), and AppSidebar reads from registry with useMatchRoute active state detection (NAV-01, NAV-03).
- Pathless _layout route wiring SidebarProvider + AppSidebar + SidebarInset, registry-driven bento overview, violet active state fix, and dev colours inspection page
- One-liner:
- Five typed CRUD server functions for todos with Zod validation — written TDD (RED then GREEN), bundle isolation verified: zero Supabase code in client chunks.
- vitest env stubs + viteReact() plugin restore all 30 tests; tsconfig baseUrl removal fixes TS5101; component file renames and routeFileIgnorePattern eliminate all build warnings
- Todos route at /_layout/todos/ with optimistic mutation handlers, 5-skeleton loading state, Alert-based error/empty UI, and typed TodoRow/AddTodoRow stubs for Wave 2
- `src/routes/_layout/todos/TodoRow.tsx`
- One-liner:
- One-line null coalescing fix to getTodos: `return data ?? []` prevents todos.map() crash when Supabase returns null for an empty table
- Five targeted styling fixes to AddTodoRow: outer bg-accent/50 container, shadcn Input for date, w-24 column wrapper, invisible low-priority badge fixed, keyboard hint added — all verified by TDD render tests
- Collapsed-row type-to-expand and priority-to-date Tab key now work via collapsedRowRef/dateTriggerRef with closed useEffect-driven focus cycle
- Replaced 2 stale input[type="date"] tests with Calendar popover Button assertions, restoring bun run test to 30/30 pass
- One-liner:
- One-liner:
- Supabase postgres_changes subscription with refetch-on-event strategy, stable useRef callback, and pulsing LiveIndicator for channel status

---
