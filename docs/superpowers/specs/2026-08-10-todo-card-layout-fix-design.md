# Todo card layout fix design

## Goal

Make the Overview Todo card compact, left-aligned, and visually quiet while
preserving every Todo action and the approved inline add flow.

## Confirmed causes

Live browser measurements at 1282 by 986 found three separate causes:

- The Overview grid uses the default stretch alignment. The Todo content is
  196px tall, but its card becomes 400px tall to match the right column.
- `AddTodoRow` moves focus to its collapsed control after the initial render.
  The control therefore matches `:focus-visible` and shows a 3px ring before
  the user interacts with it.
- Compact section labels, Todo names, and the add label start 60px inside the
  board. They align with each other, but the shared inset is too large.

There were no browser console warnings or errors during the measurement.

## Approved layout

- The Overview grid aligns its children to the start. The Todo card uses its
  content height and does not match the height of the right column.
- Compact content uses a smaller leading control column and smaller horizontal
  padding. Section labels, Todo names, and the add label share one reading line.
- High and Low remain quiet section labels with counts.
- The collapsed add row has no focus until the user reaches it by keyboard or
  pointer. Keyboard focus remains visible after real interaction.
- Opening the add row replaces it in place with the form.

## Approved add form

- The name input uses a thin neutral focus treatment instead of the large blue
  ring shown on the collapsed row.
- Priority uses a native checkbox with `role="switch"`, a rounded track, a
  circular moving thumb, and one visible `Low` or `High` label inside the track.
- The calendar action uses the existing Lucide `Calendar` icon through
  `TodoDueDatePicker`.
- Enter adds a valid Todo. Escape cancels the form and returns keyboard focus to
  the collapsed add row only when the form was previously open.

## Scope

- Change only the Overview grid and shared Todo presentation components.
- Preserve all Todo data, status, rename, reorder, priority, date, and delete
  behavior.
- Preserve the full Todo page layout except for shared focus behavior required
  for accessibility.
- Add no dependency and no new Todo feature.

## Verification

- Component tests reproduce the initial-focus and stretch-alignment regressions.
- Focus restoration after Escape and submission remains covered.
- Existing Todo tests, type checking, lint, formatting, and build pass.
- Real-browser checks cover desktop and 360px layouts, add-form expansion,
  priority switching, the calendar icon, and console output.
