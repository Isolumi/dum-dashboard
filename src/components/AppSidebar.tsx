import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "#/components/ui/sidebar";
import { Button } from "#/components/ui/button";
import { tools } from "#/tools/registry";
import type { ToolEntry } from "#/tools/registry";
import { signOut } from "#/lib/auth";

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
  const navigate = useNavigate();

  // Overview is a hardcoded entry — not in the tools registry (Research Open Question 2)
  const isOverviewActive = Boolean(matchRoute({ to: "/" }));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-3">
          <img src="/favicon.ico" alt="Dumq" className="size-6" />
          <span className="text-sm font-semibold text-neutral-100 group-data-[collapsible=icon]:hidden">
            DumQ
          </span>
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
            {tools
              .filter((tool) => !tool.overviewOnly)
              .map((tool: ToolEntry) => {
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
    </Sidebar>
  );
}
