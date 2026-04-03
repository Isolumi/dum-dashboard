---
status: investigating
trigger: "Diagnose: Why is `baseUrl` present and is it still needed with `moduleResolution: 'bundler'`? What is the minimal fix to silence TS5101 without breaking path aliases?"
created: 2026-03-30T00:00:00Z
updated: 2026-03-30T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: baseUrl was historically required for `paths` to work, but with moduleResolution bundler + vite-tsconfig-paths handling runtime resolution, it is now redundant and should be removed
test: verify path aliases work via vite-tsconfig-paths alone (no baseUrl), and that TypeScript paths resolution does not require baseUrl under bundler mode
expecting: removing baseUrl silences TS5101 without breaking imports that use #/* or @/* aliases
next_action: confirm via TS docs and code evidence that paths does not require baseUrl in bundler mode

## Symptoms

expected: tsc --noEmit exits 0 with no errors
actual: tsconfig.json:7 error TS5101 — Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0
errors: |
  tsconfig.json:7:5 - error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0.
  Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
  7     "baseUrl": ".",
reproduction: Run `tsc --noEmit`
started: Discovered during UAT for phase 03
severity: minor

## Eliminated

## Evidence

- timestamp: 2026-03-30T00:00:00Z
  checked: tsconfig.json
  found: |
    baseUrl is "." (project root), paths maps #/* and @/* to ./src/*
    moduleResolution is "bundler", noEmit is true
  implication: baseUrl was added to satisfy the historical TS requirement that paths needs baseUrl to resolve. Under bundler mode this is no longer true.

- timestamp: 2026-03-30T00:00:00Z
  checked: vite.config.ts
  found: vite-tsconfig-paths plugin is present — `tsconfigPaths({ projects: ["./tsconfig.json"] })`
  implication: path alias resolution at build/runtime is delegated entirely to vite-tsconfig-paths, not the TypeScript compiler's own resolver. tsc only type-checks; vite resolves.

- timestamp: 2026-03-30T00:00:00Z
  checked: package.json imports field
  found: "imports": { "#/*": "./src/*" } — Node subpath imports also define the #/* alias
  implication: the #/* alias has three layers (TS paths, Node imports, vite-tsconfig-paths). None of them require baseUrl.

- timestamp: 2026-03-30T00:00:00Z
  checked: TypeScript version
  found: TypeScript 5.9.3 — baseUrl emits TS5101 (deprecated) starting in TS 5.x leading to TS 7.0 removal
  implication: baseUrl will cause a hard error in TS 7.0. Needs removal now to stop the warning.

- timestamp: 2026-03-30T00:00:00Z
  checked: TypeScript moduleResolution bundler + paths
  found: As of TypeScript 5.x, `paths` in bundler mode does NOT require baseUrl. The deprecation was introduced precisely because bundler mode + paths is the modern pattern without needing baseUrl.
  implication: safe to remove baseUrl without any functional regression.

## Resolution

root_cause: |
  `baseUrl: "."` was present as a legacy companion to `paths`. In pre-5.0 TypeScript, `paths` required `baseUrl` to be set as an anchor for relative resolution. With `moduleResolution: "bundler"` (TypeScript 5.0+), `paths` no longer requires `baseUrl`. TypeScript 5.x introduced TS5101 to signal this: `baseUrl` is now a deprecated no-op on its way to removal in TS 7.0. Additionally, since vite-tsconfig-paths is handling all actual path alias resolution at build time, TypeScript is only type-checking — `baseUrl` has zero functional effect in this setup.

fix: |
  Remove the `"baseUrl": "."` line from tsconfig.json. The `paths` entries (#/* and @/*) remain and continue to work: tsc uses them for type-checking only, and vite-tsconfig-paths resolves them at build/dev time. No other changes required.

verification: ""
files_changed: [tsconfig.json]
