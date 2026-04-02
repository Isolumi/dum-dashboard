---
status: resolved
phase: 03-supabase-data-layer
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md]
started: 2026-03-30T00:00:00Z
updated: 2026-03-30T00:05:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Unit Tests Pass
expected: Run `bun test` in the project root. All 23 tests in `src/routes/todos/-todos.functions.test.ts` pass. No failures or errors.
result: issue
reported: "there are 7 errors. the tests do not pass"
severity: major

### 2. TypeScript Compiles Clean
expected: Run `tsc --noEmit`. It exits with code 0, no type errors reported.
result: issue
reported: "tsconfig.json:7 error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Found 1 error in tsconfig.json:7"
severity: minor

### 3. Bundle Isolation
expected: Run `bun run build` then verify no Supabase-related strings (`createClient`, `@supabase`, `supabase-js`) appear in any file under `dist/client/`. Supabase code stays server-side only.
result: issue
reported: "it builds but a lot of warnings appear"
severity: minor

### 4. Environment Variables Documented
expected: `.env.example` exists at project root and contains both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` with comments explaining where to find these values.
result: pass

### 5. Helper Type Aliases Exported
expected: `src/lib/database.types.ts` exports all five helper aliases: `Todo`, `TodoInsert`, `TodoUpdate`, `TodoPriority`, and `TodoStatus` — matching the actual Supabase schema types.
result: pass

## Summary

total: 5
passed: 2
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Run `bun test` passes — all 23 tests in -todos.functions.test.ts pass with no failures"
  status: resolved
  reason: "User reported: there are 7 errors. the tests do not pass"
  severity: major
  test: 1
  root_cause: |
    Two separate causes:
    1. todos.functions.ts imports supabase.ts at module scope; supabase.ts calls createClient() synchronously at module load time. In vitest node env, import.meta.env.VITE_SUPABASE_URL is undefined (vitest does not load .env.local in node env), so @supabase/supabase-js throws "supabaseUrl is required." before any schema tests can run.
    2. vitest.config.ts components project is missing viteReact() in its plugins array. Without the React Vite plugin, .tsx files with JSX cannot be transformed. Tests fall through to node env where document is not defined. @vitejs/plugin-react is already in devDependencies.
  artifacts:
    - path: "vitest.config.ts"
      issue: "unit project has no env stub for VITE_SUPABASE_URL; components project missing viteReact() plugin"
    - path: "src/lib/supabase.ts"
      issue: "createClient() called at module scope — throws when env var is undefined"
  missing:
    - "Add env: { VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_PUBLISHABLE_KEY: 'test' } to unit project config in vitest.config.ts"
    - "Add viteReact() to plugins in the components defineProject block in vitest.config.ts"
  debug_session: .planning/debug/bun-test-failures-supabase-and-jsdom.md
- truth: "`tsc --noEmit` exits 0 with no errors"
  status: resolved
  reason: "User reported: tsconfig.json error TS5101 — baseUrl is deprecated in TS 7.0, exits with 1 error"
  severity: minor
  test: 2
  root_cause: |
    tsconfig.json line 7 has "baseUrl": "." which is a legacy artifact from pre-TS-5.0 era when paths required baseUrl as an anchor. Under moduleResolution: "bundler", baseUrl is a no-op — runtime alias resolution is handled by vite-tsconfig-paths reading the paths entries directly. TypeScript 5.9.3 (installed) emits TS5101 deprecation error. Safe to remove entirely.
  artifacts:
    - path: "tsconfig.json"
      issue: "line 7: \"baseUrl\": \".\" — deprecated under moduleResolution bundler, no-op, causes TS5101"
  missing:
    - "Delete \"baseUrl\": \".\" from tsconfig.json compilerOptions (paths block stays intact)"
  debug_session: .planning/debug/tsconfig-baseurl-deprecated.md
- truth: "`bun run build` succeeds with no warnings; no Supabase strings in dist/client/"
  status: resolved
  reason: "User reported: it builds but a lot of warnings appear"
  severity: minor
  test: 3
  root_cause: |
    TanStack Router Vite plugin scans src/routes/ recursively. Three non-route files lack the "-" prefix convention and trigger "does not export a Route" warnings (each twice — once per build pass):
    - src/routes/todos/todos.functions.ts (should be -todos.functions.ts)
    - src/routes/_layout/todos/TodoRow.tsx (should be -TodoRow.tsx)
    - src/routes/_layout/todos/AddTodoRow.tsx (should be -AddTodoRow.tsx)
    The test file (-todos.functions.test.ts) already has the prefix correctly applied.
  artifacts:
    - path: "src/routes/todos/todos.functions.ts"
      issue: "missing - prefix, picked up as route candidate"
    - path: "src/routes/_layout/todos/TodoRow.tsx"
      issue: "missing - prefix, picked up as route candidate"
    - path: "src/routes/_layout/todos/AddTodoRow.tsx"
      issue: "missing - prefix, picked up as route candidate"
  missing:
    - "Rename todos.functions.ts → -todos.functions.ts; update import in index.tsx and -todos.functions.test.ts (path string on line 177)"
    - "Rename TodoRow.tsx → -TodoRow.tsx; update import in index.tsx"
    - "Rename AddTodoRow.tsx → -AddTodoRow.tsx; update import in index.tsx; update test file name reference"
  debug_session: .planning/debug/build-route-warnings.md
