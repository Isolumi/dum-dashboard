---
phase: quick
plan: 260402-vwa
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/database.types.ts
  - src/routes/todos/todos.functions.ts
  - src/routes/_layout/todos/index.tsx
  - src/routes/_layout/todos/-TodoRow.tsx
  - src/routes/_layout/todos/-AddTodoRow.tsx
  - src/routes/_layout/todos/-PrioritySection.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Todos are visually grouped into three sections: High, Medium, Low"
    - "User can drag a todo within its priority section to reorder"
    - "Reorder persists across page refresh (stored in DB)"
    - "AddTodoRow appears within its matching priority section"
  artifacts:
    - path: "src/routes/_layout/todos/-PrioritySection.tsx"
      provides: "Draggable section container for a single priority group"
    - path: "src/routes/todos/todos.functions.ts"
      provides: "reorderTodos server function + sort_order support"
      exports: ["reorderTodos"]
  key_links:
    - from: "src/routes/_layout/todos/index.tsx"
      to: "src/routes/_layout/todos/-PrioritySection.tsx"
      via: "renders three PrioritySection components (high, medium, low)"
    - from: "src/routes/_layout/todos/-PrioritySection.tsx"
      to: "@dnd-kit/sortable"
      via: "SortableContext wrapping todo items"
    - from: "src/routes/_layout/todos/index.tsx"
      to: "src/routes/todos/todos.functions.ts"
      via: "calls reorderTodos after drag end"
---

<objective>
Split the todo list into three priority-grouped sections (High, Medium, Low) with drag-and-drop reordering within each section.

Purpose: Improve todo organization by visually separating priorities and allowing manual ordering within each group.
Output: Grouped, draggable todo list with persisted sort order.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@src/routes/_layout/todos/index.tsx
@src/routes/_layout/todos/-TodoRow.tsx
@src/routes/_layout/todos/-AddTodoRow.tsx
@src/routes/todos/todos.functions.ts
@src/lib/database.types.ts
@src/hooks/useTodosRealtime.ts

<interfaces>
From src/lib/database.types.ts:
```typescript
export type Todo = Database["public"]["Tables"]["todos"]["Row"];
// Row: { id: string; name: string; priority: "high"|"medium"|"low"; status: "not_started"|"started"|"complete"; due_date: string|null; created_at: string }
export type TodoPriority = Database["public"]["Enums"]["todo_priority"]; // "high"|"medium"|"low"
export type TodoStatus = Database["public"]["Enums"]["todo_status"];
```

From src/routes/todos/todos.functions.ts:
```typescript
export const getTodos = createServerFn({ method: "GET" }).handler(async (): Promise<Todo[]> => { ... });
export const createTodo = createServerFn({ method: "POST" })...;
export const updateTodo = createServerFn({ method: "POST" })...;
export const deleteTodo = createServerFn({ method: "POST" })...;
```

From src/routes/_layout/todos/-TodoRow.tsx:
```typescript
export interface TodoRowProps {
  todo: Todo;
  onUpdate: (fields: { id: string; name?: string; priority?: "high"|"medium"|"low"; status?: "not_started"|"started"|"complete"; due_date?: string|null }) => void;
  onDelete: (id: string) => void;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add sort_order column + reorder server function + install dnd-kit</name>
  <files>src/lib/database.types.ts, src/routes/todos/todos.functions.ts</files>
  <action>
**1. Add sort_order column to Supabase todos table via a server function migration.**

Create a one-time migration server function in `todos.functions.ts` (or run directly via supabaseAdmin). The column:
- `sort_order integer not null default 0`
- Add to todos table

Actually, since there's no migration system, add the column via a SQL statement executed through supabaseAdmin. Create a `migrateSortOrder` server function that:
1. Runs `ALTER TABLE todos ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0`
2. Backfills existing rows: `UPDATE todos SET sort_order = row_number OVER (PARTITION BY priority ORDER BY created_at ASC) WHERE sort_order = 0` (uses window function to set initial order per priority group)

NOTE: The executor should run this migration function once, then it can be removed or left as idempotent.

**2. Update database.types.ts** to include `sort_order: number` in the Todo Row, Insert, and Update types.

**3. Update getTodos** to order by `priority` (high first, medium second, low third) then `sort_order ASC` within each priority group. Use `.order("sort_order", { ascending: true })`. Since we group by priority in the UI, just order by sort_order ascending -- the grouping happens client-side.

**4. Update createTodo** handler: before inserting, query the max `sort_order` for the given priority and set the new todo's `sort_order` to `max + 1` (so it appears at the bottom of its priority section). If no todos exist for that priority, set `sort_order` to 0.

**5. Add reorderTodos server function:**
```typescript
export const ReorderTodosSchema = z.object({
  updates: z.array(z.object({
    id: z.string().uuid(),
    sort_order: z.number().int().nonneg(),
  })),
});

