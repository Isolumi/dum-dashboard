import { z } from "zod";

export const SupabaseAccessTokenSchema = z.string().min(1);
