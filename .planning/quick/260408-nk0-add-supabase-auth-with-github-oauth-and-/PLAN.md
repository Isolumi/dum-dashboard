---
quick_task: 260408-nk0
type: execute
autonomous: false
wave: sequential

must_haves:
  truths:
    - "Unauthenticated requests to any /_layout route redirect to /login"
    - "Clicking 'Sign in with GitHub' initiates OAuth flow and redirects back to the app"
    - "After successful OAuth, the user lands on the overview page and stays logged in across page refreshes"
    - "Visiting /login while already authenticated redirects to /"
    - "RLS is enabled on all tables — Supabase security emails stop"
    - "All existing server functions continue to work (they use supabaseAdmin which bypasses RLS)"
  artifacts:
    - path: "src/routes/login.tsx"
      provides: "Login page with GitHub OAuth button"
    - path: "src/routes/auth/callback.tsx"
      provides: "OAuth callback route that exchanges code for session"
    - path: "src/lib/supabase.ts"
      provides: "Browser Supabase client configured with persistSession: true"
  key_links:
    - from: "src/routes/_layout.tsx"
      to: "/login"
      via: "beforeLoad redirect when no session"
    - from: "src/routes/auth/callback.tsx"
      to: "supabase.auth.exchangeCodeForSession()"
      via: "URL ?code param on OAuth return"
    - from: "supabase dashboard"
      to: "todos table"
      via: "RLS enabled + allow-if-authenticated policy"

user_setup:
  - service: supabase
    why: "GitHub OAuth provider must be configured in Supabase dashboard"
    dashboard_config:
      - task: "Enable GitHub OAuth provider"
        location: "Supabase Dashboard -> Authentication -> Providers -> GitHub"
        details: "Create a GitHub OAuth App at github.com/settings/developers. Set Homepage URL to your app URL, Authorization callback URL to https://<your-supabase-project>.supabase.co/auth/v1/callback. Copy Client ID and Client Secret into Supabase."
      - task: "Add redirect URL to allow list"
        location: "Supabase Dashboard -> Authentication -> URL Configuration"
        details: "Add http://localhost:3000/auth/callback (dev) and your production URL/auth/callback to the Redirect URLs allow list."
  - service: github
    why: "GitHub OAuth App must be created to get credentials"
    dashboard_config:
      - task: "Create GitHub OAuth App"
        location: "github.com/settings/developers -> OAuth Apps -> New OAuth App"
        details: "Homepage URL: http://localhost:3000, Authorization callback URL: https://<your-supabase-project>.supabase.co/auth/v1/callback"
---

<objective>
Add GitHub OAuth authentication to the personal dashboard and enable RLS on all Supabase tables.

Purpose: The dashboard is publicly accessible right now. Adding auth makes it private. RLS enablement stops Supabase security warning emails (currently server functions use supabaseAdmin which bypasses RLS, so policies just need to exist).

Output:
- /login page with GitHub OAuth button
- /auth/callback route handling OAuth code exchange
- Route guard on /_layout that redirects unauthenticated users to /login
- RLS enabled on todos table with a permissive "authenticated users only" policy
- Existing server functions unchanged (continue using supabaseAdmin)

Architecture note: This app runs on Cloudflare Workers. `@supabase/ssr` cookie-based session handling is NOT used here — it requires Node.js `cookies()` APIs incompatible with workerd. Instead:
- Browser client uses `createClient` with default `persistSession: true` (localStorage in browser)
- Route protection uses TanStack Router's `beforeLoad` to check session client-side
- Server functions continue using `getSupabaseAdmin()` (service role key, bypasses RLS)
- RLS policies are permissive (`auth.uid() IS NOT NULL`) — they just satisfy Supabase's security requirements; enforcement happens via auth.uid() being present for browser clients and via the admin client for server functions
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@src/lib/supabase.ts
@src/lib/supabase-admin.ts
@src/lib/cf-env.ts
@src/routes/__root.tsx
@src/routes/_layout.tsx
@src/router.tsx
@vite.config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enable RLS on todos table + add permissive policy</name>
  <files>supabase/migrations/20260408_enable_rls_todos.sql</files>
  <action>
Create a SQL migration file at `supabase/migrations/20260408_enable_rls_todos.sql`.

If the `supabase/migrations/` directory does not exist, create it. Run `supabase db push` after creating the file, or note that the user must apply it manually via the Supabase dashboard SQL editor.

Migration content:

