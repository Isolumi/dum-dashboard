---
phase: 3
slug: supabase-data-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — Wave 0 installs vitest |
| **Config file** | `vitest.config.ts` — Wave 0 creates |
| **Quick run command** | `bun run typecheck` (`tsc --noEmit`) |
| **Full suite command** | `bun run build` (bundle analysis via vite build) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run typecheck`
- **After every plan wave:** Run `bun run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| schema-migration | 01 | 1 | TODO-07 | manual | `bun run typecheck` | ✅ | ⬜ pending |
| supabase-client | 01 | 1 | TODO-07 | type-check | `bun run typecheck` | ❌ W0 | ⬜ pending |
| type-gen | 01 | 1 | TODO-07 | type-check | `bun run typecheck` | ❌ W0 | ⬜ pending |
| server-fns | 01 | 2 | TODO-07 | type-check | `bun run typecheck` | ❌ W0 | ⬜ pending |
| bundle-check | 01 | 3 | TODO-07 | build | `bun run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/supabase.ts` — Supabase client singleton
- [ ] `src/routes/todos/todos.functions.ts` — CRUD server function stubs
- [ ] `src/types/supabase.ts` — generated Database types (via `npx supabase gen types`)
- [ ] `.env.local` — `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` added

*New packages installed: `@supabase/supabase-js`, `zod`, `@tanstack/zod-adapter`*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Todos persist across page refresh | TODO-07 | Requires live Supabase project | Create a todo, reload, verify it reappears |
| CRUD all ops against live DB | TODO-07 | Requires live Supabase project | Create, read, update, delete a todo row via manual test |
| Supabase helpers absent from client bundle | TODO-07 | Bundle analysis is visual | Run `bun run build`, check dist/ chunk sizes, verify no supabase-js in client chunks |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
