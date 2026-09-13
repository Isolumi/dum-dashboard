begin;

alter table public.todos
add column today_date date,
add column today_sort_order integer;

alter table public.todos
add constraint todos_today_sort_order_nonnegative
check (today_sort_order is null or today_sort_order >= 0);

create function public.reorder_todo_section_atomically(
  p_section text,
  p_expected_ids uuid[],
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actual_ids uuid[];
  expected_set uuid[];
  ordered_set uuid[];
  updated_count integer;
begin
  if p_section is null or p_section not in ('today', 'high', 'low') then
    raise exception using errcode = '22023', message = 'Todo section must be today, high, or low';
  end if;

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

  lock table public.todos in share row exclusive mode;

  if p_section = 'today' then
    select coalesce(
      array_agg(todo.id order by todo.today_sort_order nulls last, todo.id),
      array[]::uuid[]
    )
    into actual_ids
    from public.todos as todo
    where todo.today_date is not null;
  else
    select coalesce(array_agg(todo.id order by todo.sort_order, todo.id), array[]::uuid[])
    into actual_ids
    from public.todos as todo
    where todo.today_date is null and todo.priority::text = p_section;
  end if;

  if actual_ids is distinct from p_expected_ids then
    raise exception using errcode = '40001', message = 'Todo order is stale';
  end if;

  if p_section = 'today' then
    update public.todos as todo
    set today_sort_order = desired.sort_order
    from (
      select ordered_id.id, (ordered_id.ordinality - 1)::integer as sort_order
      from unnest(p_ordered_ids) with ordinality as ordered_id(id, ordinality)
    ) as desired
    where todo.id = desired.id and todo.today_date is not null;
  else
    update public.todos as todo
    set sort_order = desired.sort_order
    from (
      select ordered_id.id, (ordered_id.ordinality - 1)::integer as sort_order
      from unnest(p_ordered_ids) with ordinality as ordered_id(id, ordinality)
    ) as desired
    where todo.id = desired.id
      and todo.today_date is null
      and todo.priority::text = p_section;
  end if;

  get diagnostics updated_count = row_count;
  if updated_count <> cardinality(p_ordered_ids) then
    raise exception using errcode = '40001', message = 'Todo set changed during reorder';
  end if;
end;
$$;

revoke execute on function public.reorder_todo_section_atomically(text, uuid[], uuid[])
from public, anon, authenticated;

grant execute on function public.reorder_todo_section_atomically(text, uuid[], uuid[])
to service_role;

create function public.move_todo_between_sections(
  p_todo_id uuid,
  p_target_section text,
  p_source_ids uuid[],
  p_target_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_section text;
  actual_source_ids uuid[];
  actual_target_ids uuid[];
  supplied_source_ids uuid[];
  supplied_target_ids uuid[];
  source_updated_count integer;
  target_updated_count integer;
begin
  if p_todo_id is null
    or p_target_section is null
    or p_target_section not in ('today', 'high', 'low') then
    raise exception using errcode = '22023', message = 'Moved Todo id and a valid target section are required';
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
    select count(distinct source_id.id)::integer from unnest(p_source_ids) as source_id(id)
  ) or cardinality(p_target_ids) <> (
    select count(distinct target_id.id)::integer from unnest(p_target_ids) as target_id(id)
  ) then
    raise exception using errcode = '22023', message = 'Todo orders cannot contain duplicate ids';
  end if;

  if p_todo_id = any(p_source_ids)
    or not (p_todo_id = any(p_target_ids))
    or p_source_ids && p_target_ids then
    raise exception using errcode = '22023', message = 'Moved Todo must occur once in only the target order';
  end if;

  lock table public.todos in share row exclusive mode;

  select case when todo.today_date is not null then 'today' else todo.priority::text end
  into source_section
  from public.todos as todo
  where todo.id = p_todo_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Moved Todo does not exist';
  end if;

  if source_section = p_target_section then
    raise exception using errcode = '22023', message = 'Source and target Todo sections must differ';
  end if;

  if source_section = 'today' then
    select coalesce(
      array_agg(todo.id order by todo.today_sort_order nulls last, todo.id),
      array[]::uuid[]
    )
    into actual_source_ids
    from public.todos as todo
    where todo.today_date is not null and todo.id <> p_todo_id;
  else
    select coalesce(array_agg(todo.id order by todo.sort_order, todo.id), array[]::uuid[])
    into actual_source_ids
    from public.todos as todo
    where todo.today_date is null
      and todo.priority::text = source_section
      and todo.id <> p_todo_id;
  end if;

  if p_target_section = 'today' then
    select coalesce(
      array_agg(todo.id order by todo.today_sort_order nulls last, todo.id),
      array[]::uuid[]
    )
    into actual_target_ids
    from public.todos as todo
    where todo.today_date is not null;
  else
    select coalesce(array_agg(todo.id order by todo.sort_order, todo.id), array[]::uuid[])
    into actual_target_ids
    from public.todos as todo
    where todo.today_date is null and todo.priority::text = p_target_section;
  end if;

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

  if source_section = 'today' then
    update public.todos as todo
    set today_sort_order = desired.sort_order
    from (
      select source_id.id, (source_id.ordinality - 1)::integer as sort_order
      from unnest(p_source_ids) with ordinality as source_id(id, ordinality)
    ) as desired
    where todo.id = desired.id and todo.today_date is not null;
  else
    update public.todos as todo
    set sort_order = desired.sort_order
    from (
      select source_id.id, (source_id.ordinality - 1)::integer as sort_order
      from unnest(p_source_ids) with ordinality as source_id(id, ordinality)
    ) as desired
    where todo.id = desired.id
      and todo.today_date is null
      and todo.priority::text = source_section;
  end if;

  get diagnostics source_updated_count = row_count;

  if p_target_section = 'today' then
    update public.todos as todo
    set
      today_date = (current_timestamp at time zone 'America/Toronto')::date,
      today_sort_order = desired.sort_order
    from (
      select target_id.id, (target_id.ordinality - 1)::integer as sort_order
      from unnest(p_target_ids) with ordinality as target_id(id, ordinality)
    ) as desired
    where todo.id = desired.id;
  else
    update public.todos as todo
    set
      priority = p_target_section::public.todo_priority,
      sort_order = desired.sort_order,
      today_date = null,
      today_sort_order = null
    from (
      select target_id.id, (target_id.ordinality - 1)::integer as sort_order
      from unnest(p_target_ids) with ordinality as target_id(id, ordinality)
    ) as desired
    where todo.id = desired.id;
  end if;

  get diagnostics target_updated_count = row_count;

  if source_updated_count <> cardinality(p_source_ids)
    or target_updated_count <> cardinality(p_target_ids) then
    raise exception using errcode = '40001', message = 'Affected Todo set changed during move';
  end if;
end;
$$;

revoke execute on function public.move_todo_between_sections(uuid, text, uuid[], uuid[])
from public, anon, authenticated;

grant execute on function public.move_todo_between_sections(uuid, text, uuid[], uuid[])
to service_role;

commit;
