import { createFileRoute } from "@tanstack/react-router";
import { tools } from "#/tools/registry";

export const Route = createFileRoute("/_layout/")({
  loader: loadToolData,
  errorComponent: OverviewError,
  component: OverviewPage,
});

function loadToolData(): Record<string, unknown> {
  return {};
}

function OverviewError() {
  return (
    <div className="p-6">
      <h1 className="sr-only">Overview</h1>
      <p className="text-sm text-destructive">Could not load overview. Refresh to try again.</p>
    </div>
  );
}

function OverviewPage() {
  const [firstTool, ...remainingTools] = tools;
  const toolData = Route.useLoaderData();

  return (
    <div className="p-6">
      <h1 className="sr-only">Overview</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr] md:gap-6">
        {firstTool && <firstTool.BentoCard tool={firstTool} data={toolData[firstTool.id]} />}
        {remainingTools.length > 0 && (
          <div className="flex flex-col gap-4 md:gap-6">
            {remainingTools.map((tool) => (
              <tool.BentoCard key={tool.id} tool={tool} data={toolData[tool.id]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
