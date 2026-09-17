import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Job } from "#/lib/database.types";

const mocks = {
  deleteMock: vi.fn(),
  eqMock: vi.fn(),
  fromMock: vi.fn(),
  insertMock: vi.fn(),
  limitMock: vi.fn(),
  listResultMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  orderMock: vi.fn(),
  notMock: vi.fn(),
  orMock: vi.fn(),
  rangeMock: vi.fn(),
  selectMock: vi.fn(),
  upsertMock: vi.fn(),
};

const query = {
  delete() {
    mocks.deleteMock();
    return query;
  },
  eq(column: string, value: unknown) {
    mocks.eqMock(column, value);
    return query;
  },
  insert(value: unknown) {
    mocks.insertMock(value);
    return query;
  },
  limit(value: number) {
    mocks.limitMock(value);
    return query;
  },
  maybeSingle() {
    return mocks.maybeSingleMock();
  },
  order(column: string, options: unknown) {
    mocks.orderMock(column, options);
    return query;
  },
  select(columns: string) {
    mocks.selectMock(columns);
    return query;
  },
  range(from: number, to: number) {
    mocks.rangeMock(from, to);
    return query;
  },
  or(filter: string) {
    mocks.orMock(filter);
    return query;
  },
  not(column: string, operator: string, value: unknown) {
    mocks.notMock(column, operator, value);
    return query;
  },
  upsert(value: unknown, options: { ignoreDuplicates: boolean; onConflict: string }) {
    mocks.upsertMock(value, options);
    return query;
  },
  // oxlint-disable-next-line unicorn/no-thenable -- Supabase query builders are thenable.
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: Job[] | null;
          error: { code?: string; message?: string } | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return mocks.listResultMock().then(onfulfilled, onrejected);
  },
};

mocks.fromMock.mockImplementation(() => query);

vi.mock("#/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({ from: mocks.fromMock })),
}));

const { JobDomainError, deleteAllJobRecords, deleteJobRecord, listJobRecords, saveJobRecord } =
  await import("./job.domain");

const JOB_ID = "550e8400-e29b-41d4-a716-446655440000";
const SECOND_JOB_ID = "11111111-1111-4111-8111-111111111111";
const THIRD_JOB_ID = "22222222-2222-4222-8222-222222222222";

function makeJob(id: string, saved_at: string, overrides: Partial<Job> = {}): Job {
  return {
    company: "Point72",
    id,
    saved_at,
    title: "Quantitative Developer Intern",
    url: `https://jobs.example/${id}?source=discord`,
    ...overrides,
  };
}

const newest = makeJob(JOB_ID, "2026-09-15T15:00:00.000Z");
const middle = makeJob(SECOND_JOB_ID, "2026-09-15T14:00:00.000Z");
const oldest = makeJob(THIRD_JOB_ID, "2026-09-15T13:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fromMock.mockImplementation(() => query);
  mocks.listResultMock.mockReset().mockResolvedValue({ data: [], error: null });
  mocks.maybeSingleMock.mockResolvedValue({ data: null, error: null });
});

