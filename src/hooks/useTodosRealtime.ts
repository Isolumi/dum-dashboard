import { useEffect, useRef, useState } from "react";
import { supabase } from "#/lib/supabase";

export type ChannelStatus = "connecting" | "live" | "reconnecting";

export function useTodosRealtime(onEvent: () => void): ChannelStatus {
  const [status, setStatus] = useState<ChannelStatus>("live");
  // Stable ref prevents channel teardown/recreation on every render (per D-01 anti-pattern avoidance)
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    const channel = supabase
      .channel("todos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "todos" }, () =>
        onEventRef.current(),
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") {
          setStatus("live");
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          // Only show reconnecting if we were already live — prevents flash on initial mount
          setStatus((prev) => (prev === "live" ? "reconnecting" : prev));
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // empty deps -- channel created once per mount, per D-03

  return status;
}
