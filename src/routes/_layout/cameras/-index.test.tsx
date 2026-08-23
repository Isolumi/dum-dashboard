/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

class FakeCameraStreamElement extends HTMLElement {
  mode = "";
  media = "";
  background = true;
  visibilityCheck = false;
  visibilityThreshold = 0;
  src = "";
  video: HTMLVideoElement | null = null;
  ws: WebSocket | null = null;
}

if (!customElements.get("dum-camera-stream")) {
  customElements.define("dum-camera-stream", FakeCameraStreamElement);
}

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    createFileRoute:
      () =>
      <T,>(options: T): T =>
        options,
  };
});

const { Route } = await import("./index");
const CamerasPage = (Route as unknown as { component: React.ComponentType }).component;

afterEach(() => {
  cleanup();
});

describe("CamerasPage", () => {
  it("shows one labeled high-quality Camera stream", async () => {
    render(React.createElement(CamerasPage));

    expect(screen.getAllByRole("heading", { level: 1, name: "Cameras" })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Camera" })).toBeTruthy();
    expect(screen.getByTestId("camera-player-frame").className).toContain("aspect-video");

    const host = screen.getByTestId("camera-player-host");
    await waitFor(() => expect(host.firstElementChild).toBeTruthy());
    expect((host.firstElementChild as FakeCameraStreamElement).src).toBe(
      "/camera-stream/api/ws?src=camera-high",
    );
  });

  it("keeps the page video-only while showing the real player state", async () => {
    render(React.createElement(CamerasPage));

    const host = screen.getByTestId("camera-player-host");
    await waitFor(() => expect(host.firstElementChild).toBeTruthy());
    act(() => {
      host.firstElementChild?.dispatchEvent(
        new CustomEvent("camera-playback-state", { detail: "live" }),
      );
    });

    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector("audio")).toBeNull();
    expect(screen.queryByText(/recording|playback|account|management|settings/i)).toBeNull();
  });
});
