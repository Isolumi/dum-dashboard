---
phase: quick
plan: 260402-1gu
subsystem: todo-tool
tags: [ui, styling, input, addtodorow]
dependency_graph:
  requires: []
  provides: [modern-input-styling-addtodorow]
  affects: [src/routes/_layout/todos/-AddTodoRow.tsx]
tech_stack:
  added: []
  patterns: [semantic-tailwind-tokens, apple-inspired-input-design]
key_files:
  created: []
  modified:
    - src/routes/_layout/todos/-AddTodoRow.tsx
decisions:
  - "Used rounded-lg + border border-input/40 + bg-input/20 for Apple-style field — all semantic tokens, no hardcoded colours"
  - "Soft focus ring ring-2 ring-ring/30 chosen over default ring-3 ring-ring/50 for subtler Apple aesthetic"
metrics:
  duration: 120s
  completed: 2026-04-02
  tasks: 1
  files: 1
---

# Quick 260402-1gu: AddTodoRow Name Input Modern Apple-style Restyle Summary

**One-liner:** Replaced bare underline name input in AddTodoRow with rounded-lg, subtle bg-input/20 fill, and soft focus ring using only semantic Tailwind tokens.

## What Was Done

Restyled the `<Input>` component's className in the expanded state of `AddTodoRow` from a flat underline style to a modern Apple-inspired field appearance.

**Before:**
```
h-auto flex-1 border-0 border-b border-input/60 px-2 pb-0.5 text-base shadow-none focus-visible:border-ring focus-visible:outline-none focus-visible:ring-0
```

**After:**
```
h-9 flex-1 rounded-lg border border-input/40 bg-input/20 px-3 text-base shadow-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:bg-input/30 focus-visible:ring-2 focus-visible:ring-ring/30
```

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Restyle AddTodoRow name input to modern Apple-inspired look | 12c0935 | src/routes/_layout/todos/-AddTodoRow.tsx |

## Decisions Made

- Used `rounded-lg` for smooth Apple-style rounding via the project's `--radius-lg` token
- `bg-input/20` provides a subtle dark fill distinguishing the field from the `bg-accent/50` row background — semantic token at 20% opacity
- `border border-input/40` replaces the previous `border-0 border-b` underline pattern with a full contained border at 40% opacity
- Soft focus ring `ring-2 ring-ring/30` instead of the default `ring-3 ring-ring/50` achieves a more refined Apple-style glow
- All colour values use semantic Tailwind tokens (`input`, `ring`, `muted-foreground`) — zero hardcoded hex/rgb/oklch values

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- File modified: `src/routes/_layout/todos/-AddTodoRow.tsx` — FOUND
- Commit 12c0935 — FOUND
- `rounded-lg` present in file — VERIFIED
- `bg-input` present in file — VERIFIED
- `border-0` absent from file — VERIFIED
- No hardcoded colour values — VERIFIED
- Build passes — VERIFIED
