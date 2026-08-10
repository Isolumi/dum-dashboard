# Todo Drag and Input Polish Design

## Goal

Make Todo movement direct and predictable: drag a Todo within one priority or between High and Low, keep the handle on the left, remove duplicate priority controls, let the add text box use the available width, and animate the priority switch.

## Chosen approach

Use one `DndContext` around the complete Todo board. Each priority section remains its own sortable container, but both containers report to one board-level drag handler. The handler will identify the source and destination priority, then call either `reorder` for movement inside one section or a new controller `move` operation for movement between sections.

This is better than keeping one drag context per section because separate contexts cannot see each other's drop targets. It is also better than adding more arrow controls because drag-and-drop is already the primary movement action.

## Interaction design

- A small, muted drag handle is the first control on the left of every Todo row.
- The handle appears on hover or keyboard focus on pointer devices and stays visible on coarse-pointer devices.
- Dropping over a Todo places the moved Todo at that position.
- Dropping in an empty priority section or below its Todos appends the Todo.
- Priority arrow and text buttons are removed from both compact and full views.
- Existing status, rename, due-date, and delete actions stay unchanged.
- While a move is saving, involved rows cannot start another drag.

## Add form

The expanded compact add form will not reserve a blank status or drag column. Its layout is:

```text
[ Todo name................................ ] [ Low/High ] [ Calendar ] [ Add ]
```

On narrow screens, the Add button remains on a second full-width row. The collapsed add row keeps its plus icon.

## Switch motion

The switch keeps its current size and appearance. The thumb, track color, and Low/High labels animate for 200 ms with an ease-out curve. Reduced-motion mode disables the motion.

## Data and error behavior

The new controller `move(id, targetPriority, targetIndex)` operation will:

1. Save the original Todo state.
2. Update the local source and destination groups immediately.
3. Persist the moved Todo's priority and sort order.
4. Persist the normalized order of both affected groups.
5. Restore the original state and show the existing mutation error if persistence fails.

This keeps the UI responsive and prevents a failed network call from leaving the local list in the wrong priority.

## Accessibility and testing

- The drag handle keeps an accessible label that names the Todo.
- Keyboard drag support continues through the existing DnD Kit keyboard sensor.
- High and Low sections remain valid drop targets when empty.
- Tests will cover same-section reorder, cross-section movement, failure rollback, left-side handle order, removed priority controls, the full-width add input, and motion classes.
- Live checks will cover desktop and mobile width, cross-priority drag, input width, switch motion styling, and console errors.
