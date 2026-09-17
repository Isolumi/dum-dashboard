import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Job } from "#/lib/database.types";

const mocks = {
  deleteAllJobRecords: vi.fn(),
  deleteJobRecord: vi.fn(),
  listJobRecords: vi.fn(),
};

vi.mock("@tanstack/react-start", () => ({
  createServerFn: vi.fn(() => {
    let validator: { parse: (input: unknown) => unknown } | undefined;
    const builder = {
      inputValidator(nextValidator: { parse: (input: unknown) => unknown }) {
        validator = nextValidator;
        return builder;
      },
      handler(handler: (context: { data: unknown }) => unknown) {
        return (options?: { data?: unknown }) =>
          handler({ data: validator ? validator.parse(options?.data) : options?.data });
      },
    };
    return builder;
  }),
}));

vi.mock("#/lib/server-auth", () => ({
  assertSameOrigin: vi.fn(),
  getOwnerUser: vi.fn(() => ({ id: "owner-user-id" })),
  noStore: vi.fn(),
}));

vi.mock("./job.domain", () => ({
  deleteAllJobRecords: mocks.deleteAllJobRecords,
  deleteJobRecord: mocks.deleteJobRecord,
  listJobRecords: mocks.listJobRecords,
}));

const { deleteAllJobs, deleteJob, getJobs } = await import("./jobs.functions");
const { assertSameOrigin, getOwnerUser, noStore } = await import("#/lib/server-auth");

function firstCallOrder(mock: unknown): number {
  return (mock as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0]!;
}

const newest: Job = {
  company: "Point72",
  id: "550e8400-e29b-41d4-a716-446655440000",
  saved_at: "2026-09-15T15:00:00.000Z",
  title: "Quantitative Developer Intern",
  url: "https://jobs.example/point72",
};

const older: Job = {
  company: "Jane Street",
  id: "11111111-1111-4111-8111-111111111111",
  saved_at: "2026-09-15T14:00:00.000Z",
  title: "Software Engineer Intern",
  url: "https://jobs.example/jane-street",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listJobRecords.mockResolvedValue([newest, older]);
  mocks.deleteJobRecord.mockResolvedValue(newest);
});

describe("getJobs", () => {
  it("owner-gates a no-store read and returns the newest saved jobs", async () => {
    await expect(getJobs()).resolves.toEqual([newest, older]);

    expect(noStore).toHaveBeenCalledOnce();
    expect(getOwnerUser).toHaveBeenCalledOnce();
    expect(mocks.listJobRecords).toHaveBeenCalledWith();
    expect(firstCallOrder(noStore)).toBeLessThan(firstCallOrder(mocks.listJobRecords));
    expect(firstCallOrder(getOwnerUser)).toBeLessThan(firstCallOrder(mocks.listJobRecords));
  });
});

describe("deleteJob", () => {
  it("checks owner authentication and same origin before deleting a validated job ID", async () => {
    await expect(deleteJob({ data: { id: newest.id } })).resolves.toBeUndefined();

    expect(noStore).toHaveBeenCalledOnce();
    expect(getOwnerUser).toHaveBeenCalledOnce();
    expect(assertSameOrigin).toHaveBeenCalledOnce();
    expect(mocks.deleteJobRecord).toHaveBeenCalledWith(newest.id);
    expect(firstCallOrder(getOwnerUser)).toBeLessThan(firstCallOrder(mocks.deleteJobRecord));
    expect(firstCallOrder(assertSameOrigin)).toBeLessThan(firstCallOrder(mocks.deleteJobRecord));
  });

  it("rejects a malformed ID before the delete boundary", async () => {
    await expect(
      Promise.resolve().then(() => deleteJob({ data: { id: "not-a-uuid" } })),
    ).rejects.toThrow();

    expect(assertSameOrigin).not.toHaveBeenCalled();
    expect(mocks.deleteJobRecord).not.toHaveBeenCalled();
  });
});

describe("deleteAllJobs", () => {
  it("checks owner, same origin and no-store before a bulk deletion", async () => {
    await expect(deleteAllJobs()).resolves.toBeUndefined();
    expect(noStore).toHaveBeenCalledOnce();
    expect(getOwnerUser).toHaveBeenCalledOnce();
    expect(assertSameOrigin).toHaveBeenCalledOnce();
    expect(mocks.deleteAllJobRecords).toHaveBeenCalledOnce();
    expect(firstCallOrder(getOwnerUser)).toBeLessThan(firstCallOrder(mocks.deleteAllJobRecords));
    expect(firstCallOrder(assertSameOrigin)).toBeLessThan(
      firstCallOrder(mocks.deleteAllJobRecords),
    );
  });

  it("does not delete if the origin check fails", async () => {
    vi.mocked(assertSameOrigin).mockImplementationOnce(() => {
      throw new Error("Cross-origin request rejected");
    });
    await expect(deleteAllJobs()).rejects.toThrow("Cross-origin request rejected");
    expect(mocks.deleteAllJobRecords).not.toHaveBeenCalled();
  });
});
