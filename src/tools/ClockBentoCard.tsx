import { useEffect, useState } from "react";
import type { ToolEntry } from "#/tools/registry";

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function ClockBentoCard({ tool: _tool, data: _data }: { tool: ToolEntry; data: unknown }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card p-6">
      <time className="text-4xl font-light tabular-nums tracking-wider text-foreground">
        {formatTime(now)}
      </time>
      <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        {formatDate(now)}
      </span>
    </div>
  );
}
