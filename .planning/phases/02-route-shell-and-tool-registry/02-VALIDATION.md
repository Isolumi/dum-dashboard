---
phase: 2
slug: route-shell-and-tool-registry
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (or vite.config.ts if combined) |
| **Quick run command** | `bun run test --run` |
| **Full suite command** | `bun run test --run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test --run`
- **After every plan wave:** Run `bun run test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | FOUN-03 | unit | `bun run test --run` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | FOUN-04 | unit | `bun run test --run` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 2 | NAV-01 | manual | browser nav check | N/A | ⬜ pending |
| 2-01-04 | 01 | 2 | NAV-02 | manual | sidebar active state | N/A | ⬜ pending |
| 2-01-05 | 01 | 3 | NAV-03 | manual | registry expansion | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/routes/_layout.tsx` — pathless layout exists (prerequisite for routing)
- [ ] `src/lib/tools.ts` — tool registry module exists
- [ ] vitest framework detection — if `vitest` not in package.json, install before tests

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar active link is visually distinguished | NAV-01 | Visual state depends on CSS/Tailwind render | Load app, observe active vs inactive sidebar links |
| SPA navigation (no full page reload) | NAV-02 | Browser network tab required to verify no full reload | Click sidebar links, confirm no network request for full page |
| Tool registry drives sidebar and overview auto | NAV-03 | Requires adding a registry entry and re-rendering | Add a new tool to registry, verify it appears in sidebar and bento grid without layout changes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
