---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - vite.config.ts
  - wrangler.jsonc
autonomous: true
requirements: []
must_haves:
  truths:
    - "bun run build produces a Cloudflare Workers-compatible output"
    - "wrangler.jsonc exists with nodejs_compat flag and correct project name"
    - "vite.config.ts includes @cloudflare/vite-plugin before tanstackStart plugin"
  artifacts:
    - path: "wrangler.jsonc"
      provides: "Cloudflare Workers deployment configuration"
      contains: "nodejs_compat"
    - path: "vite.config.ts"
      provides: "Vite config with Cloudflare plugin"
      contains: "cloudflare"
    - path: "package.json"
      provides: "Cloudflare dev dependencies"
      contains: "wrangler"
  key_links:
    - from: "vite.config.ts"
      to: "@cloudflare/vite-plugin"
      via: "import and plugin registration"
      pattern: "cloudflare"
    - from: "wrangler.jsonc"
      to: "vite.config.ts"
      via: "wrangler reads vite config for Workers build"
      pattern: "nodejs_compat"
---

<objective>
Add Cloudflare Workers deployment support to the TanStack Start project.

Purpose: Enable deploying the dashboard to Cloudflare Workers edge network for fast, globally distributed hosting.
Output: Updated vite.config.ts with Cloudflare plugin, new wrangler.jsonc config, and deployment dependencies installed.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@vite.config.ts
@package.json
@tsconfig.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Cloudflare dependencies and create wrangler.jsonc</name>
  <files>package.json, wrangler.jsonc</files>
  <action>
1. Install `@cloudflare/vite-plugin` as a dev dependency and `wrangler` as a dev dependency:
   ```
   bun add -D @cloudflare/vite-plugin wrangler
   ```

2. Create `wrangler.jsonc` at the project root with the following content:
   - `$schema`: `"node_modules/wrangler/config-schema.json"`
   - `name`: `"dum-dashboard"`
   - `compatibility_date`: `"2025-12-30"` (recent stable date)
   - `compatibility_flags`: `["nodejs_compat"]`
   - No `main` or `assets` fields -- the `@cloudflare/vite-plugin` handles build output routing automatically when used with Vite

Keep the config minimal. The Cloudflare Vite plugin reads this file and handles the rest.
  </action>
  <verify>
    <automated>test -f wrangler.jsonc && bun run --bun node -e "const fs = require('fs'); const c = fs.readFileSync('wrangler.jsonc','utf8').replace(/\/\/.*/g,'').replace(/\/\*[\s\S]*?\*\//g,''); const j = JSON.parse(c); if(!j.compatibility_flags.includes('nodejs_compat')) process.exit(1); console.log('OK')"</automated>
  </verify>
  <done>wrangler.jsonc exists with nodejs_compat flag; @cloudflare/vite-plugin and wrangler are in devDependencies</done>
</task>

<task type="auto">
  <name>Task 2: Add Cloudflare Vite plugin to vite.config.ts and add deploy script</name>
  <files>vite.config.ts, package.json</files>
  <action>
1. In `vite.config.ts`:
   - Add import: `import { cloudflare } from "@cloudflare/vite-plugin";`
   - Add `cloudflare()` to the plugins array. Place it AFTER `tanstackStart()` and `viteReact()` -- at the END of the plugins array. The Cloudflare Vite plugin must come after the framework plugins so it can wrap their output for Workers.
   - Do NOT remove or reorder any existing plugins.

2. In `package.json`, add two scripts:
   - `"deploy": "vite build && wrangler deploy"` -- builds and deploys to Cloudflare Workers
   - `"preview:worker": "vite build && wrangler dev"` -- builds and runs locally in Workers runtime for testing

The final plugins array order should be:
```ts
plugins: [
  devtools(),
  tsconfigPaths({ projects: ["./tsconfig.json"] }),
  tailwindcss(),
  tanstackStart({ router: { routeFileIgnorePattern: "\\.functions\\.ts$" } }),
  viteReact(),
  cloudflare(),
],
```
  </action>
  <verify>
    <automated>bun run build 2>&1 | tail -5</automated>
  </verify>
  <done>vite.config.ts has cloudflare() plugin at end of plugins array; package.json has deploy and preview:worker scripts; bun run build completes without errors</done>
</task>

</tasks>

<verification>
1. `bun run build` completes successfully (no plugin errors, no missing dependency errors)
2. `wrangler.jsonc` is valid JSON with comments and contains `nodejs_compat`
3. `vite.config.ts` imports and uses `cloudflare()` from `@cloudflare/vite-plugin`
4. `package.json` contains `deploy` and `preview:worker` scripts
</verification>

<success_criteria>
- Build succeeds with Cloudflare Workers target
- All three files (wrangler.jsonc, vite.config.ts, package.json) are correctly configured
- No existing functionality is broken (dev server still works)
</success_criteria>

<output>
After completion, create `.planning/quick/260402-tcs-add-cloudflare-workers-deployment-suppor/260402-tcs-SUMMARY.md`
</output>