```sql
-- Enable RLS on todos table to stop security warning emails.
-- Server functions use the service role key (supabaseAdmin) which bypasses RLS,
-- so this policy only applies to browser client queries (none currently).
alter table todos enable row level security;

-- Allow any authenticated user to perform all operations.
-- This is a personal app — only one person will ever authenticate.
create policy "Authenticated users can do everything"
  on todos
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
```

After creating the file, run:
```bash
supabase db push
```

If local Supabase isn't running, the SQL can be applied via the Supabase dashboard -> SQL Editor. Add a note in the task output if applying manually.
  </action>
  <verify>
    In Supabase dashboard -> Table Editor -> todos: the RLS badge should show "RLS enabled". Or run: `supabase db diff` to confirm the migration is applied.
  </verify>
  <done>RLS is enabled on the todos table and a permissive policy exists. No Supabase security warning emails for todos.</done>
</task>

<task type="auto">
  <name>Task 2: Update browser Supabase client + create auth helper</name>
  <files>src/lib/supabase.ts, src/lib/auth.ts</files>
  <action>
**src/lib/supabase.ts** — update to use explicit session persistence options (already defaults to true, but be explicit):

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
```

**src/lib/auth.ts** — create a new file with auth helper functions used by route guards and the login/callback pages:

```typescript
import { supabase } from "./supabase";

/** Returns the current session or null. Safe to call on client only. */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}

/** Initiates GitHub OAuth redirect. */
export async function signInWithGitHub() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

