/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteAllJobsButton } from "./-DeleteAllJobsButton";

afterEach(cleanup);

describe("DeleteAllJobsButton", () => {
  it("requires one confirmation and cancels without deleting", async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    render(<DeleteAllJobsButton count={7} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete all" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("7 saved jobs");
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("deletes once after confirmation and closes on success", async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    render(<DeleteAllJobsButton count={7} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete all" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete all" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("keeps the dialog open with a safe error on failure", async () => {
    const onDelete = vi.fn().mockResolvedValue(false);
    render(<DeleteAllJobsButton count={7} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete all" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete all" }));
    expect(await within(dialog).findByRole("alert")).toBeTruthy();
  });

  it("disables the button when empty or unavailable", () => {
    const { rerender } = render(<DeleteAllJobsButton count={0} onDelete={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Delete all" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    rerender(<DeleteAllJobsButton count={7} disabled onDelete={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Delete all" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
