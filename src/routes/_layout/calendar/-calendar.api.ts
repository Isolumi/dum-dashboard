export interface CalendarEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

export interface CalendarApiError {
  type: "auth_expired" | "network_error";
}

export async function fetchCalendarEvents(
  providerToken: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${providerToken}` } },
  );

  if (!res.ok) {
    const error: CalendarApiError = {
      type: res.status === 401 ? "auth_expired" : "network_error",
    };
    throw error;
  }

  const json = await res.json();
  return (json.items ?? []) as CalendarEvent[];
}
