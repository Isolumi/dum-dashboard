---
phase: 04-todo-tool
verified: 2026-04-02T06:40:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  previous_verified: 2026-04-02T02:30:00Z
  gaps_closed:
    - "bun run test exits 0 with all 30 tests passing — 2 stale input[type=date] tests replaced with Calendar popover Button assertions (plan 04-08, commit c9185af)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Load /todos, type a character without clicking — row expands with character pre-filled"
    expected: "Collapsed AddTodoRow receives focus on mount; typing any character expands the row and seeds the name input with that character"
    why_human: "Focus management on mount via useEffect([isExpanded]) requires browser focus API to confirm the collapsed div receives focus automatically; jsdom does not faithfully simulate initial focus"
  - test: "With AddTodoRow expanded, press Tab from name -> priority -> date -> name cycle (forward and Shift+Tab backward)"
    expected: "Full Tab cycle works: name input -> priority badge -> date picker button -> name input (wrap); Shift+Tab reverses"
    why_human: "Ref-based focus with e.preventDefault() needs a real browser to verify the cycle completes correctly; jsdom cannot verify this"
  - test: "Create, edit, delete, and toggle todos with real Supabase connection"
    expected: "All CRUD operations persist to DB and survive page refresh; completed state shows strikethrough and dimmed row; overdue due dates show in destructive color"
    why_human: "Requires live Supabase connection with valid credentials configured in .env.local"
---

# Phase 4: Todo Tool Verification Report

**Phase Goal:** Build the complete Todo Tool — a fully functional, real-time todo management page with interactive rows, inline editing, and Supabase integration.
**Verified:** 2026-04-02T06:40:00Z
**Status:** human_needed (all automated checks passed; 3 items require browser/live-service confirmation)
**Re-verification:** Yes — gap closure after plan 04-08 fixed 2 stale component tests; this re-verification confirms the gap is closed and no regressions were introduced.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create a todo (name, priority, due date) by typing in the AddTodoRow and pressing Enter | VERIFIED | `-AddTodoRow.tsx` lines 60-68: `handleSubmit` trims name, calls `onCreate`, resets form; wired to `handleCreate` in `index.tsx` which calls `createTodo` |
| 2 | User sees all todos with name, status icon, priority badge, and due date | VERIFIED | `-TodoRow.tsx` 229 lines: STATUS_ICONS, PRIORITY_STYLES, `format(parseISO(todo.due_date), "MMM d")`; `index.tsx` renders `todos.map()` inside `role="list"` container |
| 3 | User can edit any field inline (name, priority, status, due date) and changes persist | VERIFIED | `-TodoRow.tsx`: `isEditingName` with Enter/Escape/blur, `isPriorityOpen` popover with `onUpdate`, `isDateOpen` calendar popover with `onUpdate`; all call `updateTodo` via `handleUpdate` optimistic update |
| 4 | User can delete a todo and it disappears from the list | VERIFIED | `-TodoRow.tsx` line 218: Trash2 Button calls `onDelete(todo.id)`; `handleDelete` in `index.tsx` optimistically removes then calls `deleteTodo` |
| 5 | User can toggle a todo's status directly from the list without opening an edit form | VERIFIED | `-TodoRow.tsx` line 110: status Button calls `onUpdate({ id: todo.id, status: STATUS_CYCLE[todo.status] })`; STATUS_CYCLE maps all three states |
| 6 | Keyboard shortcuts work: Enter submits, Escape cancels, Tab moves between fields | VERIFIED | `-AddTodoRow.tsx`: name onKeyDown handles Enter/Escape/Tab; priority button handles Tab/Shift+Tab with dateTriggerRef.current?.focus(); date picker Button handles Tab/Shift+Tab; collapsedRowRef + useEffect([isExpanded]) for type-to-expand |
| 7 | Test suite passes (bun run test exits 0) | VERIFIED | Plan 04-08 replaced 2 stale input[type="date"] tests with Calendar popover Button assertions; `bun run test` now exits 0 with 30/30 passing (confirmed by re-verification run) |

