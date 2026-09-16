import { describe, expect, it } from "vitest";

import {
  DeleteJobSchema,
  JobCompanySchema,
  JobTitleSchema,
  JobUrlSchema,
  SaveJobSchema,
} from "./job.schemas";

const VALID_JOB = {
  company: "Point72",
  title: "Quantitative Developer Intern",
  url: "https://jobs.example/point72?team=quant&source=discord",
};

describe("job field schemas", () => {
  it("trims valid company, title, and URL values", () => {
    expect(
      SaveJobSchema.parse({
        company: `  ${VALID_JOB.company}  `,
        title: `  ${VALID_JOB.title}  `,
        url: `  ${VALID_JOB.url}  `,
      }),
    ).toEqual(VALID_JOB);
  });

  it.each([
    ["company", JobCompanySchema],
    ["title", JobTitleSchema],
    ["URL", JobUrlSchema],
  ])("rejects a blank %s", (_label, schema) => {
    expect(schema.safeParse("   ").success).toBe(false);
  });

  it("enforces the company length limit", () => {
    expect(JobCompanySchema.safeParse("c".repeat(200)).success).toBe(true);
    expect(JobCompanySchema.safeParse("c".repeat(201)).success).toBe(false);
  });

  it("enforces the title length limit", () => {
    expect(JobTitleSchema.safeParse("t".repeat(300)).success).toBe(true);
    expect(JobTitleSchema.safeParse("t".repeat(301)).success).toBe(false);
  });

  it("enforces the URL length limit", () => {
    const prefix = "https://jobs.example/";

    expect(JobUrlSchema.safeParse(prefix + "a".repeat(2048 - prefix.length)).success).toBe(true);
    expect(JobUrlSchema.safeParse(prefix + "a".repeat(2049 - prefix.length)).success).toBe(false);
  });

  it("rejects an FTP URL", () => {
    expect(JobUrlSchema.safeParse("ftp://jobs.example/opening").success).toBe(false);
  });

  it("rejects a relative URL", () => {
    expect(JobUrlSchema.safeParse("/jobs/opening").success).toBe(false);
  });
});

describe("SaveJobSchema", () => {
  it("accepts a valid job and preserves URL query parameters", () => {
    expect(SaveJobSchema.parse(VALID_JOB)).toEqual(VALID_JOB);
  });

  it("rejects unknown fields", () => {
    expect(SaveJobSchema.safeParse({ ...VALID_JOB, status: "applied" }).success).toBe(false);
  });
});

describe("DeleteJobSchema", () => {
  it("accepts a UUID", () => {
    expect(DeleteJobSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" }).success).toBe(
      true,
    );
  });

  it("rejects a malformed ID", () => {
    expect(DeleteJobSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
  });
});
