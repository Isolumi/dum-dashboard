# Phase 1: Foundation - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the TanStack Start project, establish the colour token system as CSS custom properties in a single theme file, and configure OXC linting and formatting — the base every subsequent phase builds on. No UI components or business logic.

Requirements in scope: FOUN-01, FOUN-02

</domain>

<decisions>
## Implementation Decisions

### Colour Palette

- **D-01:** Dark mode only — one dark theme, no light/system switching. Keeps palette simple; no dual-palette to maintain.
- **D-02:** Accent colour is violet/indigo family (~oklch(65% 0.2 270) for primary, slightly lighter/brighter for hover). Used for buttons, active states, focus rings.
- **D-03:** Minimal palette at this stage — define only what Phase 1 needs: backgrounds, surfaces, text, borders, and one accent scale. Expand in later phases as components reveal what's needed.

### Token Naming

- **D-04:** Scale-based CSS custom property names: `--color-neutral-950`, `--color-neutral-900`, `--color-neutral-100`, `--color-neutral-400`, `--color-violet-500`, etc. No semantic aliases at this stage.
- **D-05:** Tokens are exposed to Tailwind via the `@theme` block so components use utility classes (`bg-neutral-950`, `text-neutral-100`, `bg-violet-500`) — not arbitrary `[bg:var(...)]` values. This satisfies FOUN-02 (all Tailwind utilities reference palette tokens, not raw Tailwind colours like `gray-500`).

### OXC Tooling

- **D-06:** oxlint runs with zero-config defaults — no `.oxlintrc.json` to start. Built-in recommended React, TypeScript, and correctness rules are sufficient. Add config if violations emerge.
- **D-07:** oxfmt only — no Prettier fallback installed. The beta risk is noted (see STATE.md blockers); we validate in Phase 1 by running `oxfmt --check` on the scaffold. Add Prettier only if oxfmt proves unstable.

### Claude's Discretion

- Exact OKLCH values for the neutral scale (choose values that produce good contrast ratios and a cohesive dark palette)
- Number of neutral steps to define in Phase 1 (define only what's needed for scaffold verification)
- Tailwind `@theme` block structure within the CSS file

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack Documentation
- `CLAUDE.md` §Technology Stack — full stack spec including Tailwind v4 `@theme` setup, oxfmt/oxlint usage, and version constraints
- `CLAUDE.md` §What NOT to Use — hardcoded hex/rgb values in components, `tailwind.config.js`, `tailwindcss-animate`, ESLint

### Requirements
- `.planning/REQUIREMENTS.md` §Foundation — FOUN-01 and FOUN-02 acceptance criteria
- `.planning/ROADMAP.md` §Phase 1 — success criteria (all 4 must be TRUE after this phase)

No external ADRs or specs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None (greenfield project — no existing code)

### Established Patterns
- None yet — Phase 1 establishes the first patterns

### Integration Points
- `src/styles/theme.css` (to be created) — single source of truth for all colour tokens; all subsequent phases read from here
- `@theme` block within that file — where Tailwind v4 picks up custom colour utilities

</code_context>

<specifics>
## Specific Ideas

- Preview shown during discussion: dark background `~#0f0f0f` (near-black), surface cards `~#1a1a1a` (dark grey), off-white text — use OKLCH equivalents
- Accent preview: `oklch(65% 0.2 270)` as primary violet, `oklch(70% 0.2 270)` as hover state

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-29*
