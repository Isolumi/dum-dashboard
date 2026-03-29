import { createFileRoute } from "@tanstack/react-router";
import { tools } from "#/tools/registry";

export const Route = createFileRoute("/_layout/")({
  component: OverviewPage,
});

function OverviewPage() {
  return (
    <main className="p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {tools.map((tool) => (
          <tool.BentoCard key={tool.id} tool={tool} />
        ))}
      </div>
    </main>
  );
}
