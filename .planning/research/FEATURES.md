# Feature Research

**Domain:** Personal dashboard / personal tool aggregator (todo-first)
**Researched:** 2026-03-28
**Confidence:** MEDIUM-HIGH (todo patterns well-established; bento widget registry pattern is architectural inference from established design trends)

---

## Feature Landscape

### Table Stakes (Users Expect These)

These are non-negotiable. Missing any of these makes the product feel broken or unfinished.

#### Todo Tool

| Feature                                         | Why Expected                                                        | Complexity | Notes                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------ |
| Create todo item                                | Core CRUD — you can't have a todo app without creating todos        | LOW        | Single text field minimum; name is the only required field         |
| View todo list                                  | See all your items at a glance                                      | LOW        | Flat list is sufficient for v1; no tree/nesting required           |
| Edit todo item                                  | Fix typos, update names, change fields                              | LOW        | Inline edit preferred over modal for speed                         |
| Delete todo item                                | Remove completed or irrelevant items                                | LOW        | Soft delete not needed for personal use; hard delete is fine       |
| Mark as complete / toggle status                | Core feedback loop — the "satisfaction click"                       | LOW        | The status field covers this; a quick-toggle is the UX expectation |
| Priority field (high/medium/low)                | Users expect to be able to signal urgency                           | LOW        | Three levels is standard; no need for numeric scoring              |
| Due date field                                  | Deadline tracking is a baseline expectation in any todo tool        | LOW        | Date picker; no time-of-day needed for v1                          |
| Persist data across page refreshes              | Data must survive a browser reload                                  | LOW-MEDIUM | Supabase Postgres handles this; the risk is the sync wiring        |
| Status field (not started/in progress/complete) | Users want to distinguish "haven't touched it" from "working on it" | LOW        | Three-state enum maps cleanly to the DB                            |

#### Dashboard / Overview

| Feature                                        | Why Expected                                                        | Complexity | Notes                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| Overview / home page that summarises all tools | The whole premise of a dashboard is "see everything at once"        | MEDIUM     | Bento card per tool; cards must be composable from per-tool components |
| Sidebar navigation                             | Standard navigation pattern for multi-section apps; users expect it | LOW        | Links: overview + each tool page                                       |
| Tool-specific full page                        | Each tool needs dedicated space for full interaction                | LOW        | Simple route per tool                                                  |

#### Bento Card (Todo Summary Widget)

| Feature                                  | Why Expected                                            | Complexity | Notes                                                    |
| ---------------------------------------- | ------------------------------------------------------- | ---------- | -------------------------------------------------------- |
| Shows count of todos by status           | Quick health-check at a glance                          | LOW        | Counts from DB; rendered in card                         |
| Highlights overdue / high-priority items | Users expect a dashboard to flag what needs attention   | LOW-MEDIUM | Requires due date comparison against today; filter query |
| Link/navigate to full todo page          | Cards are always clickable — users expect to drill down | LOW        | Route link on the card                                   |

---

### Differentiators (Competitive Advantage)

Features that make this product noticeably better than a blank Notion page or a generic todo app. Focus on the ones that align with the core value: "a single place, built to grow."

| Feature                                              | Value Proposition                                                                                               | Complexity | Notes                                                                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Modular tool registry (self-registering bento cards) | New tools can be dropped in without touching the overview page — this is what makes the dashboard pattern scale | MEDIUM     | Each tool exports a `BentoCard` component; overview page iterates a registry. This is the key architectural differentiator.                   |
| Real-time Supabase sync                              | Changes persist instantly without manual save; tab refresh is never needed                                      | MEDIUM     | Supabase Realtime + optimistic UI via TanStack Query. The pattern: query on load, subscribe to changes, apply optimistic updates immediately. |
| Predefined colour palette as single source of truth  | Visual consistency across all tools without per-component colour decisions                                      | LOW        | Tailwind CSS config palette; zero hardcoded colour values in components. Small effort, high payoff for future tools.                          |
| Status as a three-state enum (not just done/undone)  | "In progress" captures the real state of work — most todo apps are binary                                       | LOW        | Mapping: `not_started` / `started` / `complete`. Binary is simpler but less honest.                                                           |
| Keyboard-friendly task entry                         | Reduces friction to near zero — fastest path from thought to task                                               | MEDIUM     | Enter to save, Escape to cancel, Tab to move between fields                                                                                   |

---

### Anti-Features (Commonly Requested, Often Problematic)

Explicitly do NOT build these in v1. They feel like obvious improvements but each introduces complexity disproportionate to value at this scale.

