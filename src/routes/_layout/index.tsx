import { createFileRoute } from "@tanstack/react-router";
import { tools } from "#/tools/registry";

export const Route = createFileRoute("/_layout/")({
  errorComponent: OverviewError,
  component: OverviewPage,
});

function OverviewError() {
  return (
    <main className="p-6">
      <p className="text-sm text-destructive">Could not load overview. Refresh to try again.</p>
    </main>
  );
}

function OverviewPage() {
  const [firstTool, ...remainingTools] = tools;

  return (
    <main className="p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr] md:gap-6">
        {firstTool && <firstTool.BentoCard tool={firstTool} data={undefined} />}
        {remainingTools.length > 0 && (
          <div className="flex flex-col gap-4 md:gap-6">
            {remainingTools.map((tool) => (
              <tool.BentoCard key={tool.id} tool={tool} data={undefined} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
