---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [tanstack-start, tailwind, shadcn, oxlint, oxfmt, typescript, vite]

# Dependency graph
requires: []
provides:
  - TanStack Start v1.167.13 project scaffold with Vite and TypeScript
  - shadcn/ui initialized with base library and nova preset (style: base-nova)
  - Tailwind v4 CSS-first config with @theme block
  - OKLCH scale token system in src/theme.css with --color-*: initial purge
  - shadcn semantic token layer in src/styles.css mapped to dark-only palette
  - src/routeTree.gen.ts auto-generated route tree
  - OXC tooling: oxlint 1.57.0 + oxfmt 0.42.0 as exact-pin devDependencies
  - package.json scripts: lint, lint:fix, fmt, fmt:check
affects:
  - 01-02 (colour token system and bento layout will build on src/theme.css)
  - All subsequent phases (scaffold is the base everything builds on)

# Tech tracking
tech-stack:
  added:
    - "@tanstack/react-start@1.167.13 (full-stack meta-framework)"
    - "@tanstack/react-router@1.168.8 (file-based routing)"
    - "tailwindcss@4.2.2 (CSS-first config, @theme block)"
    - "shadcn@4.1.1 (CLI-managed component library, base-nova preset)"
    - "@base-ui/react@1.3.0 (base UI primitives for shadcn base preset)"
    - "tw-animate-css@1.4.0 (CSS animations, replaces tailwindcss-animate)"
    - "lucide-react@0.545.0 (icon library)"
    - "clsx + tailwind-merge (cn() helper utility)"
    - "@fontsource-variable/geist (system font via CSS variable)"
    - "oxlint@1.57.0 (zero-config linting, replaces ESLint)"
    - "oxfmt@0.42.0 (formatting + Tailwind class sorting, replaces Prettier)"
    - "vite@7.3.1 + @tailwindcss/vite (build system)"
  patterns:
    - "CSS-first Tailwind v4 config: all colour tokens in @theme block, no tailwind.config.js"
    - "Two-layer token architecture: scale tokens (theme.css) + semantic tokens (styles.css)"
    - "Dark-only design: single :root set of OKLCH values, no .dark class or prefers-color-scheme switching"
    - "--color-*: initial purge ensures only project palette tokens generate utility classes (FOUN-02)"
    - "TanStack Start route: createFileRoute in each route file, createRootRoute in __root.tsx"
    - "CSS import pattern: appCss from '../styles.css?url' in __root.tsx"

key-files:
  created:
    - src/styles.css (main CSS entry: tailwindcss + tw-animate-css + shadcn/tailwind.css + theme.css, plus shadcn @theme inline semantic tokens)
    - src/theme.css (project scale tokens: neutral-950..100 + violet-500/400 in OKLCH)
    - src/routes/__root.tsx (root route with createRootRoute, CSS import, HTML shell)
    - src/routes/index.tsx (placeholder home route using project token utilities)
    - src/router.tsx (createRouter with routeTree)
    - src/routeTree.gen.ts (auto-generated route tree, never edit manually)
    - src/lib/utils.ts (cn() helper using clsx + tailwind-merge)
    - components.json (shadcn config: style=base-nova, tailwindCssFile=src/styles.css)
    - package.json (manifest with all deps + oxlint/oxfmt scripts)
    - pnpm-lock.yaml (lockfile)
    - tsconfig.json (TypeScript config)
    - vite.config.ts (Vite config with TanStack Start + Tailwind v4 plugins)
  modified: []

key-decisions:
  - "Used -b base -p nova flags for shadcn init (--preset base-nova is not valid; named preset encodes both base and style)"
  - "CSS file path is src/styles.css (not src/styles/app.css); theme.css placed adjacent as src/theme.css"
  - "Scaffold demo CSS (TanStack Start starter theme) removed; replaced with dark-only OKLCH palette"
  - "Scaffold demo routes and components (about.tsx, Header, Footer, ThemeToggle) removed — violation of D-01 (dark-only, no theme toggling)"
  - "Dark-only :root applied directly in src/styles.css; no .dark class or @media prefers-color-scheme needed"

patterns-established:
  - "Pattern 1: All colour usage via Tailwind utility classes (bg-neutral-950, text-neutral-100, bg-violet-500) — never raw CSS values or arbitrary classes"
  - "Pattern 2: theme.css is the single source of truth for the colour palette; styles.css handles shadcn semantic layer"
  - "Pattern 3: OXC zero-config — no .oxlintrc.json, no oxfmt config file"
  - "Pattern 4: Route files use createFileRoute('/path'); root uses createRootRoute with shellComponent"

