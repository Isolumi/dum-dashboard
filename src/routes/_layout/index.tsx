import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "#/components/ui/skeleton";
import { tools } from "#/tools/registry";

export const Route = createFileRoute("/_layout/")({
  loader: async () => {
    const results = await Promise.all(
      tools.map((tool) => tool.loadData?.() ?? Promise.resolve(null)),
    );
    const toolData: Record<string, unknown> = {};
    tools.forEach((tool, i) => {
      toolData[tool.id] = results[i];
    });
    return { toolData };
  },
  pendingComponent: OverviewLoading,
  errorComponent: OverviewError,
  component: OverviewPage,
});

function OverviewLoading() {
  return (
    <main className="p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr] md:gap-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <Skeleton className="mb-4 h-4 w-24" />
          <Skeleton className="mb-3 h-4 w-40" />
          <Skeleton className="mb-2 h-3 w-32" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-6 gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
      </div>
    </main>
  );
}

function OverviewError() {
  return (
    <main className="p-6">
      <p className="text-sm text-destructive">Could not load overview. Refresh to try again.</p>
    </main>
  );
}

function OverviewPage() {
  const { toolData } = Route.useLoaderData();
  const [firstTool, ...remainingTools] = tools;

  return (
    <main className="p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr] md:gap-6">
        {firstTool && (
          <firstTool.BentoCard tool={firstTool} data={toolData[firstTool.id]} />
        )}
        {remainingTools.length > 0 && (
          <div className="flex flex-col gap-4 md:gap-6">
            {remainingTools.map((tool) => (
              <tool.BentoCard key={tool.id} tool={tool} data={toolData[tool.id]} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
