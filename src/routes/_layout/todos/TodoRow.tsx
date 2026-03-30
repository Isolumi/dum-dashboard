import type { Todo } from "#/lib/database.types";

export interface TodoRowProps {
  todo: Todo;
  onUpdate: (fields: {
    id: string;
    name?: string;
    priority?: "high" | "medium" | "low";
    status?: "not_started" | "started" | "complete";
    due_date?: string | null;
  }) => void;
  onDelete: (id: string) => void;
}

export function TodoRow({ todo }: TodoRowProps) {
  return (
    <div className="flex items-center gap-2 px-4 min-h-[44px]">
      <span className="text-base">{todo.name}</span>
    </div>
  );
}
