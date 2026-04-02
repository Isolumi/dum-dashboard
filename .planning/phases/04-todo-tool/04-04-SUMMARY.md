---
plan: 04-04
phase: 04-todo-tool
status: complete
completed: 2026-04-01
---

# Plan 04-04 Summary: Fix Supabase Credentials

## What was done

Resolved the two credential problems blocking `/todos` from loading:

1. **URL fixed**: `VITE_SUPABASE_URL` updated to include `https://` prefix in `.env.local`
2. **Secret key added**: `SUPABASE_SECRET_KEY` added to `.env.local` (server-only, no VITE_ prefix)
3. **Admin client created**: `src/lib/supabase-admin.ts` created using `process.env.SUPABASE_SECRET_KEY` — bypasses RLS for all server functions
4. **todos.functions.ts updated**: All 5 server functions now use `supabaseAdmin` instead of the publishable-key client
5. **Vitest stubs updated**: `SUPABASE_SECRET_KEY: "test-secret"` added to unit project env in `vitest.config.ts`

## RLS Decision

RLS is enabled on the `todos` table. Server functions bypass it via the secret key — no per-user policies needed for this personal tool.

## Verification

- `tsc --noEmit` exits 0
- `bun run test` — 24/24 unit tests pass
- `SUPABASE_SECRET_KEY` is NOT VITE_-prefixed — confirmed not in client bundle

## Key files

- Created: `src/lib/supabase-admin.ts`
- Modified: `src/routes/todos/todos.functions.ts`
- Modified: `vitest.config.ts`
- Modified: `.env.local` (URL prefix + secret key)
