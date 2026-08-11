# Remove the Todo Bento Header

**Status:** Implemented; merge and deployment pending

## Goal

Remove the visible `Todos` header row from the Overview Todo bento card so the Todo groups start at the top of the card.

## Design

- Keep the card border, background, radius, and current content padding.
- Remove the complete header element, including the `Todos` text, link, spacing, and divider.
- Keep `aria-label="Todos"` on the card section so assistive technology still has a clear region name.
- Render the compact `TodoBoard` directly inside the existing padded content container.
- Do not add a replacement icon, label, tooltip, or navigation control.

## Behavior

Todo loading, creation, editing, completion, deletion, due dates, priority changes, and drag-and-drop behavior do not change. The full `/todos` page does not change.

## Testing

- Confirm the card remains a region named `Todos`.
- Confirm the card has no visible `Todos` heading or link.
- Keep the existing compact Todo behavior tests passing.
- Run the full test, lint, format, and build checks before completion.

## Deployment

Implementation does not include merge or deployment. Those actions require a separate user request.
