import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import type { BuyListItem } from "#/lib/database.types";
import { assertSameOrigin, getOwnerUser, noStore } from "#/lib/server-auth";
import {
  listBuyListRecords,
  createBuyListRecord,
  renameBuyListRecord,
  deleteBuyListRecord,
} from "./buy-list.domain";
import {
  CreateBuyListItemSchema,
  RenameBuyListItemSchema,
  DeleteBuyListItemSchema,
} from "./buy-list.schemas";

export const getBuyList = createServerFn({ method: "POST" }).handler(
  async (): Promise<BuyListItem[]> => {
    noStore();
    getOwnerUser();
    return await listBuyListRecords();
  },
);
export const createBuyListItem = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(CreateBuyListItemSchema))
  .handler(async ({ data }): Promise<BuyListItem> => {
    noStore();
    getOwnerUser();
    assertSameOrigin();
    return await createBuyListRecord(data);
  });
export const renameBuyListItem = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(RenameBuyListItemSchema))
  .handler(async ({ data }): Promise<BuyListItem> => {
    noStore();
    getOwnerUser();
    assertSameOrigin();
    return await renameBuyListRecord(data);
  });
export const deleteBuyListItem = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(DeleteBuyListItemSchema))
  .handler(async ({ data }): Promise<BuyListItem> => {
    noStore();
    getOwnerUser();
    assertSameOrigin();
    return await deleteBuyListRecord(data.id);
  });
