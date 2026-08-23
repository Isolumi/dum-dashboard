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
    const updateClock = () => setNow(new Date());
    updateClock();

    const millisecondsUntilNextMinute = 60_000 - (Date.now() % 60_000);
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const timeoutId = setTimeout(() => {
      updateClock();
      intervalId = setInterval(updateClock, 60_000);
    }, millisecondsUntilNextMinute);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, []);

  const date = now ? formatDate(now) : "---, --- --";
  const time = now ? formatTime(now) : "--:--";

  return (
    <time
      aria-label={`Current date and time: ${date}, ${time}`}
      dateTime={now?.toISOString()}
      className="inline-flex items-center gap-2 whitespace-nowrap text-[11px] text-muted-foreground sm:text-xs"
    >
      <span className="tracking-wide">{date}</span>
      <span aria-hidden="true">·</span>
      <span className="font-medium tabular-nums text-foreground">{time}</span>
    </time>
  );
}
