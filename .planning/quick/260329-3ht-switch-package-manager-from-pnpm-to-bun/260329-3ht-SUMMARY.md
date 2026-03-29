---
phase: quick
plan: 260329-3ht
subsystem: toolchain
tags: [bun, package-manager, pnpm, migration, oxfmt]
dependency_graph:
  requires: []
  provides: [bun.lock, .prettierignore]
  affects: [package.json, CLAUDE.md]
tech_stack:
  added: [bun (package manager)]
  patterns: [bunx --bun shadcn@latest for shadcn CLI invocations]
key_files:
  created: [bun.lock, .prettierignore]
  modified: [package.json, CLAUDE.md]
  deleted: [pnpm-lock.yaml]
decisions:
  - Removed pnpm.onlyBuiltDependencies block from package.json (pnpm-specific config)
  - Added .prettierignore to exclude .claude/, .planning/, .agents/ from oxfmt scope
  - oxfmt reads .prettierignore by default for ignore patterns (.oxfmtignore is not a supported format)
metrics:
  duration: 25min
  completed: "2026-03-29"
  tasks: 3
  files: 5
---

# Quick Task 260329-3ht: Switch Package Manager from pnpm to bun Summary

**One-liner:** Migrated package manager from pnpm to bun by removing pnpm-lock.yaml and config block, generating bun.lock, and updating all CLAUDE.md references from `pnpm dlx` to `bunx --bun`.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Remove pnpm artifacts and install with bun | f66e55b | package.json (removed pnpm block), pnpm-lock.yaml (deleted), bun.lock (created) |
| 2 | Verify dev server, lint, and format | fe6b084 | .prettierignore (created to scope oxfmt to source files only) |
| 3 | Update CLAUDE.md pnpm references to bun/bunx | f24a727, d07896c | CLAUDE.md (Development Tools table, @shadcn/ui Core Tech row) |

## Verification Results

- `bun.lock` — present (161,651 bytes, 584 installs across 684 packages)
- `pnpm-lock.yaml` — absent
- `bun run lint` — exits 0 (0 warnings, 0 errors across 66 files)
- `bun run fmt:check` — exits 0 (17 source files, all correctly formatted)
- `bun run build` — completes without errors (CSS warnings are pre-existing)
- `grep -c "pnpm" CLAUDE.md` — 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing config] Added .prettierignore to scope oxfmt to source files**
- **Found during:** Task 2
- **Issue:** `bun run fmt:check` was failing because oxfmt was scanning `.claude/worktrees/` (other git worktrees) and `.planning/` (planning artifacts), finding formatting issues in non-project-source files.
- **Fix:** Created `.prettierignore` at project root excluding `.claude/`, `.planning/`, `.agents/`. oxfmt reads `.prettierignore` by default (not `.oxfmtignore` — that is not a supported filename).
- **Files modified:** `.prettierignore` (created)
- **Commit:** fe6b084

**2. [Rule 1 - Bug] oxfmt reformatted CLAUDE.md table spacing**
- **Found during:** Task 3 verification
- **Issue:** The CLAUDE.md edits for Task 3 introduced minor table spacing differences that caused `fmt:check` to fail on CLAUDE.md itself.
- **Fix:** Ran `bun run fmt` to apply oxfmt normalization, then committed the result.
- **Files modified:** `CLAUDE.md`
- **Commit:** d07896c

## Known Stubs

None — all changes are toolchain configuration, no UI or data stubs introduced.

## Self-Check: PASSED

All created files verified present. All task commits verified in git history.
