# External Integrations

**Analysis Date:** 2026-02-20

## APIs & External Services

**Not detected** - Codebase does not currently integrate with external APIs or third-party services.

## Data Storage

**Databases:**
- Not detected - No database integration present

**File Storage:**
- Cloudflare R2 (optional, currently disabled)
  - Connection: Configured via `open-next.config.ts`
  - Status: Commented out, not active
  - Usage: Optional incremental cache storage for Next.js

**Caching:**
- Cloudflare Workers service binding for self-reference caching
  - Binding: WORKER_SELF_REFERENCE
  - Configuration: `wrangler.jsonc` service binding
  - Status: Configured but implementation not yet active

## Static Assets & Images

**Assets Binding:**
- Cloudflare Workers ASSETS binding
  - Directory: `.open-next/assets`
  - Purpose: Serve static files from generated build artifacts

**Image Optimization:**
- Cloudflare Image Optimization service (optional)
  - Binding: IMAGES
  - Configuration: `wrangler.jsonc` images configuration
  - Status: Configured but disabled (commented in `open-next.config.ts`)
  - Reference: https://opennext.js.org/cloudflare/howtos/image

## Authentication & Identity

**Auth Provider:**
- Not detected - No authentication system implemented

## Monitoring & Observability

**Observability:**
- Cloudflare Workers observability
  - Status: Enabled in `wrangler.jsonc`
  - Platform: Cloudflare Workers built-in observability

**Error Tracking:**
- Not configured

**Logs:**
- Cloudflare Workers standard logging (automatic via observability setting)

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers platform
  - Worker name: "dum-dashboard"
  - Compatibility date: 2025-12-01
  - Configuration: `wrangler.jsonc`

**Deployment Tools:**
- OpenNext Cloudflare adapter (@opennextjs/cloudflare 1.16.0)
  - Entry point: `.open-next/worker.js` (Next.js compiled to Cloudflare Worker)
- wrangler CLI v4.60.0
  - Commands: deploy, upload, preview
  - Scripts in `package.json`: deploy, upload, preview

**CI Pipeline:**
- Not detected - No CI/CD workflow files found

## Environment Configuration

**Required env vars:**
- `NEXTJS_ENV` - Set to "development" in `.dev.vars` for development environment

**Secrets location:**
- `.dev.vars` - Local development environment variables (Git-ignored)
- Wrangler secrets (per Cloudflare Workers documentation)
- Note: Bun automatically loads `.env` files (per `CLAUDE.md` project instructions)

## Webhooks & Callbacks

**Incoming:**
- Not detected

**Outgoing:**
- Not detected

## Optional Features (Not Currently Active)

**Cloudflare R2 Integration:**
- Import available: `@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache`
- Purpose: Enable R2 cache for Next.js incremental static regeneration
- Reference: https://opennext.js.org/cloudflare/caching

## Framework Integration

**Next.js with Cloudflare:**
- Adapter: @opennextjs/cloudflare 1.16.0
- Server-Side Rendering (SSR): Enabled via Cloudflare Workers
- Static Generation: Supported via incremental cache (optional R2)
- Image Optimization: Available via Cloudflare Image Optimization (optional)
- Dev environment: OpenNext dev mode enabled in `next.config.ts` via `initOpenNextCloudflareForDev()`

---

*Integration audit: 2026-02-20*
