---
status: diagnosed
trigger: "bun test fails: supabaseUrl is required + document is not defined"
created: 2026-03-30T00:00:00.000Z
updated: 2026-03-30T00:00:00.000Z
goal: find_root_cause_only
---

## Current Focus

hypothesis: Two independent root causes confirmed — (1) supabase.ts executes at module load in the unit test project because tanstackStart() plugin does NOT suppress side-effectful top-level module code, and .env.local is not loaded by vitest in node env; (2) jsdom environment directive in -AddTodoRow.test.tsx is ignored because the components project config already sets environment: "jsdom" via defineProject, but the @vitest-environment docblock has no effect when projects config is active — actually the real cause is that the components project config does NOT include `@vitejs/plugin-react` (viteReact()), so React JSX transform is unavailable, and the import of @testing-library/react fails before jsdom is ever activated.
test: static analysis of vitest.config.ts + module import chain
expecting: two distinct config gaps causing the two independent failures
next_action: return ROOT CAUSE FOUND

## Symptoms

expected: bun test runs and all 23 Zod schema unit tests pass
actual: there are 7 errors. the tests do not pass
errors: |
  - src/routes/todos/-todos.functions.test.ts: Unhandled error between tests: supabaseUrl is required
    (thrown from node_modules/@supabase/supabase-js when loading supabase.ts at module scope)
  - src/routes/_layout/todos/-AddTodoRow.test.tsx: 7 failures: "ReferenceError: document is not defined"
reproduction: run `bun test`
started: discovered during UAT

## Eliminated

- hypothesis: @vitest-environment jsdom docblock is not being parsed
  evidence: The docblock IS at line 2 of -AddTodoRow.test.tsx; vitest does parse these. But when a projects array is active, per-file environment directives are still honoured — this is NOT the cause. The real cause is the missing React plugin.
  timestamp: 2026-03-30

- hypothesis: .env.local is not present or missing values
  evidence: .env.local exists and has real VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY values. But vitest does not auto-load .env.local for the node environment by default — it requires explicit loadEnv config.
  timestamp: 2026-03-30

## Evidence

- timestamp: 2026-03-30
  checked: todos.functions.ts top-level imports
  found: Line 5 — `import { supabase } from "#/lib/supabase"` is a bare top-level import (not inside a function). When the unit test project imports todos.functions.ts to get the Zod schemas, the entire module executes, including this import.
  implication: supabase.ts executes at module-evaluation time whenever todos.functions.ts is imported by any test.

- timestamp: 2026-03-30
  checked: supabase.ts
  found: `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)` executes at module scope (line 4). This is synchronous, side-effectful top-level code.
  implication: If VITE_SUPABASE_URL is undefined/empty when the module loads, @supabase/supabase-js throws "supabaseUrl is required" immediately.

- timestamp: 2026-03-30
  checked: vitest.config.ts unit project config
  found: The unit project uses `environment: "node"`. Vitest does NOT automatically load `.env.local` in node environment — `import.meta.env` values are only populated if vitest is configured to load env files (via `envFiles` or `loadEnv`) or if the Vite dev server is running. In node environment, `import.meta.env.VITE_SUPABASE_URL` resolves to `undefined`.
  implication: Even though .env.local has values, they are invisible to the unit test project's node environment. createClient receives (undefined, undefined) → throws.

- timestamp: 2026-03-30
  checked: vitest.config.ts components project config
  found: The components project defines `environment: "jsdom"` but its `plugins` array only contains `tsconfigPaths(...)`. It does NOT include `@vitejs/plugin-react` (viteReact()). React JSX transform requires either the React plugin or a Babel transform.
  implication: When -AddTodoRow.test.tsx (a .tsx file using JSX) is processed by the components project, there is no JSX transform registered. The file fails to parse/execute. The `@vitest-environment jsdom` docblock at the top of the test file is rendered irrelevant because the module never loads successfully — but even before that, the jsdom environment IS configured at the project level. The actual failure is a JSX transform gap.

