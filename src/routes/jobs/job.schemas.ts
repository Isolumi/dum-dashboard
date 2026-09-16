import { z } from "zod";

export const JobCompanySchema = z.string().trim().min(1).max(200);
export const JobTitleSchema = z.string().trim().min(1).max(300);
export const JobUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  });

export const SaveJobSchema = z.strictObject({
  company: JobCompanySchema,
  title: JobTitleSchema,
  url: JobUrlSchema,
});

export const DeleteJobSchema = z.strictObject({
  id: z.string().uuid(),
});

export type SaveJobInput = z.infer<typeof SaveJobSchema>;
