import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckSquare } from "lucide-react";
import { TodoBentoCard } from "#/routes/_layout/todos/-TodoBentoCard";
import { getTodos } from "#/routes/todos/todos.functions";

export interface ToolEntry {
  id: string;
  label: string;
  route: string;
  icon: LucideIcon;
  BentoCard: ComponentType<{ tool: ToolEntry; data: unknown }>;
  loadData?: () => Promise<unknown>;
  overviewOnly?: boolean;
}

export const tools: ToolEntry[] = [
  {
    id: "todos",
    label: "Todos",
    route: "/todos",
    icon: CheckSquare,
    BentoCard: TodoBentoCard,
    loadData: getTodos,
  },
];
