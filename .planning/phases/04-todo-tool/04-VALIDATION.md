---
phase: 4
slug: todo-tool
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.0.5 |
| **Config file** | none — inline via `vite.config.ts` `test` key (vitest uses defaults) |
| **Quick run command** | `bun run test` |
| **Full suite command** | `bun run test && bun run lint && bun run fmt:check` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test`
- **After every plan wave:** Run `bun run test && bun run lint && bun run fmt:check`
- **Before `/gsd:verify-work`:** Full suite must be green + all UI-SPEC verification gates passed
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TODO-01 | TBD | TBD | TODO-01 | manual | — | ❌ manual only | ⬜ pending |
| TODO-02 | TBD | TBD | TODO-02 | manual | — | ❌ manual only | ⬜ pending |
| TODO-03 | TBD | TBD | TODO-03 | manual | — | ❌ manual only | ⬜ pending |
| TODO-04 | TBD | TBD | TODO-04 | manual | — | ❌ manual only | ⬜ pending |
| TODO-05 | TBD | TBD | TODO-05 | manual | — | ❌ manual only | ⬜ pending |
| TODO-06 | TBD | TBD | TODO-06 | manual | — | ❌ manual only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `bunx --bun shadcn@latest add popover` — install Popover component (needed for priority dropdown)
- [ ] Add `--color-amber-400: oklch(0.82 0.17 85);` to `src/theme.css` `@theme` block (needed for medium priority badge)
- [ ] Install `@tanstack/react-query` and wire `QueryClient` into router (recommended — aligns with CLAUDE.md stack)

*Existing test infrastructure (`-todos.functions.test.ts`) covers all automated requirements. No new test files needed for this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Create todo via Enter key | TODO-01 | Keyboard interaction, no DOM assertion | Type name in add row, press Enter; verify row appears in list |
| View list of todos | TODO-02 | Visual rendering | Load /todos; verify all existing todos appear with name, priority, status, due date |
| Inline field editing | TODO-03 | Click-to-edit interaction | Click a name field; type new value; press Enter; verify updated in list |
| Delete todo | TODO-04 | Hover-reveal interaction | Hover a row; click trash icon; verify row disappears |
| Status icon cycle | TODO-05 | Click interaction | Click status icon; verify cycles not_started → started → complete → not_started |
| Escape cancels entry | TODO-06 | Keyboard interaction | Focus add row; type name; press Escape; verify row reverts to placeholder |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
