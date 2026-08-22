/**
 * @vitest-environment jsdom
 */
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { ToolEntry } from "#/tools/registry";

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

const { CameraBentoCard } = await import("./-CameraBentoCard");

const cameraTool = {
  id: "cameras",
  label: "Cameras",
  route: "/cameras",
  icon: () => null,
  BentoCard: () => null,
} as unknown as ToolEntry;

async function renderCameraBentoCard() {
  const rootRoute = createRootRoute({
    component: () => React.createElement(CameraBentoCard, { tool: cameraTool, data: null }),
  });
  const camerasRoute = createRoute({ getParentRoute: () => rootRoute, path: "cameras" });
  const router = createRouter({
    routeTree: rootRoute.addChildren([camerasRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await router.load();
  return render(React.createElement(RouterProvider, { router }));
}

afterEach(() => {
  cleanup();
});

describe("CameraBentoCard", () => {
  it("opens the Camera page with a low stream in a stable non-cropping frame", async () => {
    await renderCameraBentoCard();

    const link = screen.getByRole("link", { name: "Open Camera" });
    expect(link.getAttribute("href")).toBe("/cameras");
    expect(screen.getByText("Camera").className).toContain("text-xs");
    expect(screen.getByRole("region", { name: "Camera" })).toBeTruthy();
    expect(screen.getByTestId("camera-player-frame").className).toContain("aspect-video");

    const host = screen.getByTestId("camera-player-host");
    await waitFor(() => expect(host.firstElementChild).toBeTruthy());
    expect((host.firstElementChild as FakeCameraStreamElement).src).toBe(
      "/camera-stream/api/ws?src=camera-low",
    );
  });

  it("shows the real player state in the card", async () => {
    await renderCameraBentoCard();

    const host = screen.getByTestId("camera-player-host");
    await waitFor(() => expect(host.firstElementChild).toBeTruthy());

    act(() => {
      host.firstElementChild?.dispatchEvent(
        new CustomEvent("camera-playback-state", { detail: "live" }),
      );
    });

    expect(screen.getByText("Live")).toBeTruthy();
  });
});
