import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/dev-colours")({
  component: DevColoursPage,
});

const themeTokens = [
  { name: "neutral-950", class: "bg-neutral-950", label: "Page background" },
  { name: "neutral-900", class: "bg-neutral-900", label: "Card / surface" },
  { name: "neutral-800", class: "bg-neutral-800", label: "Elevated surface" },
  { name: "neutral-700", class: "bg-neutral-700", label: "Borders / dividers" },
  { name: "neutral-400", class: "bg-neutral-400", label: "Muted / secondary text" },
  { name: "neutral-100", class: "bg-neutral-100", label: "Primary text" },
  { name: "violet-500", class: "bg-violet-500", label: "Primary accent" },
  { name: "violet-400", class: "bg-violet-400", label: "Hover / active state" },
];

const cssVarTokens = [
  { name: "--background", label: "background" },
  { name: "--foreground", label: "foreground" },
  { name: "--card", label: "card" },
  { name: "--primary", label: "primary" },
  { name: "--secondary", label: "secondary" },
  { name: "--muted", label: "muted" },
  { name: "--accent", label: "accent" },
  { name: "--border", label: "border" },
  { name: "--sidebar", label: "sidebar" },
  { name: "--sidebar-primary", label: "sidebar-primary" },
  { name: "--sidebar-accent", label: "sidebar-accent" },
  { name: "--sidebar-border", label: "sidebar-border" },
  { name: "--sidebar-ring", label: "sidebar-ring" },
];

function Swatch({ bg, label, sublabel }: { bg: string; label: string; sublabel: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="size-10 shrink-0 rounded-md border border-neutral-700"
        style={{ backgroundColor: bg }}
      />
      <div>
        <p className="text-sm text-neutral-100">{label}</p>
        <p className="text-xs text-neutral-400">{sublabel}</p>
      </div>
    </div>
  );
}

function DevColoursPage() {
  return (
    <main className="p-6">
      <h1 className="mb-1 text-lg font-semibold text-neutral-100">Dev: Colour Tokens</h1>
      <p className="mb-8 text-sm text-neutral-400">
        All tokens from theme.css and styles.css :root
      </p>

      <section className="mb-8">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-400">
          Theme Palette (theme.css)
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {themeTokens.map((t) => (
            <Swatch key={t.name} bg={`var(--color-${t.name})`} label={t.name} sublabel={t.label} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-400">
          Semantic / Sidebar Tokens (styles.css :root)
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cssVarTokens.map((t) => (
            <Swatch key={t.name} bg={`var(${t.name})`} label={t.label} sublabel={t.name} />
          ))}
        </div>
      </section>
    </main>
  );
}