/** Signs out the current user. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
```

Import boundary rule: `src/lib/auth.ts` may only be imported from route files and components (never from `*.functions.ts` server files — those use `supabase-admin.ts`).
  </action>
  <verify>
    `bun run lint` passes with no errors on src/lib/supabase.ts and src/lib/auth.ts.
  </verify>
  <done>supabase.ts has explicit auth options. auth.ts exports getSession, signInWithGitHub, signOut.</done>
</task>

<task type="auto">
  <name>Task 3: Create /login page and /auth/callback route</name>
  <files>src/routes/login.tsx, src/routes/auth/callback.tsx</files>
  <action>
**src/routes/login.tsx** — login page with GitHub OAuth button. Uses shadcn Button and Lucide icons. No layout wrapper (login is outside /_layout):

```typescript
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { getSession, signInWithGitHub } from "#/lib/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const session = await getSession();
    if (session) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    try {
      setLoading(true);
      setError(null);
      await signInWithGitHub();
      // signInWithGitHub redirects the browser — nothing to do after
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-lg border border-border bg-card p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-semibold text-foreground">DumQ</h1>
          <p className="text-sm text-muted-foreground">Sign in to access your dashboard</p>
        </div>
        {error && (
          <p className="w-full rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          className="w-full"
          onClick={handleSignIn}
          disabled={loading}
        >
          {loading ? "Redirecting..." : "Sign in with GitHub"}
        </Button>
      </div>
    </div>
  );
}
```

**src/routes/auth/callback.tsx** — handles the OAuth code exchange. Supabase's `detectSessionInUrl: true` handles this automatically when the page loads, but we still need a route to render while it processes:

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "#/lib/supabase";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase detectSessionInUrl handles the code exchange automatically.
    // Listen for the session to be established, then redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        void navigate({ to: "/", replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Signing you in...</p>
    </div>
  );
}
```
  </action>
  <verify>
    `bun run lint` passes. Both files are picked up by TanStack Router's file-based routing (check `routeTree.gen.ts` regenerates with `/login` and `/auth/callback` routes after running `bun run dev` briefly).
  </verify>
  <done>/login renders a GitHub sign-in button. /auth/callback renders a loading state and redirects on SIGNED_IN event.</done>
</task>

<task type="auto">
  <name>Task 4: Add route guard to /_layout and sign-out button</name>
  <files>src/routes/_layout.tsx, src/components/AppSidebar.tsx</files>
  <action>
**src/routes/_layout.tsx** — add `beforeLoad` to redirect unauthenticated users to `/login`:

```typescript
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "#/components/ui/sidebar";
import { AppSidebar } from "#/components/AppSidebar";
import { getSession } from "#/lib/auth";

export const Route = createFileRoute("/_layout")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: LayoutComponent,
});

function LayoutComponent() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center border-b border-border px-4">
          <SidebarTrigger />
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
```

**src/components/AppSidebar.tsx** — read the existing file first, then add a sign-out button at the bottom of the sidebar. Import `signOut` from `#/lib/auth` and `useNavigate` from `@tanstack/react-router`. Add a button (using shadcn Button variant="ghost") in the sidebar footer area. On click: call `signOut()` then navigate to `/login`. Keep all existing sidebar content intact — only add the footer sign-out element.

Use `SidebarFooter` from `#/components/ui/sidebar` if it's already used, otherwise wrap in a div with `class="mt-auto p-2"` inside the sidebar. Use the `LogOut` icon from `lucide-react`.

Example footer addition (adapt to match existing AppSidebar structure):
```tsx
<SidebarFooter>
  <Button
    variant="ghost"
    size="sm"
    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
    onClick={async () => {
      await signOut();
      void navigate({ to: "/login" });
    }}
  >
    <LogOut className="h-4 w-4" />
    Sign out
  </Button>
</SidebarFooter>
```
  </action>
  <verify>
    `bun run lint` passes. Manual check: open app in browser while unauthenticated — should land on /login. After auth, /login should redirect to /.
  </verify>
  <done>/_layout redirects to /login when no session. AppSidebar has a sign-out button that clears session and redirects to /login.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    - RLS enabled on todos table with authenticated-only policy
    - Browser Supabase client updated with explicit session persistence
    - /login page with GitHub OAuth button
    - /auth/callback route handling session establishment
    - /_layout route guard redirecting unauthenticated users
    - AppSidebar sign-out button
  </what-built>
  <how-to-verify>
    Pre-requisite: Complete user setup steps above (GitHub OAuth App + Supabase provider config + redirect URL allow list) before testing.

    1. Clear localStorage and visit http://localhost:3000 — should redirect to /login
    2. Visit http://localhost:3000/todos directly — should redirect to /login
    3. Click "Sign in with GitHub" on /login — should redirect to GitHub OAuth consent page
    4. Approve the OAuth app on GitHub — should redirect back to /auth/callback then to /
    5. Refresh the page — should stay on / (session persisted)
    6. Click "Sign out" in sidebar — should redirect to /login
    7. Visit http://localhost:3000 again — should redirect to /login (session cleared)
    8. Check Supabase dashboard -> todos table -> RLS badge shows "enabled"
  </how-to-verify>
  <resume-signal>Type "approved" if all steps pass, or describe any issues found</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /_layout routes | Unauthenticated browser requests must not see dashboard content |
| browser → Supabase Auth | OAuth code exchange happens via Supabase's servers; callback URL must be in allow list |
| browser → Supabase DB (direct) | Browser client uses anon key; RLS prevents unauthenticated reads if browser ever queries directly |
| server functions → Supabase DB | Service role key bypasses RLS; restricted to server-only execution via createServerFn |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-auth-01 | Spoofing | /auth/callback | mitigate | Supabase validates OAuth state parameter internally; code exchange happens server-side at Supabase; PKCE is used by default in supabase-js v2 |
| T-auth-02 | Elevation of Privilege | todos RLS policy | mitigate | `auth.uid() IS NOT NULL` ensures only authenticated sessions can read/write via browser client; service role key never exposed to client bundle |
| T-auth-03 | Information Disclosure | VITE_SUPABASE_PUBLISHABLE_KEY | accept | Anon/publishable key is designed to be public; RLS is the enforcement layer (now enabled) |
| T-auth-04 | Elevation of Privilege | SUPABASE_SECRET_KEY | mitigate | Secret key only in Cloudflare Worker binding (wrangler secret), never in VITE_ prefix vars, never in client bundle |
| T-auth-05 | Spoofing | /login beforeLoad | accept | Personal app — attacker would need GitHub account; GitHub OAuth handles identity verification |
| T-auth-06 | Denial of Service | supabase.auth.getSession() in beforeLoad | accept | Session check is a local storage read (fast); not a network call unless token needs refresh |
</threat_model>

<verification>
- `bun run lint` passes with zero violations after all tasks
- `bun run test` passes (existing tests unchanged; no new test surface for auth UI)
- RLS badge visible on todos table in Supabase dashboard
- Full OAuth flow works end-to-end (GitHub -> callback -> dashboard)
- Session persists across page refresh (localStorage-backed)
- Sign-out clears session and redirects to /login
</verification>

<success_criteria>
- Unauthenticated users cannot access any /_layout route — always land on /login
- GitHub OAuth round-trip completes successfully
- Session survives page refresh without re-login
- Supabase security warning emails stop (RLS enabled on todos)
- All existing todo CRUD and realtime features continue to work
- `bun run lint` zero violations
</success_criteria>

<output>
After completion, create `.planning/quick/260408-nk0-add-supabase-auth-with-github-oauth-and-/SUMMARY.md` following the standard summary template.
</output>
