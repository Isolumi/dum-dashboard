# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 01-foundation
**Areas discussed:** Colour palette design, Token naming convention, OXC configuration

---

## Colour Palette Design

### Visual Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Dark mode only | One dark theme, no switching. Simpler — no dual-palette to maintain. | ✓ |
| Light mode only | One light theme. Clean and minimal. | |
| System-aware (light + dark) | Respects OS preference. Requires maintaining two full palettes. | |

**User's choice:** Dark mode only
**Notes:** Background near-black (~#0f0f0f), surface cards dark grey (~#1a1a1a), off-white text, 1–2 vivid accent colours.

---

### Accent Colour

| Option | Description | Selected |
|--------|-------------|----------|
| Violet / indigo | Modern, tasteful, works well in dark UIs. shadcn/ui defaults to this family. | ✓ |
| Cyan / teal | Cool, tech-forward feel. Contrasts well on dark backgrounds. | |
| Amber / orange | Warmer, high-energy accent. Less common in dashboards. | |
| You decide | Claude picks a tasteful accent for dark backgrounds. | |

**User's choice:** Violet / indigo
**Notes:** Primary ~oklch(65% 0.2 270), hover slightly lighter/brighter. Used for buttons, active states, focus rings.

---

### Palette Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal, expand as needed | Define only what Phase 1 needs. Expand as phases reveal what's needed. | ✓ |
| Full upfront | Complete palette now: neutrals, full accent scale, semantic tokens. | |

**User's choice:** Minimal, expand as needed

---

## Token Naming Convention

### Naming Style

| Option | Description | Selected |
|--------|-------------|----------|
| Semantic names | --color-background, --color-surface, --color-primary. Role-based. | |
| Scale-based names | --color-neutral-950, --color-violet-500. Matches raw colour steps. | ✓ |
| Hybrid: scale + semantic aliases | Both layers. Most flexible but most tokens to maintain. | |

**User's choice:** Scale-based names
**Notes:** --color-neutral-950, --color-neutral-900, --color-neutral-100, --color-neutral-400, --color-violet-500

---

### Tailwind Referencing

| Option | Description | Selected |
|--------|-------------|----------|
| Via @theme mapping | Map CSS custom properties in @theme block; use bg-neutral-950, text-neutral-100, etc. | ✓ |
| Direct CSS variable references | Arbitrary Tailwind values like [bg:var(--color-neutral-950)]. | |

**User's choice:** Via @theme mapping
**Notes:** Tailwind v4 `@theme` block exposes tokens as utility classes. Satisfies FOUN-02.

---

## OXC Configuration

### Linter Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Zero-config defaults | Run oxlint with built-in recommended rules. No .oxlintrc.json needed. | ✓ |
| Customised ruleset | Start with .oxlintrc.json for tuned rules. | |

**User's choice:** Zero-config defaults

---

### oxfmt Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| oxfmt only, no fallback | Lean into oxfmt. Add Prettier only if issues arise. | ✓ |
| Prettier as fallback from the start | Install both; switch if oxfmt acts up. | |

**User's choice:** oxfmt only, no fallback
**Notes:** Validate in Phase 1 by running `oxfmt --check` on scaffolded project.

---

## Claude's Discretion

- Exact OKLCH values for the neutral scale
- Number of neutral steps to define at Phase 1
- Tailwind `@theme` block structure within the CSS file
