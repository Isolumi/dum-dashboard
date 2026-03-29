import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: IndexPage });

function IndexPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="p-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>
    </main>
  );
}
