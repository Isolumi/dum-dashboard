export type CameraStreamName = "camera-low" | "camera-high";
export type CameraPlaybackState = "idle" | "loading" | "live" | "offline";
export const CAMERA_PLAYBACK_EVENT = "camera-playback-state";

export interface CameraStreamElement extends HTMLElement {
  mode: string;
  media: string;
  background: boolean;
  visibilityCheck: boolean;
  visibilityThreshold: number;
  src: string;
  video: HTMLVideoElement | null;
  ws: WebSocket | null;
}

type UpstreamVideoRTC = Omit<CameraStreamElement, "onclose"> & {
  oninit(): void;
  onopen(): unknown[];
  onclose(): boolean;
  ondisconnect(): void;
};

type VideoRTCConstructor = new () => UpstreamVideoRTC;

const customElementName = "dum-camera-stream";
const videoRtcModuleUrl = "/camera-stream/video-rtc.js";
const startupTimeoutMs = 20_000;

function emitPlaybackState(element: HTMLElement, state: CameraPlaybackState) {
  element.dispatchEvent(
    new CustomEvent<CameraPlaybackState>(CAMERA_PLAYBACK_EVENT, {
      bubbles: false,
      detail: state,
    }),
  );
}

export function configureCameraStreamElement(
  element: CameraStreamElement,
  stream: CameraStreamName,
): void {
  element.mode = "mse";
  element.media = "video";
  element.background = false;
  element.visibilityCheck = true;
  element.visibilityThreshold = 0.01;
  element.src = `/camera-stream/api/ws?src=${encodeURIComponent(stream)}`;
}

export function buildCameraStreamElementClass(VideoRTC: VideoRTCConstructor): VideoRTCConstructor {
  return class CameraStream extends VideoRTC {
    private startupTimer: ReturnType<typeof setTimeout> | null = null;
    private listeningSocket: WebSocket | null = null;
    private listeningVideo: HTMLVideoElement | null = null;

    private clearStartupTimer() {
      if (this.startupTimer !== null) {
        clearTimeout(this.startupTimer);
        this.startupTimer = null;
      }
    }

    private removeSocketListeners() {
      if (this.listeningSocket) {
        this.listeningSocket.removeEventListener("close", this.handleSocketClose);
        this.listeningSocket.removeEventListener("message", this.handleSocketMessage);
        this.listeningSocket = null;
      }
    }

    private handleSocketClose = () => {
      this.clearStartupTimer();
    };

    private handleSocketMessage = (event: Event) => {
      if (!(event instanceof MessageEvent) || typeof event.data !== "string") return;

      try {
        const message: unknown = JSON.parse(event.data);
        if (
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          message.type === "error" &&
          this.listeningSocket === this.ws
        ) {
          this.clearStartupTimer();
          emitPlaybackState(this, "offline");
          const socket = this.ws;
          if (socket) socket.close();
        }
      } catch {
        // Ignore non-JSON upstream messages.
      }
    };

    private handlePlaying = () => {
      this.clearStartupTimer();
      emitPlaybackState(this, "live");
    };

    oninit() {
      super.oninit();

      if (!this.video) return;
      if (this.listeningVideo) {
        this.listeningVideo.removeEventListener("playing", this.handlePlaying);
      }
      this.video.controls = false;
      this.video.muted = true;
      this.video.autoplay = true;
      this.video.playsInline = true;
      this.video.style.objectFit = "contain";
      this.video.addEventListener("playing", this.handlePlaying);
      this.listeningVideo = this.video;
    }

    onopen() {
      const result = super.onopen();
      this.clearStartupTimer();
      this.removeSocketListeners();

      if (this.ws) {
        this.ws.addEventListener("close", this.handleSocketClose);
        this.ws.addEventListener("message", this.handleSocketMessage);
        this.listeningSocket = this.ws;
      }

      const socket = this.ws;
      emitPlaybackState(this, "loading");
      this.startupTimer = setTimeout(() => {
        this.startupTimer = null;
        if (this.ws !== socket) return;
        emitPlaybackState(this, "offline");
        socket?.close();
      }, startupTimeoutMs);

      return result;
    }

    onclose = () => {
      const reconnecting = super.onclose();
      this.clearStartupTimer();
      this.removeSocketListeners();
      if (reconnecting) emitPlaybackState(this, "offline");
      return reconnecting;
    };

    ondisconnect() {
      this.clearStartupTimer();
      this.removeSocketListeners();
      super.ondisconnect();
      emitPlaybackState(this, "idle");
    }
  };
}

export async function createCameraStreamElement(
  stream: CameraStreamName,
): Promise<CameraStreamElement> {
  if (typeof window === "undefined") {
    throw new Error("Camera streams require a browser");
  }

  if (!customElements.get(customElementName)) {
    const module = (await import(/* @vite-ignore */ videoRtcModuleUrl)) as { VideoRTC?: unknown };
    if (typeof module.VideoRTC !== "function") {
      throw new Error("Camera stream player is unavailable");
    }
    customElements.define(
      customElementName,
      buildCameraStreamElementClass(module.VideoRTC as VideoRTCConstructor),
    );
  }

  const element = document.createElement(customElementName) as CameraStreamElement;
  configureCameraStreamElement(element, stream);
  return element;
}
