import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "#/lib/supabase";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // detectSessionInUrl:true exchanges the PKCE code and cleans the URL
    // during Supabase client init — before this effect runs. The session is
    // already established. Just check for it, or wait for SIGNED_IN.
    void supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      if (session) {
        window.location.href = "/";
        return;
      }
      // Exchange not yet complete — wait for the event
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, s) => {
        if (event === "SIGNED_IN" && s) {
          window.location.href = "/";
        }
      });
      // Timeout so we don't spin forever if something went wrong upstream
      const timer = setTimeout(() => {
        setError("Sign-in timed out. Check the browser console for details.");
      }, 10000);
      return () => {
        subscription.unsubscribe();
        clearTimeout(timer);
      };
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {error ? (
        <div className="max-w-md rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-semibold">Auth error</p>
          <p className="mt-1 font-mono text-xs break-all">{error}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      )}
    </div>
  );
}
