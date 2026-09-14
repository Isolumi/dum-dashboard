import type { z } from "zod";

import type { Todo } from "#/lib/database.types";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import {
  CreateTodoSchema,
  MoveTodoSchema,
  ReorderTodosSchema,
  TODO_COLUMNS,
  type TodoListFilters,
  type TodoSection,
  UpdateTodoSchema,
  normalizeCreateTodoFields,
  normalizeUpdateTodoFields,
} from "./todo.schemas";

export type TodoDomainErrorCode = "not_found" | "conflict" | "database_unavailable";

export class TodoDomainError extends Error {
  constructor(public readonly code: TodoDomainErrorCode) {
    super(
      code === "not_found"
        ? "Todo not found"
        : code === "conflict"
          ? "Todo changed; retry the request"
          : "Todo service unavailable",
    );
    this.name = "TodoDomainError";
  }
}

type DatabaseError = {
  code?: string;
};

function throwDatabaseError(error: DatabaseError): never {
  if (error.code === "40001") throw new TodoDomainError("conflict");
  if (error.code === "P0002") throw new TodoDomainError("not_found");
  throw new TodoDomainError("database_unavailable");
}

function requireTodo(todo: Todo | null): Todo {
  if (!todo) throw new TodoDomainError("not_found");
  return todo;
}

export async function listTodoRecords(filters: TodoListFilters = {}): Promise<Todo[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("todos").select(TODO_COLUMNS);

  const status = filters.status ?? "incomplete";
  if (status === "incomplete") query = query.neq("status", "complete");
  if (status === "complete") query = query.eq("status", "complete");

  if (filters.section === "today") {
    query = query.not("today_date", "is", null);
  } else if (filters.section) {
    query = query.is("today_date", null).eq("priority", filters.section);
  }

  const nameQuery = filters.query?.trim().slice(0, 100);
  if (nameQuery) query = query.ilike("name", `%${nameQuery}%`);

  const limit = Math.min(Math.max(Math.trunc(filters.limit ?? 50), 1), 50);
  const { data, error } = await query.order("sort_order", { ascending: true }).limit(limit);
  if (error) throwDatabaseError(error);
  return data ?? [];
}

export async function getTodoRecord(id: string): Promise<Todo> {
  const { data, error } = await getSupabaseAdmin()
    .from("todos")
    .select(TODO_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throwDatabaseError(error);
  return requireTodo(data);
}

export async function createTodoRecord(input: z.infer<typeof CreateTodoSchema>): Promise<Todo> {
  const admin = getSupabaseAdmin();
  const todoFields = normalizeCreateTodoFields(input);
  const { data: maxRow, error: maxError } = await admin
    .from("todos")
    .select("sort_order")
    .eq("priority", todoFields.priority)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) throwDatabaseError(maxError);

  const sort_order = maxRow ? maxRow.sort_order + 1 : 0;
  const { data, error } = await admin
    .from("todos")
    .insert({ ...todoFields, sort_order })
    .select(TODO_COLUMNS)
    .single();
  if (error) throwDatabaseError(error);
  return data;
}

export async function updateTodoRecord(input: z.infer<typeof UpdateTodoSchema>): Promise<Todo> {
  const { id, ...fields } = normalizeUpdateTodoFields(input);
  const { data, error } = await getSupabaseAdmin()
    .from("todos")
    .update(fields)
    .eq("id", id)
    .select(TODO_COLUMNS)
    .maybeSingle();
  if (error) throwDatabaseError(error);
  return requireTodo(data);
}

export async function deleteTodoRecord(id: string): Promise<Todo> {
  const { data, error } = await getSupabaseAdmin()
    .from("todos")
    .delete()
    .eq("id", id)
    .select(TODO_COLUMNS)
    .maybeSingle();
  if (error) throwDatabaseError(error);
  return requireTodo(data);
}

export async function reorderTodoRecords(input: z.infer<typeof ReorderTodosSchema>): Promise<void> {
  const { error } = await getSupabaseAdmin().rpc("reorder_todo_section_atomically", {
    p_section: input.section,
    p_expected_ids: input.expected_ids,
    p_ordered_ids: input.ordered_ids,
  });
  if (error) throwDatabaseError(error);
}

export async function moveTodoRecord(input: z.infer<typeof MoveTodoSchema>): Promise<void> {
  const { error } = await getSupabaseAdmin().rpc("move_todo_between_sections", {
    p_todo_id: input.id,
    p_target_section: input.target_section,
    p_source_ids: input.source_ids,
    p_target_ids: input.target_ids,
  });
  if (error) throwDatabaseError(error);
}

function todoSection(todo: Todo): TodoSection {
  return todo.today_date !== null ? "today" : todo.priority;
}

async function listAllTodoRecords(): Promise<Todo[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("todos")
    .select(TODO_COLUMNS)
    .order("sort_order", { ascending: true });
  if (error) throwDatabaseError(error);
  return data ?? [];
}

export async function moveTodoRecordToSectionEnd(id: string, target: TodoSection): Promise<Todo> {
  const todos = await listAllTodoRecords();
  const current = todos.find((todo) => todo.id === id);
  if (!current) throw new TodoDomainError("not_found");

  const source = todoSection(current);
  if (source === target) return current;

  const source_ids = todos
    .filter((todo) => todo.id !== id && todoSection(todo) === source)
    .map((todo) => todo.id);
  const target_ids = [
    ...todos.filter((todo) => todoSection(todo) === target).map((todo) => todo.id),
    id,
  ];

  await moveTodoRecord({ id, target_section: target, source_ids, target_ids });
  return await getTodoRecord(id);
}
