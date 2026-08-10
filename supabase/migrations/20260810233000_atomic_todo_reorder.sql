begin;

create function public.reorder_todos_atomically(
  p_expected_ids uuid[],
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ordered_priority public.todo_priority;
  actual_ids uuid[];
  expected_set uuid[];
  ordered_set uuid[];
  updated_count integer;
begin
  if p_expected_ids is null or p_ordered_ids is null then
    raise exception using errcode = '22023', message = 'Expected and requested Todo orders are required';
  end if;

  if cardinality(p_expected_ids) = 0
    or cardinality(p_expected_ids) > 200
    or cardinality(p_ordered_ids) = 0
    or cardinality(p_ordered_ids) > 200
    or cardinality(p_expected_ids) <> cardinality(p_ordered_ids) then
    raise exception using errcode = '22023', message = 'Todo orders must contain the same 1 to 200 ids';
  end if;

  if exists (select 1 from unnest(p_expected_ids) as expected_id(id) where expected_id.id is null)
    or exists (select 1 from unnest(p_ordered_ids) as ordered_id(id) where ordered_id.id is null) then
    raise exception using errcode = '22023', message = 'Todo orders cannot contain null ids';
  end if;

  if cardinality(p_expected_ids) <> (
    select count(distinct expected_id.id)::integer
    from unnest(p_expected_ids) as expected_id(id)
  ) or cardinality(p_ordered_ids) <> (
    select count(distinct ordered_id.id)::integer
    from unnest(p_ordered_ids) as ordered_id(id)
  ) then
    raise exception using errcode = '22023', message = 'Todo orders cannot contain duplicate ids';
  end if;

  select coalesce(array_agg(expected_id.id order by expected_id.id), array[]::uuid[])
  into expected_set
  from unnest(p_expected_ids) as expected_id(id);

  select coalesce(array_agg(ordered_id.id order by ordered_id.id), array[]::uuid[])
  into ordered_set
  from unnest(p_ordered_ids) as ordered_id(id);

  if expected_set is distinct from ordered_set then
    raise exception using errcode = '22023', message = 'Expected and requested Todo orders must contain the same ids';
  end if;

  -- Serialize Todo ordering writes across browser tabs and app instances.
  lock table public.todos in share row exclusive mode;

  select todo.priority
  into ordered_priority
  from public.todos as todo
  where todo.id = p_expected_ids[1];

  if not found then
    raise exception using errcode = 'P0002', message = 'Ordered Todo does not exist';
  end if;

  perform todo.id
  from public.todos as todo
  where todo.priority = ordered_priority
  order by todo.id
  for update;

  select coalesce(array_agg(todo.id order by todo.sort_order, todo.id), array[]::uuid[])
  into actual_ids
  from public.todos as todo
  where todo.priority = ordered_priority;

  if actual_ids is distinct from p_expected_ids then
    raise exception using errcode = '40001', message = 'Todo order is stale';
  end if;

  update public.todos as todo
  set sort_order = desired.sort_order
  from (
    select
      ordered_id.id,
      (ordered_id.ordinality - 1)::integer as sort_order
    from unnest(p_ordered_ids) with ordinality as ordered_id(id, ordinality)
  ) as desired
  where todo.id = desired.id and todo.priority = ordered_priority;

  get diagnostics updated_count = row_count;
  if updated_count <> cardinality(p_ordered_ids) then
    raise exception using errcode = '40001', message = 'Todo set changed during reorder';
  end if;
end;
$$;

revoke execute on function public.reorder_todos_atomically(uuid[], uuid[])
from public, anon, authenticated;

grant execute on function public.reorder_todos_atomically(uuid[], uuid[])
to service_role;

-- Make cross-priority moves reject stale source or target ordering too.
create or replace function public.move_todo_between_priorities(
  p_todo_id uuid,
  p_target_priority public.todo_priority,
  p_source_ids uuid[],
  p_target_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_priority public.todo_priority;
  locked_source_priority public.todo_priority;
  actual_source_ids uuid[];
  actual_target_ids uuid[];
  supplied_source_ids uuid[];
  supplied_target_ids uuid[];
  updated_count integer;
begin
  if p_todo_id is null or p_target_priority is null then
    raise exception using errcode = '22023', message = 'Moved Todo id and target priority are required';
  end if;

  if p_source_ids is null or p_target_ids is null then
    raise exception using errcode = '22023', message = 'Source and target Todo orders are required';
  end if;

  if cardinality(p_source_ids) > 200
    or cardinality(p_target_ids) = 0
    or cardinality(p_target_ids) > 200 then
    raise exception using errcode = '22023', message = 'Todo orders must contain between 0 and 200 ids';
  end if;

  if exists (select 1 from unnest(p_source_ids) as source_id(id) where source_id.id is null)
    or exists (select 1 from unnest(p_target_ids) as target_id(id) where target_id.id is null) then
    raise exception using errcode = '22023', message = 'Todo orders cannot contain null ids';
  end if;

  if cardinality(p_source_ids) <> (
    select count(distinct source_id.id)::integer
    from unnest(p_source_ids) as source_id(id)
  ) or cardinality(p_target_ids) <> (
    select count(distinct target_id.id)::integer
    from unnest(p_target_ids) as target_id(id)
  ) then
    raise exception using errcode = '22023', message = 'Todo orders cannot contain duplicate ids';
  end if;

  if p_todo_id = any(p_source_ids)
    or not (p_todo_id = any(p_target_ids))
    or p_source_ids && p_target_ids then
    raise exception using errcode = '22023', message = 'Moved Todo must occur once in only the target order';
  end if;

  lock table public.todos in share row exclusive mode;

  select todo.priority
  into source_priority
  from public.todos as todo
  where todo.id = p_todo_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Moved Todo does not exist';
  end if;

  if source_priority = p_target_priority then
    raise exception using errcode = '22023', message = 'Source and target priorities must differ';
  end if;

  perform todo.id
  from public.todos as todo
  where todo.priority in (source_priority, p_target_priority)
  order by todo.id
  for update;

  select todo.priority
  into locked_source_priority
  from public.todos as todo
  where todo.id = p_todo_id;

  if not found or locked_source_priority <> source_priority then
    raise exception using errcode = '40001', message = 'Moved Todo priority is stale';
  end if;

  select coalesce(array_agg(todo.id order by todo.sort_order, todo.id), array[]::uuid[])
  into actual_source_ids
  from public.todos as todo
  where todo.priority = source_priority and todo.id <> p_todo_id;

  select coalesce(array_agg(todo.id order by todo.sort_order, todo.id), array[]::uuid[])
  into actual_target_ids
  from public.todos as todo
  where todo.priority = p_target_priority;

  select coalesce(array_agg(source_id.id order by source_id.ordinality), array[]::uuid[])
  into supplied_source_ids
  from unnest(p_source_ids) with ordinality as source_id(id, ordinality);

  select coalesce(array_agg(target_id.id order by target_id.ordinality), array[]::uuid[])
  into supplied_target_ids
  from unnest(p_target_ids) with ordinality as target_id(id, ordinality)
  where target_id.id <> p_todo_id;

  if actual_source_ids is distinct from supplied_source_ids
    or actual_target_ids is distinct from supplied_target_ids then
    raise exception using errcode = '40001', message = 'Source or target Todo order is stale';
  end if;

  update public.todos as todo
  set
    priority = desired.priority,
    sort_order = desired.sort_order
  from (
    select
      source_id.id,
      source_priority as priority,
      (source_id.ordinality - 1)::integer as sort_order
    from unnest(p_source_ids) with ordinality as source_id(id, ordinality)
    union all
    select
      target_id.id,
      p_target_priority as priority,
      (target_id.ordinality - 1)::integer as sort_order
    from unnest(p_target_ids) with ordinality as target_id(id, ordinality)
  ) as desired
  where todo.id = desired.id;

  get diagnostics updated_count = row_count;
  if updated_count <> cardinality(p_source_ids) + cardinality(p_target_ids) then
    raise exception using errcode = '40001', message = 'Affected Todo set changed during move';
  end if;
end;
$$;

revoke execute on function public.move_todo_between_priorities(
  uuid,
  public.todo_priority,
  uuid[],
  uuid[]
) from public, anon, authenticated;

grant execute on function public.move_todo_between_priorities(
  uuid,
  public.todo_priority,
  uuid[],
  uuid[]
) to service_role;

commit;
