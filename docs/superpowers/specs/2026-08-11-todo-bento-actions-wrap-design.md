# Todo Bento Actions and Text Wrap Design

Date: 2026-08-11
Status: Implemented; merge and deployment pending

## Goal

Make Todo rows easier to read in the Overview bento card while keeping the card quiet and compact.

The change has two parts:

1. Put the calendar action before the trash action and reduce the visual space between them.
2. Show up to two lines of Todo text in the bento card instead of forcing every name onto one line.

## Current evidence

The live bento card and current source were inspected before this design was approved.

- The compact row puts the trash action before the calendar action.
- Both action targets are 44 px wide. The visible icon edges are about 33 px apart.
- The trash control is hidden until row hover, keyboard focus, or a coarse pointer is used.
- The Todo name uses one-line truncation, so long names lose most of their useful text.
- The full Todos page and the bento card share `TodoRow`; the `compact` property already separates their layouts.

This is a compact-row presentation problem. It does not require a data, API, or drag-and-drop change.

## Decisions

### Compact action rail

The bento row will use this visual order:

```text
[drag] [status] Todo name, up to two lines     [calendar] [trash]
```

- The calendar control comes before the trash control in the DOM and on screen.
- Each desktop icon-only action target is 36 px square.
- The gap between the two action targets is 2 px.
- Coarse-pointer devices keep 44 px icon-only targets.
- The action rail always keeps its width, so hover and focus do not move or rewrap the Todo text.
- The trash action stays hidden until row hover or keyboard focus on desktop.
- The trash action stays visible on coarse-pointer devices because those devices do not have reliable hover.
- An empty calendar icon keeps its current quiet behavior. It appears on row hover, keyboard focus, or coarse-pointer devices. A saved due date stays visible.
- The trash action keeps its current destructive hover color. It does not use a destructive background in the resting state.

The implementation will reuse the project `Button`, `TodoDueDatePicker`, and Lucide icons. It will not add a new action-menu or tooltip library.

### Compact Todo text

- A Todo name in the bento card can use up to two lines.
- Text after the second line uses an ellipsis.
- The compact text uses a 20 px line height, so two lines fit cleanly beside the existing 44 px completion target.
- Short names stay on one line. They do not receive extra fixed height.
- Clicking the name still starts inline editing and exposes the complete value.
- The full accessible name remains available to assistive technology.
- The full Todos page keeps its current one-line presentation.

Unlimited wrapping is not used. One very long Todo must not make the bento card uneven or push its other tools far down the page.

## Component changes

### `TodoRow`

Only the compact branch changes.

- Replace compact name truncation with a two-line clamp.
- Keep the current name edit behavior.
- Replace the compact overlay action structure with one stable action rail.
- Render the calendar control before the trash control.
- Apply compact desktop sizes and coarse-pointer target sizes.

The full-page branch keeps its current name, date, trash, drag, status, and edit behavior.

### `TodoDueDatePicker`

No date logic or overlay behavior changes.

The compact trigger must accept the smaller action width without hiding its calendar icon. A saved date can keep its existing compact value width.

## Interaction and accessibility

- Keyboard users can focus both actions in their visual order: calendar, then trash.
- Focus reveals a hidden action before it is used.
- The action rail does not change width during hover or focus.
- The row keeps a minimum height of 44 px.
- Reduced-motion behavior stays unchanged.
- Pending Todos keep all actions disabled until the save finishes.

## Responsive behavior

- Desktop icon-only action targets are 36 px with a 2 px gap.
- Coarse-pointer icon-only action targets are 44 px.
- At narrow widths, the Todo name receives the remaining space and uses at most two lines.
- The action rail does not cause horizontal page overflow.
- Saved due-date text can still use the existing compact width and truncation rules.

## Tests

Use tests before source changes.

1. Update compact `TodoRow` tests to require calendar-before-trash DOM order.
2. Require 36 px desktop icon-only targets, a 2 px action gap, and 44 px coarse-pointer icon-only targets.
3. Require a two-line clamp for compact Todo names.
4. Prove that the full-page Todo name keeps its current one-line presentation.
5. Keep existing edit, delete, due-date, pending, focus, and coarse-pointer tests passing.
6. Run focused Todo tests, the full test suite, lint, formatting checks, and the production build.
7. Verify the Overview card in a real browser at desktop and 360 px widths.
8. Check short and long names, hover, keyboard focus, and clean browser console output.
9. Do not create, edit, move, complete, or delete live Todo data during browser verification.

## Out of scope

- Todo storage or API changes
- Drag-and-drop changes
- Changes to the add-Todo form
- Changes to the full Todos page
- Unlimited Todo-name wrapping
- A new tooltip, action-menu, icon, or calendar library

## Existing implementations

- Project Button wrapper: `src/components/ui/button.tsx`
- Project compact date picker: `src/routes/_layout/todos/-TodoDueDatePicker.tsx`
- Lucide React icons: https://lucide.dev/guide/packages/lucide-react
- Tailwind line clamp utility: https://tailwindcss.com/docs/line-clamp
