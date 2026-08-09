import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { assertSameOrigin, getOwnerUser, noStore } from "#/lib/server-auth";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import type { Todo } from "#/lib/database.types";

const TODO_COLUMNS = "id,name,status,priority,due_date,sort_order,created_at" as const;

const TodoDueDateSchema = z.union([z.string().date(), z.string().datetime({ offset: true })]);

export const CreateTodoSchema = z.object({
  name: z.string().trim().min(1).max(200),
  priority: z.enum(["high", "low"] as const).default("low"),
  status: z.enum(["not_started", "started", "complete"] as const).default("not_started"),
  due_date: TodoDueDateSchema.nullable().optional(),
});

export const UpdateTodoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  priority: z.enum(["high", "low"] as const).optional(),
  status: z.enum(["not_started", "started", "complete"] as const).optional(),
  due_date: TodoDueDateSchema.nullable().optional(),
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

export const GetTodosInputSchema = z.object({}).strict();

export const GetTodoInputSchema = GetTodoSchema.strict();

export const CreateTodoInputSchema = CreateTodoSchema.strict();

export const UpdateTodoInputSchema = UpdateTodoSchema.strict();

export const DeleteTodoInputSchema = DeleteTodoSchema.strict();

export const ReorderTodosInputSchema = ReorderTodosSchema.strict();

export function assertTodoMutationRequest(): void {
  assertSameOrigin();
}

export const getTodos = createServerFn({ method: "POST" }).handler(async (): Promise<Todo[]> => {
  noStore();
  getOwnerUser();
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
    getOwnerUser();
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
    assertTodoMutationRequest();
    const todoFields = data;
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
    assertTodoMutationRequest();
    const { id, ...fields } = data;
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
    assertTodoMutationRequest();
    const { error } = await getSupabaseAdmin().from("todos").delete().eq("id", data.id);
    if (error) throw new Error(`Failed to delete todo: ${error.message}`);
  });

export const reorderTodos = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(ReorderTodosInputSchema))
  .handler(async ({ data }): Promise<void> => {
    noStore();
    assertTodoMutationRequest();
    const results = await Promise.all(
      data.updates.map(({ id, sort_order }) =>
        getSupabaseAdmin().from("todos").update({ sort_order }).eq("id", id),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw new Error(`Failed to reorder todos: ${failed.error.message}`);
  });
