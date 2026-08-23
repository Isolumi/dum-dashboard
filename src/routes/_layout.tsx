import { Outlet, createFileRoute } from "@tanstack/react-router";
import { NavbarClock } from "#/components/NavbarClock";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "#/components/ui/sidebar";
import { AppSidebar } from "#/components/AppSidebar";

export const Route = createFileRoute("/_layout")({
  component: LayoutComponent,
});

function LayoutComponent() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center border-b border-border px-4">
          <SidebarTrigger />
          <div className="ml-auto">
            <NavbarClock />
          </div>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
