# Requirements: Personal Dashboard

**Defined:** 2026-03-29
**Core Value:** A single place to see and manage all your personal tools — starting with todos, built to grow.

## v1 Requirements

### Foundation

- [ ] **FOUN-01**: Colour palette is defined as CSS custom properties in a single theme file — no hardcoded colour values exist in any component
- [ ] **FOUN-02**: All Tailwind colour utilities reference the palette tokens (no raw `gray-500`-style classes)
- [ ] **FOUN-03**: A tool registry exists as the single source of truth for all registered tools (sidebar + overview read from it)
- [ ] **FOUN-04**: Adding a new tool requires only: a registry entry, a route directory, and a bento card component — no changes to shared layout code

### Navigation

- [ ] **NAV-01**: User sees a sidebar with links to the overview page and each registered tool's page
- [ ] **NAV-02**: User can navigate between the overview page and tool pages via the sidebar
- [ ] **NAV-03**: The current active page is visually indicated in the sidebar

### Overview

- [ ] **OVER-01**: User sees a bento box grid on the overview page with one summary card per registered tool
- [ ] **OVER-02**: Each bento card is provided by its tool (not hardcoded in the overview page)

### Todo Tool

- [ ] **TODO-01**: User can create a todo item with a name, priority (high/medium/low), status (not started/started/complete), and optional due date
- [ ] **TODO-02**: User can view a list of all todo items
- [ ] **TODO-03**: User can edit a todo item's name, priority, status, and due date
- [ ] **TODO-04**: User can delete a todo item
- [ ] **TODO-05**: User can toggle a todo item's status directly from the list without opening an edit view
- [ ] **TODO-06**: User can create a todo item by typing and pressing Enter; Escape cancels entry; Tab moves between fields
- [ ] **TODO-07**: Todo data is persisted to Supabase and survives page refresh

### Todo Bento Card

- [ ] **BENT-01**: The todo bento card shows a count of todos grouped by status (not started / started / complete)
- [ ] **BENT-02**: The todo bento card visually flags overdue items (past due date and not complete) and high-priority items
- [ ] **BENT-03**: User can click the todo bento card to navigate to the full todo page

### Realtime

- [ ] **REAL-01**: Todo changes (create/edit/delete) made in one browser tab are reflected in other open tabs without a manual refresh

## v2 Requirements

### Todo Enhancements

- **TODOV2-01**: User can sort or filter the todo list by priority, status, or due date
- **TODOV2-02**: User can perform bulk actions (mark multiple todos complete, bulk delete)
- **TODOV2-03**: User can set a time-of-day alongside the due date

### Additional Tools

- **TOOLV2-01**: Habit tracker tool with daily habits and streak tracking
- **TOOLV2-02**: Notes / journal tool with freeform text entries
- **TOOLV2-03**: Bookmarks tool for saving and tagging URLs

### Mobile

- **MOBL-01**: Layout is optimised for mobile screen sizes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Authentication / login | Personal tool only — single user, no auth needed for v1 |
| Multi-user / collaboration | Requires auth, multi-tenancy, permissions — explicitly out of scope |
| Subtasks / nested todos | Schema complexity (parent_id FK, recursive queries) disproportionate to v1 value |
| Tags / labels / projects | Adds a second entity; priority + status provide enough organisation axes for v1 |
| Drag-and-drop reordering | Requires `sort_order` column, position-update logic, conflict handling — defer |
| Recurring tasks | Requires recurrence rule engine (RFC 5545/cron) — non-trivial, not needed in v1 |
| Push / browser notifications | Requires notification permissions + background scheduling infra — overkill for personal use |
| Offline support | Service workers + IndexedDB + sync-on-reconnect — significant infra, defer to v2+ |
| Natural language task entry | NLP/regex date parsing introduces unreliability; explicit date picker is more predictable |
| Mobile-optimised layout | Responsive Tailwind defaults will make it tolerable; full mobile optimisation is v2+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | — | Pending |
| FOUN-02 | — | Pending |
| FOUN-03 | — | Pending |
| FOUN-04 | — | Pending |
| NAV-01 | — | Pending |
| NAV-02 | — | Pending |
| NAV-03 | — | Pending |
| OVER-01 | — | Pending |
| OVER-02 | — | Pending |
| TODO-01 | — | Pending |
| TODO-02 | — | Pending |
| TODO-03 | — | Pending |
| TODO-04 | — | Pending |
| TODO-05 | — | Pending |
| TODO-06 | — | Pending |
| TODO-07 | — | Pending |
| BENT-01 | — | Pending |
| BENT-02 | — | Pending |
| BENT-03 | — | Pending |
| REAL-01 | — | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 20 ⚠️ (will be resolved during roadmap creation)

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 after initial definition*
