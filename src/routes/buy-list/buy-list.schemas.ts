import { z } from "zod";

const name = z.string().trim().min(1).max(300);
const id = z.string().uuid();
export const CreateBuyListItemSchema = z.object({ name }).strict();
export const RenameBuyListItemSchema = z.object({ id, name }).strict();
export const DeleteBuyListItemSchema = z.object({ id }).strict();
export type CreateBuyListItemInput = z.infer<typeof CreateBuyListItemSchema>;
export type RenameBuyListItemInput = z.infer<typeof RenameBuyListItemSchema>;
