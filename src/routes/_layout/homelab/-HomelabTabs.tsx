import { Link, useRouterState } from "@tanstack/react-router";

import { tools } from "#/tools/registry";

function normalizePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

export function HomelabTabs() {
  const pathname = useRouterState({ select: (state) => normalizePath(state.location.pathname) });
  const children = tools.find((tool) => tool.id === "homelab")?.children ?? [];

  return (
    <nav aria-label="Homelab sections" className="no-scrollbar -mx-1 overflow-x-auto px-1">
      <div className="flex min-w-max items-center gap-1" role="list">
        {children.map((child) => {
          const isOverview = child.route === "/homelab";
          const isActive = isOverview
            ? pathname === child.route
            : pathname === child.route || pathname.startsWith(`${child.route}/`);

          return (
            <div role="listitem" key={child.id}>
              <Link
                // These registered future child paths are implemented by Tasks 11-12.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                to={child.route as any}
                aria-current={isActive ? "page" : undefined}
                data-active={isActive || undefined}
                className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active]:bg-accent data-[active]:text-foreground data-[active]:hover:bg-accent data-[active]:hover:text-foreground motion-reduce:transition-none"
              >
                {child.label}
              </Link>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
