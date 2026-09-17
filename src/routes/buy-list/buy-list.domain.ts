import type { BuyListItem } from "#/lib/database.types";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import {
  CreateBuyListItemSchema,
  DeleteBuyListItemSchema,
  RenameBuyListItemSchema,
  type CreateBuyListItemInput,
  type RenameBuyListItemInput,
} from "./buy-list.schemas";

const COLUMNS = "id,name,created_at";
const PAGE_SIZE = 1000;
export class BuyListDomainError extends Error {
  constructor(public readonly code: "not_found" | "database_unavailable") {
    super(code === "not_found" ? "Buy list item not found" : "Buy list service unavailable");
    this.name = "BuyListDomainError";
  }
}

// Supabase can return database errors or throw transport/configuration errors.
async function databaseOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof BuyListDomainError) throw error;
    throw new BuyListDomainError("database_unavailable");
  }
}

export function listBuyListRecords(): Promise<BuyListItem[]> {
  return databaseOperation(async () => {
    const admin = getSupabaseAdmin();
    const items: BuyListItem[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await admin
        .from("buy_list_items")
        .select(COLUMNS)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new BuyListDomainError("database_unavailable");
      const page = data ?? [];
      items.push(...page);
      if (page.length < PAGE_SIZE) return items;
    }
  });
}

export function createBuyListRecord(input: CreateBuyListItemInput): Promise<BuyListItem> {
  const parsed = CreateBuyListItemSchema.parse(input);
  return databaseOperation(async () => {
    const { data, error } = await getSupabaseAdmin()
      .from("buy_list_items")
      .insert(parsed)
      .select(COLUMNS)
      .maybeSingle();
    if (error || !data) throw new BuyListDomainError("database_unavailable");
    return data;
  });
}

export function renameBuyListRecord(input: RenameBuyListItemInput): Promise<BuyListItem> {
  const { id, name } = RenameBuyListItemSchema.parse(input);
  return databaseOperation(async () => {
    const { data, error } = await getSupabaseAdmin()
      .from("buy_list_items")
      .update({ name })
      .eq("id", id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw new BuyListDomainError("database_unavailable");
    if (!data) throw new BuyListDomainError("not_found");
    return data;
  });
}

export function deleteBuyListRecord(id: string): Promise<BuyListItem> {
  const parsed = DeleteBuyListItemSchema.parse({ id });
  return databaseOperation(async () => {
    const { data, error } = await getSupabaseAdmin()
      .from("buy_list_items")
      .delete()
      .eq("id", parsed.id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw new BuyListDomainError("database_unavailable");
    if (!data) throw new BuyListDomainError("not_found");
    return data;
  });
}