requirements-completed: [FOUN-01, FOUN-02]

# Metrics
duration: 7min
completed: 2026-03-29
---

# Phase 01 Plan 01: Scaffold + shadcn/ui + OXC Summary

**TanStack Start v1.167.13 scaffolded with shadcn/ui base-nova preset, dark-only OKLCH token system in Tailwind v4 @theme, and OXC (oxlint@1.57.0 + oxfmt@0.42.0) zero-config tooling — both linting and formatting pass with zero violations.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-29T06:03:28Z
- **Completed:** 2026-03-29T06:10:37Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- TanStack Start v1.167.13 project scaffolded in the project root with Tailwind v4, TypeScript 5, and Vite
- shadcn/ui initialized with base-nova preset (`components.json` style: `base-nova`), Geist font, base-ui primitives, and `cn()` helper
- Two-layer CSS token architecture: `src/theme.css` (OKLCH scale tokens) + `src/styles.css` (shadcn semantic tokens mapped to dark palette)
- `--color-*: initial` purge ensures only project palette tokens produce Tailwind utility classes (FOUN-02 enforced)
- oxlint 1.57.0 + oxfmt 0.42.0 installed as exact-pin devDependencies; 0 warnings/errors on full scaffold

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold TanStack Start + shadcn/ui init** - `5c3ca00` (feat)
2. **Task 2: Install OXC tooling + package.json scripts** - `fc5cbd8` (feat)

## Files Created/Modified

- `src/styles.css` — Main CSS entry: Tailwind v4, tw-animate-css, shadcn/tailwind.css, theme.css import; shadcn @theme inline semantic tokens; dark-only :root palette
- `src/theme.css` — Project scale tokens: neutral-950/900/800/700/400/100 + violet-500/400 in OKLCH; `--color-*: initial` purge
- `src/routes/__root.tsx` — Root route with createRootRoute, CSS import via `?url` suffix, minimal HTML shell (Outlet + Scripts)
- `src/routes/index.tsx` — Placeholder home page using `bg-neutral-950 text-neutral-100` project tokens
- `src/router.tsx` — createRouter with routeTree and scroll restoration
- `src/routeTree.gen.ts` — Auto-generated by TanStack Start dev server run
- `src/lib/utils.ts` — `cn()` helper using clsx + tailwind-merge (generated by shadcn init)
- `components.json` — shadcn config with style `base-nova`, tailwindCssFile `src/styles.css`
- `package.json` — All dependencies + `lint`, `lint:fix`, `fmt`, `fmt:check` scripts; oxlint 1.57.0 + oxfmt 0.42.0 exact-pin
- `pnpm-lock.yaml` — Dependency lockfile
- `tsconfig.json` — TypeScript config with path aliases
- `vite.config.ts` — Vite with TanStack Start plugin, Tailwind v4 plugin, react plugin
- `public/` — Static assets (favicon, manifest, robots.txt)

## Decisions Made

- **shadcn preset syntax:** `--preset base-nova` is invalid in the current CLI (v4.1.1); the correct invocation is `-b base -p nova`. The preset name `base-nova` still appears correctly in `components.json` as `"style": "base-nova"`.
- **CSS file location:** The scaffold places the CSS at `src/styles.css` (not `src/styles/app.css` as the plan artifact listed). `theme.css` was placed adjacently as `src/theme.css`. The plan's RESEARCH.md explicitly says to use the path from `shadcn info` → `tailwindCssFile`.
- **Scaffold cleanup:** The TanStack Start starter includes demo-specific CSS with hardcoded hex/rgba colors and a light/dark theme toggle script — both violate FOUN-01, FOUN-02, and D-01. These were replaced with the project's dark-only OKLCH palette.
- **Dark-only tokens:** Per D-01 (dark mode only), the shadcn `.dark` class block was removed and values consolidated into `:root` with the project's OKLCH neutral + violet palette.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid shadcn preset syntax `--preset base-nova`**
- **Found during:** Task 1 (shadcn init step)
- **Issue:** `pnpm dlx shadcn@latest init --preset base-nova` exits with error "Invalid preset: base-nova. Available presets: nova, vega, maia, lyra, mira"
- **Fix:** Used `-b base -p nova` flags which produce `"style": "base-nova"` in components.json — the correct behavior
- **Files modified:** components.json (correctly created with base-nova)
- **Verification:** `grep '"style": "base-nova"' components.json` → match
- **Committed in:** 5c3ca00 (Task 1 commit)