| Feature                                           | Why Requested                           | Why Problematic                                                                                                                                                                                                   | Alternative                                                                                                                     |
| ------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Push / browser notifications and reminders        | "I want to be reminded about deadlines" | Requires notification permissions, background workers or server-side scheduling, and becomes annoying fast for personal tools. Adds infra complexity with no clear gain for a single-user app checked habitually. | Due date is visible in the UI and on the bento card. Overdue items can be visually flagged (red text) — no notification needed. |
| Subtasks / nested tasks                           | "Some tasks have steps"                 | Nested data is a schema change (parent_id FK, recursive queries), complicates the list view, and solves a problem most personal todos don't actually have                                                         | Keep tasks atomic. If a task needs breakdown, create multiple tasks.                                                            |
| Tags / labels / projects                          | "I want to organise by project"         | Adds a second entity (tags table or projects table), filtering UI, and schema complexity. Priority + status already provide meaningful axes of organisation.                                                      | Status and priority are enough axes for a personal todo. Add when the single list grows unwieldy.                               |
| Drag-and-drop reordering                          | "I want to sort my list manually"       | Requires a `sort_order` column, position-update logic on every drag, conflict handling on concurrent edits, and a drag library. Almost never used consistently.                                                   | Sort by priority then due date — deterministic and automatic.                                                                   |
| Recurring tasks                                   | "Some things repeat every week"         | Requires a recurrence rule engine (RFC 5545 / cron logic), automatic task generation, and edge-case handling (what if I miss a week?). Non-trivial to get right.                                                  | Create the task fresh each time in v1.                                                                                          |
| Collaboration / sharing                           | "I want to share my todos with someone" | Requires auth, multi-tenancy, permission model, and a completely different data model. PROJECT.md explicitly rules this out.                                                                                      | Personal only; auth is out of scope for v1.                                                                                     |
| Bulk actions (multi-select, bulk delete)          | "I want to complete 5 tasks at once"    | Adds selection state, shift-click logic, and confirmation flows. Nice to have, zero cost to defer.                                                                                                                | Complete tasks individually. Add bulk actions in v1.x if it feels slow.                                                         |
| Offline-first / local persistence                 | "I want it to work without internet"    | Service workers, conflict resolution between IndexedDB and Supabase, and sync-on-reconnect logic. Significant infra for a personal tool used from a fixed device.                                                 | Supabase realtime is fast. Optimistic updates give perceived immediacy. Offline is a v2+ concern.                               |
| Natural language task parsing ("buy milk Monday") | "Quick entry by typing naturally"       | NLP or regex date parsing (chrono-node etc.) is a separate surface area, creates false positives, and can feel unreliable.                                                                                        | Explicit date picker is predictable and reliable.                                                                               |
| Mobile-specific layout                            | "Should work on my phone"               | PROJECT.md explicitly defers this. Tailwind responsive utilities will make it tolerable on mobile by default, but optimising for it is a separate milestone.                                                      | Use responsive Tailwind defaults; don't optimise for mobile in v1.                                                              |

---

## Feature Dependencies

```
[Supabase schema: todos table]
    └──required by──> [Create todo]
    └──required by──> [View todo list]
    └──required by──> [Edit todo]
    └──required by──> [Delete todo]
    └──required by──> [Toggle status / complete]
    └──required by──> [Bento card: todo summary counts]

[Todo CRUD (all fields: name, priority, status, due date)]
    └──required by──> [Bento card: overdue / high-priority highlight]
    └──required by──> [Status toggle]

[Supabase Realtime subscription]
    └──enhances──> [Create / Edit / Delete] (live updates across tabs)
    └──depends on──> [Supabase schema: todos table]

[Tool registry / BentoCard component per tool]
    └──required by──> [Overview / bento page]
    └──feeds into──> [Modular expansion to future tools]

[Colour palette in Tailwind config]
    └──used by──> [All UI components]
    └──blocks──> [Hardcoded colour values in components]

[Sidebar navigation]
    └──required by──> [Switching between overview and tool pages]
```

### Dependency Notes

- **Supabase schema must come first:** All todo CRUD and the bento card depend on the table existing. Schema migration is the foundation of the feature phase.
- **Todo CRUD before bento card:** The bento summary widget reads todo data — it can only be built after the todo data model and basic CRUD are in place.
- **Realtime enhances but does not block CRUD:** The app is functional without Realtime subscriptions. Add subscriptions as a layer on top of working CRUD.
- **Tool registry is an architecture concern, not a feature:** It must be established before the first tool is built so that tools self-register correctly from day one. Retrofitting is harder.
- **Colour palette must be established before any component work:** Once components are written with hardcoded colours, migrating them to the palette is a refactor burden.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — the smallest thing that demonstrates the dashboard premise.

- [ ] Supabase `todos` table with columns: `id`, `name`, `priority` (enum), `status` (enum), `due_date`, `created_at`, `updated_at`
- [ ] Todo CRUD: create, view (list), edit (inline), delete
- [ ] Status toggle (not started / started / complete) as a quick action
- [ ] Priority field visible and editable on each item
- [ ] Due date field visible and editable on each item
- [ ] Supabase realtime sync (changes persist and update live)
- [ ] Bento overview page with a todo summary card (counts by status, highlights overdue)
- [ ] Sidebar navigation (overview + todo page)
- [ ] Colour palette defined in Tailwind config (used by all components, no hardcoded values)
- [ ] Tool registry pattern in place so the bento page composes from registered tool cards

### Add After Validation (v1.x)

Features to add once core is working and daily use reveals friction points.

