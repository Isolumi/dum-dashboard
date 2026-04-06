# Phase 1: Foundation - Research

**Researched:** 2026-03-29
**Domain:** TanStack Start scaffold + Tailwind v4 CSS token system + OXC tooling
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Dark mode only — one dark theme, no light/system switching. Keeps palette simple; no dual-palette to maintain.
- **D-02:** Accent colour is violet/indigo family (~oklch(65% 0.2 270) for primary, slightly lighter/brighter for hover). Used for buttons, active states, focus rings.
- **D-03:** Minimal palette at this stage — define only what Phase 1 needs: backgrounds, surfaces, text, borders, and one accent scale. Expand in later phases as components reveal what's needed.
- **D-04:** Scale-based CSS custom property names: `--color-neutral-950`, `--color-neutral-900`, `--color-neutral-100`, `--color-neutral-400`, `--color-violet-500`, etc. No semantic aliases at this stage.
- **D-05:** Tokens are exposed to Tailwind via the `@theme` block so components use utility classes (`bg-neutral-950`, `text-neutral-100`, `bg-violet-500`) — not arbitrary `[bg:var(...)]` values.
- **D-06:** oxlint runs with zero-config defaults — no `.oxlintrc.json` to start. Built-in recommended React, TypeScript, and correctness rules are sufficient.
- **D-07:** oxfmt only — no Prettier fallback installed. Validate in Phase 1 by running `oxfmt --check` on the scaffold.

### Claude's Discretion

