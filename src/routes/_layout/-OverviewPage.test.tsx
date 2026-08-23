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
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Camera } from "lucide-react";

const { getCalendarEventsMock, getHomelabOverviewMock, getTodosMock } = vi.hoisted(() => ({
  getCalendarEventsMock: vi.fn(),
  getHomelabOverviewMock: vi.fn(),
  getTodosMock: vi.fn(),
}));

vi.mock("#/homelab/homelab.functions", () => ({
  getHomelabOverview: getHomelabOverviewMock,
}));

vi.mock("#/routes/todos/todos.functions", () => ({
  getTodos: getTodosMock,
}));

vi.mock("#/routes/_layout/calendar/-calendar.functions", () => ({
  getCalendarEvents: getCalendarEventsMock,
}));

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

const { tools } = await import("#/tools/registry");
const { Route } = await import("./index");

async function renderInsideLayout(content: ReactNode) {
  const rootRoute = createRootRoute({ component: () => <main>{content}</main> });
  const routes = ["todos", "cameras", "calendar", "homelab"].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await router.load();
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  getTodosMock.mockResolvedValue([]);
  getCalendarEventsMock.mockResolvedValue({ status: "ready", events: [] });
  getHomelabOverviewMock.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("main dashboard composition", () => {
  it("keeps the clock out of the bento registry and retains the Cameras tool", () => {
    const cameraTool = tools.find((tool) => tool.id === "cameras");

    expect(tools.find((tool) => tool.id === "clock")).toBeUndefined();
    expect(cameraTool).toMatchObject({
      id: "cameras",
      label: "Cameras",
      route: "/cameras",
      icon: Camera,
    });
  });

  it("catches the production break where a stalled Homelab request blocks static dashboard cards", async () => {
    const loader = Route.options.loader as ((context: never) => unknown) | undefined;
    if (!loader) throw new Error("Dashboard loader is missing");

    const outcome = loader({} as never);

    expect(outcome).toEqual({});
    expect(getHomelabOverviewMock).not.toHaveBeenCalled();
  });

  it("catches the production break where the success wrapper nests a second main landmark", async () => {
    vi.spyOn(Route, "useLoaderData").mockReturnValue({});
    const OverviewPage = Route.options.component as ComponentType;

    await renderInsideLayout(<OverviewPage />);

    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("catches the production break where the dashboard has no Overview page heading", async () => {
    vi.spyOn(Route, "useLoaderData").mockReturnValue({});
    const OverviewPage = Route.options.component as ComponentType;

    await renderInsideLayout(<OverviewPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeTruthy();
  });

  it("keeps the Todo card at its content height instead of stretching it to the side column", async () => {
    vi.spyOn(Route, "useLoaderData").mockReturnValue({});
    const OverviewPage = Route.options.component as ComponentType;

    await renderInsideLayout(<OverviewPage />);

    const todoCard = screen.getByRole("region", { name: "Todos" });
    expect(todoCard.parentElement?.className).toContain("items-start");
  });

  it("stacks Calendar directly after Todos and keeps the other tools in the side column", async () => {
    vi.spyOn(Route, "useLoaderData").mockReturnValue({});
    const OverviewPage = Route.options.component as ComponentType;

    await renderInsideLayout(<OverviewPage />);

    const todoCard = screen.getByRole("region", { name: "Todos" });
    const calendarCard = screen.getByRole("link", { name: "Open Calendar tool" });
    const cameraCard = screen.getByRole("region", { name: "Camera" }).closest("a");
    const moniesCard = screen.getByRole("link", { name: "Open Monies tool" });
    const homelabCard = screen.getByRole("link", { name: "Open Homelab overview" });

    expect(todoCard.parentElement).toBe(calendarCard.parentElement);
    expect(
      todoCard.compareDocumentPosition(calendarCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(cameraCard?.parentElement).not.toBe(todoCard.parentElement);
    expect(cameraCard?.parentElement).toBe(moniesCard.parentElement);
    expect(moniesCard.parentElement).toBe(homelabCard.parentElement);
  });

  it("catches the production break where the error wrapper nests a second main landmark", async () => {
    const OverviewError = Route.options.errorComponent as ComponentType<{
      error: Error;
      reset: () => void;
    }>;

    await renderInsideLayout(<OverviewError error={new Error("failed")} reset={() => undefined} />);

    expect(screen.getAllByRole("main")).toHaveLength(1);
  });
});
