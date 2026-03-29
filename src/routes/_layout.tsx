import { Outlet, createFileRoute } from "@tanstack/react-router";
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
        <header className="flex h-12 shrink-0 items-center border-b border-neutral-700 px-4">
          <SidebarTrigger />
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
