---
status: partial
phase: 04-todo-tool
source: [04-VERIFICATION.md]
started: 2026-04-02T02:34:00Z
updated: 2026-04-02T02:34:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Type-to-expand on mount
expected: Load /todos, type without clicking; collapsed AddTodoRow should expand with the typed character pre-filled in the name field
result: [pending]

### 2. Full Tab cycle in AddTodoRow
expected: Tab forward through name -> priority -> date -> name (wraps), Shift+Tab backward through same cycle; focus should stay within the row
result: [pending]

### 3. End-to-end CRUD with live Supabase
expected: Create a todo, edit its fields, toggle status, delete it; all changes persist after page refresh (requires valid .env.local Supabase credentials)
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
