import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
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
        <Button className="w-full" onClick={handleSignIn} disabled={loading}>
          {loading ? "Redirecting..." : "Sign in with GitHub"}
        </Button>
      </div>
    </div>
  );
}
