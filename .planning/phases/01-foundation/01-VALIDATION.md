---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| **Framework**          | None (Phase 1 is scaffolding + config — CLI/grep verification only) |
| **Config file**        | none — Wave 0 installs                                              |
| **Quick run command**  | `pnpm dev`                                                          |
| **Full suite command** | `pnpm lint && pnpm fmt:check`                                       |
| **Estimated runtime**  | ~10 seconds                                                         |

---

## Sampling Rate

- **After every task commit:** Run `pnpm dev`
- **After every plan wave:** Run `pnpm lint && pnpm fmt:check`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type  | Automated Command                                                                                                                    | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ---------- |
| 1-01-01 | 01   | 1    | FOUN-01     | smoke      | `pnpm dev` starts without compilation errors                                                                                         | ❌ W0       | ⬜ pending |
| 1-01-02 | 01   | 1    | FOUN-01     | structural | `grep -r --include="*.tsx" --include="*.ts" "oklch\|hsl\|rgb\|#[0-9a-f]\{3,6\}" src/routes/ src/components/ \| wc -l` → must equal 0 | ❌ W0       | ⬜ pending |
| 1-02-01 | 02   | 1    | FOUN-02     | structural | `grep -r --include="*.tsx" "gray-\|slate-\|zinc-\|blue-\|red-\|green-" src/routes/ src/components/ \| wc -l` → must equal 0          | ❌ W0       | ⬜ pending |
| 1-02-02 | 02   | 1    | FOUN-02     | tool run   | `pnpm lint && pnpm fmt:check` → exit code 0                                                                                          | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

None — existing infrastructure covers all phase requirements (Phase 1 verification is tooling-based, not unit-test based).

_If none: "Existing infrastructure covers all phase requirements."_

---

## Manual-Only Verifications

| Behavior                              | Requirement | Why Manual                                                                 | Test Instructions                                                                    |
| ------------------------------------- | ----------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| App renders in browser without errors | FOUN-01     | `pnpm dev` starts a server; visual/browser check needed for runtime errors | Run `pnpm dev`, open localhost in browser, verify no console errors and page renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
