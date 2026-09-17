import { Link } from "@tanstack/react-router";
import type { ToolEntry } from "#/tools/registry";
import { BuyList } from "./-BuyList";
import { useBuyListController } from "./-useBuyListController";

export function BuyListBentoCard({ tool: _tool, data: _data }: { tool: ToolEntry; data: unknown }) {
  const controller = useBuyListController();
  return (
    <section aria-label="Buy list" className="rounded-lg border border-border bg-card p-4">
      <Link
        to="/buy-list"
        className="mb-3 inline-flex rounded-sm text-sm font-semibold text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        Buy list
      </Link>
      <BuyList controller={controller} compact />
    </section>
  );
}
