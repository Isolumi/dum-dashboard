import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Camera, CheckSquare, Clock, Server, WalletCards } from "lucide-react";
import { TodoBentoCard } from "#/routes/_layout/todos/-TodoBentoCard";
import { ClockBentoCard } from "#/tools/ClockBentoCard";
import { CalendarBentoCard } from "#/routes/_layout/calendar/-CalendarBentoCard";
import { MoniesBentoCard } from "#/routes/_layout/monies/-MoniesBentoCard";
import { HomelabBentoCard } from "#/routes/_layout/homelab/-HomelabBentoCard";
import { CameraBentoCard } from "#/routes/_layout/cameras/-CameraBentoCard";
import { getHomelabOverview } from "#/homelab/homelab.functions";

export interface ToolEntry {
  id: string;
  label: string;
  route: string;
  icon: LucideIcon;
  BentoCard: ComponentType<{ tool: ToolEntry; data: unknown }>;
  loadData?: () => Promise<unknown>;
  overviewOnly?: boolean;
  children?: Array<{ id: string; label: string; route: string }>;
}

export const tools: ToolEntry[] = [
  {
    id: "todos",
    label: "Todos",
    route: "/todos",
    icon: CheckSquare,
    BentoCard: TodoBentoCard,
  },
  {
    id: "clock",
    label: "Clock",
    route: "/",
    icon: Clock,
    BentoCard: ClockBentoCard,
    overviewOnly: true,
  },
  {
    id: "cameras",
    label: "Cameras",
    route: "/cameras",
    icon: Camera,
    BentoCard: CameraBentoCard,
  },
  {
    id: "calendar",
    label: "Calendar",
    route: "/calendar",
    icon: CalendarDays,
    BentoCard: CalendarBentoCard,
  },
  {
    id: "monies",
    label: "Monies",
    route: "/monies",
    icon: WalletCards,
    BentoCard: MoniesBentoCard,
  },
  {
    id: "homelab",
    label: "Homelab",
    route: "/homelab",
    icon: Server,
    BentoCard: HomelabBentoCard,
    loadData: getHomelabOverview,
    children: [
      { id: "overview", label: "Overview", route: "/homelab" },
      { id: "cluster", label: "Cluster", route: "/homelab/cluster" },
      { id: "deployments", label: "Deployments", route: "/homelab/deployments" },
      { id: "services", label: "Services", route: "/homelab/services" },
    ],
  },
];
