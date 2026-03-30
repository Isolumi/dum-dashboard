export interface AddTodoRowProps {
  onCreate: (fields: {
    name: string;
    priority: "high" | "medium" | "low";
    due_date: string | null;
  }) => void;
}

export function AddTodoRow({ onCreate: _onCreate }: AddTodoRowProps) {
  return (
    <div className="flex items-center gap-2 px-4 min-h-[44px] text-sm italic text-muted-foreground">
      + Add a todo...
    </div>
  );
}
