import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { getSupabaseAdmin } from "#/lib/supabase-admin";
import type { Todo } from "#/lib/database.types";

export const CreateTodoSchema = z.object({
  name: z.string().min(1),
  priority: z.enum(["high", "medium", "low"] as const).default("medium"),
  status: z.enum(["not_started", "started", "complete"] as const).default("not_started"),
  due_date: z.string().date().nullable().optional(),
});

export const UpdateTodoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  priority: z.enum(["high", "medium", "low"] as const).optional(),
  status: z.enum(["not_started", "started", "complete"] as const).optional(),
  due_date: z.string().date().nullable().optional(),
  sort_order: z.number().int().optional(),
});

export const ReorderTodosSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid(),
      sort_order: z.number().int().nonnegative(),
    }),
  ),
});

export const DeleteTodoSchema = z.object({
  id: z.string().uuid(),
});

export const GetTodoSchema = z.object({
  id: z.string().uuid(),
});

export const getTodos = createServerFn({ method: "GET" }).handler(async (): Promise<Todo[]> => {
  const { data, error } = await getSupabaseAdmin()
    .from("todos")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Failed to fetch todos: ${error.message}`);
  return data ?? [];
});

export const getTodo = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(GetTodoSchema))
  .handler(async ({ data }): Promise<Todo> => {
    const { data: todo, error } = await getSupabaseAdmin()
      .from("todos")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(`Failed to fetch todo: ${error.message}`);
    return todo;
  });

export const createTodo = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(CreateTodoSchema))
  .handler(async ({ data }): Promise<Todo> => {
    // Assign sort_order as max + 1 within the same priority group
    const { data: maxRow } = await getSupabaseAdmin()
      .from("todos")
      .select("sort_order")
      .eq("priority", data.priority)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();
    const sort_order = maxRow ? maxRow.sort_order + 1 : 0;
    const { data: todo, error } = await getSupabaseAdmin()
      .from("todos")
      .insert({ ...data, sort_order })
      .select()
      .single();
    if (error) throw new Error(`Failed to create todo: ${error.message}`);
    return todo;
  });

export const updateTodo = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(UpdateTodoSchema))
  .handler(async ({ data }): Promise<Todo> => {
    const { id, ...fields } = data;
    const { data: todo, error } = await getSupabaseAdmin()
      .from("todos")
      .update(fields)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update todo: ${error.message}`);
    return todo;
  });

export const deleteTodo = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(DeleteTodoSchema))
  .handler(async ({ data }): Promise<void> => {
    const { error } = await getSupabaseAdmin().from("todos").delete().eq("id", data.id);
    if (error) throw new Error(`Failed to delete todo: ${error.message}`);
  });

export const reorderTodos = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(ReorderTodosSchema))
  .handler(async ({ data }): Promise<void> => {
    await Promise.all(
      data.updates.map(({ id, sort_order }) =>
        getSupabaseAdmin().from("todos").update({ sort_order }).eq("id", id),
      ),
    );
  });