- [ ] Keyboard shortcuts for task entry (Enter to save, Escape to cancel) — add when input friction is felt
- [ ] Sort / filter within the todo list (by priority, due date, status) — add when the list grows past ~20 items
- [ ] Bulk complete / bulk delete — add if completing multiple tasks per session is common
- [ ] Visual overdue indicator (red text/badge on the todo page, not just the bento card) — add when the due date field is being actively used

### Future Consideration (v2+)

Features to defer until the tool suite has grown and usage patterns are clearer.

- [ ] Second tool (habit tracker, notes, etc.) — defer until todo tool is fully validated
- [ ] Mobile-optimised layout — defer until there's a reason to use it on mobile
- [ ] Offline support — defer; complexity is high and personal tools are used from fixed devices
- [ ] Notifications / reminders — defer; visual flagging covers the use case for now

---

## Feature Prioritization Matrix

| Feature                                      | User Value       | Implementation Cost | Priority |
| -------------------------------------------- | ---------------- | ------------------- | -------- |
| Todo CRUD (name, status, priority, due date) | HIGH             | LOW                 | P1       |
| Supabase schema + sync                       | HIGH             | MEDIUM              | P1       |
| Bento overview card (todo summary)           | HIGH             | LOW-MEDIUM          | P1       |
| Sidebar navigation                           | HIGH             | LOW                 | P1       |
| Tool registry / modular architecture         | HIGH (long-term) | MEDIUM              | P1       |
| Colour palette in Tailwind config            | MEDIUM           | LOW                 | P1       |
| Status toggle as quick action                | MEDIUM           | LOW                 | P1       |
| Realtime subscription (live updates)         | MEDIUM           | MEDIUM              | P1       |
| Keyboard shortcuts for task entry            | MEDIUM           | MEDIUM              | P2       |
| Sort / filter todo list                      | MEDIUM           | MEDIUM              | P2       |
| Overdue visual indicator (per-item)          | LOW-MEDIUM       | LOW                 | P2       |
| Bulk actions                                 | LOW              | MEDIUM              | P3       |
| Recurring tasks                              | LOW              | HIGH                | P3       |
| Drag-and-drop reordering                     | LOW              | HIGH                | P3       |
| Notifications / reminders                    | LOW              | HIGH                | P3       |

**Priority key:**

- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

Reference apps surveyed: Todoist, Linear (task tracking), Notion (personal dashboard), ClickUp, Things 3.

| Feature              | Todoist / Things 3                                                   | Notion / ClickUp                         | Our Approach                                                             |
| -------------------- | -------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| Task creation        | Fast, inline, natural language                                       | Modal or block-based, heavier            | Inline form, explicit fields — fast but not NLP                          |
| Priority             | 4-level (P1–P4)                                                      | Custom fields, unlimited                 | 3-level enum (high/medium/low) — simpler, sufficient for personal use    |
| Status               | Done / not done (binary)                                             | Fully custom workflow                    | 3-state enum — more honest than binary, simpler than fully custom        |
| Due dates            | Full date + time + recurrence                                        | Full date + time + recurrence            | Date only, no time, no recurrence in v1                                  |
| Overview / dashboard | Dashboard view (ClickUp), Today view (Things), Weekly view (Todoist) | Linked databases in dashboard pages      | Bento card per tool on a dedicated overview page — cleaner separation    |
| Realtime sync        | Cloud sync (polling or push)                                         | Collaborative realtime                   | Supabase Realtime + optimistic updates                                   |
| Modularity           | Monolithic                                                           | Monolithic (everything in one workspace) | Tool registry pattern — each tool is self-contained and self-registering |

Key takeaway: mainstream todo apps are either too simple (binary done/undone) or too complex (NLP, recurrence, collaboration). The three-state status enum and bento overview are meaningful differentiators that sit between these extremes without adding implementation burden.

---

## Sources

- [12 Top Features for the Perfect Todo App — Time Management Ninja](https://timemanagementninja.com/2017/04/12-top-features-for-the-perfect-todo-app/)
- [7 Best To-Do List Apps of 2026 — Zapier](https://zapier.com/blog/best-todo-list-apps/)
- [Bento Grid Dashboard Design: Balancing Aesthetics and Functionality in 2025 — Orbix Studio](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics)
- [The Bento Box Effect: Why Modular Grids Dominate 2025 Design — Onecodesoft](https://www.onecodesoft.com/blogs/the-bento-box-effect-why-modular-grids-dominate-2025-design)
- [How to Build a Personal Life Dashboard for Productivity — ClickUp](https://clickup.com/blog/how-to-build-a-personal-life-dashboard/)
- [Building Scalable Real-Time Systems: Supabase Realtime and Optimistic UI Patterns — Medium](https://medium.com/@ansh91627/building-scalable-real-time-systems-a-deep-dive-into-supabase-realtime-architecture-and-eccb01852f2b)
- [Realtime — Supabase Docs](https://supabase.com/docs/guides/realtime)
- [How to Use Supabase with TanStack Query — Makerkit](https://makerkit.dev/blog/saas/supabase-react-query)

---

_Feature research for: Personal dashboard — todo tool (v1), bento overview pattern_
_Researched: 2026-03-28_
