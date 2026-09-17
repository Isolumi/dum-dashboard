import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuyList } from "./-BuyList";
import type { BuyListController } from "./-useBuyListController";

afterEach(cleanup);
const item = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Milk",
  created_at: "2026-09-17T12:00:00Z",
};
function controller(overrides: Partial<BuyListController> = {}): BuyListController {
  return {
    items: [item],
    status: "ready",
    loadError: null,
    mutationError: null,
    pendingIds: new Set(),
    refresh: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(true),
    rename: vi.fn().mockResolvedValue(true),
    remove: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}
describe.each([false, true])("shared Buy list compact=%s", (compact) => {
  it("adds with the keyboard and clears only a successful draft", async () => {
    const state = controller();
    render(<BuyList controller={state} compact={compact} />);
    const input = screen.getByRole("textbox", { name: "Item to buy" });
    fireEvent.change(input, { target: { value: " Bread " } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(""));
    expect(state.add).toHaveBeenCalledWith("Bread");
  });
  it("retains failed add drafts and prevents a duplicate submission", async () => {
    let resolve!: (success: boolean) => void;
    const state = controller({
      add: vi.fn(
        () =>
          new Promise<boolean>((yes) => {
            resolve = yes;
          }),
      ),
    });
    render(<BuyList controller={state} compact={compact} />);
    const input = screen.getByRole("textbox", { name: "Item to buy" });
    fireEvent.change(input, { target: { value: "Bread" } });
    fireEvent.submit(input.closest("form")!);
    fireEvent.submit(input.closest("form")!);
    expect(state.add).toHaveBeenCalledTimes(1);
    resolve(false);
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    expect((input as HTMLInputElement).value).toBe("Bread");
  });
  it("renames with Enter, retains failure, and cancels with Escape", async () => {
    const state = controller({ rename: vi.fn().mockResolvedValue(false) });
    render(<BuyList controller={state} compact={compact} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename Milk" }));
    const input = screen.getByRole("textbox", { name: "Rename item" });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "Cheese" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(state.rename).toHaveBeenCalledWith(item.id, "Cheese"));
    expect((screen.getByRole("textbox", { name: "Rename item" }) as HTMLInputElement).value).toBe(
      "Cheese",
    );
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Rename item" })).toBeNull();
    expect(screen.getByRole("button", { name: "Rename Milk" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Rename Milk" }));
  });
  it("closes a successful rename", async () => {
    const state = controller();
    render(<BuyList controller={state} compact={compact} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename Milk" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Rename item" }), { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Rename item" })).toBeNull());
  });
  it("uses compact touch-visible delete controls, wrapping text, and pending protection", () => {
    const state = controller();
    const { rerender } = render(<BuyList controller={state} compact={compact} />);
    const remove = screen.getByRole("button", { name: "Delete Milk" });
    expect(remove.className).toContain("size-8");
    expect(remove.className).toContain("[@media(hover:hover)_and_(pointer:fine)]:opacity-0");
    expect(remove.className).toContain("group-hover:opacity-100");
    expect(remove.className).toContain("group-focus-within:opacity-100");
    const name = screen.getByRole("button", { name: "Rename Milk" });
    expect(name.className).toContain("text-left");
    expect(name.className).toContain("break-words");
    expect(name.className).not.toContain("truncate");
    fireEvent.click(remove);
    expect(state.remove).toHaveBeenCalledWith(item.id);
    rerender(
      <BuyList controller={controller({ pendingIds: new Set([item.id]) })} compact={compact} />,
    );
    expect(
      (screen.getByRole("button", { name: "Delete Milk" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Rename Milk" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
  it("shows empty, loading, retry, and safe errors without hiding retained items", () => {
    const state = controller({ items: [] });
    const { rerender } = render(<BuyList controller={state} compact={compact} />);
    expect(screen.getByText("No items")).toBeTruthy();
    rerender(
      <BuyList controller={controller({ status: "loading", items: [] })} compact={compact} />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    const error = controller({
      status: "error",
      items: [],
      loadError: "Could not refresh Buy list.",
    });
    rerender(<BuyList controller={error} compact={compact} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(error.refresh).toHaveBeenCalled();
    rerender(
      <BuyList
        controller={controller({
          loadError: "Could not refresh Buy list.",
          mutationError: "Could not save item.",
        })}
        compact={compact}
      />,
    );
    expect(screen.getByRole("button", { name: "Rename Milk" })).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });
  it("bounds the compact list only and does not truncate saved items", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      ...item,
      id: String(i),
      name: `Item ${i}`,
    }));
    render(<BuyList controller={controller({ items })} compact={compact} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(20);
    const list = screen.getByRole("list", { name: "Items to buy" });
    expect(list.className.includes("max-h-80")).toBe(compact);
    expect(list.className.includes("overflow-y-auto")).toBe(compact);
  });
});
