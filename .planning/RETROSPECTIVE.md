# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1 — Personal Dashboard MVP

**Shipped:** 2026-04-02
**Phases:** 6 | **Plans:** 18 | **Commits:** ~151

### What Was Built

- TanStack Start v1.167 scaffold with shadcn/ui base-nova, dark-only OKLCH token system, OXC tooling
- Sidebar + tool registry: single source of truth drives sidebar, overview bento grid, and route registration
- Supabase data layer: typed client singleton, todos table with enums, 5 Zod-validated CRUD server functions, bundle isolation
- Full todo CRUD UI: keyboard-first entry, inline editing, status cycling, priority popover, due date with overdue detection, optimistic mutations
- Bento overview: TodoBentoCard with live status counts, overdue + high-priority flags, click-to-navigate
- Supabase Realtime: `useTodosRealtime` hook with optimistic LiveIndicator, cross-tab sync within ~3s, clean subscription teardown

### What Worked

- **TDD throughout**: Writing tests before implementation (RED→GREEN) caught interface mismatches early (e.g., hook mock shape, LiveIndicator state rendering). The failing-first discipline was worth the overhead.
- **GSD phase structure**: Breaking the project into clearly scoped phases with explicit must-haves made it easy to verify completion and catch gaps. Verification reports surfaced real gaps that would have slipped through.
- **OXC enforcement**: Running `bun run lint && bun run fmt:check` at every task kept the codebase clean throughout. No lint debt accumulated.
- **Semantic colour tokens**: Enforcing no hardcoded values from Phase 1 paid off — never had to hunt for colour violations in later phases, and the dark mode system "just worked."
- **onEventRef pattern**: Capturing the realtime callback in a ref with an empty deps array prevented subtle channel churn bugs before they appeared in production.

### What Was Inefficient

- **Phase 2/3 roadmap tracking**: The progress table in ROADMAP.md got out of sync with actual disk state (showing "In Progress" when complete). Stale tracking caused minor confusion during milestone completion.
- **Realtime indicator polish**: The LiveIndicator required three iterations (reconnecting flash → nothing→live flash → optimistic with guard) that could have been anticipated with a more careful UI-SPEC for the initial state. The `hasSubscribed` guard pattern should be in the research doc for future realtime features.
- **Phase 4 gap closure volume**: 5 gap-closure plans out of 8 total for Phase 4. Many of these (null guard, env credentials, focus management) were environment/integration issues discoverable earlier with a pre-execution checklist.

### Patterns Established

- **Tool self-registration**: Tools own their route, bento card, DB schema, and server functions. The registry is the only shared contract. Adding a new tool requires no changes to layout code.
- **Realtime hook pattern**: `useTodosRealtime(onEvent)` — optimistic initial state, `hasSubscribed` ref guard, `onEventRef` for stable callback, empty deps array for single-mount channel lifecycle.
- **Dual vitest projects**: `-*.test.ts` (unit/node) and `-*.test.tsx` (components/jsdom) separation keeps server-only code from leaking into DOM tests.
- **Server functions at module boundary**: `createServerFn` + Zod validation at every entry point; client code never imports Supabase directly.

### Key Lessons

1. **Realtime initial state**: For reliable personal-app WebSocket connections, start the indicator at the success state (optimistic) and guard error transitions behind a `hasSubscribed` ref. This eliminates both the nothing→live flash and the false reconnecting flash during handshake.
2. **Roadmap table discipline**: Keep the progress table updated at phase completion, not just the phase headers. Stale tables create confusion at milestone archival.
3. **Gap closure prediction**: Supabase env setup, null returns from empty tables, and focus management are recurring gotchas. Pre-execution checklist items for future data-layer phases.
4. **OXC beta stability**: oxfmt (beta) was stable throughout — no issues encountered. Worth staying on for Tailwind class sorting built-in.

### Cost Observations

- Model: Claude Sonnet 4.6 throughout
- Parallelization: executor subagents used for phases with multiple plans
- No notable efficiency issues — 200k context window sufficient for all phases

---

## Cross-Milestone Trends

| Metric | v1 |
|--------|----|
| Phases | 6 |
| Plans | 18 |
| Tests | 45 |
| LOC (TS) | 3,493 |
| Gap closure plans | 5/18 (28%) |
| Commits | ~151 |
| Duration | ~2 months (2026-01-26 → 2026-04-02) |
