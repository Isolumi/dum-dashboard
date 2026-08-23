import { Link } from "@tanstack/react-router";

import type { ToolEntry } from "#/tools/registry";
import { CameraPlayer } from "./-CameraPlayer";

export function CameraBentoCard({ tool: _tool, data: _data }: { tool: ToolEntry; data: unknown }) {
  return (
    <Link
      to="/cameras"
      aria-label="Open Camera"
      className="block overflow-hidden rounded-lg border border-border bg-card outline-none transition-colors duration-150 hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative">
        <CameraPlayer stream="camera-low" label="Camera" className="w-full" />
        <span className="pointer-events-none absolute top-3 left-3 rounded-md bg-background/80 px-2 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
          Camera
        </span>
      </div>
    </Link>
  );
}
