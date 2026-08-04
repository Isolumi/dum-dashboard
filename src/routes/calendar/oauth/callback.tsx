import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { completeCalendarOAuth } from "#/routes/_layout/calendar/-calendar.functions";

export const Route = createFileRoute("/calendar/oauth/callback")({
  component: CalendarOAuthCallback,
});

function CalendarOAuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code || !state) {
      setError("Google did not return the expected calendar connection parameters.");
      return;
    }

    void completeCalendarOAuth({ data: { code, state } })
      .then(() => {
        window.location.href = "/calendar";
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Calendar connection failed.");
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {error ? (
        <div className="max-w-md rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-semibold">Calendar connection failed</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Connecting Google Calendar...</p>
      )}
    </div>
  );
}
