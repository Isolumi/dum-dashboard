---
status: awaiting_human_verify
trigger: "Tab favicon not loading from /favicon.ico despite link tag being added to __root.tsx head links array"
created: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED — Browser cache holds old /favicon.ico. Fix applied: added ?v=1 cache-bust query and sizes="16x16" to the icon link in __root.tsx.
test: Applied fix, awaiting user verification in browser
expecting: Browser tab shows the custom favicon after hard refresh or new tab
next_action: await human verification

## Symptoms

expected: Browser tab should show the custom favicon from /favicon.ico
actual: Tab favicon is not using the file — still showing default/wrong icon
errors: None reported
reproduction: Run dev server, observe browser tab
started: After adding { rel: "icon", href: "/favicon.ico", type: "image/x-icon" } to the links array in src/routes/__root.tsx head() function

## Eliminated

- hypothesis: Code path from head() → match.links → HeadContent → Asset → <link> is broken
  evidence: Traced through headContentUtils.js, Asset.js, ssr-client.js, load-matches.js — all correctly propagate links array entries as <link rel="icon" ...> tags
  timestamp: 2026-04-02T00:00:30Z

- hypothesis: favicon.ico file is missing or invalid
  evidence: file command confirms "MS Windows icon resource - 1 icon, 16x16"; Python analysis confirms valid ICO with 4-color palette (black/white/red/gray) and AND mask; actual pixel grid shows visible content
  timestamp: 2026-04-02T00:00:45Z

- hypothesis: favicon.ico file is blank/invisible
  evidence: Python parse of XOR pixel data shows indices 0-3 forming a clear pattern (not all zeros); AND mask shows proper transparency at edges with opaque center content
  timestamp: 2026-04-02T00:00:50Z

- hypothesis: TanStack Start dev server doesn't serve public/ directory
  evidence: Vite default publicDir is "public"; no vite.config.ts override; Cloudflare plugin doesn't modify publicDir
  timestamp: 2026-04-02T00:00:55Z

## Evidence

- timestamp: 2026-04-02T00:00:10Z
  checked: src/routes/__root.tsx
  found: Correct link tag present: { rel: "icon", href: "/favicon.ico", type: "image/x-icon" } in head() links array; HeadContent rendered in <head>
  implication: Code is syntactically and structurally correct

- timestamp: 2026-04-02T00:00:20Z
  checked: public/favicon.ico
  found: Valid 16x16 ICO file, 1406 bytes; replaced the 3870-byte original in the rebrand commit de46269
  implication: File exists and is a proper ICO

- timestamp: 2026-04-02T00:00:30Z
  checked: node_modules/@tanstack/router-core/dist/esm/load-matches.js and ssr-client.js
  found: executeHead() calls head() and sets match.links; client-side executeHead() is called during router.load() for all routes including root
  implication: The link tag WILL be emitted in the rendered HTML

- timestamp: 2026-04-02T00:00:40Z
  checked: node_modules/@tanstack/router-core/dist/esm/headContentUtils.js
  found: useTags() maps match.links items to { tag: "link", attrs: { ...link, nonce } }; Asset component renders these as <link> elements
  implication: The <link rel="icon"> tag IS being rendered

- timestamp: 2026-04-02T00:00:50Z
  checked: git log for public/favicon.ico
  found: Previous favicon was 3870 bytes (React/TanStack scaffold default). Before the rebrand commit, there was NO <link rel="icon"> tag — browsers auto-fetched /favicon.ico. Browser cached the old favicon.
  implication: Browser is likely showing the old cached /favicon.ico. The new link tag doesn't override the cache for the exact same URL.

- timestamp: 2026-04-02T00:01:00Z
  checked: ICO pixel data via Python struct analysis
  found: Palette: black(0), white(1), red(2), gray(3). XOR mask shows a clear icon pattern. AND mask shows transparent edges with opaque center. Icon has visible content.
  implication: The favicon file is not blank — it has actual visual content

## Resolution

root_cause: Browser cache holds the old /favicon.ico (React/TanStack scaffold default, 3870 bytes) from before the rebrand. Adding a <link rel="icon" href="/favicon.ico"> tag doesn't force re-fetch since browsers aggressively cache favicons by URL, and the URL hasn't changed. Additionally, the link tag was missing a `sizes` attribute.
fix: Added sizes="16x16" and href="/favicon.ico?v=1" (cache-bust query) to the icon link tag in src/routes/__root.tsx
verification:
files_changed: [src/routes/__root.tsx]
