begin;

alter table public.todos
  alter column due_date type timestamptz
  using case
    when due_date is null then null
    else due_date::timestamp at time zone 'UTC'
  end;

commit;
