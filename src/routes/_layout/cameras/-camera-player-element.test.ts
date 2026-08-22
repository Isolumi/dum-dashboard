/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildCameraStreamElementClass,
  CAMERA_PLAYBACK_EVENT,
  configureCameraStreamElement,
  createCameraStreamElement,
  type CameraPlaybackState,
  type CameraStreamElement,
  type CameraStreamName,
} from "./-camera-player-element";

vi.mock("/camera-stream/video-rtc.js", () => ({ VideoRTC: FakeVideoRTC }));

class FakeVideoRTC extends HTMLElement {
  mode = "";
  media = "";
  background = true;
  visibilityCheck = false;
  visibilityThreshold = 0;
  src = "";
  video: HTMLVideoElement | null = null;
  ws: WebSocket | null = null;
  disconnected = false;
  reconnecting = true;

  oninit() {
    this.video = document.createElement("video");
    this.append(this.video);
  }

  onopen() {
    return [];
  }

  ondisconnect() {
    this.disconnected = true;
  }
}

Object.defineProperty(FakeVideoRTC.prototype, "onclose", {
  value: function (this: FakeVideoRTC) {
    return this.reconnecting;
  },
});

let testElementNumber = 0;

function createCameraStreamInstance() {
  const CameraStream = buildCameraStreamElementClass(FakeVideoRTC as never);
  const elementName = `test-camera-stream-${testElementNumber++}`;
  customElements.define(elementName, CameraStream);
  return document.createElement(elementName) as InstanceType<typeof CameraStream>;
}

function createWebSocket() {
  const socket = new EventTarget() as WebSocket;
  Object.defineProperty(socket, "close", { value: vi.fn(), writable: true });
  return socket;
}