export const reorderTodos = createServerFn({ method: "POST" })
  .inputValidator(zodValidator(ReorderTodosSchema))
  .handler(async ({ data }) => {
    // Batch update all sort_orders. Use Promise.all for parallel updates.
    await Promise.all(
      data.updates.map(({ id, sort_order }) =>
        supabaseAdmin.from("todos").update({ sort_order }).eq("id", id)
      )
    );
  });
```

**6. Update UpdateTodoSchema** to include optional `sort_order: z.number().int().optional()`.

**7. Install @dnd-kit/core and @dnd-kit/sortable:**
Run `bun add @dnd-kit/core @dnd-kit/sortable`

These are the standard React DnD libraries -- lightweight, accessible, and composable. No alternatives needed.
  </action>
  <verify>
    <automated>cd /Users/isolumi/Documents/CS/dum-dashboard && bun run build 2>&1 | tail -5</automated>
  </verify>
  <done>sort_order field in database.types.ts, getTodos ordered by sort_order, createTodo assigns sort_order, reorderTodos server function exists, @dnd-kit installed</done>
</task>

<task type="auto">
  <name>Task 2: Create PrioritySection component and refactor TodosPage for grouped drag-and-drop</name>
  <files>src/routes/_layout/todos/-PrioritySection.tsx, src/routes/_layout/todos/index.tsx, src/routes/_layout/todos/-TodoRow.tsx, src/routes/_layout/todos/-AddTodoRow.tsx</files>
  <action>
**1. Create `-PrioritySection.tsx`** -- a component that renders a single priority group with drag-and-drop reordering.

```tsx
// Key structure:
interface PrioritySectionProps {
  priority: TodoPriority;
  label: string;
  todos: Todo[];
  onUpdate: TodoRowProps["onUpdate"];
  onDelete: TodoRowProps["onDelete"];
  onCreate: AddTodoRowProps["onCreate"];
  onReorder: (priority: TodoPriority, orderedIds: string[]) => void;
}
```

Each PrioritySection:
- Has a section header showing the priority label (e.g., "High", "Medium", "Low") with a count badge. Use semantic color tokens matching existing PRIORITY_STYLES (destructive for high, amber for medium, muted for low). The header should be a subtle label, not visually heavy -- use `text-sm font-medium uppercase tracking-wider text-muted-foreground` style.
- Wraps its todo items in `<DndContext>` + `<SortableContext>` from @dnd-kit
- Uses `verticalListSortingStrategy` from @dnd-kit/sortable
- On `onDragEnd`, computes new order and calls `onReorder(priority, newOrderedIds)`
- Renders `<AddTodoRow>` at the bottom of each section (the AddTodoRow's priority should be pre-set to match the section's priority, so new todos created in the High section default to High priority)
- When the section has no todos and AddTodoRow is collapsed, show a minimal empty state: just the AddTodoRow placeholder

Use `@dnd-kit/sortable`'s `useSortable` hook. Create a thin `SortableTodoRow` wrapper:
```tsx
function SortableTodoRow({ todo, onUpdate, onDelete }: TodoRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes}
      className={cn(isDragging && "opacity-50 z-10")}
    >
      <TodoRow todo={todo} onUpdate={onUpdate} onDelete={onDelete} dragListeners={listeners} />
    </div>
  );
}
```

Use `closestCenter` collision detection and `restrictToVerticalAxis` modifier (from `@dnd-kit/modifiers` -- install if needed, or use `@dnd-kit/core`'s built-in). If `@dnd-kit/modifiers` is not needed, skip it and let vertical sorting handle naturally.

Use `KeyboardSensor` and `PointerSensor` from `@dnd-kit/core` for accessibility.

**2. Update `-TodoRow.tsx`** to accept an optional `dragListeners` prop and render a drag handle.

Add to TodoRowProps:
```typescript
dragListeners?: SyntheticListenerMap; // from @dnd-kit/core
```

Add a drag handle as the leftmost element (before the status icon). Use the `GripVertical` icon from lucide-react. The handle should:
- Be visible on hover (same pattern as delete button: `opacity-0 group-hover:opacity-100`)
- Apply `{...dragListeners}` to the handle element
- Use `cursor-grab` (and `cursor-grabbing` during drag via parent)
- Be `text-muted-foreground` color

**3. Update `-AddTodoRow.tsx`** to accept an optional `defaultPriority` prop.

When `defaultPriority` is provided:
- Initialize the priority state to `defaultPriority` instead of "low"
- Still allow the user to change priority via the popover (in case they want a different one)

**4. Refactor `index.tsx` (TodosPage):**

Replace the flat todo list with three `<PrioritySection>` components:

```tsx
const PRIORITY_ORDER: TodoPriority[] = ["high", "medium", "low"];

