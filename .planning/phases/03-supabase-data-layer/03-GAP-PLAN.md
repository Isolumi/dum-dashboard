---
phase: 03-supabase-data-layer
plan: GAP
type: execute
wave: 1
depends_on: []
files_modified:
  - vitest.config.ts
  - tsconfig.json
  - src/routes/todos/todos.functions.ts
  - src/routes/todos/-todos.functions.ts
  - src/routes/todos/-todos.functions.test.ts
  - src/routes/_layout/todos/TodoRow.tsx
  - src/routes/_layout/todos/-TodoRow.tsx
  - src/routes/_layout/todos/AddTodoRow.tsx
  - src/routes/_layout/todos/-AddTodoRow.tsx
  - src/routes/_layout/todos/index.tsx
autonomous: true
gap_closure: true
requirements: [TODO-07]

must_haves:
  truths:
    - "`bun test` exits 0 — all 23 tests in -todos.functions.test.ts pass with no failures"
    - "`tsc --noEmit` exits 0 with no errors or deprecation warnings"
    - "`bun run build` completes with no TanStack Router route-candidate warnings"
  artifacts:
    - path: "vitest.config.ts"
      provides: "Vitest config with env stubs for unit project and viteReact() for components project"
      contains: "VITE_SUPABASE_URL"
    - path: "tsconfig.json"
      provides: "TypeScript config without deprecated baseUrl"
      contains: "moduleResolution"
    - path: "src/routes/todos/-todos.functions.ts"
      provides: "Renamed server functions file with - prefix"
      exports: ["getTodos", "createTodo", "updateTodo", "deleteTodo"]
    - path: "src/routes/_layout/todos/-TodoRow.tsx"
      provides: "Renamed TodoRow component with - prefix"
    - path: "src/routes/_layout/todos/-AddTodoRow.tsx"
      provides: "Renamed AddTodoRow component with - prefix"
  key_links:
    - from: "src/routes/_layout/todos/index.tsx"
      to: "src/routes/todos/-todos.functions.ts"
      via: "named import"
      pattern: "#/routes/todos/-todos.functions"
    - from: "src/routes/todos/-todos.functions.test.ts"
      to: "src/routes/todos/-todos.functions.ts"
      via: "relative import"
      pattern: "./-todos.functions"
---

<objective>
Close the three UAT gaps identified in 03-UAT.md:
1. (major) Unit tests fail — vitest.config.ts missing env stubs and viteReact() plugin
2. (minor) tsc --noEmit exits 1 — deprecated `baseUrl` in tsconfig.json
3. (minor) Build warnings — three route files lack the `-` prefix convention

Purpose: Restore `bun test`, `tsc --noEmit`, and `bun run build` to clean exits so the phase is fully verified.
Output: Updated config files and renamed source files with all import paths corrected.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-supabase-data-layer/03-UAT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix vitest.config.ts — add env stubs and viteReact() plugin</name>
  <files>vitest.config.ts</files>
  <action>
Make two targeted edits to vitest.config.ts:

1. In the `unit` defineProject block, add an `env` object inside `test`:
   ```ts
   test: {
     name: "unit",
     include: ["src/**/-*.test.ts"],
     environment: "node",
     env: {
       VITE_SUPABASE_URL: "http://localhost",
       VITE_SUPABASE_PUBLISHABLE_KEY: "test",
     },
   },
   ```
   This prevents `@supabase/supabase-js` from throwing "supabaseUrl is required" when supabase.ts is imported at module scope during test collection.

2. In the `components` defineProject block, add `viteReact()` to its `plugins` array:
   ```ts
   plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] }), viteReact()],
   ```
   This enables JSX transform for `.tsx` component test files.

3. At the top of the file, add the import:
   ```ts
   import viteReact from "@vitejs/plugin-react";
   ```
   Place this after the existing `import tsconfigPaths` line. `@vitejs/plugin-react` is already in devDependencies — no install needed.

The final import block should be:
```ts
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineProject, mergeConfig } from "vitest/config";
import { defineConfig } from "vitest/config";
```
  </action>
  <verify>
    <automated>cd /Users/isolumi/Documents/CS/dum-dashboard && bun test 2>&1 | tail -20</automated>
  </verify>
  <done>All 23 tests in -todos.functions.test.ts pass. `bun test` exits 0.</done>
</task>

<task type="auto">
  <name>Task 2: Fix tsconfig.json — remove deprecated baseUrl</name>
  <files>tsconfig.json</files>
  <action>
Delete the `"baseUrl": "."` line (line 7) from `compilerOptions` in tsconfig.json. Leave everything else intact — `paths`, `moduleResolution`, all other compiler options remain unchanged.

