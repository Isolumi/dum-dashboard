---
phase: 03-supabase-data-layer
plan: GAP
type: execute
wave: 1
depends_on: []
files_modified:
  - vitest.config.ts
  - tsconfig.json
  - vite.config.ts
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
    - path: "vite.config.ts"
      provides: "Vite config with routeFileIgnorePattern excluding *.functions.ts from route scanning"
      contains: "routeFileIgnorePattern"
    - path: "src/routes/_layout/todos/-TodoRow.tsx"
      provides: "Renamed TodoRow component with - prefix"
    - path: "src/routes/_layout/todos/-AddTodoRow.tsx"
      provides: "Renamed AddTodoRow component with - prefix"
  key_links:
    - from: "src/routes/_layout/todos/index.tsx"
      to: "src/routes/todos/todos.functions.ts"
      via: "named import"
      pattern: "#/routes/todos/todos.functions"
    - from: "src/routes/todos/-todos.functions.test.ts"
      to: "src/routes/todos/todos.functions.ts"
      via: "relative import"
      pattern: "./todos.functions"
---

<objective>
Close the three UAT gaps identified in 03-UAT.md:
1. (major) Unit tests fail — vitest.config.ts missing env stubs and viteReact() plugin
2. (minor) tsc --noEmit exits 1 — deprecated `baseUrl` in tsconfig.json
3. (minor) Build warnings — TodoRow.tsx and AddTodoRow.tsx lack the `-` prefix; todos.functions.ts is excluded via routeFileIgnorePattern (preserving D-07)

Purpose: Restore `bun test`, `tsc --noEmit`, and `bun run build` to clean exits so the phase is fully verified.
Output: Updated config files and renamed component files with all import paths corrected.
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
  <done>
The vitest unit project collects without "supabaseUrl is required" error; the viteReact() plugin enables JSX transform in the components project. `bun test` exits 0 or makes meaningful progress past the previous collection errors. (Full 23-test pass is confirmed in Task 3's done, after component file renames are complete.)
  </done>
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
  <name>Task 3: Silence build warnings — configure routeFileIgnorePattern and rename component files</name>
  <files>
    vite.config.ts,
    src/routes/_layout/todos/-TodoRow.tsx,
    src/routes/_layout/todos/-AddTodoRow.tsx,
    src/routes/_layout/todos/index.tsx
  </files>
  <action>
TanStack Router Vite plugin picks up any file without a `-` prefix as a route candidate and emits a warning for each. The solution is two-pronged:

**Part A — Configure routeFileIgnorePattern in vite.config.ts** (for todos.functions.ts):

D-07 locks `todos.functions.ts` at `src/routes/todos/todos.functions.ts` per the `<tool>.functions.ts` convention. Do NOT rename this file. Instead, tell the router plugin to ignore all `*.functions.ts` files by adding `routeFileIgnorePattern` to the `tanstackStart()` plugin options:

```ts
tanstackStart({
  routeFileIgnorePattern: "\\.functions\\.ts$",
}),
```

This regex matches any file ending in `.functions.ts`, excluding `todos.functions.ts` from route scanning without renaming it.

The complete vite.config.ts after edit:
```ts
import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      routeFileIgnorePattern: "\\.functions\\.ts$",
    }),
    viteReact(),
  ],
});

export default config;
```

**Part B — Rename TodoRow.tsx and AddTodoRow.tsx** (component files, no convention locks these):

```bash
git mv src/routes/_layout/todos/TodoRow.tsx src/routes/_layout/todos/-TodoRow.tsx
git mv src/routes/_layout/todos/AddTodoRow.tsx src/routes/_layout/todos/-AddTodoRow.tsx
```

**Part C — Update index.tsx** (`src/routes/_layout/todos/index.tsx`):

Change local component imports:
```ts
// Before:
import { AddTodoRow } from "./AddTodoRow";
import { TodoRow } from "./TodoRow";
// After:
import { AddTodoRow } from "./-AddTodoRow";
import { TodoRow } from "./-TodoRow";
```

The `todos.functions.ts` import in index.tsx does NOT change — it stays as `#/routes/todos/todos.functions` (per D-07, file is not renamed).

Note: `-todos.functions.test.ts` already has the correct `-` prefix and imports from `./todos.functions` — do not modify the test file.
  </action>
  <verify>
    <automated>cd /Users/isolumi/Documents/CS/dum-dashboard && bun test 2>&1 | tail -5 && tsc --noEmit && ! bun run build 2>&1 | grep -q "does not export a Route" && echo "ALL PASS"</automated>
  </verify>
  <done>
`bun run build` completes with zero "does not export a Route" warnings. `-TodoRow.tsx` and `-AddTodoRow.tsx` exist at their new paths. `todos.functions.ts` remains at `src/routes/todos/todos.functions.ts` (D-07 preserved). `bun test` passes all 23 tests (imports still resolve). `tsc --noEmit` still exits 0.

Final smoke check: `bun test && tsc --noEmit && ! bun run build 2>&1 | grep -q "does not export a Route"` — all three exit 0.
  </done>
</task>

</tasks>

<verification>
Run all three checks in sequence after task 3 completes:

```bash
cd /Users/isolumi/Documents/CS/dum-dashboard
bun test
tsc --noEmit
! bun run build 2>&1 | grep -q "does not export a Route" && echo "PASS" || echo "FAIL"
```

All three must succeed: `bun test` exits 0 with 23 passing tests, `tsc --noEmit` exits 0 with no output, the build grep check prints "PASS".
</verification>

<success_criteria>
- `bun test` exits 0, all 23 tests pass, no errors
- `tsc --noEmit` exits 0, no TS5101 or any other error
- `bun run build` produces no "does not export a Route" warnings
- `src/routes/todos/todos.functions.ts` still exists at original path (D-07 preserved)
- `src/routes/_layout/todos/-TodoRow.tsx` exists (renamed from TodoRow.tsx)
- `src/routes/_layout/todos/-AddTodoRow.tsx` exists (renamed from AddTodoRow.tsx)
- `src/routes/_layout/todos/TodoRow.tsx` does not exist (replaced by `-TodoRow.tsx`)
- `src/routes/_layout/todos/AddTodoRow.tsx` does not exist (replaced by `-AddTodoRow.tsx`)
</success_criteria>

<output>
After completion, create `.planning/phases/03-supabase-data-layer/03-GAP-SUMMARY.md`
</output>
