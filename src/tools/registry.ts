import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckSquare } from "lucide-react";
import { PlaceholderBentoCard } from "./PlaceholderBentoCard";

export interface ToolEntry {
  id: string;
  label: string;
  route: string;
  icon: LucideIcon;
  BentoCard: ComponentType<{ tool: ToolEntry; data: unknown }>;
  loadData?: () => Promise<unknown>;
}

export const tools: ToolEntry[] = [
  {
    id: "todos",
    label: "Todos",
    route: "/todos",
    icon: CheckSquare,
    BentoCard: PlaceholderBentoCard,
  },
];
