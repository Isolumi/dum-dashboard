import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { supabase } from "#/lib/supabase";
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
});

export const DeleteTodoSchema = z.object({
  id: z.string().uuid(),
});

export const GetTodoSchema = z.object({
  id: z.string().uuid(),
});

export const getTodos = createServerFn({ method: "GET" }).handler(async (): Promise<Todo[]> => {
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to fetch todos: ${error.message}`);
  return data ?? [];
});

export const getTodo = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(GetTodoSchema))
  .handler(async ({ data }): Promise<Todo> => {
    const { data: todo, error } = await supabase
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
    const { data: todo, error } = await supabase.from("todos").insert(data).select().single();
    if (error) throw new Error(`Failed to create todo: ${error.message}`);
    return todo;
  });

export const updateTodo = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(UpdateTodoSchema))
  .handler(async ({ data }): Promise<Todo> => {
    const { id, ...fields } = data;
    const { data: todo, error } = await supabase
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
    const { error } = await supabase.from("todos").delete().eq("id", data.id);
    if (error) throw new Error(`Failed to delete todo: ${error.message}`);
  });
