import { Link, useMatchRoute } from "@tanstack/react-router";
import { LayoutDashboard, LayoutGrid } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "#/components/ui/sidebar";
import { tools } from "#/tools/registry";
import type { ToolEntry } from "#/tools/registry";

function NavItem({
  tool,
  isActive,
}: {
  tool: { label: string; route: string; icon: React.ComponentType };
  isActive: boolean;
}) {
  const Icon = tool.icon;
  return (
    <SidebarMenuButton
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render={<Link to={tool.route as any} />}
      isActive={isActive}
      tooltip={tool.label}
    >
      <Icon />
      <span>{tool.label}</span>
    </SidebarMenuButton>
  );
}

export function AppSidebar() {
  const matchRoute = useMatchRoute();

  // Overview is a hardcoded entry — not in the tools registry (Research Open Question 2)
  const isOverviewActive = Boolean(matchRoute({ to: "/" }));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-3">
          <LayoutDashboard className="size-6 text-neutral-100" />
          <span className="text-sm font-semibold text-neutral-100">Dashboard</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {/* Overview — hardcoded, always first */}
            <SidebarMenuItem>
              <NavItem
                tool={{ label: "Overview", route: "/", icon: LayoutGrid }}
                isActive={isOverviewActive}
              />
            </SidebarMenuItem>

            {/* Tool entries — driven by registry (FOUN-03) */}
            {tools.map((tool: ToolEntry) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const isActive = Boolean(matchRoute({ to: tool.route as any }));
              return (
                <SidebarMenuItem key={tool.id}>
                  <NavItem tool={tool} isActive={isActive} />
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
