import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "#/components/ui/sidebar";
import { AppSidebar } from "#/components/AppSidebar";
import { getSession } from "#/lib/auth";

export const Route = createFileRoute("/_layout")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return; // session lives in localStorage — skip on server
    const session = await getSession();
    if (!session) throw redirect({ to: "/login" });
    if (session.user.id !== import.meta.env.VITE_OWNER_ID) {
      await import("#/lib/auth").then((m) => m.signOut());
      throw redirect({ to: "/login" });
    }
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
