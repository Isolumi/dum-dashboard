import { describe, expect, it } from "vitest";

import { CreateToolJobSchema } from "./-schemas";

const VALID_JOB = {
  company: "Point72",
  title: "Quantitative Developer Intern",
  url: "https://jobs.example/point72?team=quant&source=discord",
};

describe("CreateToolJobSchema", () => {
  it("trims fields and preserves URL query parameters", () => {
    expect(
      CreateToolJobSchema.parse({
        company: `  ${VALID_JOB.company}  `,
        title: `  ${VALID_JOB.title}  `,
        url: `  ${VALID_JOB.url}  `,
      }),
    ).toEqual(VALID_JOB);
  });

  it("rejects unknown fields", () => {
    expect(CreateToolJobSchema.safeParse({ ...VALID_JOB, status: "applied" }).success).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(CreateToolJobSchema.safeParse({ ...VALID_JOB, url: "not-a-url" }).success).toBe(false);
  });
});
