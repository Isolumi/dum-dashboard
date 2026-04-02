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
  status: resolved
  reason: "User reported: Error could not load todos. Refresh to try again"
  severity: major
  test: 1
  root_cause: ".env.local has invalid Supabase credentials: VITE_SUPABASE_URL missing 'https://' prefix, VITE_SUPABASE_PUBLISHABLE_KEY is not a real JWT anon key — createClient() fails, getTodos throws, loader catch returns error state"
  artifacts:
    - path: ".env.local"
      issue: "VITE_SUPABASE_URL missing https:// scheme; VITE_SUPABASE_PUBLISHABLE_KEY not a valid JWT"
  missing:
    - "Valid VITE_SUPABASE_URL with https:// prefix"
    - "Valid Supabase anon JWT for VITE_SUPABASE_PUBLISHABLE_KEY"
- truth: "Navigating to /todos on fresh load shows 5 skeleton rows while data is fetched"
  status: resolved
  reason: "User reported: Cannot read properties of undefined (reading 'map')"
  severity: blocker
  test: 2
  root_cause: "getTodos() returns data directly from Supabase — data is typed Todo[]|null and can be null when table is empty or response is absent. null propagates through loader happy path, useState(null) initializes todos as null, todos.map() at index.tsx:118 crashes"
  artifacts:
    - path: "src/routes/todos/todos.functions.ts:37"
      issue: "return data — returns null instead of [] when Supabase data is null"
    - path: "src/routes/_layout/todos/index.tsx:118"
      issue: "todos.map() crashes when todos is null"
  missing:
    - "Null coalescing guard: return data ?? [] in getTodos"
- truth: "When no todos exist, empty state shows CheckSquare icon and descriptive text"
  status: resolved
  reason: "User reported: same red errors as before (error alert, cannot load todos)"
  severity: major
  test: 3
  root_cause: "Same root cause as test 1 — invalid .env.local credentials cause loader to always throw, so error state is always shown and empty state is never reached"
  artifacts:
    - path: ".env.local"
      issue: "Invalid credentials prevent Supabase connection"
  missing:
    - "Valid Supabase credentials (same fix as test 1)"
- truth: "AddTodoRow expands into a clean form with focused name Input; submitting adds todo and collapses"
  status: resolved
  reason: "User reported: its a form with very poorly made css and very unintuitive"
  severity: major
  test: 4
  root_cause: "Expanded state missing column structure from TodoRow: (1) status spacer is unstyled div instead of ghost Button — columns misalign; (2) date input is raw <input type='date'> not shadcn Input inside w-24 shrink-0 wrapper — renders platform browser chrome; (3) no row background on expanded state; (4) low priority has no badge background — invisible; (5) no submit/cancel affordance — Enter/Escape only with no UI hint"
  artifacts:
    - path: "src/routes/_layout/todos/AddTodoRow.tsx:84"
      issue: "Status spacer is bare <div> not sized ghost Button — column misalignment vs TodoRow"
    - path: "src/routes/_layout/todos/AddTodoRow.tsx:166-188"
      issue: "Raw <input type='date'> instead of shadcn Input in w-24 shrink-0 wrapper"
    - path: "src/routes/_layout/todos/AddTodoRow.tsx:82"
      issue: "No background class on expanded container — looks detached"
    - path: "src/routes/_layout/todos/AddTodoRow.tsx:17-21"
      issue: "low priority missing bg class — renders as invisible grey text"
    - path: "src/routes/_layout/todos/AddTodoRow.tsx:81-191"
      issue: "No submit/cancel affordance — keyboard-only with no discoverability"
  missing:
    - "Replace status spacer div with ghost icon-button-sized element"
    - "Replace raw <input type='date'> with shadcn Input inside w-24 shrink-0 wrapper"
    - "Add bg-accent/50 or similar background to expanded container"
    - "Add bg-destructive/20 or similar to low priority badge"
    - "Add visible Save/Cancel controls or keyboard hint"
- truth: "Page crashes on load preventing all interaction (type-to-expand, keyboard nav, todo CRUD)"
  status: resolved
  reason: "User reported: page keeps erroring — all remaining tests 5-16 skipped"
  severity: blocker
  test: 5
  root_cause: "Same root cause as test 2 — todos state initialized as null from loader, todos.map() crashes before page renders. Fixing getTodos null guard (test 2 fix) and .env.local credentials (test 1 fix) will unblock all remaining tests"
  artifacts:
    - path: "src/routes/todos/todos.functions.ts:37"
      issue: "return data instead of data ?? []"
    - path: ".env.local"
      issue: "Invalid credentials"
  missing:
    - "Same fixes as tests 1 and 2"
