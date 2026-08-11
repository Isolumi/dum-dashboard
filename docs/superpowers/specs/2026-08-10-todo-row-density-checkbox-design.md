# Todo Row Density and High Checkbox Design

## Goal

Remove the large empty area at the left of each compact Todo row and replace the Low/High slider in the add form with a smaller, clearer High checkbox.

## Todo row

- Keep one drag handle at the far left.
- Reduce the compact drag column from 44 px to 24 px.
- Keep the drag button 44 px tall but only 24 px wide.
- Keep the grip faintly visible at rest and fully visible on hover or keyboard focus.
- Place the status control directly after the drag handle.
- Keep the existing Todo name, date, delete, pending, keyboard, and drag behavior.
- Do not add priority arrows or other row controls.

The compact row grid becomes:

```text
24 px drag | 44 px status | flexible Todo name | date/actions
```

The full-page row uses the same 24 px drag width so both views have the same visual rhythm.

## Add form priority checkbox

- Use one native checkbox input with a custom compact visual box.
- The visible box contains the word `High`.
- Unchecked means Low priority.
- Checked means High priority.
- The checked state adds a small checkmark and a quiet primary tint.
- Use a short border and background transition. Do not use sliding motion.
- Keep the control accessible as a checkbox named `High priority`.
- Keep Escape handling, keyboard focus, form reset, and submitted priority behavior unchanged.
- Keep the date icon and Add button in their current positions.

## Responsive behavior

- Desktop compact form: Todo input, High checkbox, calendar icon, and Add button stay on one row.
- Narrow compact form: Todo input, High checkbox, and calendar icon stay on the first row; Add spans the second row.
- The Todo card must not create horizontal overflow at 360 px.

## Verification

- Component tests confirm the 24 px drag column and checkbox semantics.
- Existing drag, Todo action, date, form submission, and accessibility tests continue to pass.
- Live desktop and 360 px browser checks confirm the reduced left spacing, checkbox appearance, calendar icon, and no horizontal overflow.
- Browser console has no errors or warnings.
