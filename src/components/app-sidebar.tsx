"use client";

import {
  CoinsIcon,
  HouseIcon,
  ListHeartIcon,
  PaletteIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const sidebarItems = [
  {
    label: "HOUS",
    href: "/",
    icon: HouseIcon,
  },
  {
    label: "MONIES",
    href: "/monies",
    icon: CoinsIcon,
  },
  {
    label: "DUMDO",
    href: "/dumdo",
    icon: ListHeartIcon,
  },
  {
    label: "COLORS",
    href: "/colors",
    icon: PaletteIcon,
  },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>DUM Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
