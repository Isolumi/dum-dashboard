---
status: awaiting_human_verify
trigger: "After switching from a deploy script to a Cloudflare CD pipeline (push to v1 branch), the app fails in production with 'supabaseUrl is required' — environment variables are not available at runtime."
created: 2026-04-03T00:00:00Z
updated: 2026-04-03T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED
test: ran `bun run build` — succeeded with all three env vars inlined into the server bundle
expecting: user confirms production deployment works after setting env vars in Cloudflare Pages dashboard
next_action: user action — set env vars in Cloudflare Pages dashboard and redeploy

## Symptoms

expected: App works in production with Supabase connected
actual: Runtime error "supabaseUrl is required" — env vars are undefined in production
errors: "supabaseUrl is required" (from @supabase/supabase-js when URL is undefined)
reproduction: Push to v1 branch → Cloudflare auto-builds and deploys → production site throws error
started: Worked before with deploy script; broke after switching to CD pipeline on push
platform: Cloudflare Pages (triggered on push to v1 branch)
env_vars_setup: .env.local for local dev; `wrangler secret` used for production (likely the wrong mechanism for Pages)

## Eliminated

- hypothesis: "env var names are wrong (missing VITE_ prefix)"
  evidence: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are already correctly named and accessed in supabase.ts (client-side). Naming is not the root cause.
  timestamp: 2026-04-03T00:01:00Z

## Evidence

- timestamp: 2026-04-03T00:01:00Z
  checked: src/lib/supabase.ts
  found: Uses `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` — correct VITE_ prefix for Vite client-side inlining
  implication: Fine for the client bundle. VITE_ prefix means Vite inlines at build time.

- timestamp: 2026-04-03T00:01:00Z
  checked: src/lib/supabase-admin.ts
  found: Uses `import.meta.env.VITE_SUPABASE_URL` for the URL and `process.env.SUPABASE_SECRET_KEY` for the secret key. This file is used exclusively in createServerFn handlers (server-side only).
  implication: (1) `process.env` does not exist in Cloudflare Workers runtime. (2) `import.meta.env.VITE_*` in the SSR/Worker bundle is inlined at build time, so if absent during the Pages build, it becomes undefined permanently.

- timestamp: 2026-04-03T00:01:00Z
  checked: wrangler.jsonc
  found: No `vars` section defined. wrangler.jsonc has zero environment variable definitions.
  implication: Even if `wrangler secret put` were used, it only applies to Workers deployments via `wrangler deploy`. Pages reads env vars from the Pages dashboard.

- timestamp: 2026-04-03T00:01:00Z
  checked: dist/server/wrangler.json (generated build artifact)
  found: `"vars": {}` — empty. No vars are being passed to the Worker runtime.
  implication: Confirms no vars flow through to the deployed Worker.

- timestamp: 2026-04-03T00:01:00Z
  checked: package.json scripts
  found: `"deploy": "vite build && wrangler deploy"` — old script used `wrangler deploy` (Cloudflare Workers). New CD pipeline targets Cloudflare Pages — completely different product.
  implication: `wrangler secret put` worked with the old Workers deploy. It is completely ineffective for Cloudflare Pages deployments.

- timestamp: 2026-04-03T00:01:00Z
  checked: vite/loadEnv source + @cloudflare/vite-plugin source
  found: Vite's `loadEnv` only includes vars matching `envPrefix` (default: `VITE_`). `SUPABASE_SECRET_KEY` (no VITE_ prefix) would not be included in config.env → not inlined into import.meta.env. The @cloudflare/vite-plugin only loads CLOUDFLARE_-prefixed vars additionally.
  implication: The fix requires adding `SUPABASE_` to Vite's `envPrefix` so `SUPABASE_SECRET_KEY` gets inlined from the build environment.

- timestamp: 2026-04-03T00:02:00Z
  checked: dist/server/assets/todos.functions-*.js after applying fix
  found: `sb_secret` value appears in the bundle — SUPABASE_SECRET_KEY was correctly inlined
  implication: Fix is working correctly in the local build.

## Resolution

root_cause: Three compounding failures when switching from Cloudflare Workers (`wrangler deploy`) to Cloudflare Pages CD:
  (1) `wrangler secret put` targets Workers only — completely invisible to Cloudflare Pages builds. Pages env vars must be set in the Pages dashboard.
  (2) VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be present during `vite build` for Vite to inline them. With no env vars in Pages, they were inlined as undefined.
  (3) `process.env.SUPABASE_SECRET_KEY` in supabase-admin.ts does not work in Cloudflare Workers runtime — `process.env` is a Node.js API unavailable in the Worker global scope. Additionally, `SUPABASE_SECRET_KEY` was excluded from Vite's import.meta.env because the default envPrefix is `VITE_` only.

fix:
  CODE CHANGES applied:
    - src/lib/supabase-admin.ts: replaced `process.env.SUPABASE_SECRET_KEY` with `import.meta.env.SUPABASE_SECRET_KEY`
    - vite.config.ts: added `envPrefix: ["VITE_", "SUPABASE_"]` so Vite inlines SUPABASE_* vars from the build environment into the SSR bundle
    - .env.example: added SUPABASE_SECRET_KEY documentation
  USER ACTION STILL REQUIRED:
    In Cloudflare Pages dashboard → project → Settings → Environment variables, add for Production:
      - VITE_SUPABASE_URL = <your supabase URL>
      - VITE_SUPABASE_PUBLISHABLE_KEY = <your anon/publishable key>
      - SUPABASE_SECRET_KEY = <your service-role key>  (mark as encrypted/secret)
    Then trigger a new deployment (or push to v1 branch again).

verification: `bun run build` succeeds. dist/server/assets/todos.functions-*.js contains the inlined secret key value, confirming Vite correctly picks it up from .env.local via the new SUPABASE_ envPrefix.
files_changed: [src/lib/supabase-admin.ts, vite.config.ts, .env.example]