function statesFrom(element: HTMLElement) {
  const states: CameraPlaybackState[] = [];
  element.addEventListener(CAMERA_PLAYBACK_EVENT, (event) => {
    states.push((event as CustomEvent<CameraPlaybackState>).detail);
  });
  return states;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("configureCameraStreamElement", () => {
  it("configures the low stream with the maintained player contract", () => {
    const element = document.createElement("div") as unknown as CameraStreamElement;

    configureCameraStreamElement(element, "camera-low");

    expect(element.mode).toBe("mse");
    expect(element.media).toBe("video");
    expect(element.background).toBe(false);
    expect(element.visibilityCheck).toBe(true);
    expect(element.visibilityThreshold).toBe(0.01);
    expect(element.src).toBe("/camera-stream/api/ws?src=camera-low");
  });

  it("configures the high stream and accepts only declared stream names", () => {
    const element = document.createElement("div") as unknown as CameraStreamElement;
    // @ts-expect-error CameraStreamName rejects undeclared stream names.
    const invalidStream: CameraStreamName = "camera-medium";

    configureCameraStreamElement(element, "camera-high");

    expect(element.src).toBe("/camera-stream/api/ws?src=camera-high");
    expect(invalidStream).toBe("camera-medium");
  });
});

describe("buildCameraStreamElementClass", () => {
  it("configures the upstream video and reports live playback", () => {
    const element = createCameraStreamInstance();
    const states = statesFrom(element);

    element.oninit();
    element.video?.dispatchEvent(new Event("playing"));

    expect(element.video?.controls).toBe(false);
    expect(element.video?.muted).toBe(true);
    expect(element.video?.autoplay).toBe(true);
    expect(element.video?.playsInline).toBe(true);
    expect(element.video?.style.objectFit).toBe("contain");
    expect(states).toEqual(["live"]);
  });

  it("reports loading after open and offline when the upstream reports an error", () => {
    vi.useFakeTimers();
    const element = createCameraStreamInstance();
    const socket = createWebSocket();
    const states = statesFrom(element);
    element.ws = socket;

    element.oninit();
    element.onopen();
    socket.dispatchEvent(
      new MessageEvent("message", { data: '{"type":"error","value":"secret"}' }),
    );

    expect(states).toEqual(["loading", "offline"]);
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it("reports offline and closes the current socket when playback does not start", () => {
    vi.useFakeTimers();
    const element = createCameraStreamInstance();
    const socket = createWebSocket();
    const states = statesFrom(element);
    element.ws = socket;

    element.oninit();
    element.onopen();
    vi.advanceTimersByTime(20_000);

    expect(states).toEqual(["loading", "offline"]);
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it("clears the startup timer when playback starts", () => {
    vi.useFakeTimers();
    const element = createCameraStreamInstance();
    const socket = createWebSocket();
    const states = statesFrom(element);
    element.ws = socket;

    element.oninit();
    element.onopen();
    element.video?.dispatchEvent(new Event("playing"));
    vi.advanceTimersByTime(20_000);

    expect(states).toEqual(["loading", "live"]);
    expect(socket.close).not.toHaveBeenCalled();
  });

  it("reports offline only for reconnecting close events", () => {
    const element = createCameraStreamInstance();
    const states = statesFrom(element);

    element.onclose();

    expect(states).toEqual(["offline"]);
  });

  it("clears the startup timer without reporting offline for an intentional close", () => {
    vi.useFakeTimers();
    const element = createCameraStreamInstance();
    const socket = createWebSocket();
    const states = statesFrom(element);
    (element as unknown as FakeVideoRTC).reconnecting = false;
    element.ws = socket;

    element.oninit();
    element.onopen();
    element.onclose();
    vi.advanceTimersByTime(20_000);

    expect(states).toEqual(["loading"]);
    expect(socket.close).not.toHaveBeenCalled();
  });

  it("clears the timer when the socket closes or the player becomes idle", () => {
    vi.useFakeTimers();
    const socketClosed = createCameraStreamInstance();
    const socket = createWebSocket();
    const idle = createCameraStreamInstance();
    const idleSocket = createWebSocket();
    socketClosed.ws = socket;
    idle.ws = idleSocket;

    socketClosed.oninit();
    socketClosed.onopen();
    socket.dispatchEvent(new Event("close"));
    idle.oninit();
    idle.onopen();
    idle.ondisconnect();
    vi.advanceTimersByTime(20_000);

    expect(socket.close).not.toHaveBeenCalled();
    expect(idleSocket.close).not.toHaveBeenCalled();
  });

  it("reports idle after calling the upstream disconnect method", () => {
    const element = createCameraStreamInstance();
    const states = statesFrom(element);

    element.ondisconnect();

    expect((element as unknown as FakeVideoRTC).disconnected).toBe(true);
    expect(states).toEqual(["idle"]);
  });
});

describe("createCameraStreamElement", () => {
  it("shares registration work between concurrent factory calls", async () => {
    const definitions = new Map<string, unknown>();
    vi.stubGlobal("customElements", {
      define: (name: string, constructor: unknown) => {
        if (definitions.has(name)) {
          throw new DOMException("This name has already been registered in the registry.");
        }
        definitions.set(name, constructor);
      },
      get: (name: string) => definitions.get(name),
    });

    try {
      const [low, high] = await Promise.all([
        createCameraStreamElement("camera-low"),
        createCameraStreamElement("camera-high"),
      ]);

      expect(low.src).toBe("/camera-stream/api/ws?src=camera-low");
      expect(high.src).toBe("/camera-stream/api/ws?src=camera-high");
      expect(definitions.get("dum-camera-stream")).toBeDefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("reuses an already registered class before loading the upstream module", async () => {
    class RegisteredCameraStream extends HTMLElement {
      video: HTMLVideoElement | null = null;
      ws: WebSocket | null = null;
      mode = "";
      media = "";
      background = true;
      visibilityCheck = false;
      visibilityThreshold = 0;
      src = "";
    }

    if (!customElements.get("dum-camera-stream")) {
      customElements.define("dum-camera-stream", RegisteredCameraStream);
    }

    const element = await createCameraStreamElement("camera-high");

    expect(element).toBeInstanceOf(RegisteredCameraStream);
    expect(element.src).toBe("/camera-stream/api/ws?src=camera-high");
  });
});
