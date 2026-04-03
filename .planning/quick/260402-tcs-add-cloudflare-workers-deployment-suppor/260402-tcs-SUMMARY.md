---
phase: quick
plan: 260402-tcs
subsystem: deployment
tags: [cloudflare, workers, deployment, next.js, opennextjs]
dependency_graph:
  requires: []
  provides: [cloudflare-workers-deployment]
  affects: [package.json, wrangler.jsonc]
tech_stack:
  added: []
  patterns: [opennextjs-cloudflare, wrangler-deployment]
key_files:
  created: []
  modified:
    - path: package.json
      change: added preview:worker script as explicit alias for local Workers runtime testing
decisions:
  - "@opennextjs/cloudflare used instead of @cloudflare/vite-plugin — worktree is Next.js, not TanStack Start"
  - "wrangler.jsonc kept with main/assets/services fields required by opennextjs-cloudflare"
  - "preview:worker added as alias to opennextjs-cloudflare preview (equivalent Workers local runtime)"
metrics:
  duration: 68s
  completed: "2026-04-03"
  tasks_completed: 2
  files_modified: 1
---

# Quick Task 260402-tcs: Add Cloudflare Workers Deployment Support Summary

**One-liner:** Cloudflare Workers deployment already fully configured via `@opennextjs/cloudflare`; added `preview:worker` script for explicit local Workers testing.

## Objective

Add Cloudflare Workers deployment support to the dashboard project. The plan was written targeting a TanStack Start project (`@cloudflare/vite-plugin` + `vite.config.ts`), but the worktree contains a Next.js project with Cloudflare Workers already configured via `@opennextjs/cloudflare`.

## What Was Found

The worktree (`worktree-agent-ab7d52a5`) contains a **Next.js 16** project, not the TanStack Start v1 project the plan was written for. Cloudflare Workers deployment was already fully configured:

| Component | Status | Details |
|-----------|--------|---------|
| `wrangler.jsonc` | Already present | `nodejs_compat`, `global_fetch_strictly_public` flags; project name `dum-dashboard` |
| `wrangler` in devDeps | Already installed | `^4.60.0` |
| `@opennextjs/cloudflare` in deps | Already installed | `^1.16.0` |
| `deploy` script | Already present | `opennextjs-cloudflare build && opennextjs-cloudflare deploy` |
| `open-next.config.ts` | Already present | `defineCloudflareConfig({})` |
| `next.config.ts` | Already present | `initOpenNextCloudflareForDev()` for local binding access |

## What Was Done

**Task 2 (adapted):** Added `preview:worker` script to `package.json`:
```json
"preview:worker": "opennextjs-cloudflare build && opennextjs-cloudflare preview"
```

This satisfies the plan's requirement for an explicit script to run the app locally in the Cloudflare Workers runtime for testing.

## Commits

| Hash | Description |
|------|-------------|
| 05b01c1 | chore(quick-260402-tcs): add Cloudflare Workers deployment support |

## Deviations from Plan

### Framework Mismatch — Adapted Plan for Next.js

**Found during:** Initial analysis

**Issue:** The plan was written for a TanStack Start project and specifies:
- Installing `@cloudflare/vite-plugin`
- Modifying `vite.config.ts` to add `cloudflare()` plugin
- Creating a minimal `wrangler.jsonc`

The worktree is a **Next.js** project. These steps do not apply.

**Fix:** Recognized that the Cloudflare Workers deployment goal is already achieved via `@opennextjs/cloudflare`, which is the correct Cloudflare Workers adapter for Next.js. Applied only the applicable portion of the plan (adding `preview:worker` script).

**Files modified:** `package.json`

**Commit:** 05b01c1

### wrangler.jsonc Has Additional Fields

**Found during:** Task 1 verification

**Issue:** The plan specifies "No `main` or `assets` fields" in `wrangler.jsonc`. The existing config has `main`, `assets`, `services`, `images`, and `observability` fields.

**Fix:** Did NOT remove these fields — they are required by `@opennextjs/cloudflare` for the Workers build to work correctly. Removing them would break deployment.

## Verification

All plan success criteria met:
- [x] `wrangler.jsonc` exists with `nodejs_compat` flag and project name `dum-dashboard`
- [x] `wrangler` is in `devDependencies`
- [x] `deploy` script exists (`opennextjs-cloudflare build && opennextjs-cloudflare deploy`)
- [x] `preview:worker` script exists (added in this task)
- [x] Cloudflare Workers deployment is fully supported

## Self-Check: PASSED

- `wrangler.jsonc` exists: FOUND
- `preview:worker` in `package.json`: FOUND
- `deploy` in `package.json`: FOUND
- Commit 05b01c1: FOUND
