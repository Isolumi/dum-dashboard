# Todo Density and Centered Calendar Design

Date: 2026-08-10
Status: Approved direction; implementation pending

## Goal

Make the Todo bento card cleaner without removing its current inline actions.

The change has three parts:

1. Reduce the empty space at the left of each Todo.
2. Remove the High control from the add form. New Todos always start as Low.
3. Open the add-form date picker in a centered dialog.

## Current evidence

The live desktop layout was measured in a browser.

- A Todo name starts 84 px from the row's left edge.
- The current space is 8 px padding, a 24 px drag grip, a 4 px gap, a 44 px completion control, and another 4 px gap.
- The High control in the add form uses about 61 px.
- The date picker is an anchored popover. Its center is about 88 px to the right of the card center because it uses `align="end"` on the calendar button.
- The browser console had no errors during this check.

The problem is layout geometry. It is not a loading or JavaScript error.

## Decisions

### Todo rows

Keep the drag grip on the left because it clearly shows where dragging starts. Make it smaller and reduce nearby spacing.

The compact row will use:

- 4 px left and right padding
- a 16 px drag-grip column
- a 2 px gap
- the existing 44 px completion control
- a second 2 px gap
- the Todo name

This moves the name start from about 84 px to about 68 px. The grip remains visible but does not dominate the row.

Dragging from the Todo name will not replace the grip. The name already supports click and edit actions, so combining those actions with drag would cause input conflicts.

### New Todo priority

Remove the High control and its state from the add form.

- Every new Todo is submitted with `priority: "low"`.
- Dragging a Todo into the High section is the only way to promote it from the bento card.
- Existing High Todos stay High.
- Dragging between High and Low continues to use the existing board controller. No new drag-and-drop system is needed.

This also gives the Todo name field more width.

### Calendar presentation

Use two presentations for the existing `TodoDueDatePicker`:

- `popover` remains the default for date controls on existing Todo rows.
- `dialog` is used by the add form and is centered in the viewport.

Add an explicit presentation property instead of calculating a custom popover offset. The add form will pass `presentation="dialog"`; row controls need no change.

The centered version will use the project's installed Base UI Dialog primitive. The existing calendar stays backed by React DayPicker. The project will not add a calendar package or a custom positioning engine.

The dialog will:

- use a backdrop
- stay within the viewport on narrow screens
- include the existing calendar, date input, time input, and Clear action
- include an accessible close button
- close with Escape or an outside click
- return focus to the calendar trigger after it closes

The dialog title can be visually hidden. Its accessible name will explain that it selects a due date and time.

## Component changes

### `AddTodoRow`

- Remove the priority state and High checkbox.
- Always call `onCreate` with `priority: "low"`.
- Change the compact grid to three controls: Todo name, calendar, and Add.
- Keep the current inline form and validation behavior.

### `TodoRow`

- Change only compact spacing and drag-grip width.
- Keep completion, editing, due-date, delete, and drag behavior.

### `TodoDueDatePicker`

- Add `presentation?: "popover" | "dialog"` with `"popover"` as the default.
- Reuse one date-and-time content component in both presentations.
- Use Base UI Popover for row controls.
- Use Base UI Dialog for the add form.

### UI primitive

Add a small project Dialog wrapper only for shared styling and accessibility structure. It will follow the existing `sheet.tsx` pattern, which already wraps `@base-ui/react/dialog`. It will not duplicate dialog behavior.

## Responsive behavior

- On desktop, the dialog is centered in the viewport.
- On a 360 px viewport, the dialog keeps at least 16 px of space at each side.
- The calendar remains inside the dialog without horizontal page scrolling.
- The add row gives remaining width to the Todo name field.

## Tests

Use tests before source changes.

1. Update add-row tests to prove that the High control is absent and all new Todos submit as Low.
2. Update row tests to require the smaller compact grid, padding, gaps, and drag grip.
3. Add date-picker tests for both presentations:
   - the default row presentation uses a popover
   - the add presentation uses a dialog
   - date, time, Clear, closing, and focus behavior still work
4. Run the focused Todo tests.
5. Run the full test suite and production build.
6. After deployment, check desktop and 360 px layouts in a real browser. Do not create or modify a live Todo during visual checks.

## Out of scope

- Changes to Todo storage or API data
- A new drag-and-drop library
- Changes to the full Todos page
- Changes to existing Todo priorities
- A new calendar implementation

## Reference implementations

- Base UI Dialog: https://base-ui.com/react/components/dialog
- Base UI Popover: https://base-ui.com/react/components/popover
- React DayPicker input and dialog guide: https://daypicker.dev/guides/input-fields