- Exact OKLCH values for the neutral scale (choose values that produce good contrast ratios and a cohesive dark palette)
- Number of neutral steps to define in Phase 1 (define only what's needed for scaffold verification)
- Tailwind `@theme` block structure within the CSS file

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                   | Research Support                                                                                                                                              |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FOUN-01 | Colour palette is defined as CSS custom properties in a single theme file — no hardcoded colour values exist in any component | Tailwind v4 `@theme` block allows all colour definitions in one CSS file; `--color-*` variables auto-generate utility classes                                 |
| FOUN-02 | All Tailwind colour utilities reference the palette tokens (no raw `gray-500`-style classes)                                  | The `@theme` block replaces the default colour palette when tokens are defined with matching names; using `--color-*: initial` to purge defaults is an option |

</phase_requirements>

---

## Summary

Phase 1 is a greenfield scaffold with no existing code. The three domains are independent but must be completed in order: (1) scaffold the TanStack Start project, (2) configure OXC tooling, and (3) establish the colour token system.

The scaffold is created via `npx @tanstack/cli@latest create` selecting the Start + React + Tailwind combo, then `pnpm dlx shadcn@latest init` initialises shadcn/ui for TanStack Start. The shadcn CLI for TanStack Start creates an `app/styles/app.css` (or equivalent) file with Tailwind v4 imports already in place — the `@theme` block is the correct insertion point for custom colour tokens. Because the user chose dark mode only (D-01), there is no `.dark` selector override needed; the single set of tokens represents the only theme.

OXC tooling (oxlint + oxfmt) is installed as devDependencies using exact-pin version ranges, per the STATE.md blocker on oxfmt beta stability. The zero-config approach (D-06/D-07) is validated by running both tools against the scaffold before Phase 1 is closed.

**Primary recommendation:** Scaffold with `npx @tanstack/cli@latest create`, init shadcn, insert the `@theme` block with scale-based colour tokens into the single Tailwind CSS file, install oxlint + oxfmt as devDependencies, run both tools, verify zero violations.

---

## Standard Stack

### Core

| Library                  | Version            | Purpose                                 | Why Standard                                                                            |
| ------------------------ | ------------------ | --------------------------------------- | --------------------------------------------------------------------------------------- |
| `@tanstack/react-start`  | 1.167.13           | Full-stack meta-framework               | v1 stable, Vite-native, type-safe server functions; locked in CLAUDE.md                 |
| `@tanstack/react-router` | 1.168.8            | File-based routing                      | Underpins TanStack Start; `createFileRoute` per route file                              |
| `react` + `react-dom`    | 19.2.4             | UI rendering                            | Required peer dep for TanStack Start v1                                                 |
| `tailwindcss`            | 4.2.2              | Utility-first CSS (v4 CSS-first config) | No `tailwind.config.js`; all config in CSS via `@theme`                                 |
| `tw-animate-css`         | 1.4.0              | CSS animations for shadcn/ui            | Replaces deprecated `tailwindcss-animate`; import via `@import "tw-animate-css"` in CSS |
| `vite`                   | 6.x (latest 8.0.3) | Build tool / dev server                 | Used natively by TanStack Start since v1.121.0                                          |
| `typescript`             | 5.x (latest 6.0.2) | Type safety                             | Required for TanStack Start type inference                                              |

> **Note:** npm shows `vite@8.0.3` and `typescript@6.0.2` as latest. CLAUDE.md specifies `^6.x` and `^5.x` respectively. Use the versions the `@tanstack/cli create` scaffold pins — do not manually override unless the scaffold is outdated.

### Supporting (Phase 1 only)

| Library        | Version     | Purpose               | When to Use                                                 |
| -------------- | ----------- | --------------------- | ----------------------------------------------------------- |
| `lucide-react` | 1.7.0       | Icon set              | Required by shadcn/ui internally; install at init time      |
| `shadcn` CLI   | 4.1.1 (dlx) | Component scaffolding | Run via `pnpm dlx shadcn@latest` at init; not a runtime dep |

### Dev Tools

| Tool     | Version | Purpose                             | Notes                                                                                         |
| -------- | ------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `oxlint` | 1.57.0  | Linting                             | `pnpm add -D oxlint`; run via `oxlint .`; zero-config works immediately                       |
| `oxfmt`  | 0.42.0  | Formatting + Tailwind class sorting | `pnpm add -D oxfmt`; run via `oxfmt` or `oxfmt --check`; exact-pin version due to beta status |

### Alternatives Considered

| Instead of | Could Use                              | Tradeoff                                                                                              |
| ---------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| oxfmt      | Prettier + prettier-plugin-tailwindcss | Prettier is stable but slower; oxfmt has built-in Tailwind class sorting. Decision D-07 locks oxfmt.  |
| oxlint     | ESLint                                 | ESLint is slower; oxlint v1.0 stable covers full React/TS/import ruleset. Decision D-06 locks oxlint. |

### Installation

```bash
# 1. Install pnpm if not present (required for shadcn dlx commands)
npm install -g pnpm

# 2. Scaffold TanStack Start project
npx @tanstack/cli@latest create
# Select: Start, React, Tailwind CSS, Recommended defaults
# Do NOT add the shadcn add-on when prompted (init separately)

# 3. Navigate into project and install deps
cd <project-name>
pnpm install

# 4. Init shadcn/ui for TanStack Start
pnpm dlx shadcn@latest init

# 5. Add OXC tooling as exact-pin devDependencies
pnpm add -D oxlint@1.57.0 oxfmt@0.42.0

# 6. Add scripts to package.json
# "lint": "oxlint .",
# "lint:fix": "oxlint . --fix",
# "fmt": "oxfmt",
# "fmt:check": "oxfmt --check"
```

### Version Verification

Confirmed against npm registry on 2026-03-29:

| Package                 | Verified Version | Published  |
| ----------------------- | ---------------- | ---------- |
| `@tanstack/react-start` | 1.167.13         | recent     |
| `tailwindcss`           | 4.2.2            | 2026-03-18 |
| `oxlint`                | 1.57.0           | 2026-03-24 |
| `oxfmt`                 | 0.42.0           | 2026-03-24 |
| `lucide-react`          | 1.7.0            | recent     |
| `tw-animate-css`        | 1.4.0            | recent     |

---

## Architecture Patterns

### Recommended Project Structure

After scaffold + shadcn init, the project should look like:

```
src/
├── routes/
│   ├── __root.tsx          # Root layout; imports app CSS
│   └── index.tsx           # Home/overview route
├── styles/
│   ├── app.css             # Main CSS: @import tailwind + tw-animate-css + @theme + base styles
│   └── theme.css           # (Phase 1 deliverable) colour token definitions; imported by app.css
├── router.tsx              # createRouter() config
├── routeTree.gen.ts        # Auto-generated; never edit
└── components/
    └── ui/                 # shadcn component copies (added per phase)
```

> **Note:** The shadcn CLI for TanStack Start creates an `app.css`-style entry file. The `theme.css` file is a deliberate Phase 1 addition — it keeps all colour decisions in one place, imported by `app.css`. The ROADMAP success criterion explicitly names `src/styles/theme.css`.

### Pattern 1: Tailwind v4 CSS-First Colour Tokens

**What:** All colour tokens are defined as `--color-{name}-{scale}` CSS custom properties inside a `@theme` block. Tailwind v4 reads the `@theme` block and generates corresponding utility classes automatically.

**When to use:** Anytime a colour value is needed in a component — always reference the generated utility class, never a raw CSS value.

**Example:**

```css
/* src/styles/theme.css */
/* Source: https://tailwindcss.com/docs/theme */

@theme {
  /* Purge Tailwind's default colour palette — project uses only these tokens */
  --color-*: initial;

  /* Neutral scale — dark UI backgrounds, surfaces, text */
  --color-neutral-950: oklch(0.09 0 0); /* ~#0f0f0f — page background */
  --color-neutral-900: oklch(0.13 0 0); /* ~#1a1a1a — surface/card */
  --color-neutral-800: oklch(0.2 0 0); /* slightly lighter surface */
  --color-neutral-700: oklch(0.28 0 0); /* borders */
  --color-neutral-400: oklch(0.6 0 0); /* muted text */
  --color-neutral-100: oklch(0.93 0 0); /* primary text (off-white) */

  /* Violet accent scale */
  --color-violet-500: oklch(0.65 0.2 270); /* primary accent (from D-02) */
  --color-violet-400: oklch(0.7 0.2 270); /* hover state (from D-02) */
}
```

```css
/* src/styles/app.css */
@import "tailwindcss";
@import "tw-animate-css";
@import "./theme.css";

/* Dark mode only: set base styles on :root (no .dark switcher needed) */
@layer base {
  :root {
    background-color: theme(--color-neutral-950);
    color: theme(--color-neutral-100);
  }
}
```

Usage in components:

```tsx
// Correct — references palette token via generated utility class
<div className="bg-neutral-900 text-neutral-100 border border-neutral-700">
  <button className="bg-violet-500 hover:bg-violet-400">Action</button>
</div>

// WRONG — raw Tailwind palette class (violates FOUN-02)
<div className="bg-gray-900 text-gray-100">
```

### Pattern 2: shadcn Semantic Token Layer (for shadcn components)

**What:** shadcn/ui components use semantic variables (`--background`, `--foreground`, `--primary`, etc.) via `@theme inline`. For Phase 1 the shadcn init creates these; they coexist with the scale tokens.

**When to use:** When installing any shadcn component — the semantic layer is managed by the shadcn CLI and should not be hand-edited.

**Key insight:** The two layers are separate — `theme.css` owns scale tokens; the shadcn-generated CSS file owns semantic tokens that map to scale tokens. Phase 1 must define both because subsequent phases will add shadcn components.

```css
/* Generated by shadcn init — do not edit manually */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... */
}

:root {
  --background: oklch(0.09 0 0); /* maps to neutral-950 */
  --foreground: oklch(0.93 0 0); /* maps to neutral-100 */
  --primary: oklch(0.65 0.2 270); /* maps to violet-500 */
  /* ... */
}
```

### Pattern 3: OXC Zero-Config Run

**What:** oxlint and oxfmt run without configuration files on fresh scaffolds.

**When to use:** Add to `package.json` scripts and run at end of Phase 1 to verify zero violations.

```json
{
  "scripts": {
    "lint": "oxlint .",
    "lint:fix": "oxlint . --fix",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check"
  }
}
```

Running `pnpm fmt:check` will fail (exit code 1) if any files are unformatted — treat this as a Phase 1 gate.

### Anti-Patterns to Avoid

- **Raw palette classes in components:** `bg-gray-500`, `text-slate-100`, `border-zinc-700` — all violate FOUN-02. Only tokens defined in `theme.css` may be used.
- **Hardcoded hex/rgb/hsl values anywhere outside theme.css:** e.g., `style={{ backgroundColor: '#0f0f0f' }}` or inline `oklch(...)` — violates FOUN-01.
- **`tailwind.config.js`:** Does not exist in Tailwind v4; all config lives in the CSS `@theme` block.
- **`tailwindcss-animate` plugin:** Deprecated March 2025; use `tw-animate-css` imported as CSS instead.
- **`--color-*: initial` omission:** Without purging Tailwind defaults, raw palette classes like `bg-blue-500` continue to work in components, making FOUN-02 unenforceable. Always include the purge declaration.
- **`dark:` utility prefixes in components:** Decision D-01 is dark-mode-only; no `dark:` prefixes needed or correct.
- **Creating a new CSS file instead of editing `tailwindCssFile`:** The shadcn skill explicitly states: "Never create a new CSS file for this." Edit the file at the path returned by `npx shadcn@latest info` → `tailwindCssFile`.

---

## Don't Hand-Roll

| Problem                   | Don't Build                            | Use Instead                 | Why                                                                                                                                               |
| ------------------------- | -------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colour token registration | Manual CSS variables without `@theme`  | Tailwind v4 `@theme` block  | Without `@theme`, variables exist in CSS but produce no utility classes — components must use `[bg:var(...)]` which is verbose and harder to lint |
| Tailwind class sorting    | Manual ordering convention             | oxfmt built-in              | oxfmt has built-in Tailwind class sorting; a manual convention will drift and become inconsistent                                                 |
| Linting rule config       | Custom `.oxlintrc.json` in Phase 1     | oxlint zero-config defaults | Decision D-06; zero-config covers correctness, React, TypeScript rules; premature config adds maintenance cost                                    |
| Dark mode toggling        | `next-themes` or manual class toggling | No toggler needed           | Decision D-01 is dark-only; no runtime theme switching                                                                                            |
| Formatter config file     | `.oxfmtrc` or `.prettierrc`            | oxfmt defaults              | oxfmt defaults align closely with Prettier; no config file needed for Phase 1                                                                     |

**Key insight:** The `@theme` block is the architectural foundation — everything downstream (components, shadcn, lint rules) depends on tokens being registered correctly here. Getting this wrong in Phase 1 means every subsequent phase inherits the misalignment.

---

## Common Pitfalls

### Pitfall 1: `--color-*: initial` Forgotten

**What goes wrong:** Default Tailwind palette classes (`gray-500`, `blue-100`, etc.) remain valid. Components can accidentally use them, violating FOUN-02 without any lint error.
**Why it happens:** Tailwind v4 ships a full default colour palette by default; custom `@theme` additions are additive, not replacement.
**How to avoid:** Add `--color-*: initial;` as the first line inside the `@theme` block to purge all defaults. Then define only the project's palette.
**Warning signs:** Running `grep -r "gray-\|slate-\|zinc-\|blue-\|green-\|red-\|sky-" src/` in a later phase finds hits.

### Pitfall 2: Two CSS Files in Conflict

**What goes wrong:** `app.css` (shadcn-generated) and `theme.css` (project-created) both define `@theme` blocks with overlapping variable names, causing silent overrides.
**Why it happens:** shadcn init generates its own `@theme inline` block; creating a second standalone `@theme` block in a different file can shadow or be shadowed by it.
**How to avoid:** Import `theme.css` from `app.css` so there is only one CSS entry point. Keep scale tokens in `theme.css`, semantic tokens in the shadcn-generated section of `app.css`. Verify with `pnpm dlx shadcn@latest info` to confirm `tailwindCssFile` path.
**Warning signs:** Colour utilities resolve to unexpected values; running `oxfmt --check` after adding `theme.css` import causes cascade errors.

### Pitfall 3: pnpm Not Installed

**What goes wrong:** `pnpm dlx shadcn@latest init` fails because `pnpm` is not available on the system.
**Why it happens:** pnpm is not pre-installed on macOS by default. The system has node@25 and npm@11 but pnpm was not found on this machine.
**How to avoid:** Install pnpm first via `npm install -g pnpm` (or `brew install pnpm`). All shadcn CLI commands use `pnpm dlx`.
**Warning signs:** `command not found: pnpm` during scaffold.

### Pitfall 4: `@tanstack/cli create` Prompts Shadcn Add-on

**What goes wrong:** Accepting the shadcn add-on during `@tanstack/cli create` installs shadcn pre-configured, but may use different defaults than `pnpm dlx shadcn@latest init -t start` run separately.
**Why it happens:** The integrated add-on may use an older or different preset.
**How to avoid:** Skip the shadcn add-on when prompted during scaffold. Run `pnpm dlx shadcn@latest init` as a separate step after scaffold completes.
**Warning signs:** `components.json` references a preset or base that conflicts with project conventions.

### Pitfall 5: oxfmt Beta Incompatibility With Scaffold Code

**What goes wrong:** `oxfmt --check` exits non-zero on freshly scaffolded files not due to project code but due to edge-case formatting differences in generated boilerplate.
**Why it happens:** oxfmt is in beta (0.42.0) and may have minor differences from expected output on certain patterns.
**How to avoid:** Run `oxfmt` (format mode) first to auto-correct the scaffold, then `oxfmt --check` to confirm. Document any persistent failures. If oxfmt proves unstable, the STATE.md blocker plan is to fall back to Prettier — but attempt oxfmt first.
**Warning signs:** `oxfmt --check` fails on files that were not modified by the developer.

### Pitfall 6: Route Tree Not Auto-Generated

**What goes wrong:** TypeScript errors appear because `routeTree.gen.ts` does not exist when the project is first opened.
**Why it happens:** TanStack Start generates `routeTree.gen.ts` at dev/build time, not at scaffold time.
**How to avoid:** Run `pnpm dev` once after scaffold to generate the route tree before running lint or type checks.
**Warning signs:** TS errors referencing missing exports from `routeTree.gen.ts`.

---

## Code Examples

Verified patterns from official sources:

### @theme Block with Scale Tokens (Tailwind v4)

```css
/* Source: https://tailwindcss.com/docs/theme */
@theme {
  --color-*: initial;

  --color-neutral-950: oklch(0.09 0 0);
  --color-neutral-900: oklch(0.13 0 0);
  --color-neutral-800: oklch(0.2 0 0);
  --color-neutral-700: oklch(0.28 0 0);
  --color-neutral-400: oklch(0.6 0 0);
  --color-neutral-100: oklch(0.93 0 0);

  --color-violet-500: oklch(0.65 0.2 270);
  --color-violet-400: oklch(0.7 0.2 270);
}
```

### app.css Entry Point

```css
/* Source: shadcn/ui TanStack Start docs + tw-animate-css docs */
@import "tailwindcss";
@import "tw-animate-css";
@import "./theme.css";
```

### oxlint Zero-Config Run

```bash
# Source: https://oxc.rs/docs/guide/usage/linter
pnpm exec oxlint .
# or after adding to package.json scripts:
pnpm lint
```

### oxfmt Check

```bash
# Source: https://oxc.rs/docs/guide/usage/formatter
pnpm exec oxfmt --check
# Fix all formatting:
pnpm exec oxfmt
```

### TanStack Start Route with CSS Import

```tsx
// Source: TanStack Start docs / shadcn TanStack install guide
// src/routes/__root.tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";
import appCss from "../styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: () => <Outlet />,
});
```

---

## State of the Art

| Old Approach                 | Current Approach                         | When Changed                 | Impact                                                    |
| ---------------------------- | ---------------------------------------- | ---------------------------- | --------------------------------------------------------- |
| `tailwind.config.js`         | `@theme` block in CSS                    | Tailwind v4 (late 2024)      | No JS config file; all tokens in CSS                      |
| `tailwindcss-animate` plugin | `tw-animate-css` CSS import              | March 2025                   | `@plugin` directive gone; use `@import "tw-animate-css"`  |
| `@shadcn/ui` npm package     | Components copied to project via CLI     | Always                       | No installed shadcn package; `shadcn` CLI is latest name  |
| HSL colour format            | OKLCH colour format                      | shadcn/ui Tailwind v4 update | Better perceptual uniformity; CSS var wrapping simplified |
| Vinxi build tool             | Vite natively                            | TanStack Start v1.121.0      | Any docs referencing Vinxi are outdated                   |
| `React.forwardRef`           | Plain function component with `ref` prop | React 19                     | shadcn components no longer use `forwardRef`              |
| ESLint                       | oxlint v1.0                              | June 2025                    | 50-100x faster; 700+ rules; zero-config for this stack    |

**Deprecated / outdated:**

- `tailwind.config.js`: Does not exist in this project; any AI suggestion to create one is wrong.
- `tailwindcss-animate`: Do not install; `tw-animate-css` is the replacement.
- `prettier` + `prettier-plugin-tailwindcss`: Not installed; oxfmt handles both.
- `@supabase/ssr`: Not needed; no auth in v1.

---

## Open Questions

1. **Exact CSS file path after `shadcn init`**
   - What we know: shadcn TanStack docs say CLI pre-configures Tailwind; a CSS file with `@theme inline` is created; `tailwindCssFile` in `components.json` points to it.
   - What's unclear: Is the file `src/styles/app.css`, `src/app.css`, or `app/styles/globals.css`? Depends on what `@tanstack/cli create` + shadcn init produce interactively.
   - Recommendation: Run `pnpm dlx shadcn@latest info` immediately after init and read the `tailwindCssFile` field. Place `theme.css` adjacent to whatever that file is; import it from there.

2. **`--color-*: initial` and shadcn semantic tokens**
   - What we know: shadcn semantic tokens like `--color-primary` are registered via `@theme inline` in the shadcn-generated block.
   - What's unclear: If scale tokens in `theme.css` use `--color-*: initial` to purge defaults, does that also purge the shadcn semantic tokens registered in a separate `@theme inline` block?
   - Recommendation: Put `--color-*: initial` only in `theme.css`, which is imported after the shadcn section. Tailwind processes `@theme` blocks in document order — later blocks supplement earlier ones. Verify by checking `bg-primary` still resolves after purge. If it breaks, scope the purge more narrowly by not using `initial` and instead relying on explicit token names that shadow the defaults.

3. **pnpm version pinning**
   - What we know: pnpm is the documented package manager for this project; it is not installed on this machine.
   - What's unclear: Whether the TanStack CLI scaffold pins a specific pnpm version in `packageManager` field.
   - Recommendation: Install via `npm install -g pnpm`; the scaffold step will set the `packageManager` field in `package.json`.

---

## Environment Availability

| Dependency   | Required By                   | Available | Version | Fallback                                      |
| ------------ | ----------------------------- | --------- | ------- | --------------------------------------------- |
| Node.js      | All JS tooling                | Yes       | 25.8.2  | —                                             |
| npm          | Package install fallback      | Yes       | 11.11.1 | —                                             |
| pnpm         | shadcn CLI, TanStack scaffold | No        | —       | Install via `npm install -g pnpm`             |
| oxlint       | Linting (Phase 1 gate)        | No        | —       | Install as devDependency during Phase 1       |
| oxfmt        | Formatting (Phase 1 gate)     | No        | —       | Install as devDependency during Phase 1       |
| TanStack CLI | Scaffold                      | No        | —       | Install via `npx @tanstack/cli@latest create` |

**Missing dependencies with no fallback:**

- None that block execution — all can be installed as part of Phase 1 tasks.

**Missing dependencies with fallback:**

- pnpm: not globally installed; install via `npm install -g pnpm` as the first task.
- oxlint/oxfmt: not globally installed; installed as project devDependencies (expected for per-project tools).

---

## Validation Architecture

### Test Framework

This phase is a pure scaffolding + configuration phase. There is no application logic to unit test. The "tests" for Phase 1 are CLI commands that verify tooling and structural constraints.

| Property           | Value                                               |
| ------------------ | --------------------------------------------------- |
| Framework          | None (no test framework needed for Phase 1)         |
| Config file        | None — scaffold verification uses CLI commands only |
| Quick run command  | `pnpm dev` (app starts without errors)              |
| Full suite command | `pnpm lint && pnpm fmt:check` (zero violations)     |

### Phase Requirements → Test Map

| Req ID     | Behavior                                                | Test Type         | Automated Command                                                                                                                                                                                                                            | File Exists?        |
| ---------- | ------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| FOUN-01    | No hardcoded colour values in components                | Structural / grep | `grep -r --include="*.tsx" --include="*.ts" "oklch\|hsl\|rgb\|#[0-9a-f]\{3,6\}" src/routes/ src/components/` → must return zero hits                                                                                                         | N/A (grep audit)    |
| FOUN-02    | No raw palette classes (`gray-500`, etc.) in components | Structural / grep | `grep -r --include="*.tsx" "gray-\|slate-\|zinc-\|blue-\|red-\|green-\|sky-\|stone-\|amber-\|yellow-\|lime-\|emerald-\|teal-\|cyan-\|indigo-\|purple-\|pink-\|rose-\|fuchsia-\|orange-" src/routes/ src/components/` → must return zero hits | N/A (grep audit)    |
| Phase gate | OXC tools run cleanly                                   | Tool run          | `pnpm lint && pnpm fmt:check` → exit code 0                                                                                                                                                                                                  | N/A (shell command) |
| Phase gate | App renders without errors                              | Smoke             | `pnpm dev` starts without compilation errors                                                                                                                                                                                                 | N/A (manual check)  |

### Sampling Rate

- **Per task commit:** `pnpm dev` (verify app starts)
- **Per wave merge:** `pnpm lint && pnpm fmt:check`
- **Phase gate:** All four verification commands above must pass before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements (Phase 1 verification is tooling-based, not unit-test based).

---

## Project Constraints (from CLAUDE.md)

Directives the planner must verify compliance with:

| Directive             | Constraint                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Tech Stack locked     | TanStack Start + Tailwind + shadcn + Lucide + OXC + Supabase — no deviations                     |
| Colour system         | All colours defined via a single Tailwind CSS config palette — no hardcoded values in components |
| Modularity            | Each tool self-contained — Phase 1 establishes the base, not any tool-specific code              |
| Tailwind v4           | CSS-first config; no `tailwind.config.js`; all config in `@theme` block                          |
| `tw-animate-css`      | Use `@import "tw-animate-css"` — not `tailwindcss-animate` plugin                                |
| shadcn/ui             | Init via `pnpm dlx shadcn@latest init -t start`; components copied to project                    |
| OXC                   | oxlint replaces ESLint; oxfmt replaces Prettier + prettier-plugin-tailwindcss                    |
| No `React.forwardRef` | React 19 components use plain function components with `ref` prop                                |
| No hardcoded hex/rgb  | Violates single-source-of-truth constraint                                                       |
| GSD workflow          | Changes must go through GSD (`/gsd:execute-phase`) — no direct repo edits                        |

---

## Sources

### Primary (HIGH confidence)

- `https://tailwindcss.com/docs/theme` — `@theme` block syntax, `--color-*: initial` pattern, OKLCH examples
- `https://tailwindcss.com/docs/adding-custom-styles` — `--color-{name}-{scale}` convention, custom colour registration
- `https://ui.shadcn.com/docs/tailwind-v4` — `@theme inline` pattern, OKLCH migration, `tw-animate-css` import
- `https://ui.shadcn.com/docs/installation/tanstack` — TanStack Start init command, shadcn scaffold flow
- `https://oxc.rs/docs/guide/usage/linter` — oxlint install, zero-config usage, plugin categories
- `https://oxc.rs/docs/guide/usage/formatter` — oxfmt install, `--check` mode, built-in Tailwind sorting
- npm registry (verified 2026-03-29): `@tanstack/react-start@1.167.13`, `tailwindcss@4.2.2`, `oxlint@1.57.0`, `oxfmt@0.42.0`, `lucide-react@1.7.0`, `tw-animate-css@1.4.0`

### Secondary (MEDIUM confidence)

- `https://marmelab.com/blog/2026/02/18/scaffold-your-shadcn-admin-app-with-tanstack-start.html` — Confirmed `npx @tanstack/cli create` + `npx shadcn@latest init` flow for TanStack Start 2026
- `.claude/skills/shadcn/customization.md` — `@theme inline` block structure for adding custom colours (project skill, HIGH within project context)
- `.claude/skills/shadcn/rules/styling.md` — Semantic colours, no raw palette values, no manual `dark:` overrides

### Tertiary (LOW confidence)

- WebSearch results for shadcn TanStack CSS file location — CSS file path after init varies by scaffold version; must be verified by running `pnpm dlx shadcn@latest info` after init.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions verified against npm registry 2026-03-29
- Architecture (Tailwind @theme): HIGH — verified via official Tailwind v4 docs and shadcn/ui Tailwind v4 docs
- Architecture (scaffold flow): MEDIUM — `@tanstack/cli create` + `shadcn init` flow confirmed by multiple sources but exact CSS file paths depend on interactive prompts
- OXC tooling: HIGH — official docs confirmed, zero-config approach matches CLAUDE.md recommendations
- Pitfalls: MEDIUM to HIGH — most based on official docs or known Tailwind v4 migration patterns

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable stack; oxfmt beta could change faster — re-verify if more than 1 week elapses)
