begin;

alter table public.todos
  add column due_date_has_time boolean not null default false,
  alter column due_date type timestamptz
  using case
    when due_date is null then null
    else due_date::timestamp at time zone 'UTC'
  end;

notify pgrst, 'reload schema';

commit;