The `paths` block (`#/*` and `@/*` aliases) does NOT require `baseUrl` under `moduleResolution: "bundler"` — path resolution is handled by vite-tsconfig-paths reading the `paths` entries directly. Removing `baseUrl` eliminates the TS5101 deprecation error emitted by TypeScript 5.9.3+.

Result:
```json
{
  "include": ["**/*.ts", "**/*.tsx"],
  "compilerOptions": {
    "target": "ES2022",
    "jsx": "react-jsx",
    "module": "ESNext",
    "paths": {
      "#/*": ["./src/*"],
      "@/*": ["./src/*"]
    },
    ...
  }
}
```
  </action>
  <verify>
    <automated>cd /Users/isolumi/Documents/CS/dum-dashboard && tsc --noEmit 2>&1; echo "exit: $?"</automated>
  </verify>
  <done>`tsc --noEmit` exits 0 with no output. No TS5101 error appears.</done>
</task>

<task type="auto">
  <name>Task 3: Rename non-route files to add - prefix and update all import paths</name>
  <files>
    src/routes/todos/-todos.functions.ts,
    src/routes/_layout/todos/-TodoRow.tsx,
    src/routes/_layout/todos/-AddTodoRow.tsx,
    src/routes/_layout/todos/index.tsx,
    src/routes/todos/-todos.functions.test.ts
  </files>
  <action>
TanStack Router Vite plugin picks up any file without a `-` prefix as a route candidate and emits a warning for each. Three files need renaming.

**Step 1 — Rename the files** (git mv to preserve history):
```bash
git mv src/routes/todos/todos.functions.ts src/routes/todos/-todos.functions.ts
git mv src/routes/_layout/todos/TodoRow.tsx src/routes/_layout/todos/-TodoRow.tsx
git mv src/routes/_layout/todos/AddTodoRow.tsx src/routes/_layout/todos/-AddTodoRow.tsx
```

**Step 2 — Update index.tsx** (`src/routes/_layout/todos/index.tsx`):

Change line 8 import:
```ts
// Before:
import { createTodo, deleteTodo, getTodos, updateTodo } from "#/routes/todos/todos.functions";
// After:
import { createTodo, deleteTodo, getTodos, updateTodo } from "#/routes/todos/-todos.functions";
```

Change local component imports (lines 9–10):
```ts
// Before:
import { AddTodoRow } from "./AddTodoRow";
import { TodoRow } from "./TodoRow";
// After:
import { AddTodoRow } from "./-AddTodoRow";
import { TodoRow } from "./-TodoRow";
```

**Step 3 — Update -todos.functions.test.ts** (`src/routes/todos/-todos.functions.test.ts`):

Change the relative import (line 12):
```ts
// Before:
} from "./todos.functions";
// After:
} from "./-todos.functions";
```

Change the `readFileSync` path string (line 177):
```ts
// Before:
const source = readFileSync(resolve(__dirname, "todos.functions.ts"), "utf-8");
// After:
const source = readFileSync(resolve(__dirname, "-todos.functions.ts"), "utf-8");
```

Note: `-todos.functions.test.ts` and `-AddTodoRow.test.tsx` already have the correct `-` prefix — do not rename them.
  </action>
  <verify>
    <automated>cd /Users/isolumi/Documents/CS/dum-dashboard && bun run build 2>&1 | grep -i "does not export a Route" | wc -l</automated>
  </verify>
  <done>
`bun run build` completes with zero "does not export a Route" warnings. All three renamed files exist at their new paths. `bun test` still passes (imports resolve to renamed file). `tsc --noEmit` still exits 0.

Final smoke check: `bun test && tsc --noEmit && bun run build 2>&1 | grep -c "does not export a Route"` — first two exit 0, last prints 0.
  </done>
</task>

</tasks>

<verification>
Run all three checks in sequence after task 3 completes:

```bash
cd /Users/isolumi/Documents/CS/dum-dashboard
bun test
tsc --noEmit
bun run build 2>&1 | grep "does not export a Route"
```

All three must succeed: `bun test` exits 0 with 23 passing tests, `tsc --noEmit` exits 0 with no output, `bun run build` emits no route-candidate warnings.
</verification>

<success_criteria>
- `bun test` exits 0, all 23 tests pass, no errors
- `tsc --noEmit` exits 0, no TS5101 or any other error
- `bun run build` produces no "does not export a Route" warnings
- `src/routes/todos/todos.functions.ts` does not exist (replaced by `-todos.functions.ts`)
- `src/routes/_layout/todos/TodoRow.tsx` does not exist (replaced by `-TodoRow.tsx`)
- `src/routes/_layout/todos/AddTodoRow.tsx` does not exist (replaced by `-AddTodoRow.tsx`)
</success_criteria>

<output>
After completion, create `.planning/phases/03-supabase-data-layer/03-GAP-SUMMARY.md`
</output>
