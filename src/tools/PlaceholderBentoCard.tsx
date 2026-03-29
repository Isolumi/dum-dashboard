import { Link } from "@tanstack/react-router";
import type { ToolEntry } from "./registry";

export function PlaceholderBentoCard({ tool }: { tool: ToolEntry }) {
  return (
    <Link
      to={tool.route}
      className="block rounded-lg border border-neutral-700 bg-neutral-900 p-6 transition-colors duration-150 hover:border-violet-400"
    >
      <h3 className="text-base font-normal text-neutral-100">{tool.label}</h3>
      <p className="mt-2 text-sm text-neutral-400">Coming soon</p>
    </Link>
  );
}
