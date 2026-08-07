# Todo Overview Card Overhaul Design

## Goal

Make the Todo bento card on the dashboard fully usable without opening the dedicated Todo page.
Both surfaces must support the same Todo actions, and priority must be simplified from three levels
to only `high` and `low`. Every existing `medium` Todo must migrate to `low` without data loss.

## Interaction Design

The bento card becomes an interactive Todo board instead of one large link. Its header contains a
small `Open full page` link for users who want the roomier view. The card keeps a fixed maximum
height and scrolls internally so adding Todos does not change the dashboard layout.

The card contains High and Low sections. Each section shows its count, ordered Todo rows, and an
inline add row preconfigured to that section's priority. Rows support every existing action:

- Click the status control to cycle `not_started` to `started` to `complete` and back to
  `not_started`.
- Click the Todo name to rename it inline.
- Change priority between High and Low from the compact priority control.
- Add, change, or clear the due date from the calendar control.
- Delete the Todo from its row action.
- Drag rows to reorder them within their priority section.

The dedicated Todo page uses the same controls with roomier spacing. Completing an action inside
the card never navigates away from the dashboard. Keyboard focus, touch target sizes, and reduced
motion behavior remain supported.

## Component Design

Extract the shared board behavior from the current full page into reusable units:

- A Todo data controller owns loading, polling, optimistic mutations, rollback, and user-facing
  mutation errors.
- A shared Todo board renders the High and Low sections and accepts a compact or full-page layout
  mode.
- Existing row, add-row, date, priority, status, delete, and drag interactions are reused by both
  surfaces instead of being reimplemented for the card.

The bento card may receive server-preloaded Todo data. It initializes from that data immediately,
then uses the same polling and mutation controller as the full page. This preserves the dashboard's
fast first render while keeping both views synchronized with the database.

## Priority Migration

Add a Supabase migration that performs the priority change transactionally:

1. Move every `medium` Todo to `low`, appending those rows after existing Low Todos while
   preserving their relative order.
2. Replace the PostgreSQL `todo_priority` enum with an enum containing only `high` and `low`.
3. Change the default priority to `low`.

Update generated database types, validation schemas, UI selectors, grouping utilities, and tests so
`medium` is rejected everywhere after the migration. New Todos default to Low unless they are
created from the High section.

## Data and Failure Behavior

Mutations update the interface optimistically. When the server mutation succeeds, the returned Todo
becomes the local source of truth. When it fails, the card restores the previous Todo list and shows
a compact error message inside the card. The full page shows the same error in its existing alert
area. Polling must not overwrite an in-flight optimistic mutation with stale data.

Loading shows compact row skeletons. A failed initial load shows a retryable error state. Empty High
or Low sections remain visible because each section includes its own add row.

## Testing and Verification

- Prove the bento card supports create, rename, status cycling, priority changes, due dates,
  deletion, and reordering without navigation.
- Prove both the compact card and full page use only High and Low sections.
- Prove validation defaults to Low and rejects Medium.
- Validate the SQL migration against representative High, Medium, and Low rows, including preserved
  ordering and no remaining Medium values.
- Test optimistic success, rollback on failure, loading, empty, and retry states.
- Run the complete test suite, lint, formatting, production builds, and deployment security checks.
- Deploy through the protected `v1` GitOps workflow, then verify Argo is Synced/Healthy and the live
  dashboard card can perform every Todo action.
