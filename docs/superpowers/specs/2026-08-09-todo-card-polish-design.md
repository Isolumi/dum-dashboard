# Todo card polish design

## Goal

Make the Overview Todo card feel quieter and easier to scan without removing any
Todo actions. The card should preserve the existing High/Low grouping while
reducing duplicate controls, unnecessary labels, and layout movement.

## Approved interaction design

### Card header and layout

- The visible `Todos` title is the only navigation affordance and links to the
  full `/todos` page.
- Remove `Open full page`.
- Keep High and Low as muted section headers with counts. Neither section uses
  an aggressive red treatment.
- Tighten compact row padding and allow the Todo name to use the available
  horizontal space.
- Align section labels, Todo names, and the add-row label to one vertical text
  line. Do not reserve a hidden drag column before the Todo status control.
- Keep hover-only row actions in an overlay so they do not shorten Todo names
  when the actions are hidden.

### Todo row actions

- Keep status, rename, drag/reorder, priority, due date, and delete actions.
- Keep the priority action icon-only and neutral in the row; its accessible
  label still explains that it toggles to the other priority.
- Keep utility actions visually quiet until row hover or keyboard focus.
- If a due date exists, show a compact date/time value next to the calendar
  control; otherwise show the calendar icon alone.

### Add Todo interaction

- Replace the two section-level add rows with one shared add row below both
  priority sections.
- Clicking `+ Add todo` replaces that row in place with a single-line form so
  the rest of the card does not move.
- The form contains a focused name input, a text-in-switch priority control,
  a calendar icon, and an Add action.
- The priority switch displays `Low` when off and `High` when on. Off maps to
  the existing `low` value; on maps to `high`.
- Use a native checkbox switch with a visible track and moving thumb. Do not
  style the control as a pill button.
- The calendar icon opens a date/time picker that supports both picker selection
  and typed date/time input.
- Enter submits a valid Todo; Escape cancels and restores the add row.

## Data and API change

The current Todo contract stores `due_date` as a date-only string. To preserve
the requested time, change the persisted value to an optional UTC timestamp
while remaining backward-compatible with existing date-only values during the
migration. Update the Supabase migration, generated database types, server
schemas, controller types, sorting, overdue display, and tests together.

The UI should format timestamps in the user's local timezone and retain a clear
date-only display when an existing Todo has no time component.

## Scope boundaries

- No new Todo features, filters, modals, or settings.
- No changes to the full Todo page beyond sharing the new add-row and date/time
  behavior.
- No changes to unrelated Overview cards.

## Verification

- Component tests cover title navigation, one shared add control, inline form
  replacement, High/Low toggle behavior, typed date/time submission, and the
  retained row actions.
- Existing Todo controller and server-function tests remain green.
- The production build, lint, formatting, and type checks pass.
- The deployed Overview card is smoke-tested at desktop and narrow widths,
  including opening the date/time picker and submitting a Todo.
