import { Link } from "@tanstack/react-router";
import type { ToolEntry } from "./registry";

export function PlaceholderBentoCard({ tool }: { tool: ToolEntry; data: unknown }) {
  return (
    <Link
      to={tool.route}
      className="block rounded-lg border border-border bg-card p-6 transition-colors duration-150 hover:border-primary/50"
    >
      <h3 className="text-base font-normal text-foreground">{tool.label}</h3>
      <p className="mt-2 text-sm text-muted-foreground">Coming soon</p>
    </Link>
  );
}