**2. [Rule 1 - Bug] Removed scaffold demo CSS with hardcoded hex/rgba colors**
- **Found during:** Task 1 (CSS setup)
- **Issue:** TanStack Start starter ships `src/styles.css` with 200+ lines of hardcoded hex/rgba color variables (--sea-ink: #173a40, etc.) violating FOUN-01/FOUN-02
- **Fix:** Replaced entire file with clean structure: `@import "tailwindcss"` + `tw-animate-css` + `shadcn/tailwind.css` + `./theme.css` + shadcn semantic tokens mapped to dark OKLCH palette
- **Files modified:** src/styles.css
- **Verification:** FOUN-01 grep audit returns zero matches
- **Committed in:** 5c3ca00 (Task 1 commit)

**3. [Rule 1 - Bug] Removed theme toggle script and demo components violating D-01**
- **Found during:** Task 1 (__root.tsx cleanup)
- **Issue:** Scaffold `__root.tsx` includes a THEME_INIT_SCRIPT that toggles light/dark modes from localStorage, violating D-01 (dark-only). Demo Header/Footer/ThemeToggle components contain hardcoded colors.
- **Fix:** Rewrote `__root.tsx` as a minimal root route; deleted Header.tsx, Footer.tsx, ThemeToggle.tsx, about.tsx
- **Files modified:** src/routes/__root.tsx (rewritten), demo files deleted
- **Verification:** `grep -r "data-theme\|THEME_INIT" src/routes/` → no matches; FOUN-01 check passes
- **Committed in:** 5c3ca00 (Task 1 commit)

**4. [Rule 1 - Bug] Cleaned index.tsx of scaffold demo content with hardcoded colors**
- **Found during:** Task 1 (index.tsx review)
- **Issue:** Scaffold `src/routes/index.tsx` uses `text-[var(--sea-ink)]`, `bg-[rgba(79,184,178,0.32)]` and other arbitrary color values violating FOUN-01/FOUN-02
- **Fix:** Replaced with minimal placeholder using only project token utility classes (`bg-neutral-950 text-neutral-100`)
- **Files modified:** src/routes/index.tsx
- **Verification:** FOUN-01/FOUN-02 grep audits return zero matches
- **Committed in:** 5c3ca00 (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (all Rule 1 - Bug: scaffold demo code violations)
**Impact on plan:** All fixes required for FOUN-01/FOUN-02 compliance and D-01 (dark-only) adherence. No scope creep — all changes within Task 1 scope.

## Issues Encountered

- **oxfmt beta warning:** oxfmt prints "No config found, using defaults" warning on every run. This is informational, not an error. Both `pnpm fmt` and `pnpm fmt:check` exit 0. Per D-07, no config file will be added at this stage.
- **@tanstack/cli --add-on flag:** The CLI uses `--add-ons` (plural), not `--add-on` (singular). Minor discrepancy from plan task instructions; resolved by checking `--help`.

## User Setup Required

None — no external service configuration required for Phase 1 (scaffold only, no Supabase connection yet).

## Next Phase Readiness

- Project scaffold complete — `pnpm dev` starts the server cleanly
- Colour token system ready: `bg-neutral-950`, `text-neutral-100`, `bg-violet-500` etc. are live Tailwind utilities
- shadcn/ui initialized — components can be added with `pnpm dlx shadcn@latest add <component>`
- OXC tooling passing — lint and format gates active for all subsequent development
- Plan 02 can proceed: `tailwindCssFile` is `src/styles.css`; `theme.css` is at `src/theme.css`

---
*Phase: 01-foundation*
*Completed: 2026-03-29*

## Self-Check: PASSED

All key files verified present:
- FOUND: src/styles.css
- FOUND: src/theme.css
- FOUND: src/routes/__root.tsx
- FOUND: src/routes/index.tsx
- FOUND: src/router.tsx
- FOUND: src/routeTree.gen.ts
- FOUND: src/lib/utils.ts
- FOUND: components.json
- FOUND: package.json
- FOUND: pnpm-lock.yaml
- FOUND: .planning/phases/01-foundation/01-01-SUMMARY.md

All commits verified:
- FOUND: 5c3ca00 (Task 1: scaffold + shadcn)
- FOUND: fc5cbd8 (Task 2: OXC tooling)
- FOUND: 28e8ca7 (docs: SUMMARY + state updates)
