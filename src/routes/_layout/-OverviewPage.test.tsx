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
import { BriefcaseBusiness, Camera, ShoppingBag } from "lucide-react";

const { getBuyListMock } = vi.hoisted(() => ({ getBuyListMock: vi.fn() }));
vi.mock("#/routes/buy-list/buy-list.functions", () => ({ getBuyList: getBuyListMock }));

const { getCalendarEventsMock, getHomelabOverviewMock, getJobsMock, getTodosMock } = vi.hoisted(
  () => ({
    getCalendarEventsMock: vi.fn(),
    getHomelabOverviewMock: vi.fn(),
    getJobsMock: vi.fn(),
    getTodosMock: vi.fn(),
  }),
);

vi.mock("#/homelab/homelab.functions", () => ({
  getHomelabOverview: getHomelabOverviewMock,
}));

vi.mock("#/routes/todos/todos.functions", () => ({
  getTodos: getTodosMock,
}));

vi.mock("#/routes/_layout/calendar/-calendar.functions", () => ({
  getCalendarEvents: getCalendarEventsMock,
}));

vi.mock("#/routes/jobs/jobs.functions", () => ({
  deleteAllJobs: vi.fn(),
  getJobs: getJobsMock,
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
  const routes = ["todos", "cameras", "calendar", "buy-list", "jobs", "homelab"].map((path) =>
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
  getBuyListMock.mockResolvedValue([]);
  getTodosMock.mockResolvedValue([]);
  getCalendarEventsMock.mockResolvedValue({ status: "ready", events: [] });
  getJobsMock.mockResolvedValue([]);
  getHomelabOverviewMock.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("main dashboard composition", () => {
  it("registers Buy list after Calendar for sidebar navigation", () => {
    const calendarIndex = tools.findIndex((tool) => tool.id === "calendar");
    expect(tools[calendarIndex + 1]).toMatchObject({
      id: "buy-list",
      label: "Buy list",
      route: "/buy-list",
      icon: ShoppingBag,
    });
  });
  it("places Buy list below Calendar in the primary column", async () => {
    vi.spyOn(Route, "useLoaderData").mockReturnValue({});
    const OverviewPage = Route.options.component as ComponentType;
    await renderInsideLayout(<OverviewPage />);
    const calendar = screen.getByRole("link", { name: "Open Calendar tool" });
    const buyList = screen.getByRole("region", { name: "Buy list" });
    expect(buyList.parentElement).toBe(calendar.parentElement);
    expect(calendar.nextElementSibling).toBe(buyList);
    expect(screen.getByRole("link", { name: "Buy list" }).getAttribute("href")).toBe("/buy-list");
  });
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

  it("registers the Jobs tool for sidebar and overview use", () => {
    expect(tools.find((tool) => tool.id === "jobs")).toMatchObject({
      id: "jobs",
      label: "Jobs",
      route: "/jobs",
      icon: BriefcaseBusiness,
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

  it("stacks Calendar after Todos and orders Monies, Jobs, Homelab, then Camera in the side column", async () => {
    vi.spyOn(Route, "useLoaderData").mockReturnValue({});
    const OverviewPage = Route.options.component as ComponentType;

    await renderInsideLayout(<OverviewPage />);

    const todoCard = screen.getByRole("region", { name: "Todos" });
    const calendarCard = screen.getByRole("link", { name: "Open Calendar tool" });
    const cameraCard = screen.getByRole("region", { name: "Camera" }).closest("a");
    const moniesCard = screen.getByRole("link", { name: "Open Monies tool" });
    const jobsCard = screen.getByRole("region", { name: "Jobs" });
    const homelabCard = screen.getByRole("link", { name: "Open Homelab overview" });
    if (!cameraCard) throw new Error("Camera card link is missing");

    expect(todoCard.parentElement).toBe(calendarCard.parentElement);
    expect(
      todoCard.compareDocumentPosition(calendarCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(cameraCard.parentElement).not.toBe(todoCard.parentElement);
    expect(cameraCard.parentElement).toBe(moniesCard.parentElement);
    expect(moniesCard.parentElement).toBe(jobsCard.parentElement);
    expect(jobsCard.parentElement).toBe(homelabCard.parentElement);
    expect(
      moniesCard.compareDocumentPosition(jobsCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      jobsCard.compareDocumentPosition(homelabCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      homelabCard.compareDocumentPosition(cameraCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps Camera as the final side card when another tool is added", async () => {
    const futureTool = {
      id: "future",
      label: "Future",
      route: "/future",
      icon: Camera,
      BentoCard: () => <a aria-label="Open Future tool" href="/future" />,
    };
    tools.push(futureTool);

    try {
      vi.spyOn(Route, "useLoaderData").mockReturnValue({});
      const OverviewPage = Route.options.component as ComponentType;

      await renderInsideLayout(<OverviewPage />);

      const futureCard = screen.getByRole("link", { name: "Open Future tool" });
      const cameraCard = screen.getByRole("region", { name: "Camera" }).closest("a");
      if (!cameraCard) throw new Error("Camera card link is missing");

      expect(
        futureCard.compareDocumentPosition(cameraCard) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    } finally {
      tools.splice(tools.indexOf(futureTool), 1);
    }
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
