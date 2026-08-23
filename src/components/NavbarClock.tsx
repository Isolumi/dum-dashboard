import { useEffect, useState } from "react";

function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDate(date: Date): string {
  return date
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase();
}

export function NavbarClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const intervalId = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <time
      aria-label="Current date and time"
      dateTime={now?.toISOString()}
      className="inline-flex items-center gap-2 whitespace-nowrap text-[11px] text-muted-foreground sm:text-xs"
    >
      <span className="tracking-wide">{now ? formatDate(now) : "---, --- --"}</span>
      <span aria-hidden="true">·</span>
      <span className="font-medium tabular-nums text-foreground">
        {now ? formatTime(now) : "--:--"}
      </span>
    </time>
  );
}
