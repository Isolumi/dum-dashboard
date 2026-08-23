import { useEffect, useRef, useState } from "react";

import {
  CAMERA_PLAYBACK_EVENT,
  createCameraStreamElement,
  type CameraPlaybackState,
  type CameraStreamElement,
  type CameraStreamName,
} from "./-camera-player-element";

export type CameraPlayerProps = {
  stream: CameraStreamName;
  label: string;
  className?: string;
  elementFactory?: (stream: CameraStreamName) => Promise<CameraStreamElement>;
};

const stateText: Record<CameraPlaybackState, string> = {
  idle: "Camera idle",
  live: "Live",
  loading: "Loading camera",
  offline: "Camera offline",
};

export function CameraPlayer({
  stream,
  label,
  className,
  elementFactory = createCameraStreamElement,
}: CameraPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [playbackState, setPlaybackState] = useState<CameraPlaybackState>("loading");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let player: CameraStreamElement | null = null;
    const handlePlaybackState = (event: Event) => {
      const state = (event as CustomEvent<CameraPlaybackState>).detail;
      if (state === "idle" || state === "loading" || state === "live" || state === "offline") {
        setPlaybackState(state);
      }
    };

    setPlaybackState("loading");
    void elementFactory(stream)
      .then((element) => {
        if (disposed) return;
        player = element;
        player.addEventListener(CAMERA_PLAYBACK_EVENT, handlePlaybackState);
        host.append(player);
      })
      .catch(() => {
        if (disposed) return;
        setPlaybackState("offline");
      });

    return () => {
      disposed = true;
      if (player) {
        player.removeEventListener(CAMERA_PLAYBACK_EVENT, handlePlaybackState);
        player.remove();
      }
    };
  }, [elementFactory, stream]);

  return (
    <section aria-label={label} className={className}>
      <div
        data-testid="camera-player-frame"
        className="relative aspect-video overflow-hidden border border-border bg-muted"
      >
        <div ref={hostRef} data-testid="camera-player-host" className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            aria-live="polite"
            className={playbackState === "live" ? "text-foreground" : "text-muted-foreground"}
          >
            {stateText[playbackState]}
          </span>
        </div>
      </div>
    </section>
  );
}
