/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CAMERA_PLAYBACK_EVENT, type CameraStreamElement } from "./-camera-player-element";
import { CameraPlayer } from "./-CameraPlayer";

function createPlayerElement() {
  return document.createElement("div") as unknown as CameraStreamElement;
}

afterEach(() => {
  cleanup();
});

describe("CameraPlayer", () => {
  it("keeps a 16:9 loading frame and passes the selected stream to the factory", async () => {
    const element = createPlayerElement();
    const elementFactory = vi.fn(async () => element);

    render(
      <CameraPlayer stream="camera-low" label="Front camera" elementFactory={elementFactory} />,
    );

    expect(screen.getByTestId("camera-player-frame").className).toContain("aspect-video");
    expect(screen.getByText("Loading camera")).toBeTruthy();
    await waitFor(() => expect(elementFactory).toHaveBeenCalledWith("camera-low"));
  });

  it("appends the custom player once and updates the visible playback state", async () => {
    const element = createPlayerElement();
    const elementFactory = vi.fn(async () => element);

    render(
      <CameraPlayer stream="camera-high" label="Driveway camera" elementFactory={elementFactory} />,
    );

    const host = screen.getByTestId("camera-player-host");
    await waitFor(() => expect(host.children).toHaveLength(1));
    expect(elementFactory).toHaveBeenCalledOnce();

    act(() => element.dispatchEvent(new CustomEvent(CAMERA_PLAYBACK_EVENT, { detail: "live" })));
    expect(screen.getByText("Live")).toBeTruthy();

    act(() => element.dispatchEvent(new CustomEvent(CAMERA_PLAYBACK_EVENT, { detail: "offline" })));
    expect(screen.queryByText("Live")).toBeNull();
    expect(screen.getByText("Camera offline")).toBeTruthy();

    act(() => element.dispatchEvent(new CustomEvent(CAMERA_PLAYBACK_EVENT, { detail: "idle" })));
    expect(screen.getByText("Camera idle")).toBeTruthy();
  });

  it("removes the listener and player element when unmounted", async () => {
    const element = createPlayerElement();
    const removeEventListener = vi.spyOn(element, "removeEventListener");
    const { unmount } = render(
      <CameraPlayer
        stream="camera-low"
        label="Front camera"
        elementFactory={async () => element}
      />,
    );
    const host = screen.getByTestId("camera-player-host");
    await waitFor(() => expect(host.children).toHaveLength(1));

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith(CAMERA_PLAYBACK_EVENT, expect.any(Function));
    expect(host.children).toHaveLength(0);
  });

  it("shows the offline state when the player factory rejects", async () => {
    const elementFactory = vi.fn(async () => {
      throw new Error("network module failed");
    });

    render(
      <CameraPlayer stream="camera-low" label="Front camera" elementFactory={elementFactory} />,
    );

    expect(await screen.findByText("Camera offline")).toBeTruthy();
  });
});
