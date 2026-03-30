# Roadmap: Personal Dashboard

## Overview

Starting from a blank project, build a personal dashboard with a modular tool architecture. The journey: establish a solid foundation (colour tokens, tooling), wire the route shell and tool registry, build the Supabase data layer, implement full todo CRUD, compose the bento overview, and finally layer on realtime sync. Each phase is a prerequisite for the next; each delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Project scaffolding, colour token system, and tooling configured — no hardcoded values anywhere (completed 2026-03-29)
- [ ] **Phase 2: Route Shell & Tool Registry** - Navigable app skeleton with sidebar, pathless layout, and an empty tool registry
- [ ] **Phase 3: Supabase Data Layer** - Todos table, typed server functions, and Zod-validated RPC wrappers — no UI yet
- [ ] **Phase 4: Todo Tool** - Full CRUD on the dedicated todo page with keyboard shortcuts and status toggle
- [ ] **Phase 5: Bento Overview & Registration** - Todo registered in the registry; bento grid overview showing the todo summary card
- [ ] **Phase 6: Realtime** - Live cross-tab sync without page refresh, subscription cleanup verified

## Phase Details

### Phase 1: Foundation

**Goal**: The project scaffolds, colour tokens, and tooling are in place so every subsequent phase builds on a consistent, pitfall-free base
**Depends on**: Nothing (first phase)
**Requirements**: FOUN-01, FOUN-02
**Success Criteria** (what must be TRUE):

1. The app starts and renders without errors after scaffold
2. All colour values exist exclusively in `src/styles/theme.css` as CSS custom properties — no raw Tailwind palette classes (e.g., `gray-500`) appear anywhere in component files
3. Tailwind utilities reference only the palette tokens defined in theme.css
4. OXC linter and formatter run cleanly against the scaffolded project with zero violations
   **Plans**: 2 plans
   Plans:

- [x] 01-01-PLAN.md — Scaffold TanStack Start, init shadcn/ui (base-nova), install OXC tooling
- [x] 01-02-PLAN.md — Create colour token system (theme.css), wire into app.css, verify all gates
      **UI hint**: yes

### Phase 2: Route Shell & Tool Registry

**Goal**: Users can open the app, see a sidebar, and navigate between an overview page and a (currently empty) placeholder — the tool registry drives both sidebar and overview with zero hardcoded tool references
**Depends on**: Phase 1
**Requirements**: FOUN-03, FOUN-04, NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):

1. User sees a sidebar with links; the active page link is visually distinguished from inactive links
2. User can click sidebar links to navigate between the overview page and any registered tool page without a full page reload
3. Adding a new entry to the tool registry (a name, route, and placeholder components) causes it to appear in both the sidebar and the bento overview grid automatically — no changes to shared layout files required
   **Plans**: 2 plans
   Plans:

- [x] 02-01-PLAN.md — Install shadcn sidebar, create tool registry and PlaceholderBentoCard, build AppSidebar component
- [x] 02-02-PLAN.md — Create pathless layout route, wire overview page with bento grid, visual verification checkpoint
      **UI hint**: yes

### Phase 3: Supabase Data Layer

**Goal**: The todos table exists in Supabase, server functions expose typed CRUD operations, and generated TypeScript types match the schema — all data code is server-only and never leaks into the client bundle
**Depends on**: Phase 2
**Requirements**: TODO-07
**Success Criteria** (what must be TRUE):

1. A `todos` row can be created, read, updated, and deleted via `createServerFn` wrappers — confirmed by manual testing against the live Supabase project
2. Todo data persists across page refreshes (a created todo reappears after reload)
3. No Supabase query helpers appear in the Vite client bundle (confirmed via `vite build` bundle inspection)
   **Plans**: 2 plans
   Plans:

- [x] 03-01-PLAN.md — Install Supabase/Zod packages, create typed client singleton, user configures env vars and database schema, generate TypeScript types
- [x] 03-02-PLAN.md — Create CRUD server functions with Zod validation, verify bundle isolation

### Phase 4: Todo Tool

**Goal**: Users can fully manage their todos on the dedicated todo page — create, view, edit, delete, toggle status — with keyboard-first entry and priority/due date fields
**Depends on**: Phase 3
**Requirements**: TODO-01, TODO-02, TODO-03, TODO-04, TODO-05, TODO-06
**Success Criteria** (what must be TRUE):

1. User can create a todo by typing a name and pressing Enter; pressing Escape cancels entry; Tab moves between the name, priority, status, and due date fields
2. User sees all existing todos in a list with their name, priority, status, and due date displayed
3. User can edit any field of a todo item inline and save the change
4. User can delete a todo item and it disappears from the list
5. User can toggle a todo's status (not started / started / complete) directly from the list without opening an edit form
   **Plans**: 3 plans
   Plans:

- [x] 04-01-PLAN.md — Install popover, add amber-400 theme token, create todo route with state management and loading/empty/error UI
- [ ] 04-02-PLAN.md — Implement full TodoRow with inline editing, status cycling, priority popover, delete
- [ ] 04-03-PLAN.md — Implement full AddTodoRow with collapsed/expanded states and keyboard shortcuts
      **UI hint**: yes

### Phase 5: Bento Overview & Registration

**Goal**: The todo tool is registered in the tool registry; the overview page shows a bento grid with the todo summary card, which reflects live counts and flags attention items
**Depends on**: Phase 4
**Requirements**: OVER-01, OVER-02, BENT-01, BENT-02, BENT-03
**Success Criteria** (what must be TRUE):

1. User sees the overview page with a bento grid containing one card for the todo tool
2. The todo bento card shows todo counts broken down by status (not started / started / complete)
3. The bento card visually distinguishes overdue items (past due date, not complete) and high-priority items
4. User can click the todo bento card to navigate directly to the full todo page
5. The bento card component is defined inside the todo tool's own directory — the overview page contains no hardcoded todo references
   **Plans**: TBD
   **UI hint**: yes

### Phase 6: Realtime

**Goal**: Todo changes made in one browser tab appear in all other open tabs automatically — no manual refresh required — and subscriptions are cleaned up correctly on navigation
**Depends on**: Phase 5
**Requirements**: REAL-01
**Success Criteria** (what must be TRUE):

1. Creating, editing, or deleting a todo in one browser tab is reflected in a second open tab within a few seconds without any manual refresh
2. Navigating away from the todo page and back does not accumulate duplicate Supabase subscriptions (verified via Supabase dashboard connection count)
   **Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase                            | Plans Complete | Status      | Completed  |
| -------------------------------- | -------------- | ----------- | ---------- |
| 1. Foundation                    | 2/2            | Complete    | 2026-03-29 |
| 2. Route Shell & Tool Registry   | 1/2 | In Progress|  |
| 3. Supabase Data Layer           | 1/2 | In Progress|  |
| 4. Todo Tool                     | 1/3 | In Progress|  |
| 5. Bento Overview & Registration | 0/?            | Not started | -          |
| 6. Realtime                      | 0/?            | Not started | -          |
