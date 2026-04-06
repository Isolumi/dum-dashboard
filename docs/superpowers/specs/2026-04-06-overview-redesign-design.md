# Overview Page Redesign

**Date:** 2026-04-06
**Status:** Approved

## Goal

Replace the current aggregate-stats `TodoBentoCard` with a full scrollable todo list in the overview, restructure the bento grid to accommodate widgets of different sizes, and introduce a live digital clock as the first non-todo tool.

## Grid Structure

The overview grid changes from a uniform 3-column layout to a `2fr 1fr` two-column layout:

- **Left (2fr):** The todos card — always occupies this position.
- **Right (1fr):** All other tools stacked vertically (clock first, future tools below).

Responsive behaviour: at the `md` breakpoint and below, the grid collapses to a single column in order — todos → clock → other tools.

The `OverviewLoading` skeleton mirrors this layout: one wide placeholder on the left, one narrow placeholder on the right.

## TodoBentoCard

The existing `TodoBentoCard` (which shows aggregate counts + attention badges) is replaced entirely.

### Header
Identical to today: CheckSquare icon · "Todos" label · ArrowRight indicator. The entire card is a `<Link to="/todos">` — read-only, no mutations from the overview.

### Body
- Scrollable container with `overflow-y: auto` and `max-h-96` (384px).
- Grouped into **High / Medium / Low** sections, each with a small uppercase section label.
- Empty sections (no todos in that priority) are hidden entirely — no empty label rendered.

### Row format (per todo)
```
[status icon]  [todo name — truncated]       [due date or —]
```

- **Status icon:** hollow circle = `not_started`; circle with filled dot = `started`; circle with checkmark = `complete`.
- **Name:** `flex: 1`, truncated with `text-overflow: ellipsis` if long.
- **Due date:** formatted as `Mon DD` (e.g. `Apr 10`). If `null`, renders `—` in muted colour. If overdue and not complete, renders in `text-destructive`.
- **Completed rows:** dimmed (`opacity-40`) and name struck through.

### Data source
Reuses the existing `loadData: getTodos` already in the registry. No new server function.

## ClockBentoCard

A new, self-contained component with no server dependency.

### Display
- Large, light-weight monospace `HH:MM` in 24-hour format, horizontally and vertically centred in the card.
- Small `24h` label below the digits.

### Updates
A `useEffect` sets a `setInterval` (1-second tick) that reads `new Date()` and reformats on each tick. The interval is cleared on unmount.

### No dedicated page
The clock has no `/clock` route and no sidebar entry. It is overview-only.

## Registry Changes

### `ToolEntry` type extension
Add an optional `overviewOnly?: boolean` field. When `true`:
- The sidebar skips the entry (no nav item rendered).
- The overview still renders its `BentoCard`.

### New clock entry
```ts
{
  id: "clock",
  label: "Clock",
  route: "/",        // placeholder — overviewOnly tools have no dedicated page; route is unused by sidebar and overview rendering
  icon: Clock,       // lucide Clock icon
  BentoCard: ClockBentoCard,
  overviewOnly: true,
  // no loadData
}
```

### Grid rendering in overview
The overview page renders the first tool (todos) into the left `2fr` column. All subsequent tools render into the right `1fr` column, stacked vertically.

## Sidebar Change

The `AppSidebar` filters out tools where `overviewOnly === true` before rendering nav items. No other sidebar changes.

## Out of Scope

- Mutations from the overview (toggling status, creating todos).
- A dedicated clock page.
- Drag-to-reorder or any interactivity in the overview todo list.
- Changes to the todos page (`/todos`).
- Changes to Supabase schema or server functions.