describe("listJobRecords", () => {
  it("reads all pages without the previous 100-job cap", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) =>
      makeJob(`550e8400-e29b-41d4-a716-${String(999 - index).padStart(12, "0")}`, newest.saved_at),
    );
    mocks.listResultMock
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [oldest], error: null });
    await expect(listJobRecords()).resolves.toEqual([...firstPage, oldest]);
    expect(mocks.rangeMock).not.toHaveBeenCalled();
    expect(mocks.limitMock.mock.calls).toEqual([[1000], [1000]]);
    const cursor = firstPage.at(-1)!;
    expect(mocks.orMock).toHaveBeenCalledExactlyOnceWith(
      `saved_at.lt."${cursor.saved_at}",and(saved_at.eq."${cursor.saved_at}",id.lt."${cursor.id}")`,
    );
  });

  it("fails safely instead of returning a partial list when a later page fails", async () => {
    mocks.listResultMock
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => newest), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "private detail" } });
    await expect(listJobRecords()).rejects.toMatchObject({ message: "Job service unavailable" });
  });

  it("returns the requested newest jobs ordered by saved time and stable ID", async () => {
    mocks.listResultMock.mockResolvedValueOnce({ data: [newest, middle, oldest], error: null });

    await expect(listJobRecords(3)).resolves.toEqual([newest, middle, oldest]);

    expect(mocks.fromMock).toHaveBeenCalledWith("jobs");
    expect(mocks.orderMock.mock.calls).toEqual([
      ["saved_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(mocks.limitMock).toHaveBeenCalledWith(3);
  });

  it("maps a database failure to a safe domain error", async () => {
    mocks.listResultMock.mockResolvedValueOnce({
      data: null,
      error: { code: "XX000", message: "private database detail" },
    });

    const error = await listJobRecords().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(JobDomainError);
    expect(error).toMatchObject({
      code: "database_unavailable",
      message: "Job service unavailable",
    });
    expect((error as Error).message).not.toContain("private database detail");
  });
});

describe("saveJobRecord", () => {
  const input = {
    company: "Point72",
    title: "Quantitative Developer Intern",
    url: "https://jobs.example/point72?team=quant&source=discord",
  };

  it("returns a created job from a conflict-safe upsert", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({ data: newest, error: null });

    await expect(saveJobRecord(input)).resolves.toEqual({ status: "created", job: newest });

    expect(mocks.upsertMock).toHaveBeenCalledWith(input, {
      ignoreDuplicates: true,
      onConflict: "url",
    });
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it("returns the existing job for the exact trimmed duplicate URL", async () => {
    mocks.maybeSingleMock
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: oldest, error: null });

    await expect(
      saveJobRecord({
        company: `  ${input.company}  `,
        title: `  ${input.title}  `,
        url: `  ${input.url}  `,
      }),
    ).resolves.toEqual({ status: "already_saved", job: oldest });

    expect(mocks.upsertMock).toHaveBeenCalledWith(input, {
      ignoreDuplicates: true,
      onConflict: "url",
    });
    expect(mocks.insertMock).not.toHaveBeenCalled();
    expect(mocks.eqMock).toHaveBeenCalledWith("url", input.url);
  });

  it("returns the existing row when two simultaneous inserts race for one URL", async () => {
    mocks.maybeSingleMock
      .mockResolvedValueOnce({ data: newest, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: newest, error: null });

    await expect(Promise.all([saveJobRecord(input), saveJobRecord(input)])).resolves.toEqual([
      { status: "created", job: newest },
      { status: "already_saved", job: newest },
    ]);

    expect(mocks.upsertMock).toHaveBeenCalledTimes(2);
    expect(mocks.insertMock).not.toHaveBeenCalled();
    expect(mocks.eqMock).toHaveBeenCalledWith("url", input.url);
  });

  it("maps an upsert failure to database_unavailable", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { code: "XX000", message: "private insert detail" },
    });

    await expect(saveJobRecord(input)).rejects.toMatchObject({
      code: "database_unavailable",
      message: "Job service unavailable",
    });
  });
});

describe("deleteAllJobRecords", () => {
  it("deletes the job table in one filtered request without returning private rows", async () => {
    await expect(deleteAllJobRecords()).resolves.toBeUndefined();
    expect(mocks.fromMock).toHaveBeenCalledExactlyOnceWith("jobs");
    expect(mocks.deleteMock).toHaveBeenCalledOnce();
    expect(mocks.notMock).toHaveBeenCalledExactlyOnceWith("id", "is", null);
    expect(mocks.selectMock).not.toHaveBeenCalled();
  });

  it("reports a safe failure", async () => {
    mocks.listResultMock.mockResolvedValueOnce({
      data: null,
      error: { message: "private detail" },
    });
    await expect(deleteAllJobRecords()).rejects.toMatchObject({
      message: "Job service unavailable",
    });
  });
});

describe("deleteJobRecord", () => {
  it("returns the deleted job", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({ data: middle, error: null });

    await expect(deleteJobRecord(middle.id)).resolves.toEqual(middle);

    expect(mocks.deleteMock).toHaveBeenCalledOnce();
    expect(mocks.eqMock).toHaveBeenCalledWith("id", middle.id);
  });

  it("maps a missing row to not_found", async () => {
    await expect(deleteJobRecord(JOB_ID)).rejects.toMatchObject({
      code: "not_found",
      message: "Job not found",
    });
  });
});
