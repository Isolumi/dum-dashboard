import type { ChannelStatus } from "#/hooks/useTodosRealtime";

export function LiveIndicator({ status }: { status: ChannelStatus }) {
  if (status === "connecting") return null;

  if (status === "live") {
    return (
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        <span className="size-2 animate-pulse rounded-full bg-muted-foreground" />
        Live
      </span>
    );
  }

  return <span className="text-sm text-muted-foreground">Reconnecting...</span>;
}
