begin;

alter table public.todos alter column priority drop default;

with low_max as (
  select coalesce(max(sort_order), -1) as value
  from public.todos
  where priority = 'low'
),
medium_order as (
  select
    id,
    row_number() over (order by sort_order, created_at, id) - 1 as offset
  from public.todos
  where priority = 'medium'
)
update public.todos as todo
set
  priority = 'low',
  sort_order = low_max.value + 1 + medium_order.offset
from low_max, medium_order
where todo.id = medium_order.id;

alter type public.todo_priority rename to todo_priority_old;
create type public.todo_priority as enum ('high', 'low');

alter table public.todos
  alter column priority type public.todo_priority
  using priority::text::public.todo_priority;

alter table public.todos
  alter column priority set default 'low'::public.todo_priority;

drop type public.todo_priority_old;

notify pgrst, 'reload schema';

commit;
