import { createFileRoute } from "@tanstack/react-router";
import { tools } from "#/tools/registry";

export const Route = createFileRoute("/_layout/")({
  loader: loadToolData,
  errorComponent: OverviewError,
  component: OverviewPage,
});

async function loadToolData(): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    tools.map(async (tool) => {
      if (!tool.loadData) return [tool.id, undefined] as const;

      try {
        return [tool.id, await tool.loadData()] as const;
      } catch {
        return [tool.id, null] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}

function OverviewError() {
  return (
    <main className="p-6">
      <p className="text-sm text-destructive">Could not load overview. Refresh to try again.</p>
    </main>
  );
}

function OverviewPage() {
  const [firstTool, ...remainingTools] = tools;
  const toolData = Route.useLoaderData();

  return (
    <main className="p-6">
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
    </main>
  );
}
