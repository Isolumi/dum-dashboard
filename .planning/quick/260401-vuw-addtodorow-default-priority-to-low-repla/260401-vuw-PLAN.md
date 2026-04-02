---
phase: quick
plan: 260401-vuw
type: execute
wave: 1
depends_on: []
files_modified:
  - src/routes/_layout/todos/-AddTodoRow.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "New todo rows default to low priority, not medium"
    - "Resetting the form after submit also resets to low priority"
  artifacts:
    - path: "src/routes/_layout/todos/-AddTodoRow.tsx"
      provides: "AddTodoRow with low default priority"
      contains: "useState<TodoPriority>(\"low\")"
  key_links:
    - from: "useState initial value"
      to: "resetForm setPriority call"
      via: "both must be \"low\" to be consistent"
      pattern: "setPriority.*low"
---

<objective>
Change -AddTodoRow.tsx default priority from "medium" to "low".

Purpose: New todos should default to low priority so users can escalate intentionally rather than starting at medium.
Output: -AddTodoRow.tsx with two "medium" references changed to "low" (useState initial value and resetForm).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Change default priority from "medium" to "low"</name>
  <files>src/routes/_layout/todos/-AddTodoRow.tsx</files>
  <action>
    Two changes only — no other modifications:

    1. Line 32: `useState<TodoPriority>("medium")` → `useState<TodoPriority>("low")`
    2. Line 41 (inside resetForm): `setPriority("medium")` → `setPriority("low")`

    The date input is already correctly implemented as `<Input type="date">` inside a `w-24 shrink-0` wrapper — do NOT change it.

    The test file (-AddTodoRow.test.tsx) does not assert on the default priority value, so no test changes are needed.
  </action>
  <verify>
    <automated>cd /Users/isolumi/Documents/CS/dum-dashboard && bun run test --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|AddTodoRow)"</automated>
  </verify>
  <done>Both useState and resetForm use "low" as the priority default. All existing tests pass.</done>
</task>

</tasks>

<verification>
Run `bun run test` — all AddTodoRow tests pass with no regressions.
Visually: open AddTodoRow and confirm the priority badge shows "Low" before any interaction.
</verification>

<success_criteria>
- `useState<TodoPriority>("low")` on the initial state line
- `setPriority("low")` inside resetForm
- All existing tests pass unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/260401-vuw-addtodorow-default-priority-to-low-repla/260401-vuw-SUMMARY.md`
</output>
