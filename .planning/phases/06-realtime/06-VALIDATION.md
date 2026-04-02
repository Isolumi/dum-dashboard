---
phase: 6
slug: realtime
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (dual-project config) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bun run test` |
| **Full suite command** | `bun run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test`
- **After every plan wave:** Run `bun run test && bun run lint && bun run fmt:check`
- **Before `/gsd:verify-work`:** Full suite must be green + manual cross-tab verification complete
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 0 | REAL-01 | unit | `bun run test --project=components` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 0 | REAL-01 | component | `bun run test --project=components` | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 1 | REAL-01 | unit | `bun run test --project=components` | ✅ W0 | ⬜ pending |
| 6-01-04 | 01 | 1 | REAL-01 | component | `bun run test --project=components` | ✅ W0 | ⬜ pending |
| 6-01-05 | 01 | 2 | REAL-01 | manual | — | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/hooks/-useTodosRealtime.test.ts` — stubs for REAL-01 hook behavior (mocked supabase channel: `onEvent` called, status transitions, `removeChannel` on unmount)
- [ ] `src/routes/_layout/todos/-LiveIndicator.test.tsx` — stubs for REAL-01 indicator rendering (null when `'connecting'`, "Live" when `'live'`, "Reconnecting..." when `'reconnecting'`)

*No framework install needed — Vitest already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-tab sync: create/edit/delete in tab A visible in tab B within ~3s | REAL-01 | Requires two browser tabs with live Supabase connection | Open todo page in two tabs; mutate in tab A; confirm tab B updates without refresh |
| No subscription accumulation: navigate away and back 5x | REAL-01 | Requires Supabase dashboard connection count inspection | Navigate away/back 5 times; check Supabase dashboard shows only 1 active channel connection |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
