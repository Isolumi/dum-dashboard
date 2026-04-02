---
status: complete
phase: 04-todo-tool
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md, 04-06-SUMMARY.md, quick/260402-1a5-PLAN.md, quick/260402-1gu-PLAN.md]
started: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop the dev server if it's running. Start fresh with `bun run dev`. The server boots without errors and navigating to /todos returns a live page (no crash, no blank screen, no uncaught exceptions in terminal).
result: pass

### 2. Navigate to /todos
expected: Visit /todos in the browser. The page loads with the layout sidebar visible on the left and the todos content area on the right — nested under the shared layout shell.
result: pass

### 3. Loading State
expected: Navigate to /todos on a fresh load. While data is being fetched, five skeleton placeholder rows appear briefly before the real content renders.
result: skipped
reason: loads too fast to observe skeleton state

### 4. Empty State
expected: With no todos in the database, the page shows an empty state with a CheckSquare icon and descriptive text — not just a blank content area.
result: pass

### 5. Add a Todo (Click to Expand + Submit)
expected: Click the "+ Add a todo..." row at the bottom. It expands into a form with a focused name input. Type a name and press Enter. The new todo appears in the list and the form collapses back to the placeholder.
result: pass

### 6. AddTodoRow Name Input Styling
expected: When the AddTodoRow is expanded, the name input has rounded corners, a subtle background fill, a gentle border, and a soft focus ring — not the bare flat underline style.
result: pass

### 7. Type to Expand AddTodoRow
expected: With the AddTodoRow collapsed, start typing a character directly on the row (without clicking first). The row expands and the name input contains the character you typed.
result: issue
reported: "nope"
severity: major

### 8. Priority Popover on New Todo
expected: With AddTodoRow expanded, click the priority badge (shows "Medium" by default). A popover dropdown opens with High, Medium, and Low options. Select one — the badge updates immediately.
result: pass

### 9. Calendar Date Picker on New Todo
expected: With AddTodoRow expanded, click the date area (shows a calendar icon + "Date" placeholder). A calendar popup opens. Pick a date — the trigger updates to show the selected date in "MMM d" format (e.g., "Apr 15").
result: pass

### 10. Cancel Adding Todo (Escape)
expected: Expand the AddTodoRow, type something in the name field, then press Escape. The form collapses back to the "+ Add a todo..." placeholder with no todo added and no leftover state.
result: pass

### 11. Tab Navigation in AddTodoRow
expected: With AddTodoRow expanded, focus is on the name input. Press Tab — focus moves to the priority badge. Press Tab again — focus moves to the date picker trigger. Press Tab once more — focus wraps back to the name input.
result: issue
reported: "one tab goes to priority badge, but it wont go onto date picker"
severity: major

### 12. Cycle Todo Status
expected: Click the status icon on an existing todo. It cycles through: Circle (not started) → CircleDot (in progress) → CircleCheck (complete) → Circle (back to not started). Each click saves immediately.
result: pass

### 13. Inline Edit Todo Name
expected: Click on a todo's name text. It changes into an input field with the current name pre-filled. Edit the text and press Enter (or click away). The todo name updates in place.
result: pass

### 14. Inline Edit Todo Name — Escape Reverts
expected: Click a todo name to start editing. Change the text, then press Escape. The input disappears and the original name is restored unchanged.
result: pass

### 15. Set Priority on Existing Todo
expected: Click the priority badge on an existing todo row. A popover opens with High, Medium, and Low options. Click one — the popover closes and the badge updates immediately without a separate save step.
result: pass

### 16. Calendar Date Picker on Existing Todo
expected: Click the date area on an existing todo (shows formatted date or a calendar icon on hover). A calendar popup opens. Pick a date — the display updates immediately to the new date in "MMM d" format.
result: pass

### 17. Overdue Todo Highlighting
expected: A todo with a past due date that is not marked complete shows the due date text in red (destructive color).
result: pass

### 18. Completed Todo Styling
expected: A todo marked as complete (CircleCheck status) shows with reduced opacity (dimmed) and the name has a strikethrough line through it.
result: pass

### 19. Hover-Revealed Delete Button
expected: Hover over a todo row. A trash icon button appears (was invisible before hovering). Click it — the todo is removed from the list.
result: pass

### 20. Max-Width Layout
expected: On a wide browser window, the todo list content is centered and capped at a comfortable max-width (~768px) — it does not stretch edge-to-edge across the full screen.
result: pass

## Summary

total: 20
passed: 17
issues: 2
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Typing a character on the collapsed AddTodoRow expands it and seeds the name input with that character"
  status: failed
  reason: "User reported: nope"
  severity: major
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
- truth: "Tab from priority badge moves focus to date picker trigger; Tab again wraps back to name input"
  status: failed
  reason: "User reported: one tab goes to priority badge, but it wont go onto date picker"
  severity: major
  test: 11
  root_cause: ""
  artifacts: []
  missing: []
