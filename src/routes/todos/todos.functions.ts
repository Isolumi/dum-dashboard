import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { SupabaseAccessTokenSchema } from "#/lib/auth-schemas";
import { noStore, requireOwnerUser } from "#/lib/server-auth";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import type { Todo } from "#/lib/database.types";

const TODO_COLUMNS = "id,name,status,priority,due_date,sort_order,created_at" as const;

export const CreateTodoSchema = z.object({
  name: z.string().trim().min(1).max(200),
  priority: z.enum(["high", "medium", "low"] as const).default("medium"),
  status: z.enum(["not_started", "started", "complete"] as const).default("not_started"),
  due_date: z.string().date().nullable().optional(),
});

export const UpdateTodoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  priority: z.enum(["high", "medium", "low"] as const).optional(),
  status: z.enum(["not_started", "started", "complete"] as const).optional(),
  due_date: z.string().date().nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

export const ReorderTodosSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().uuid(),
        sort_order: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(200),
});

export const DeleteTodoSchema = z.object({
  id: z.string().uuid(),
});

export const GetTodoSchema = z.object({
  id: z.string().uuid(),
});

export const GetTodosInputSchema = z.object({
  supabase_access_token: SupabaseAccessTokenSchema,
});

export const GetTodoInputSchema = GetTodoSchema.extend({
  supabase_access_token: SupabaseAccessTokenSchema,
});

export const CreateTodoInputSchema = CreateTodoSchema.extend({
  supabase_access_token: SupabaseAccessTokenSchema,
});

export const UpdateTodoInputSchema = UpdateTodoSchema.extend({
  supabase_access_token: SupabaseAccessTokenSchema,
});

export const DeleteTodoInputSchema = DeleteTodoSchema.extend({
  supabase_access_token: SupabaseAccessTokenSchema,
});

export const ReorderTodosInputSchema = ReorderTodosSchema.extend({
  supabase_access_token: SupabaseAccessTokenSchema,
});

export const getTodos = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(GetTodosInputSchema))
  .handler(async ({ data: input }): Promise<Todo[]> => {
    noStore();
    await requireOwnerUser(input.supabase_access_token);
    const { data, error } = await getSupabaseAdmin()
      .from("todos")
      .select(TODO_COLUMNS)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(`Failed to fetch todos: ${error.message}`);
    return data ?? [];
  });

export const getTodo = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(GetTodoInputSchema))
  .handler(async ({ data }): Promise<Todo> => {
    noStore();
    await requireOwnerUser(data.supabase_access_token);
    const { data: todo, error } = await getSupabaseAdmin()
      .from("todos")
      .select(TODO_COLUMNS)
      .eq("id", data.id)
      .single();
    if (error) throw new Error(`Failed to fetch todo: ${error.message}`);
    return todo;
  });

export const createTodo = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(CreateTodoInputSchema))
  .handler(async ({ data }): Promise<Todo> => {
    noStore();
    await requireOwnerUser(data.supabase_access_token);
    const { supabase_access_token: _accessToken, ...todoFields } = data;
    // Assign sort_order as max + 1 within the same priority group
    const { data: maxRow } = await getSupabaseAdmin()
      .from("todos")
      .select("sort_order")
      .eq("priority", todoFields.priority)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sort_order = maxRow ? maxRow.sort_order + 1 : 0;
    const { data: todo, error } = await getSupabaseAdmin()
      .from("todos")
      .insert({ ...todoFields, sort_order })
      .select(TODO_COLUMNS)
      .single();
    if (error) throw new Error(`Failed to create todo: ${error.message}`);
    return todo;
  });

export const updateTodo = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(UpdateTodoInputSchema))
  .handler(async ({ data }): Promise<Todo> => {
    noStore();
    await requireOwnerUser(data.supabase_access_token);
    const { id, supabase_access_token: _accessToken, ...fields } = data;
    const { data: todo, error } = await getSupabaseAdmin()
      .from("todos")
      .update(fields)
      .eq("id", id)
      .select(TODO_COLUMNS)
      .single();
    if (error) throw new Error(`Failed to update todo: ${error.message}`);
    return todo;
  });

export const deleteTodo = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(DeleteTodoInputSchema))
  .handler(async ({ data }): Promise<void> => {
    noStore();
    await requireOwnerUser(data.supabase_access_token);
    const { error } = await getSupabaseAdmin().from("todos").delete().eq("id", data.id);
    if (error) throw new Error(`Failed to delete todo: ${error.message}`);
  });

export const reorderTodos = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(ReorderTodosInputSchema))
  .handler(async ({ data }): Promise<void> => {
    noStore();
    await requireOwnerUser(data.supabase_access_token);
    const results = await Promise.all(
      data.updates.map(({ id, sort_order }) =>
        getSupabaseAdmin().from("todos").update({ sort_order }).eq("id", id),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw new Error(`Failed to reorder todos: ${failed.error.message}`);
  });
