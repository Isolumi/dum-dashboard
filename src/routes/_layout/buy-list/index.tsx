import { createFileRoute } from "@tanstack/react-router";
import { BuyList } from "./-BuyList";
import { useBuyListController } from "./-useBuyListController";

export const Route = createFileRoute("/_layout/buy-list/")({ component: BuyListPage });
export function BuyListPage() {
  const controller = useBuyListController();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Buy list</h1>
        <p className="mt-1 text-sm text-muted-foreground">Things to buy.</p>
      </div>
      <BuyList controller={controller} compact={false} />
    </main>
  );
}
