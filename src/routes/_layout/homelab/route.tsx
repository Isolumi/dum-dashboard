import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Eye, Server } from "lucide-react";

import { HomelabTabs } from "./-HomelabTabs";

export const Route = createFileRoute("/_layout/homelab")({
  component: HomelabLayout,
});

function HomelabLayout() {
  return (
    <div className="min-w-0">
      <header className="border-b border-border bg-card/30">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-primary">
                <Server className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  dumachine
                </p>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Homelab</h1>
              </div>
            </div>
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-background/50 px-2.5 py-1 text-xs text-muted-foreground">
              <Eye className="size-3.5" aria-hidden="true" />
              Read only
            </div>
          </div>
          <HomelabTabs />
        </div>
      </header>
      <Outlet />
    </div>
  );
}
