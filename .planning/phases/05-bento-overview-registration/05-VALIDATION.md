---
phase: 5
slug: bento-overview-registration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (dual-project config) |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `bun run test` |
| **Full suite command** | `bun run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test`
- **After every plan wave:** Run `bun run test && bun run lint && bun run fmt:check`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| W0-01 | Wave 0 | 0 | BENT-01, BENT-02, BENT-03 | component | `bun run test` | ❌ W0 | ⬜ pending |
| BENT-01 | todo-bento-card | 1 | BENT-01 | unit | `bun run test` | ❌ W0 | ⬜ pending |
| BENT-02 | todo-bento-card | 1 | BENT-02 | unit | `bun run test` | ❌ W0 | ⬜ pending |
| BENT-03 | todo-bento-card | 1 | BENT-03 | component | `bun run test` | ❌ W0 | ⬜ pending |
| OVER-01 | overview-page | 2 | OVER-01 | manual | — | N/A | ⬜ pending |
| OVER-02 | overview-page | 2 | OVER-02 | static | `grep "TodoBentoCard" src/routes/_layout/index.tsx` → 0 matches | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/routes/_layout/todos/-TodoBentoCard.test.tsx` — test stubs for BENT-01, BENT-02, BENT-03
  - Test: correct status counts (not_started / in_progress / complete) from fixture `Todo[]`
  - Test: overdue count excludes complete todos (past `due_date`, not complete)
  - Test: high-priority count excludes complete todos
  - Test: attention row absent from DOM when `overdueCount=0` and `highPriorityCount=0`
  - Test: card renders as a `Link` to `/todos`
  - Pattern: mock `@tanstack/react-router` Link (same pattern as existing AddTodoRow test)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Overview page renders one card per tool | OVER-01 | Requires live router + registry wiring | Navigate to `/` — confirm bento grid shows exactly one card (TodoBentoCard) |
| Overview imports cards only via registry | OVER-02 | Static grep check | Run `grep "TodoBentoCard" src/routes/_layout/index.tsx` — must return 0 matches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
