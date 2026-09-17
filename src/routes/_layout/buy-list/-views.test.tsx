import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShoppingBag } from "lucide-react";
import type { ToolEntry } from "#/tools/registry";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  create: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("#/routes/buy-list/buy-list.functions", () => ({
  getBuyList: mocks.get,
  createBuyListItem: mocks.create,
  renameBuyListItem: mocks.rename,
  deleteBuyListItem: mocks.remove,
}));
import { BuyListBentoCard } from "./-BuyListBentoCard";
import { BuyListPage } from "./index";

const milk = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Milk",
  created_at: "2026-09-17T12:00:00.000Z",
};
const bread = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Bread",
  created_at: "2026-09-17T13:00:00.000Z",
};
const tool: ToolEntry = {
  id: "buy-list",
  label: "Buy list",
  route: "/buy-list",
  icon: ShoppingBag,
  BentoCard: BuyListBentoCard,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue([milk]);
  mocks.create.mockResolvedValue(bread);
  mocks.rename.mockResolvedValue({ ...bread, name: "Toast" });
  mocks.remove.mockResolvedValue(bread);
});
afterEach(cleanup);
async function renderView(compact: boolean) {
  const root = createRootRoute({
    component: () => (compact ? <BuyListBentoCard tool={tool} data={null} /> : <BuyListPage />),
  });
  const child = createRoute({ getParentRoute: () => root, path: "/buy-list" });
  const router = createRouter({
    routeTree: root.addChildren([child]),
    history: createMemoryHistory({ initialEntries: ["/buy-list"] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  await screen.findByRole("button", { name: "Rename Milk" });
}
describe.each([false, true])("Buy list view compact=%s", (compact) => {
  it("adds, renames, and deletes through the real controller and shared list", async () => {
    await renderView(compact);
    const input = screen.getByRole("textbox", { name: "Item to buy" });
    fireEvent.change(input, { target: { value: "Bread" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Rename Bread" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Rename Bread" }));
    const rename = screen.getByRole("textbox", { name: "Rename item" });
    fireEvent.change(rename, { target: { value: "Toast" } });
    fireEvent.keyDown(rename, { key: "Enter" });
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Delete Toast" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Toast" }));
    await waitFor(() => expect(screen.queryByText("Toast")).toBeNull());
    expect(screen.getByRole("button", { name: "Rename Milk" })).toBeTruthy();
    expect(mocks.create).toHaveBeenCalledWith({ data: { name: "Bread" } });
    expect(mocks.rename).toHaveBeenCalledWith({ data: { id: bread.id, name: "Toast" } });
    expect(mocks.remove).toHaveBeenCalledWith({ data: { id: bread.id } });
    if (compact)
      expect(screen.getByRole("link", { name: "Buy list" }).getAttribute("href")).toBe("/buy-list");
    else {
      expect(screen.getByRole("heading", { level: 1, name: "Buy list" })).toBeTruthy();
      expect(screen.getByRole("main").className).toContain("max-w-3xl");
    }
  });
});