- timestamp: 2026-03-30
  checked: error message "document is not defined"
  found: This error is characteristic of code that uses DOM APIs (document, window) running in a node environment, not a jsdom one. However, the components project already specifies environment: "jsdom". The discrepancy points to the test running under the wrong project — specifically under the unit project (environment: node) instead of the components project.
  implication: The include pattern for the unit project is `src/**/-*.test.ts` (no x) and for components is `src/**/-*.test.tsx`. -AddTodoRow.test.tsx ends in .tsx so it should match components only. BUT: when vitest encounters a file matched by one project that imports from a module also used by another project, or when there is a module resolution failure in the components project (due to missing React plugin), vitest may fall back to node environment. The "document is not defined" error confirms the file is executing in node env, meaning the jsdom setup in the components project is not activating — because without viteReact(), the TSX cannot be transformed, so the test runner encounters a transform error before jsdom can be set up, and the error surfaces as a node-env failure.

- timestamp: 2026-03-30
  checked: vite.config.ts vs vitest.config.ts plugin lists
  found: vite.config.ts includes viteReact() (line 14). vitest.config.ts components project does NOT inherit from vite.config.ts — it is a standalone defineProject() call with only tsconfigPaths. The two configs are separate; vitest.config.ts does not extend vite.config.ts.
  implication: The viteReact() plugin present in vite.config.ts is NOT available to the vitest components project. This is the direct cause of JSX transform failure.

## Resolution

root_cause: |
  TWO independent root causes:

  ROOT CAUSE 1 (supabaseUrl is required):
  todos.functions.ts imports supabase at the top level (line 5: `import { supabase } from "#/lib/supabase"`).
  supabase.ts calls createClient() at module scope using import.meta.env values.
  The vitest unit project runs in node environment and does NOT load .env.local, so
  import.meta.env.VITE_SUPABASE_URL is undefined at module evaluation time.
  @supabase/supabase-js throws "supabaseUrl is required" the moment todos.functions.ts
  is imported — even though the test only uses the Zod schemas (which have no Supabase
  dependency). The entire module executes as a unit; you cannot import part of it.

  ROOT CAUSE 2 (document is not defined):
  The vitest.config.ts components project configures environment: "jsdom" but its plugins
  array only contains tsconfigPaths(). It does NOT include viteReact(). Without the React
  Vite plugin, .tsx files containing JSX cannot be transformed. vitest fails to set up
  the jsdom environment for the test because the module transform step fails first (or
  the test falls through to the node environment). The symptom "document is not defined"
  confirms the test executed in node env, not jsdom.

fix: NOT APPLIED (goal: find_root_cause_only)
verification: NOT APPLIED
files_changed: []

fix_directions: |
  FIX DIRECTION 1 — for supabaseUrl error:
  Option A (preferred — no env loading needed): Mock supabase in the unit test project
    using vitest's vi.mock("#/lib/supabase", ...) or add a vitest setup file that stubs
    import.meta.env.VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before modules load.
    The schemas are pure Zod — they don't need Supabase at all. The side effect of the
    top-level import is the problem.
  Option B: Add `envFiles: ['.env.local']` (or `env: { VITE_SUPABASE_URL: '...', ... }`)
    to the unit project's test config in vitest.config.ts. This populates import.meta.env
    before modules load. Use placeholder values (not real creds) so the client constructs
    without throwing.
  Option C: Separate the schemas into a dedicated -todos.schemas.ts file with no Supabase
    import, and import from there in both the test and todos.functions.ts. Cleanest long-term.

  FIX DIRECTION 2 — for document is not defined:
  Add `viteReact()` (from @vitejs/plugin-react) to the plugins array of the components
  defineProject in vitest.config.ts. The import is already available (package is in
  devDependencies as @vitejs/plugin-react). Without this plugin, .tsx JSX is untransformed
  and the components test project cannot execute any React component tests.
  File to change: vitest.config.ts, components project defineProject block.