**Score:** 7/7 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/routes/_layout/todos/index.tsx` | Todo page route with loader, state management, error/empty UI | VERIFIED | 137 lines; `createFileRoute("/_layout/todos/")`, loader catching errors, `pendingComponent: TodosLoading`, 5 skeleton rows, empty state with CheckSquare icon, mutation error Alert |
| `src/routes/_layout/todos/-TodoRow.tsx` | Interactive row with inline editing, status cycle, and delete | VERIFIED | 229 lines; STATUS_CYCLE, STATUS_ICONS, isEditingName, isPriorityOpen, isDateOpen, Trash2 delete, overdue highlighting, completed opacity+strikethrough |
| `src/routes/_layout/todos/-AddTodoRow.tsx` | AddTodoRow with collapsed/expanded states, keyboard shortcuts, focus management | VERIFIED | 235 lines; collapsedRowRef (x3), dateTriggerRef (x3), useEffect([isExpanded]), bg-accent/50 wrapper, Calendar popover for date, keyboard hint "Enter to save · Esc to cancel" |
| `src/routes/todos/todos.functions.ts` | Server functions: getTodos (with null guard), createTodo, updateTodo, deleteTodo | VERIFIED | 79 lines; all 4 CRUD functions using `supabaseAdmin`; Zod validation; `return data ?? []` null guard on getTodos line 37 |
| `src/lib/supabase-admin.ts` | Admin Supabase client using SUPABASE_SECRET_KEY (bypasses RLS) | VERIFIED | 7 lines; `createClient<Database>` with `process.env.VITE_SUPABASE_URL` and `process.env.SUPABASE_SECRET_KEY` |
| `src/theme.css` | Amber-400 token for medium priority badge | VERIFIED | `--color-amber-400: oklch(0.82 0.17 85)` present in `@theme` block |
| `src/routes/_layout/todos/-AddTodoRow.test.tsx` | Component tests for AddTodoRow — aligned with Calendar popover interface | VERIFIED | 89 lines; 6 it() calls; zero `input[type="date"]` references (removed); 2 date tests now query `getByRole("button", { name: /select due date/i })` and assert `shrink-0` class; all 30 tests pass |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `index.tsx` | `todos.functions.ts` | named import `createTodo, deleteTodo, getTodos, updateTodo` | WIRED | Line 8: `import { createTodo, deleteTodo, getTodos, updateTodo } from "#/routes/todos/todos.functions"` |
| `index.tsx` | `-TodoRow.tsx` | `import { TodoRow }` | WIRED | Line 10: used in `todos.map()` line 118 |
| `index.tsx` | `-AddTodoRow.tsx` | `import { AddTodoRow }` | WIRED | Line 9: used line 117 |
| `-TodoRow.tsx` | `popover.tsx` | `import { Popover, PopoverTrigger, PopoverContent }` | WIRED | Line 8; used for priority badge and due date calendar |
| `-AddTodoRow.tsx` | `popover.tsx` + `calendar.tsx` | `import { Popover, PopoverTrigger, PopoverContent }` + `import { Calendar }` | WIRED | Lines 8, 6; used for priority selector and calendar date picker |
| `todos.functions.ts` | `supabase-admin.ts` | `import { supabaseAdmin }` | WIRED | Line 5; all 5 server functions use `supabaseAdmin` |
| `todos.functions.ts` | Supabase DB | `supabaseAdmin.from("todos").select/insert/update/delete` | WIRED | Real DB queries on lines 32-37, 55, 63-70, 77 |
| collapsed div | onKeyDown handler | `ref={collapsedRowRef}` + `useEffect([isExpanded])` calls `.focus()` | WIRED | Lines 42, 45-49, 73: ref attached to collapsed div, useEffect auto-focuses when `!isExpanded` |
| priority button Tab | date picker button | `dateTriggerRef.current?.focus()` | WIRED | Line 136: explicit focus call when Tab pressed on priority button |
| `index.tsx` | `routeTree.gen.ts` | `createFileRoute("/_layout/todos/")` | WIRED | `LayoutTodosIndexRoute` registered with `getParentRoute: () => LayoutRoute` |
| `-AddTodoRow.test.tsx` | `-AddTodoRow.tsx` date PopoverTrigger Button | `screen.getByRole("button", { name: /select due date/i })` | WIRED | Lines 68, 75: tests query by aria-label matching component's `aria-label="Select due date"` on the Button |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `index.tsx` | `todos` state | `getTodos()` -> `supabaseAdmin.from("todos").select("*").order("created_at", {ascending: false})` | Yes — live DB query; `data ?? []` null guard ensures no crash on empty table | FLOWING |
| `index.tsx` | Mutation results | `createTodo` -> insert; `updateTodo` -> update; `deleteTodo` -> delete | Yes — all use supabaseAdmin; optimistic update pattern with rollback on error | FLOWING |
| `-TodoRow.tsx` | `todo` prop | Flows from `todos` state via `todos.map()` in index.tsx | Yes — from loader via Supabase | FLOWING |
| `-AddTodoRow.tsx` | `name`, `priority`, `dueDate` | Local controlled state; submitted via `onCreate` -> `handleCreate` -> `createTodo` | Yes — real DB insert on submit | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| bun run test — all 30 tests pass | `bun run test` | 30 passed (24 unit + 6 component), 0 failed, exit 0 | PASS |
| bun run lint — zero violations | `bun run lint` | 0 warnings, 0 errors (447 files, 93 rules) | PASS |
| No `input[type="date"]` in test file | grep on `-AddTodoRow.test.tsx` | 0 matches | PASS |
| `select due date` aria-label in test file | grep on `-AddTodoRow.test.tsx` | 2 matches (lines 68, 75) | PASS |
| `shrink-0` assertion in test file | grep on `-AddTodoRow.test.tsx` | 1 match (line 76) | PASS |
| 6 it() calls in test file (count unchanged) | grep on `-AddTodoRow.test.tsx` | 6 matches | PASS |
| collapsedRowRef focus management present | grep on `-AddTodoRow.tsx` | 3 occurrences (lines 42, 47, 73) | PASS |
| dateTriggerRef Tab navigation present | grep on `-AddTodoRow.tsx` | 3 occurrences (lines 43, 136, 184) | PASS |
| null guard on getTodos | grep on `todos.functions.ts` | `data ?? []` line 37 confirmed | PASS |
| supabaseAdmin in admin client | grep on `supabase-admin.ts` | createClient with SUPABASE_SECRET_KEY confirmed | PASS |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TODO-01 | 04-01, 04-05, 04-07, 04-08 | User can create a todo with name, priority, status, and optional due date | SATISFIED | `-AddTodoRow.tsx`: name Input + priority popover (high/medium/low, default low) + Calendar date picker; `handleCreate` calls `createTodo` with `status: "not_started"` |
| TODO-02 | 04-01, 04-02 | User can view a list of all todo items | SATISFIED | `index.tsx` loader calls `getTodos()` (Supabase query, `data ?? []`); renders as `<TodoRow>` in `role="list"`; loading skeleton (5 rows) + empty state (CheckSquare icon) |
| TODO-03 | 04-02 | User can edit a todo item's name, priority, status, and due date | SATISFIED | `-TodoRow.tsx`: `isEditingName` (Input, Enter/Escape/blur), `isPriorityOpen` (popover, 3 options), status cycle via icon click, `isDateOpen` (calendar popover); all call `onUpdate` -> `updateTodo` |
| TODO-04 | 04-02 | User can delete a todo item | SATISFIED | `-TodoRow.tsx` line 218: Trash2 Button `onClick={() => onDelete(todo.id)}`; `handleDelete` in `index.tsx` optimistically removes then calls `deleteTodo`; rollback on error |
| TODO-05 | 04-02 | User can toggle a todo's status directly from the list without opening an edit view | SATISFIED | `-TodoRow.tsx` line 110: status Button; STATUS_CYCLE: not_started -> started -> complete -> not_started |
| TODO-06 | 04-01, 04-03, 04-07, 04-08 | User can create todo by pressing Enter; Escape cancels; Tab moves between fields | SATISFIED | `-AddTodoRow.tsx`: Enter calls `handleSubmit`, Escape calls `resetForm`, closed Tab cycle name->priority->date->name via refs; type-to-expand via `collapsedRowRef + useEffect([isExpanded])` |

**Orphaned requirements check:** REQUIREMENTS.md maps TODO-01 through TODO-06 to Phase 4. All 6 are claimed across plans 04-01 through 04-08. No orphaned requirements.

---

## Anti-Patterns Found

No blockers or warnings. Previous blocker (stale `input[type="date"]` test assertions) was resolved by plan 04-08.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

---

## Human Verification Required

#### 1. Type-to-Expand After Focus Management Fix (UAT Test 7)

**Test:** Load /todos. Without clicking anything, type a single character.
**Expected:** The collapsed AddTodoRow expands and the character appears pre-filled in the name input.
**Why human:** `useEffect([isExpanded])` with `collapsedRowRef.current?.focus()` requires browser focus API; jsdom does not faithfully simulate initial focus on mount.

#### 2. Full Tab Cycle in AddTodoRow (UAT Test 11)

**Test:** Click the AddTodoRow to expand it. Press Tab from name -> priority -> date -> name (forward). Press Shift+Tab in reverse (name -> date -> priority -> name).
**Expected:** Focus cycles through all three fields in both directions without escaping to the browser chrome.
**Why human:** Ref-based focus with `e.preventDefault()` needs a real browser to verify the cycle completes; jsdom cannot verify this behavior faithfully.

#### 3. End-to-End CRUD with Live Supabase

**Test:** Create a todo, edit its name and priority, toggle its status, set a due date, then delete it. Refresh the page after each write.
**Expected:** All changes persist across page refresh; completed state shows strikethrough and dimmed row; overdue due dates show in destructive color.
**Why human:** Requires live Supabase connection with valid credentials configured in `.env.local`.

---

## Gaps Summary

No gaps remaining. The single gap from the previous verification (2 stale component tests causing `bun run test` to exit 1) was resolved by plan 04-08:

- Stale test "renders the date field using shadcn Input" replaced with "renders the date field as a Calendar popover trigger button" — now queries `getByRole("button", { name: /select due date/i })` and verifies "Date" placeholder text
- Stale test "wraps date input in a w-24 shrink-0 div" replaced with "date trigger button has shrink-0 class for fixed width" — now asserts `dateTrigger.className` contains `"shrink-0"`

All 30 tests pass (0 failures). Lint is clean. TypeScript compiles without errors. All 6 requirements (TODO-01 through TODO-06) are satisfied. The 3 human verification items are unchanged from the previous verification — they require a real browser or live Supabase connection and cannot be confirmed programmatically.

---

_Verified: 2026-04-02T06:40:00Z_
_Verifier: Claude (gsd-verifier)_
