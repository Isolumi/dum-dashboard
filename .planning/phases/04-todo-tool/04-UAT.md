---
status: partial
phase: 04-todo-tool
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md]
started: 2026-03-30T00:00:00Z
updated: 2026-03-30T00:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Navigate to /todos
expected: Visit /todos in the browser. The page loads with the layout sidebar visible on the left and the todos content area on the right (nested under the /_layout shell).
result: issue
reported: "Error could not load todos. Refresh to try again"
severity: major

### 2. Loading State
expected: Navigate to /todos on a fresh load. While data is being fetched, five skeleton rows appear as placeholders.
result: issue
reported: "Cannot read properties of undefined (reading 'map')"
severity: blocker

### 3. Empty State
expected: When no todos exist, the page shows an empty state with a CheckSquare icon and descriptive text (not just a blank page).
result: issue
reported: "same red errors as before (error alert, cannot load todos)"
severity: major

### 4. Add a Todo (Click to Expand + Submit)
expected: Click the "+ Add a todo..." row at the bottom — it expands into a form with a focused name Input. Type a name and press Enter. The new todo appears in the list and the form collapses back to the placeholder.
result: issue
reported: "its a form with very poorly made css and very unintuitive"
severity: major

### 5. Type to Expand AddTodoRow
expected: With the AddTodoRow collapsed, start typing a character directly on it (without clicking first). The row expands and the name Input contains the character you typed.
result: skipped
reason: page crashes on load — blocked by same error as tests 1-3

### 6. Priority Popover on New Todo
expected: Expand the AddTodoRow. Click the priority badge (shows "Medium" by default). A popover dropdown opens with High, Medium, and Low options. Select one — the badge updates immediately.
result: skipped
reason: page crashes on load — blocked by same error as tests 1-3

### 7. Cancel Adding Todo (Escape)
expected: Expand the AddTodoRow, type something in the name field, then press Escape. The form collapses back to the "+ Add a todo..." placeholder with no todo added and no leftover state.
result: skipped
reason: page crashes on load — blocked by same error as tests 1-3

### 8. Tab Navigation in AddTodoRow
expected: With AddTodoRow expanded, focus is on the name Input. Press Tab — focus moves to the priority Popover trigger. Press Tab again — focus moves to the date input. Press Tab once more — focus wraps back to the name Input.
result: skipped
reason: page crashes on load — blocked by same error as tests 1-3

### 9. Cycle Todo Status
expected: Click the status icon on an existing todo. It cycles through: Circle (not started) → CircleDot (in progress) → CircleCheck (complete) → Circle (back to not started). Each click saves immediately.
result: skipped
reason: page crashes on load — blocked by same error as tests 1-3

### 10. Inline Edit Todo Name
expected: Click on a todo's name text. It changes into an Input field with the current name pre-filled. Edit the text and press Enter (or click away). The todo name updates in place.
result: skipped
reason: page crashes on load — blocked by same error as tests 1-3

### 11. Inline Edit Todo Name — Escape Reverts
expected: Click a todo name to start editing. Change the text, then press Escape. The Input disappears and the original name is restored unchanged.
result: skipped
reason: page crashes on load — blocked by same error as tests 1-3

### 12. Set Priority on Existing Todo
expected: Click the priority badge on an existing todo row. A popover opens with High, Medium, and Low options. Click one — the popover closes and the badge updates immediately without needing a separate save.
result: skipped
reason: page crashes on load — blocked by same error as tests 1-3

### 13. Inline Edit Due Date
expected: Click the due date field on an existing todo. A date Input appears. Change the date and press Enter (or click away). The due date updates in place.
result: skipped
reason: page crashes on load — blocked by same error as tests 1-3

### 14. Overdue Todo Highlighting
expected: A todo that has a past due date and is not marked complete shows the due date in red (destructive color).
result: skipped
reason: page crashes on load — blocked by same error as tests 1-3

### 15. Completed Todo Styling
expected: A todo marked as complete shows with reduced opacity (dimmed) and the name has a strikethrough line through it.
result: skipped
reason: page crashes on load — blocked by same error as tests 1-3

### 16. Hover-Revealed Delete Button
expected: Hover over a todo row. A trash icon button appears (was invisible before hovering). Click it — the todo is removed from the list.
result: skipped
reason: page crashes on load — blocked by same error as tests 1-3

## Summary

total: 16
passed: 0
issues: 5
pending: 0
skipped: 11

## Gaps

- truth: "Visit /todos and the page loads with sidebar and todos content area"
  status: failed
  reason: "User reported: Error could not load todos. Refresh to try again"
  severity: major
  test: 1
  artifacts: []
  missing: []
- truth: "Navigating to /todos on fresh load shows 5 skeleton rows while data is fetched"
  status: failed
  reason: "User reported: Cannot read properties of undefined (reading 'map')"
  severity: blocker
  test: 2
  artifacts: []
  missing: []
- truth: "When no todos exist, empty state shows CheckSquare icon and descriptive text"
  status: failed
  reason: "User reported: same red errors as before (error alert, cannot load todos)"
  severity: major
  test: 3
  artifacts: []
  missing: []
- truth: "AddTodoRow expands into a clean form with focused name Input; submitting adds todo and collapses"
  status: failed
  reason: "User reported: its a form with very poorly made css and very unintuitive"
  severity: major
  test: 4
  artifacts: []
  missing: []
- truth: "Page crashes on load preventing all interaction (type-to-expand, keyboard nav, todo CRUD)"
  status: failed
  reason: "User reported: page keeps erroring — all remaining tests 5-16 skipped"
  severity: blocker
  test: 5
  artifacts: []
  missing: []
