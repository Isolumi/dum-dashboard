# Buy list

## User requirements

- A simple list of things to buy.
- Item names only. Add, rename, and delete items.
- A dedicated page and an Overview bento card.
- No prices, links, categories, priority, bought status, or due dates.

## Proposed interface

- Label: Buy list. Route: `/buy-list`.
- Add a sidebar entry using the existing tool registry and Lucide icon system.
- Place the Overview card below Calendar in the wide left column. Do not move existing cards.
- Use one shared list component for both views; all three actions work in either view.
- A single inline input adds an item with Enter or an Add button.
- Click an item name to rename it. Enter saves; Escape cancels.
- Use the existing compact delete button pattern, visible on hover/focus and on touch screens.
- Keep item text left-aligned and allow wrapping. Show `No items` when empty.
- List newest items first; renaming does not change their position.
- Keep a long bento list inside a bounded scroll area rather than expanding the whole grid.

## Data and operations

- Save in a dedicated Supabase table: UUID `id`, trimmed `name` (1–300 characters), and `created_at` timestamp.
- Enable RLS and deny direct access to anonymous and authenticated API roles. Use the existing server-only admin client.
- All server functions use the existing owner/environment checks, no-store response, validation, and same-origin checks for writes.
- Add, rename, and delete update the interface immediately. Failed writes restore the affected item and show a short error.
- Protect pending writes from stale polling responses and reject duplicate writes for the same item.
- Refresh automatically every 10 seconds. Initial-load failure has a retry control; refresh failure keeps existing items visible.
- No changes to Todos, Jobs, Monies, Uwumi, the MCP API, or login.
- Add the schema before publishing the application image. Do not change existing tables or user records.

## Existing platform

- TanStack Start, React, Tailwind, shadcn/Base UI, Lucide, OXC, and Supabase remain the locked stack.
- Reuse existing UI controls, palette, owner checks, server-only secret handling, and polling hook.
- No new runtime dependency.
- Deploy through the existing v1 → GitHub Actions → GHCR → deploy branch → Argo CD pipeline on dumachine.

## Verification

- Schema: constraints, sorting index, RLS, role grants, and CRUD in an isolated database.
- Server: validation, owner and origin boundaries, query results, not-found handling, and safe error messages.
- Controller: initial load, retry, optimistic writes, rollback, concurrent changes, pending states, and stale reads.
- UI: both views support every action, text wraps, keyboard controls work, and empty/loading/error states are readable.
- Integration: sidebar/route/Overview placement; full CI; live add/rename/delete with disposable test items after deployment.
