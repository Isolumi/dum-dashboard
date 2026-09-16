/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { BriefcaseBusiness } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Job } from "#/lib/database.types";
import type { ToolEntry } from "#/tools/registry";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href: to, ...props }, children),
}));

vi.mock("#/routes/jobs/jobs.functions", () => ({
  getJobs: vi.fn(),
}));

const { getJobs } = await import("#/routes/jobs/jobs.functions");
const { JobsBentoCard } = await import("./-JobsBentoCard");
const { tools } = await import("#/tools/registry");

const mockTool = {
  id: "jobs",
  label: "Jobs",
  route: "/jobs",
  icon: BriefcaseBusiness,
  BentoCard: () => null,
} as unknown as ToolEntry;

function makeJob(id: string, saved_at: string, overrides: Partial<Job> = {}): Job {
  return {
    company: "Point72",
    id,
    saved_at,
    title: `Job ${id}`,
    url: `https://jobs.example/${id}`,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const oldest = makeJob("11111111-1111-4111-8111-111111111111", "2026-09-15T12:00:00.000Z", {
  title: "Fourth newest",
});
const third = makeJob("22222222-2222-4222-8222-222222222222", "2026-09-15T13:00:00.000Z", {
  title: "Third newest",
});
const tiedLowerId = makeJob("33333333-3333-4333-8333-333333333333", "2026-09-15T14:00:00.000Z", {
  title: "Second newest",
});
const tiedHigherId = makeJob("44444444-4444-4444-8444-444444444444", "2026-09-15T14:00:00.000Z", {
  title: "Newest",
});

beforeEach(() => {
  vi.mocked(getJobs).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("JobsBentoCard", () => {
  it("shows exactly the newest three jobs in saved-at and ID descending order", async () => {
    vi.mocked(getJobs).mockResolvedValue([oldest, tiedLowerId, third, tiedHigherId]);

    render(<JobsBentoCard tool={mockTool} data={null} />);

    await waitFor(() => expect(screen.getByText("Newest")).toBeTruthy());
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links[0]?.getAttribute("href")).toBe("/jobs");
    expect(links.slice(1).map((link) => link.textContent)).toEqual([
      "Point72Newest",
      "Point72Second newest",
      "Point72Third newest",
    ]);
    expect(screen.queryByText("Fourth newest")).toBeNull();
  });

  it("links the title to Jobs and opens each saved URL in a new tab", async () => {
    vi.mocked(getJobs).mockResolvedValue([tiedHigherId, tiedLowerId]);

    render(<JobsBentoCard tool={mockTool} data={null} />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(3));
    expect(screen.getByRole("link", { name: "Jobs" }).getAttribute("href")).toBe("/jobs");

    const newestLink = screen.getByRole("link", { name: "Point72 — Newest" });
    expect(newestLink.getAttribute("href")).toBe(tiedHigherId.url);
    expect(newestLink.getAttribute("target")).toBe("_blank");
    expect(newestLink.getAttribute("rel")).toBe("noreferrer");
  });

  it("truncates long company names and job titles inside compact rows", async () => {
    const longTitle = "Senior distributed systems engineer for low-latency trading infrastructure";
    const longCompany = "A very long company name that must stay inside the compact card";
    vi.mocked(getJobs).mockResolvedValue([
      makeJob("55555555-5555-4555-8555-555555555555", "2026-09-15T15:00:00.000Z", {
        company: longCompany,
        title: longTitle,
      }),
    ]);

    render(<JobsBentoCard tool={mockTool} data={null} />);

    expect((await screen.findByText(longCompany)).className).toContain("truncate");
    expect(screen.getByText(longTitle).className).toContain("line-clamp-2");
  });

  it("shows the saved-jobs empty state", async () => {
    render(<JobsBentoCard tool={mockTool} data={null} />);

    expect(await screen.findByText("No saved jobs")).toBeTruthy();
  });

  it("updates the three rows after ten seconds without a page reload", async () => {
    vi.useFakeTimers();
    vi.mocked(getJobs)
      .mockResolvedValueOnce([tiedHigherId, tiedLowerId, third])
      .mockResolvedValueOnce([
        makeJob("66666666-6666-4666-8666-666666666666", "2026-09-15T16:00:00.000Z", {
          title: "Fresh job",
        }),
        tiedHigherId,
        tiedLowerId,
        third,
      ]);

    render(<JobsBentoCard tool={mockTool} data={null} />);
    await act(async () => Promise.resolve());
    expect(screen.getByText("Third newest")).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    expect(getJobs).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Fresh job")).toBeTruthy();
    expect(screen.queryByText("Third newest")).toBeNull();
  });

  it("does not overlap a poll with a pending initial request", async () => {
    vi.useFakeTimers();
    const initialRequest = deferred<Job[]>();
    vi.mocked(getJobs).mockReturnValueOnce(initialRequest.promise);

    render(<JobsBentoCard tool={mockTool} data={null} />);
    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    expect(getJobs).toHaveBeenCalledTimes(1);

    await act(async () => {
      initialRequest.resolve([tiedHigherId]);
      await initialRequest.promise;
    });
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(getJobs).toHaveBeenCalledTimes(2);
  });

  it("preserves the last-good rows when a background refresh fails", async () => {
    vi.useFakeTimers();
    vi.mocked(getJobs)
      .mockResolvedValueOnce([tiedHigherId])
      .mockRejectedValueOnce(new Error("private database failure"));

    render(<JobsBentoCard tool={mockTool} data={null} />);
    await act(async () => Promise.resolve());
    expect(screen.getByText("Newest")).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    expect(screen.getByText("Newest")).toBeTruthy();
    expect(screen.queryByText(/private database failure/i)).toBeNull();
  });
});

describe("Jobs tool registration", () => {
  it("registers Jobs after Monies and before Homelab for overview and sidebar use", () => {
    const moniesIndex = tools.findIndex((tool) => tool.id === "monies");
    const jobsIndex = tools.findIndex((tool) => tool.id === "jobs");
    const homelabIndex = tools.findIndex((tool) => tool.id === "homelab");
    const jobs = tools[jobsIndex];

    expect(jobsIndex).toBe(moniesIndex + 1);
    expect(homelabIndex).toBe(jobsIndex + 1);
    expect(jobs).toMatchObject({
      label: "Jobs",
      route: "/jobs",
      icon: BriefcaseBusiness,
    });
    expect(jobs?.overviewOnly).not.toBe(true);
  });
});