// Group todos by priority
const grouped = useMemo(() => {
  const groups: Record<TodoPriority, Todo[]> = { high: [], medium: [], low: [] };
  for (const todo of todos) {
    groups[todo.priority].push(todo);
  }
  // Each group is already sorted by sort_order from server
  return groups;
}, [todos]);
```

Render:
```tsx
{PRIORITY_ORDER.map((p) => (
  <PrioritySection
    key={p}
    priority={p}
    label={PRIORITY_LABELS[p]}
    todos={grouped[p]}
    onUpdate={handleUpdate}
    onDelete={handleDelete}
    onCreate={handleCreate}
    onReorder={handleReorder}
  />
))}
```

Add `handleReorder` function:
```tsx
async function handleReorder(priority: TodoPriority, orderedIds: string[]) {
  // Optimistic: reorder local state
  setTodos(prev => {
    const otherTodos = prev.filter(t => t.priority !== priority);
    const reordered = orderedIds
      .map((id, i) => {
        const todo = prev.find(t => t.id === id);
        return todo ? { ...todo, sort_order: i } : null;
      })
      .filter(Boolean) as Todo[];
    return [...otherTodos, ...reordered];
  });

  // Persist
  try {
    await reorderTodos({
      data: { updates: orderedIds.map((id, i) => ({ id, sort_order: i })) },
    });
  } catch {
    // Revert on failure
    const fresh = await getTodos();
    setTodos(fresh);
    setMutationError("Reorder failed -- check your connection and try again.");
  }
}
```

Remove the old `<AddTodoRow>` at the top of the list. Each PrioritySection now has its own AddTodoRow.

Remove the old empty state that shows when `todos.length === 0` -- each section handles its own empty state implicitly (just the AddTodoRow placeholder).

Keep the `useTodosRealtime` hook, error states, and loading state as-is.

Update `handleCreate` to pass the priority from the section's AddTodoRow (this already works since AddTodoRow passes the priority in its `onCreate` callback).

**5. Add necessary imports** to all files. Use `#/` alias for project imports.

**Styling notes (FOUN-02 compliance):**
- All colors via semantic tokens (bg-accent, text-muted-foreground, text-destructive, etc.)
- No hardcoded hex/rgb values
- Use `gap-*` not `space-y-*` per shadcn skill rules
- Use `cn()` for conditional classes
- Use `size-*` for equal width/height
  </action>
  <verify>
    <automated>cd /Users/isolumi/Documents/CS/dum-dashboard && bun run build 2>&1 | tail -5</automated>
  </verify>
  <done>Three priority sections (High/Medium/Low) rendered on the todos page. Each section has its own AddTodoRow defaulting to that section's priority. Todos within each section are draggable and reorderable. Drag handle visible on hover. Reorder persists to database via reorderTodos server function with optimistic UI updates.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Drag-and-drop reorderable todo list split into three priority sections (High, Medium, Low). Each section has its own "Add a todo" row. Dragging a todo within a section reorders it, and the new order persists across page refresh.</what-built>
  <how-to-verify>
    1. Run `bun run dev` and navigate to the Todos page
    2. Verify todos are grouped into three sections: High, Medium, Low (each with a section header)
    3. Hover over a todo row -- a drag handle (grip icon) should appear on the left
    4. Drag a todo within its priority section to reorder it
    5. Refresh the page -- the new order should persist
    6. Click "Add a todo" within the High section -- the default priority should be "High"
    7. Create a new todo in the Low section -- it should appear at the bottom of the Low group
    8. Verify existing functionality still works: status toggle, name editing, priority change, date picker, delete
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `bun run build` succeeds without errors
- Three priority sections render on the todos page
- Drag-and-drop reorders within a section
- Sort order persists to the database (sort_order column)
- AddTodoRow in each section defaults to that section's priority
- All existing todo CRUD functionality preserved
</verification>

<success_criteria>
- Todos visually split into High / Medium / Low sections with headers
- Drag handle appears on hover, drag reorders within section
- New sort order persists across page refresh
- AddTodoRow per section with correct default priority
- No regressions to existing todo features (create, update, delete, status toggle, date picker)
</success_criteria>

<output>
After completion, create `.planning/quick/260402-vwa-the-todos-should-be-draggable-and-reorde/260402-vwa-SUMMARY.md`
</output>
